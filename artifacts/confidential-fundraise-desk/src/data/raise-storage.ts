import { INITIAL_RAISES, type Raise } from './raises';

const STORAGE_KEY = 'confidential-fundraise-desk:raises:v1';
type SavedRaise = Pick<Raise, 'id' | 'claimed' | 'claim' | 'commitments'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSavedRaise(value: unknown): value is SavedRaise {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.claimed !== 'boolean') return false;
  if (value.claim !== undefined && (
    !isRecord(value.claim) ||
    typeof value.claim.founderName !== 'string' ||
    typeof value.claim.email !== 'string' ||
    (value.claim.vehicleLink !== undefined && typeof value.claim.vehicleLink !== 'string')
  )) return false;
  if (value.claimed && !value.claim) return false;
  return value.commitments === undefined || (
    Array.isArray(value.commitments) && value.commitments.every((item: unknown) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.identifier === 'string' &&
      typeof item.amount === 'number' && Number.isSafeInteger(item.amount) && item.amount > 0 &&
      typeof item.hard === 'boolean' &&
      (item.verified === undefined || typeof item.verified === 'boolean') &&
      (!item.verified || item.hard)
    )
  );
}

export function loadRaises(): { raises: Raise[]; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { raises: INITIAL_RAISES, error: '' };
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.every(isSavedRaise)) throw new Error('Invalid saved raises');
    return {
      raises: INITIAL_RAISES.map((raise) => {
        const state = saved.find((item) => item.id === raise.id);
        return state ? { ...raise, claimed: state.claimed, claim: state.claim, commitments: state.commitments } : raise;
      }),
      error: '',
    };
  } catch {
    return { raises: INITIAL_RAISES, error: 'Could not load saved raise data from this browser.' };
  }
}

export function saveRaises(raises: Raise[]) {
  const saved: SavedRaise[] = raises.map(({ id, claimed, claim, commitments }) => ({
    id, claimed, claim, commitments,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}
