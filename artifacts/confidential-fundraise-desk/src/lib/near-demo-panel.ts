export type NearDemoQuoteStatus = 'ready' | 'loading' | 'error' | 'success';

export interface NearDemoPanelInput {
  unlocked: boolean;
  session: { expiresAt: number } | null;
  sessionUnavailable: boolean;
  authLoading: boolean;
  authError: boolean;
  keyRegistrationPending: boolean;
  quoteStatus: NearDemoQuoteStatus | null;
  hasQuotedHardCommitment: boolean;
  confidentialityRequested: string | null;
  now: number;
}

export interface NearDemoPanelState {
  wallet: string;
  quote: string;
  confidentiality: string;
}

export function deriveNearDemoPanelState(input: NearDemoPanelInput): NearDemoPanelState {
  if (!input.unlocked) {
    return {
      wallet: 'Locked — unlock founder view',
      quote: 'Locked — unlock founder view',
      confidentiality: 'Not requested',
    };
  }
  const sessionActive = Boolean(input.session && input.session.expiresAt > input.now);
  let wallet: string;
  if (sessionActive) wallet = 'Authenticated';
  else if (input.authLoading) wallet = 'Checking…';
  else if (input.keyRegistrationPending) wallet = 'Key registration required';
  else if (input.sessionUnavailable) wallet = 'Temporarily unavailable';
  else if (input.session) wallet = 'Session expired';
  else if (input.authError) wallet = 'Not authenticated (last attempt failed)';
  else wallet = 'Not authenticated';

  const active = input.hasQuotedHardCommitment ? input.quoteStatus : null;
  const quote =
    active === 'success' ? 'Dry-run quote received'
    : active === 'loading' ? 'Requesting…'
    : active === 'error' ? 'Failed'
    : active === 'ready' ? 'Ready — not requested'
    : 'No hard commitment selected';

  const confidentiality =
    active === 'success' && input.confidentialityRequested === 'basic' ? 'basic'
    : active === 'loading' ? 'Pending'
    : 'Not requested';

  return { wallet, quote, confidentiality };
}
