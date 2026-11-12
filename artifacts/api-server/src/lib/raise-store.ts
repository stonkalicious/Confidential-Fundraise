import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";
import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { db, demoSettlementsTable, raiseStateTable } from "@workspace/db";
import publicRaiseSeedData from "../data/public-raises.json";
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
  type RaiseCategory,
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
  rangeIsIndicative?: boolean;
  status: "approved" | "pending";
  publicStatus?: "open" | "paused" | "closed";
  sourceLink?: string;
  categories?: RaiseCategory[];
  agentClaimTokenHash?: string;
  demoInvestorReceiptHashes?: Record<string, string>;
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
    name: "Privacy Token Fund",
    thesis: "Fund-wide thesis for private money and confidential cross-chain settlement.",
    stage: "Fundraise",
    range: { min: 2_000_000, max: 5_000_000 },
    categories: ["privacy-security"],
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
    categories: ["ai-agents"],
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
    categories: ["privacy-security", "intents-payments"],
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
    categories: ["intents-payments"],
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
    categories: ["ai-agents"],
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

export type PublicRaiseSeed = {
  name: string;
  thesis: string;
  stage: string;
  range: RaiseRange;
  rangeIsIndicative?: boolean;
  sourceLink?: string;
  categories?: RaiseCategory[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function publicRaiseId(name: string): string {
  const normalizedName = name.trim().normalize("NFKC").toLowerCase();
  const suffix = createHash("sha256").update(normalizedName).digest("hex").slice(0, 8);
  return `public-${slugify(name)}-${suffix}`;
}

export function parsePublicRaiseSeeds(value: unknown): PublicRaiseSeed[] {
  if (!Array.isArray(value)) {
    throw new Error("Public raise seed data must be a JSON array.");
  }

  const parsedSeeds: PublicRaiseSeed[] = [];
  const seenIds = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const label = `Public raise seed entry ${index + 1}`;
    if (!isPlainRecord(entry)) throw new Error(`${label} must be an object.`);

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const thesis = typeof entry.thesis === "string" ? entry.thesis.trim() : "";
    const stage = typeof entry.stage === "string" ? entry.stage.trim() : "";
    if (name.length < 2 || name.length > 120) {
      throw new Error(`${label} must have a name between 2 and 120 characters.`);
    }
    if (
      thesis.length < 10 ||
      thesis.length > 280 ||
      /[\r\n]/.test(thesis)
    ) {
      throw new Error(`${label} must have a one-line thesis between 10 and 280 characters.`);
    }
    if (stage.length < 1 || stage.length > 60) {
      throw new Error(`${label} must have a stage between 1 and 60 characters.`);
    }
    if (
      !isPlainRecord(entry.range) ||
      !Number.isSafeInteger(entry.range.min) ||
      !Number.isSafeInteger(entry.range.max) ||
      (entry.range.min as number) <= 0 ||
      (entry.range.max as number) < (entry.range.min as number)
    ) {
      throw new Error(`${label} must have positive integer range bounds with max at least min.`);
    }
    if (
      entry.rangeIsIndicative !== undefined &&
      typeof entry.rangeIsIndicative !== "boolean"
    ) {
      throw new Error(`${label} rangeIsIndicative must be a boolean when provided.`);
    }

    let categories: RaiseCategory[] | undefined;
    if (entry.categories !== undefined) {
      if (!Array.isArray(entry.categories) || entry.categories.length === 0) {
        throw new Error(`${label} categories must be a non-empty array when provided.`);
      }
      const validCategories = new Set<string>([
        "privacy-security",
        "ai-agents",
        "intents-payments",
        "consumer-real-world",
      ]);
      if (
        entry.categories.some((category) =>
          typeof category !== "string" || !validCategories.has(category),
        ) ||
        new Set(entry.categories).size !== entry.categories.length
      ) {
        throw new Error(`${label} categories must contain unique supported category values.`);
      }
      categories = entry.categories as RaiseCategory[];
    }

    let sourceLink: string | undefined;
    if (entry.sourceLink !== undefined) {
      if (typeof entry.sourceLink !== "string" || !entry.sourceLink.trim()) {
        throw new Error(`${label} sourceLink must be an HTTP(S) URL when provided.`);
      }
      sourceLink = entry.sourceLink.trim();
      let url: URL;
      try {
        url = new URL(sourceLink);
      } catch {
        throw new Error(`${label} sourceLink must be an HTTP(S) URL when provided.`);
      }
      if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
        throw new Error(`${label} sourceLink must be an HTTP(S) URL when provided.`);
      }
    }

    const id = publicRaiseId(name);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    parsedSeeds.push({
      name,
      thesis,
      stage,
      range: { min: entry.range.min as number, max: entry.range.max as number },
      ...(entry.rangeIsIndicative === true ? { rangeIsIndicative: true } : {}),
      ...(sourceLink ? { sourceLink } : {}),
      ...(categories ? { categories } : {}),
    });
  }
  return parsedSeeds;
}

const publicSeededRaises: RaiseRecord[] = parsePublicRaiseSeeds(publicRaiseSeedData).map(
  (seed, index) => ({
    id: publicRaiseId(seed.name),
    position: seededRaises.length + index,
    ...seed,
    status: "approved",
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  }),
);
const defaultCategoriesByRaiseId = new Map(
  [...seededRaises, ...publicSeededRaises]
    .filter((raise): raise is RaiseRecord & { categories: RaiseCategory[] } =>
      Array.isArray(raise.categories) && raise.categories.length > 0)
    .map((raise) => [raise.id, raise.categories]),
);

let raises = seededRaises.map(cloneRaise);
let nextPosition = seededRaises.length;
let storeInitialized = false;
// After this age, reads block on a refresh instead of serving stale state.
export const RAISE_READ_MAX_AGE_MS = 1_000;
export class RaiseSnapshotUnavailableError extends Error {
  constructor() {
    super("Raise details are temporarily unavailable. Try again shortly.");
  }
}
let snapshotReadStartedAt = -Infinity;
let refreshInFlight: Promise<void> | undefined;
let writeQueue: Promise<void> = Promise.resolve();

function cloneRaise(raise: RaiseRecord): RaiseRecord {
  return {
    ...raise,
    range: { ...raise.range },
    ...(raise.categories ? { categories: [...raise.categories] } : {}),
    ...(raise.claim ? { claim: { ...raise.claim } } : {}),
    ...(raise.demoInvestorReceiptHashes
      ? { demoInvestorReceiptHashes: { ...raise.demoInvestorReceiptHashes } }
      : {}),
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
  const categories = parsed.categories ?? defaultCategoriesByRaiseId.get(parsed.id);

  return {
    id: parsed.id,
    position,
    name: parsed.name,
    thesis: parsed.thesis,
    stage: parsed.stage,
    range: parsed.range,
    ...(categories ? { categories: [...categories] } : {}),
    ...(parsed.rangeIsIndicative === true ? { rangeIsIndicative: true } : {}),
    status: storedState.status,
    publicStatus: parsed.status ?? "open",
    ...(typeof storedState.agentClaimTokenHash === "string"
      ? { agentClaimTokenHash: storedState.agentClaimTokenHash }
      : {}),
    ...(isPlainRecord(storedState.demoInvestorReceiptHashes)
      ? { demoInvestorReceiptHashes: storedState.demoInvestorReceiptHashes as Record<string, string> }
      : {}),
    ...(typeof storedState.sourceLink === "string" ? { sourceLink: storedState.sourceLink } : {}),
    ...(parsed.claim ? { claim: parsed.claim } : {}),
    commitments: parsed.commitments,
    softTotal: parsed.softTotal,
    hardTotal: parsed.hardTotal,
  };
}

async function persistRaise(raise: RaiseRecord): Promise<void> {
  if (storeInitialized) {
    // New raises are insert-only. Existing rows must go through mutateRaise.
    await db.insert(raiseStateTable).values(databaseRow(raise));
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
  seedRows: readonly RaiseRecord[] = [...seededRaises, ...publicSeededRaises],
): Promise<void> {
  return withWriteQueue(async () => {
    const existingRows = await db
      .select({ id: raiseStateTable.id, position: raiseStateTable.position })
      .from(raiseStateTable);
    const existingIds = new Set(existingRows.map((row) => row.id));
    let seedPosition =
      existingRows.reduce((maximum, row) => Math.max(maximum, row.position), -1) + 1;
    const missingSeeds: RaiseRecord[] = [];
    for (const raise of seedRows) {
      if (existingIds.has(raise.id)) continue;
      existingIds.add(raise.id);
      missingSeeds.push({ ...raise, position: seedPosition++ });
    }

    if (missingSeeds.length > 0) {
      await db
        .insert(raiseStateTable)
        .values(missingSeeds.map(databaseRow))
        .onConflictDoNothing({ target: raiseStateTable.id });
    }

    await reloadRaiseSnapshot();
    storeInitialized = true;
  });
}

async function reloadRaiseSnapshot(): Promise<void> {
  // Start the clock before the query: a slow query must not extend cache life.
  const startedAt = performance.now();
  const storedRows = await db.select().from(raiseStateTable);
  const snapshot = storedRows
    .map((row) => raiseFromDatabase(row.state, row.position))
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  // Publish only a complete, validated snapshot. A failed read remains expired.
  raises = snapshot;
  nextPosition =
    raises.reduce((maximum, raise) => Math.max(maximum, raise.position), -1) + 1;
  snapshotReadStartedAt = startedAt;
}

async function refreshRaiseSnapshot(): Promise<void> {
  // Uninitialized stores are used by isolated in-memory tests, never by the server.
  if (!storeInitialized) return;
  const oldestAllowedStart = performance.now() - RAISE_READ_MAX_AGE_MS;
  while (snapshotReadStartedAt <= oldestAllowedStart) {
    if (!refreshInFlight) {
      // Serialize publication with local writes, so a refresh cannot replace a
      // newly committed local mutation with an older database snapshot.
      refreshInFlight = withWriteQueue(reloadRaiseSnapshot)
        .catch(() => {
          // All waiting readers get the same safe error, never expired data.
          throw new RaiseSnapshotUnavailableError();
        })
        .finally(() => {
          refreshInFlight = undefined;
        });
    }
    await refreshInFlight;
    // A late reader may have joined a slow query started before its allowed
    // freshness window. That reader must wait for another (shared) refresh.
  }
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
  const categories = raise.categories ?? defaultCategoriesByRaiseId.get(raise.id);
  return GetRaiseByIdResponse.parse({
    id: raise.id,
    name: raise.name,
    thesis: raise.thesis,
    stage: raise.stage,
    range: raise.range,
    ...(categories ? { categories } : {}),
    ...(raise.categories ? { categories: raise.categories } : {}),
    ...(raise.rangeIsIndicative === true ? { rangeIsIndicative: true } : {}),
    ...(raise.sourceLink ? { sourceLink: raise.sourceLink } : {}),
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

export async function getRaises(): Promise<RaiseSummary[]> {
  await refreshRaiseSnapshot();
  return GetRaisesResponse.parse(
    raises.filter((raise) => raise.status === "approved").map(publicSnapshot),
  );
}

export async function getRaise(id: string): Promise<RaiseSummary | undefined> {
  await refreshRaiseSnapshot();
  const raise = findApprovedRaise(id);
  return raise ? publicSnapshot(raise) : undefined;
}

async function withConfirmedTestnetCounts(summaries: RaiseSummary[]): Promise<RaiseSummary[]> {
  if (summaries.length === 0) return summaries;
  const counts = await db
    .select({ raiseId: demoSettlementsTable.raiseId, total: count() })
    .from(demoSettlementsTable)
    .where(and(
      inArray(demoSettlementsTable.raiseId, summaries.map((raise) => raise.id)),
      eq(demoSettlementsTable.network, "testnet"),
      isNotNull(demoSettlementsTable.transactionHash),
    ))
    .groupBy(demoSettlementsTable.raiseId);
  const countByRaise = new Map(counts.map((row) => [row.raiseId, row.total]));
  return summaries.map((raise) => ({
    ...raise,
    confirmedTestnetTransfers: countByRaise.get(raise.id) ?? 0,
  }));
}

export async function getRaisesWithConfirmedTestnetCounts(): Promise<RaiseSummary[]> {
  return withConfirmedTestnetCounts(await getRaises());
}

export async function getRaiseWithConfirmedTestnetCount(id: string): Promise<RaiseSummary | undefined> {
  const raise = await getRaise(id);
  if (!raise) return undefined;
  const [row] = await db
    .select({ total: count() })
    .from(demoSettlementsTable)
    .where(and(
      eq(demoSettlementsTable.raiseId, id),
      eq(demoSettlementsTable.network, "testnet"),
      isNotNull(demoSettlementsTable.transactionHash),
    ));
  return { ...raise, confirmedTestnetTransfers: row?.total ?? 0 };
}

export async function getPrivateRaise(id: string): Promise<PrivateRaiseDetails | undefined> {
  await refreshRaiseSnapshot();
  const raise = findApprovedRaise(id);
  return raise ? privateSnapshot(raise) : undefined;
}

export async function getPendingRaises(): Promise<PendingRaise[]> {
  await refreshRaiseSnapshot();
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
  return mutateRaise<RaiseSummary | undefined>(id, (raise) => {
    if (raise?.status !== "pending") return { result: undefined };
    const approvedRaise = { ...raise, status: "approved" as const };
    return { updated: approvedRaise, result: publicSnapshot(approvedRaise) };
  });
}

export function claimRaiseRecord(
  id: string,
  input: ClaimRaiseInput,
): Promise<RaiseStoreResult> {
  return mutateRaise<RaiseStoreResult>(id, (raise) => {
    if (raise?.status !== "approved") return { result: { kind: "notFound" } };
    if (raise.claim || raise.agentClaimTokenHash) {
      return { result: { kind: "alreadyClaimed" } };
    }

    const signatureOrAccount = input.signatureOrAccount?.trim();
    const claimedRaise: RaiseRecord = {
      ...raise,
      claim: {
        founderName: input.founderName.trim(),
        email: input.email.trim(),
        ...(signatureOrAccount ? { signatureOrAccount } : {}),
      },
    };
    return {
      updated: claimedRaise,
      result: { kind: "success", raise: publicSnapshot(claimedRaise) },
    };
  });
}

type AgentStoreResult =
  | { kind: "success"; raise: RaiseSummary; claimToken?: string }
  | { kind: "notFound" | "alreadyClaimed" | "unauthorized" };

type RaiseMutation<T> = {
  result: T;
  updated?: RaiseRecord;
};

// Every existing-row writer must read and change state under the same database
// row lock. The process-local queue/cache alone cannot protect other instances.
function mutateRaise<T>(
  id: string,
  change: (raise: RaiseRecord | undefined) => RaiseMutation<T>,
): Promise<T> {
  return withWriteQueue(async () => {
    const outcome = storeInitialized
      ? await db.transaction(async (tx) => {
          const [row] = await tx.select().from(raiseStateTable)
            .where(eq(raiseStateTable.id, id)).for("update");
          const current = row ? raiseFromDatabase(row.state, row.position) : undefined;
          const mutation = change(current);
          if (mutation.updated) {
            await tx.update(raiseStateTable).set({
              state: databaseRow(mutation.updated).state,
              updatedAt: new Date(),
            }).where(eq(raiseStateTable.id, id));
          }
          return { ...mutation, current };
        })
      : (() => {
          const current = raises.find((raise) => raise.id === id);
          return { ...change(current), current };
        })();

    // Publish to this instance's cache only after the transaction commits.
    const latest = outcome.updated ?? outcome.current;
    if (latest) cacheRaise(latest);
    return outcome.result;
  });
}

function mutateAgentRaise(
  id: string,
  change: (raise: RaiseRecord) => RaiseMutation<AgentStoreResult>,
): Promise<AgentStoreResult> {
  return mutateRaise<AgentStoreResult>(id, (raise) =>
    raise?.status === "approved"
      ? change(raise)
      : { result: { kind: "notFound" } },
  );
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
  return mutateRaise<RaiseStoreResult>(id, (raise) => {
    if (raise?.status !== "approved") return { result: { kind: "notFound" } };

    const identifier = input.identifier.trim();
    const existing = input.id
      ? raise.commitments.find((commitment) => commitment.id === input.id)
      : undefined;
    if (existing) {
      if (existing.identifier !== identifier || existing.amount !== input.amount) {
        return { result: { kind: "conflict" } };
      }
      return { result: { kind: "success", raise: publicSnapshot(raise), created: false } };
    }

    const commitmentId = input.id || randomUUID();
    const commitments = [
      ...raise.commitments,
      {
        id: commitmentId,
        identifier,
        amount: input.amount,
        hard: false,
        verified: false,
      },
    ];
    const totals = calculateTotals(commitments);
    if (!totals) return { result: { kind: "amountOutOfRange" } };

    const updatedRaise = {
      ...raise, commitments, ...totals,
      ...(input.demoReceipt ? {
        demoInvestorReceiptHashes: {
          ...raise.demoInvestorReceiptHashes,
          [commitmentId]: tokenHash(input.demoReceipt),
        },
      } : {}),
    };
    return {
      updated: updatedRaise,
      result: { kind: "success", raise: publicSnapshot(updatedRaise), created: true },
    };
  });
}

// Fresh database reads keep optional payment authorization independent of the
// process-local public raise cache. Never return the receipt hash to clients.
export async function getDemoCommitmentAccess(
  id: string, commitmentId: string, receipt?: string,
): Promise<{ exists: boolean; investor: boolean }> {
  const [row] = await db.select().from(raiseStateTable).where(eq(raiseStateTable.id, id));
  const raise = row ? raiseFromDatabase(row.state, row.position) : undefined;
  if (!raise || raise.status !== "approved" ||
      !raise.commitments.some((item) => item.id === commitmentId)) {
    return { exists: false, investor: false };
  }
  const expected = raise.demoInvestorReceiptHashes?.[commitmentId];
  const supplied = receipt && /^[a-f0-9]{64}$/.test(receipt) ? tokenHash(receipt) : "";
  const [settlement] = supplied ? await db.select({
    investorLinkTokenHash: demoSettlementsTable.investorLinkTokenHash,
    investorLinkExpiresAt: demoSettlementsTable.investorLinkExpiresAt,
  }).from(demoSettlementsTable).where(and(
    eq(demoSettlementsTable.raiseId, id),
    eq(demoSettlementsTable.commitmentId, commitmentId),
  )) : [];
  const receiptMatches = Boolean(expected && supplied &&
    expected.length === supplied.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)));
  const inviteHash = settlement?.investorLinkTokenHash ?? "";
  const inviteMatches = Boolean(
    inviteHash && settlement?.investorLinkExpiresAt &&
    settlement.investorLinkExpiresAt.getTime() > Date.now() &&
    inviteHash.length === supplied.length &&
    timingSafeEqual(Buffer.from(inviteHash), Buffer.from(supplied)),
  );
  return {
    exists: true,
    investor: receiptMatches || inviteMatches,
  };
}

export function updateRaiseCommitmentRecord(
  id: string,
  commitmentId: string,
  input: CommitmentStatusInput,
): Promise<RaiseStoreResult> {
  return mutateRaise<RaiseStoreResult>(id, (raise) => {
    if (raise?.status !== "approved") return { result: { kind: "notFound" } };
    if (input.verified && !input.hard) return { result: { kind: "invalidStatus" } };

    const commitment = raise.commitments.find((item) => item.id === commitmentId);
    if (!commitment) return { result: { kind: "commitmentNotFound" } };

    const commitments = raise.commitments.map((item) =>
      item.id === commitmentId ? { ...item, ...input } : item,
    );
    const totals = calculateTotals(commitments);
    if (!totals) return { result: { kind: "amountOutOfRange" } };

    const updatedRaise = { ...raise, commitments, ...totals };
    return {
      updated: updatedRaise,
      result: { kind: "success", raise: publicSnapshot(updatedRaise) },
    };
  });
}
