import { randomUUID } from "node:crypto";
import {
  GetPendingRaisesResponse,
  GetPrivateRaiseResponse,
  GetRaiseByIdResponse,
  GetRaisesResponse,
  SubmitRaiseResponse,
  type ClaimRaiseInput,
  type CommitmentStatusInput,
  type PendingRaise,
  type PrivateRaiseDetails,
  type RaiseCommitment,
  type RaiseRange,
  type RaiseSubmissionInput,
  type RaiseSubmissionReceipt,
  type RaiseSummary,
  type SoftCommitmentInput,
} from "@workspace/api-zod";

export const DEFAULT_RAISE_ID = "confidential-fundraise-thesis";

type RaiseRecord = {
  id: string;
  name: string;
  thesis: string;
  stage: string;
  range: RaiseRange;
  status: "approved" | "pending";
  claim?: {
    founderName: string;
    email: string;
    signatureOrAccount?: string;
  };
  commitments: RaiseCommitment[];
  softTotal: number;
  hardTotal: number;
};

const seededRaises: RaiseRecord[] = [
  {
    id: DEFAULT_RAISE_ID,
    name: "Confidential Fundraise Thesis",
    thesis: "Fund-wide thesis for private money and confidential cross-chain settlement.",
    stage: "Fundraise",
    range: { min: 2_000_000, max: 5_000_000 },
    status: "approved",
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  },
  {
    id: "cedar-grid",
    name: "AI Encyclopedia",
    thesis: "Each disputed fact becomes an ongoing market; AI writes a public page from the market’s current view.",
    stage: "Seed",
    range: { min: 1_000_000, max: 2_000_000 },
    status: "approved",
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  },
  {
    id: "harbor-materials",
    name: "Private Social Trading",
    thesis: "Traders keep NEAR Intents positions private by default and share temporary viewing keys with selected followers; everyone else sees public PnL.",
    stage: "Pre-seed",
    range: { min: 500_000, max: 1_000_000 },
    status: "approved",
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  },
  {
    id: "lumen-labs",
    name: "Universal Checkout Widget",
    thesis: "A single checkout button lets users pay with an existing wallet and chain through NEAR Intents.",
    stage: "Series A",
    range: { min: 3_000_000, max: 5_000_000 },
    status: "approved",
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  },
  {
    id: "swarm-for-hire",
    name: "Swarm-for-Hire",
    thesis: "Job posters set a NEAR budget; others fund agent inference, and accepted work is paid from the budget.",
    stage: "Pre-seed",
    range: { min: 500_000, max: 1_000_000 },
    status: "approved",
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  },
];

let raises = [...seededRaises];

export type RaiseStoreResult =
  | { kind: "success"; raise: RaiseSummary; created?: boolean }
  | { kind: "notFound" }
  | { kind: "alreadyClaimed" }
  | { kind: "commitmentNotFound" }
  | { kind: "conflict" }
  | { kind: "invalidStatus" };

function publicSnapshot(raise: RaiseRecord): RaiseSummary {
  return GetRaiseByIdResponse.parse({
    id: raise.id,
    name: raise.name,
    thesis: raise.thesis,
    stage: raise.stage,
    range: raise.range,
    claimed: Boolean(raise.claim),
    ...(raise.claim ? { claimantName: raise.claim.founderName } : {}),
    softTotal: raise.softTotal,
    hardTotal: raise.hardTotal,
  });
}

function privateSnapshot(raise: RaiseRecord): PrivateRaiseDetails {
  return GetPrivateRaiseResponse.parse({
    ...publicSnapshot(raise),
    ...(raise.claim ? { claim: raise.claim } : {}),
    commitments: raise.commitments,
  });
}

function updateTotals(raise: RaiseRecord): void {
  raise.softTotal = raise.commitments.reduce(
    (total, commitment) => total + (commitment.hard ? 0 : commitment.amount),
    0,
  );
  raise.hardTotal = raise.commitments.reduce(
    (total, commitment) => total + (commitment.hard ? commitment.amount : 0),
    0,
  );
}

function findApprovedRaise(id: string): RaiseRecord | undefined {
  return raises.find((raise) => raise.id === id && raise.status === "approved");
}

export function getRaises(): RaiseSummary[] {
  return GetRaisesResponse.parse(
    raises.filter((raise) => raise.status === "approved").map(publicSnapshot),
  );
}

export function getRaise(id: string): RaiseSummary | undefined {
  const raise = findApprovedRaise(id);
  return raise ? publicSnapshot(raise) : undefined;
}

export function getPrivateRaise(id: string): PrivateRaiseDetails | undefined {
  const raise = findApprovedRaise(id);
  return raise ? privateSnapshot(raise) : undefined;
}

export function getPendingRaises(): PendingRaise[] {
  return GetPendingRaisesResponse.parse(
    raises
      .filter((raise) => raise.status === "pending")
      .map((raise) => ({
        id: raise.id,
        name: raise.name,
        thesis: raise.thesis,
        stage: raise.stage,
        range: raise.range,
        status: "pending" as const,
      })),
  );
}

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "raise";
}

export function submitRaiseRecord(input: RaiseSubmissionInput): RaiseSubmissionReceipt {
  const id = `${slugify(input.name)}-${randomUUID().slice(0, 8)}`;
  raises.push({
    id,
    name: input.name.trim(),
    thesis: input.thesis.trim(),
    stage: input.stage.trim(),
    range: input.range,
    status: "pending",
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  });
  return SubmitRaiseResponse.parse({ id, status: "pending" });
}

export function approveRaiseRecord(id: string): RaiseSummary | undefined {
  const raise = raises.find((item) => item.id === id && item.status === "pending");
  if (!raise) return undefined;
  raise.status = "approved";
  return publicSnapshot(raise);
}

export function claimRaiseRecord(id: string, input: ClaimRaiseInput): RaiseStoreResult {
  const raise = findApprovedRaise(id);
  if (!raise) return { kind: "notFound" };
  if (raise.claim) return { kind: "alreadyClaimed" };

  const signatureOrAccount = input.signatureOrAccount?.trim();
  raise.claim = {
    founderName: input.founderName.trim(),
    email: input.email.trim(),
    ...(signatureOrAccount ? { signatureOrAccount } : {}),
  };
  return { kind: "success", raise: publicSnapshot(raise) };
}

export function submitSoftCommitmentRecord(
  id: string,
  input: SoftCommitmentInput,
): RaiseStoreResult {
  const raise = findApprovedRaise(id);
  if (!raise) return { kind: "notFound" };

  const identifier = input.identifier.trim();
  const existing = input.id
    ? raise.commitments.find((commitment) => commitment.id === input.id)
    : undefined;
  if (existing) {
    if (existing.identifier !== identifier || existing.amount !== input.amount) {
      return { kind: "conflict" };
    }
    return { kind: "success", raise: publicSnapshot(raise), created: false };
  }

  raise.commitments.push({
    id: input.id || randomUUID(),
    identifier,
    amount: input.amount,
    hard: false,
    verified: false,
  });
  updateTotals(raise);
  return { kind: "success", raise: publicSnapshot(raise), created: true };
}

export function updateRaiseCommitmentRecord(
  id: string,
  commitmentId: string,
  input: CommitmentStatusInput,
): RaiseStoreResult {
  const raise = findApprovedRaise(id);
  if (!raise) return { kind: "notFound" };
  if (input.verified && !input.hard) return { kind: "invalidStatus" };

  const commitment = raise.commitments.find((item) => item.id === commitmentId);
  if (!commitment) return { kind: "commitmentNotFound" };

  commitment.hard = input.hard;
  commitment.verified = input.verified;
  updateTotals(raise);
  return { kind: "success", raise: publicSnapshot(raise) };
}
