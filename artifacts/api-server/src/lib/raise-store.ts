import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, raiseStateTable } from "@workspace/db";
import {
  GetPendingRaisesResponse,
  GetPrivateRaiseResponse,
  GetRaiseByIdResponse,
  GetRaisesResponse,
  SubmitRaiseResponse,
  type ClaimRaiseInput,
  type AgentRaiseUpdate,
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
  position: number;
  name: string;
  thesis: string;
  stage: string;
  range: RaiseRange;
  status: "approved" | "pending";
  publicStatus?: "open" | "paused" | "closed";
  agentClaimTokenHash?: string;
  claim?: {
    founderName: string;
    email: string;
    signatureOrAccount?: string;
  };
  commitments: RaiseCommitment[];
  softTotal: number;
  hardTotal: number;
};

const seedData: Omit<RaiseRecord, "position">[] = [
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

const seededRaises: RaiseRecord[] = seedData.map((raise, position) => ({
  ...raise,
  position,
}));

let raises = seededRaises.map(cloneRaise);
let nextPosition = seededRaises.length;
let storeInitialized = false;
let writeQueue: Promise<void> = Promise.resolve();

function cloneRaise(raise: RaiseRecord): RaiseRecord {
  return {
    ...raise,
    range: { ...raise.range },
    ...(raise.claim ? { claim: { ...raise.claim } } : {}),
    commitments: raise.commitments.map((commitment) => ({ ...commitment })),
  };
}

function withWriteQueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function databaseRow(raise: RaiseRecord) {
  const { position, ...state } = raise;
  return {
    id: raise.id,
    position,
    state: state as Record<string, unknown>,
  };
}

function raiseFromDatabase(state: unknown, position: number): RaiseRecord {
  if (
    typeof state !== "object" ||
    state === null ||
    !Number.isSafeInteger(position) ||
    position < 0
  ) {
    throw new Error("Stored raise data is invalid.");
  }

  const storedState = state as Record<string, unknown>;
  if (storedState.status !== "approved" && storedState.status !== "pending") {
    throw new Error("Stored raise status is invalid.");
  }

  const claim = storedState.claim;
  const parsed = GetPrivateRaiseResponse.parse({
    ...storedState,
    status: storedState.publicStatus ?? "open",
    claimed: Boolean(claim),
    ...(typeof claim === "object" &&
    claim !== null &&
    "founderName" in claim &&
    typeof claim.founderName === "string"
      ? { claimantName: claim.founderName }
      : {}),
  });

  return {
    id: parsed.id,
    position,
    name: parsed.name,
    thesis: parsed.thesis,
    stage: parsed.stage,
    range: parsed.range,
    status: storedState.status,
    publicStatus: parsed.status ?? "open",
    ...(typeof storedState.agentClaimTokenHash === "string"
      ? { agentClaimTokenHash: storedState.agentClaimTokenHash }
      : {}),
    ...(parsed.claim ? { claim: parsed.claim } : {}),
    commitments: parsed.commitments,
    softTotal: parsed.softTotal,
    hardTotal: parsed.hardTotal,
  };
}

async function persistRaise(raise: RaiseRecord): Promise<void> {
  if (storeInitialized) {
    const row = databaseRow(raise);
    await db
      .insert(raiseStateTable)
      .values(row)
      .onConflictDoUpdate({
        target: raiseStateTable.id,
        set: {
          position: row.position,
          state: row.state,
          updatedAt: new Date(),
        },
      });
  }

  cacheRaise(raise);
}

function cacheRaise(raise: RaiseRecord): void {
  const index = raises.findIndex((item) => item.id === raise.id);
  const saved = cloneRaise(raise);
  if (index < 0) raises.push(saved);
  else raises[index] = saved;
}

export function initializeRaiseStore(
  seedRows: readonly RaiseRecord[] = seededRaises,
): Promise<void> {
  return withWriteQueue(async () => {
    const existingRows = await db
      .select({ id: raiseStateTable.id })
      .from(raiseStateTable);
    const existingIds = new Set(existingRows.map((row) => row.id));
    const missingSeeds = seedRows.filter((raise) => !existingIds.has(raise.id));

    if (missingSeeds.length > 0) {
      await db
        .insert(raiseStateTable)
        .values(missingSeeds.map(databaseRow))
        .onConflictDoNothing({ target: raiseStateTable.id });
    }

    const storedRows = await db.select().from(raiseStateTable);
    raises = storedRows
      .map((row) => raiseFromDatabase(row.state, row.position))
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
    nextPosition =
      raises.reduce((maximum, raise) => Math.max(maximum, raise.position), -1) + 1;
    storeInitialized = true;
  });
}

export type RaiseStoreResult =
  | { kind: "success"; raise: RaiseSummary; created?: boolean }
  | { kind: "notFound" }
  | { kind: "alreadyClaimed" }
  | { kind: "commitmentNotFound" }
  | { kind: "conflict" }
  | { kind: "amountOutOfRange" }
  | { kind: "invalidStatus" };

function publicSnapshot(raise: RaiseRecord): RaiseSummary {
  return GetRaiseByIdResponse.parse({
    id: raise.id,
    name: raise.name,
    thesis: raise.thesis,
    stage: raise.stage,
    range: raise.range,
    claimed: Boolean(raise.claim || raise.agentClaimTokenHash),
    status: raise.publicStatus ?? "open",
    ...(raise.claim
      ? { claimantName: raise.claim.founderName }
      : raise.agentClaimTokenHash ? { claimantName: "agent" } : {}),
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

function calculateTotals(
  commitments: RaiseCommitment[],
): { softTotal: number; hardTotal: number } | undefined {
  let softTotal = 0;
  let hardTotal = 0;
  for (const commitment of commitments) {
    if (!Number.isSafeInteger(commitment.amount) || commitment.amount <= 0) {
      return undefined;
    }
    const total = commitment.hard ? hardTotal : softTotal;
    // Check before adding, so no intermediate sum loses integer precision.
    if (commitment.amount > Number.MAX_SAFE_INTEGER - total) return undefined;
    if (commitment.hard) hardTotal += commitment.amount;
    else softTotal += commitment.amount;
  }
  return { softTotal, hardTotal };
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

export function submitRaiseRecord(
  input: RaiseSubmissionInput,
): Promise<RaiseSubmissionReceipt> {
  return withWriteQueue(async () => {
    const id = `${slugify(input.name)}-${randomUUID().slice(0, 8)}`;
    const raise: RaiseRecord = {
      id,
      position: nextPosition++,
      name: input.name.trim(),
      thesis: input.thesis.trim(),
      stage: input.stage.trim(),
      range: { ...input.range },
      status: "pending",
      commitments: [],
      softTotal: 0,
      hardTotal: 0,
    };
    await persistRaise(raise);
    return SubmitRaiseResponse.parse({ id, status: "pending" });
  });
}

export function approveRaiseRecord(id: string): Promise<RaiseSummary | undefined> {
  return withWriteQueue(async () => {
    const raise = raises.find((item) => item.id === id && item.status === "pending");
    if (!raise) return undefined;
    const approvedRaise = { ...raise, status: "approved" as const };
    await persistRaise(approvedRaise);
    return publicSnapshot(approvedRaise);
  });
}

export function claimRaiseRecord(
  id: string,
  input: ClaimRaiseInput,
): Promise<RaiseStoreResult> {
  return withWriteQueue(async () => {
    const raise = findApprovedRaise(id);
    if (!raise) return { kind: "notFound" };
    if (raise.claim || raise.agentClaimTokenHash) return { kind: "alreadyClaimed" };

    const signatureOrAccount = input.signatureOrAccount?.trim();
    const claimedRaise: RaiseRecord = {
      ...raise,
      claim: {
        founderName: input.founderName.trim(),
        email: input.email.trim(),
        ...(signatureOrAccount ? { signatureOrAccount } : {}),
      },
    };
    await persistRaise(claimedRaise);
    return { kind: "success", raise: publicSnapshot(claimedRaise) };
  });
}

type AgentStoreResult =
  | { kind: "success"; raise: RaiseSummary; claimToken?: string }
  | { kind: "notFound" | "alreadyClaimed" | "unauthorized" };

type AgentMutation = {
  result: AgentStoreResult;
  updated?: RaiseRecord;
};

// Lock the persisted row so simultaneous agent claims cannot both reserve it.
function mutateAgentRaise(
  id: string,
  change: (raise: RaiseRecord) => AgentMutation,
): Promise<AgentStoreResult> {
  return withWriteQueue(async () => {
    const apply = (raise: RaiseRecord | undefined): AgentMutation =>
      raise?.status === "approved"
        ? change(raise)
        : { result: { kind: "notFound" } };

    const outcome = storeInitialized
      ? await db.transaction(async (tx) => {
          const [row] = await tx.select().from(raiseStateTable)
            .where(eq(raiseStateTable.id, id)).for("update");
          const mutation = apply(row ? raiseFromDatabase(row.state, row.position) : undefined);
          if (mutation.updated) {
            await tx.update(raiseStateTable).set({
              state: databaseRow(mutation.updated).state,
              updatedAt: new Date(),
            }).where(eq(raiseStateTable.id, id));
          }
          return mutation;
        })
      : apply(findApprovedRaise(id));

    if (outcome.updated) cacheRaise(outcome.updated);
    return outcome.result;
  });
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function reserveAgentRaiseRecord(id: string): Promise<AgentStoreResult> {
  return mutateAgentRaise(id, (raise) => {
    if (raise.claim || raise.agentClaimTokenHash) {
      return { result: { kind: "alreadyClaimed" } };
    }
    const claimToken = randomBytes(32).toString("base64url");
    const updated = { ...raise, agentClaimTokenHash: tokenHash(claimToken) };
    return {
      updated,
      result: { kind: "success", raise: publicSnapshot(updated), claimToken },
    };
  });
}

export function updateAgentRaiseRecord(
  id: string,
  token: string,
  input: AgentRaiseUpdate,
): Promise<AgentStoreResult> {
  return mutateAgentRaise(id, (raise) => {
    const supplied = Buffer.from(tokenHash(token), "hex");
    const expected = Buffer.from(raise.agentClaimTokenHash ?? "", "hex");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return { result: { kind: "unauthorized" } };
    }
    // Explicit allowlist: neither private records nor approval can be changed.
    const updated: RaiseRecord = {
      ...raise,
      ...(input.thesis !== undefined ? { thesis: input.thesis.trim() } : {}),
      ...(input.stage !== undefined ? { stage: input.stage.trim() } : {}),
      ...(input.range !== undefined ? { range: { ...input.range } } : {}),
      ...(input.status !== undefined ? { publicStatus: input.status } : {}),
    };
    return { updated, result: { kind: "success", raise: publicSnapshot(updated) } };
  });
}

export function submitSoftCommitmentRecord(
  id: string,
  input: SoftCommitmentInput,
): Promise<RaiseStoreResult> {
  return withWriteQueue(async () => {
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

    const commitments = [
      ...raise.commitments,
      {
        id: input.id || randomUUID(),
        identifier,
        amount: input.amount,
        hard: false,
        verified: false,
      },
    ];
    const totals = calculateTotals(commitments);
    if (!totals) return { kind: "amountOutOfRange" };

    const updatedRaise = { ...raise, commitments, ...totals };
    await persistRaise(updatedRaise);
    return { kind: "success", raise: publicSnapshot(updatedRaise), created: true };
  });
}

export function updateRaiseCommitmentRecord(
  id: string,
  commitmentId: string,
  input: CommitmentStatusInput,
): Promise<RaiseStoreResult> {
  return withWriteQueue(async () => {
    const raise = findApprovedRaise(id);
    if (!raise) return { kind: "notFound" };
    if (input.verified && !input.hard) return { kind: "invalidStatus" };

    const commitment = raise.commitments.find((item) => item.id === commitmentId);
    if (!commitment) return { kind: "commitmentNotFound" };

    const commitments = raise.commitments.map((item) =>
      item.id === commitmentId ? { ...item, ...input } : item,
    );
    const totals = calculateTotals(commitments);
    if (!totals) return { kind: "amountOutOfRange" };

    const updatedRaise = { ...raise, commitments, ...totals };
    await persistRaise(updatedRaise);
    return { kind: "success", raise: publicSnapshot(updatedRaise) };
  });
}
