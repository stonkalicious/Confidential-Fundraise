import { randomUUID } from "node:crypto";
import {
  GetRaiseByIdResponse,
  GetRaisesResponse,
  type ClaimRaiseInput,
  type CommitmentStatusInput,
  type RaiseSummary,
  type SoftCommitmentInput,
} from "@workspace/api-zod";

export const DEFAULT_RAISE_ID = "confidential-fundraise-thesis";

const seededRaises: RaiseSummary[] = [
  {
    id: DEFAULT_RAISE_ID,
    name: "Confidential Fundraise Thesis",
    thesis: "Fund-wide thesis for private money and confidential cross-chain settlement.",
    stage: "Fundraise",
    range: { min: 2_000_000, max: 5_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
    commitments: [],
  },
  {
    id: "cedar-grid",
    name: "AI Encyclopedia",
    thesis: "Each disputed fact becomes an ongoing market; AI writes a public page from the market’s current view.",
    stage: "Seed",
    range: { min: 1_000_000, max: 2_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
    commitments: [],
  },
  {
    id: "harbor-materials",
    name: "Private Social Trading",
    thesis: "Traders keep NEAR Intents positions private by default and share temporary viewing keys with selected followers; everyone else sees public PnL.",
    stage: "Pre-seed",
    range: { min: 500_000, max: 1_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
    commitments: [],
  },
  {
    id: "lumen-labs",
    name: "Universal Checkout Widget",
    thesis: "A single checkout button lets users pay with an existing wallet and chain through NEAR Intents.",
    stage: "Series A",
    range: { min: 3_000_000, max: 5_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
    commitments: [],
  },
  {
    id: "swarm-for-hire",
    name: "Swarm-for-Hire",
    thesis: "Job posters set a NEAR budget; others fund agent inference, and accepted work is paid from the budget.",
    stage: "Pre-seed",
    range: { min: 500_000, max: 1_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
    commitments: [],
  },
];

let raises = GetRaisesResponse.parse(seededRaises);

export type RaiseStoreResult =
  | { kind: "success"; raise: RaiseSummary; created?: boolean }
  | { kind: "notFound" }
  | { kind: "alreadyClaimed" }
  | { kind: "commitmentNotFound" }
  | { kind: "conflict" }
  | { kind: "invalidStatus" };

function snapshot(raise: RaiseSummary): RaiseSummary {
  return GetRaiseByIdResponse.parse(raise);
}

function updateTotals(raise: RaiseSummary) {
  raise.claimed = Boolean(raise.claim);
  raise.softTotal = raise.commitments.reduce(
    (total, commitment) => total + (commitment.hard ? 0 : commitment.amount),
    0,
  );
  raise.hardTotal = raise.commitments.reduce(
    (total, commitment) => total + (commitment.hard ? commitment.amount : 0),
    0,
  );
}

export function getRaises(): RaiseSummary[] {
  return GetRaisesResponse.parse(raises);
}

export function getRaise(id: string): RaiseSummary | undefined {
  const raise = raises.find((item) => item.id === id);
  return raise ? snapshot(raise) : undefined;
}

export function claimRaiseRecord(id: string, input: ClaimRaiseInput): RaiseStoreResult {
  const raise = raises.find((item) => item.id === id);
  if (!raise) return { kind: "notFound" };
  if (raise.claimed) return { kind: "alreadyClaimed" };

  const signatureOrAccount = input.signatureOrAccount?.trim();
  raise.claim = {
    founderName: input.founderName.trim(),
    email: input.email.trim(),
    ...(signatureOrAccount ? { signatureOrAccount } : {}),
  };
  updateTotals(raise);
  return { kind: "success", raise: snapshot(raise) };
}

export function submitSoftCommitmentRecord(
  id: string,
  input: SoftCommitmentInput,
): RaiseStoreResult {
  const raise = raises.find((item) => item.id === id);
  if (!raise) return { kind: "notFound" };

  const identifier = input.identifier.trim();
  const existing = input.id
    ? raise.commitments.find((commitment) => commitment.id === input.id)
    : undefined;
  if (existing) {
    if (existing.identifier !== identifier || existing.amount !== input.amount) {
      return { kind: "conflict" };
    }
    return { kind: "success", raise: snapshot(raise), created: false };
  }

  raise.commitments.push({
    id: input.id || randomUUID(),
    identifier,
    amount: input.amount,
    hard: false,
    verified: false,
  });
  updateTotals(raise);
  return { kind: "success", raise: snapshot(raise), created: true };
}

export function updateRaiseCommitmentRecord(
  id: string,
  commitmentId: string,
  input: CommitmentStatusInput,
): RaiseStoreResult {
  const raise = raises.find((item) => item.id === id);
  if (!raise) return { kind: "notFound" };
  if (input.verified && !input.hard) return { kind: "invalidStatus" };

  const commitment = raise.commitments.find((item) => item.id === commitmentId);
  if (!commitment) return { kind: "commitmentNotFound" };

  commitment.hard = input.hard;
  commitment.verified = input.verified;
  updateTotals(raise);
  return { kind: "success", raise: snapshot(raise) };
}
