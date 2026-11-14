import { randomBytes } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  ConfigureDemoSettlementBody,
  ConfigureDemoSettlementResponse,
  ConfirmDemoSettlementBody,
  ConfirmDemoSettlementResponse,
  GetDemoSettlementResponse,
  GetRaisesResponse,
  GetRaiseByIdResponse,
  ReserveAgentRaiseResponse,
  SubmitRaiseBody,
  SubmitRaiseResponse,
  SubmitSoftCommitmentBody,
  SubmitSoftCommitmentResponse,
  UpdateAgentRaiseBody,
  UpdateAgentRaiseResponse,
  VerifyDemoSettlementBody,
  VerifyDemoSettlementResponse,
} from "@workspace/api-zod";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080/api";
const API_TIMEOUT_MS = 15_000;
const MAX_LOCAL_COMMIT_SESSIONS = 500;
const LOCAL_COMMIT_SESSION_TTL_MS = 24 * 60 * 60 * 1_000;

type PublicRaise = z.infer<typeof GetRaisesResponse>[number];
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type LocalCommitSession = {
  receipt: string;
  createdAt: number;
  settlementId?: string;
};

class ApiRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

class SafeToolError extends Error {}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateApiBaseUrl(
  configured = process.env.AGENT_RAISED_API_BASE_URL ?? DEFAULT_API_BASE_URL,
): URL {
  let base: URL;
  try {
    base = new URL(configured);
  } catch {
    throw new Error("AGENT_RAISED_API_BASE_URL must be an absolute HTTP(S) URL.");
  }
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error("AGENT_RAISED_API_BASE_URL must be an absolute HTTP(S) URL without credentials or query parameters.");
  }
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;
  return base;
}

function apiUrl(path: string): URL {
  return new URL(path.replace(/^\/+/, ""), validateApiBaseUrl());
}

function redactMessage(message: string, secrets: string[]): string {
  let safe = message.replace(/[\r\n\t]+/g, " ").trim();
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    safe = safe.split(secret).join("[redacted]");
  }
  return safe.slice(0, 300) || "The API request was rejected.";
}

async function apiRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    founderCode?: string;
    claimToken?: string;
    investorReceipt?: string;
    redact?: string[];
  } = {},
): Promise<unknown> {
  const headers = new Headers({ accept: "application/json" });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.founderCode) headers.set("authorization", `Bearer ${options.founderCode}`);
  if (options.claimToken) headers.set("authorization", `Bearer ${options.claimToken}`);
  if (options.investorReceipt) headers.set("x-demo-receipt", options.investorReceipt);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    throw new SafeToolError("The Agent Raised API could not be reached. Check its URL and availability.");
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const apiMessage =
      record(body) && typeof body.error === "string"
        ? body.error
        : `The API request failed with HTTP ${response.status}.`;
    throw new ApiRequestError(response.status, redactMessage(apiMessage, options.redact ?? []));
  }
  if (body === undefined) throw new SafeToolError("The Agent Raised API returned an unreadable response.");
  return body;
}

function textResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function messageResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }] };
}

function errorResult(error: unknown): ToolResult {
  if (error instanceof ApiRequestError) {
    const message =
      error.status === 401 || error.status === 403
        ? "Authorization failed. Use the required per-raise claim token, founder approval code, or investor receipt for this action."
        : error.status >= 500
          ? "The Agent Raised API could not complete this request. Check its status before retrying."
          : error.message;
    return { content: [{ type: "text", text: redactMessage(message, []) }], isError: true };
  }
  const message = error instanceof SafeToolError
    ? error.message
    : "The MCP action could not be completed safely. Check the inputs and service status.";
  return { content: [{ type: "text", text: redactMessage(message, []) }], isError: true };
}

function toolHandler<TSchema extends z.ZodType>(
  handler: (input: z.infer<TSchema>) => Promise<ToolResult>,
): (input: z.infer<TSchema>) => Promise<ToolResult> {
  return async (input) => {
    try {
      return await handler(input);
    } catch (error) {
      return errorResult(error);
    }
  };
}

function publicRaise(value: unknown): PublicRaise {
  return GetRaiseByIdResponse.parse(value);
}

function publicSummary(raise: PublicRaise): Record<string, unknown> {
  return {
    id: raise.id,
    name: raise.name,
    thesis: raise.thesis,
    stage: raise.stage,
    range: raise.range,
    ...(raise.rangeIsIndicative === undefined ? {} : { rangeIsIndicative: raise.rangeIsIndicative }),
    ...(raise.categories === undefined ? {} : { categories: raise.categories }),
    ...(raise.sourceLink === undefined ? {} : { sourceLink: raise.sourceLink }),
    claimed: raise.claimed,
    ...(raise.status === undefined ? {} : { status: raise.status }),
    softTotal: raise.softTotal,
    hardTotal: raise.hardTotal,
    ...(raise.confirmedTestnetTransfers === undefined
      ? {}
      : { confirmedTestnetTransfers: raise.confirmedTestnetTransfers }),
  };
}

const SafeInteger = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const RaiseRange = z.object({
  min: SafeInteger,
  max: SafeInteger,
}).strict().refine((range) => range.max >= range.min, "Maximum must be at least the minimum.");

const listRaisesSchema = z.object({
  stage: z.string().trim().min(1).max(60).optional(),
  minRange: SafeInteger.optional(),
  maxRange: SafeInteger.optional(),
  keyword: z.string().trim().min(1).max(120).optional(),
}).strict().refine(
  (input) => input.minRange === undefined || input.maxRange === undefined || input.maxRange >= input.minRange,
  { message: "maxRange must be greater than or equal to minRange." },
);

const claimOrUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(120),
    thesis: z.string().trim().min(10).max(280),
    stage: z.string().trim().min(1).max(60),
    range: RaiseRange,
  }).strict(),
  z.object({
    action: z.literal("claim"),
    raiseId: z.string().trim().min(1).max(120),
  }).strict(),
  z.object({
    action: z.literal("update"),
    raiseId: z.string().trim().min(1).max(120),
    claimToken: z.string().min(1).max(256),
    thesis: z.string().trim().min(10).max(280).optional(),
    stage: z.string().trim().min(1).max(60).optional(),
    range: RaiseRange.optional(),
    status: z.enum(["open", "paused", "closed"]).optional(),
  }).strict().refine(
    ({ thesis, stage, range, status }) =>
      thesis !== undefined || stage !== undefined || range !== undefined || status !== undefined,
    { message: "Provide at least one public field to update." },
  ),
]);

const softCommitSchema = z.object({
  raiseId: z.string().trim().min(1).max(120),
  commitmentId: z.string().trim().min(1).max(80)
    .describe("Caller-generated opaque ID; needed to identify this commitment for optional testnet settlement."),
  identifier: z.string().trim().min(1).max(80)
    .describe("Synthetic investor name or alias; this will never appear in the tool result."),
  amount: SafeInteger.describe("Synthetic whole-dollar amount; this will never appear in the tool result."),
}).strict();

const settlementBase = {
  raiseId: z.string().trim().min(1).max(120),
  commitmentId: z.string().trim().min(1).max(80),
};
const settlementSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), ...settlementBase }).strict(),
  z.object({
    action: z.literal("founder_confirm"),
    ...settlementBase,
    receiverAccount: z.string().trim().min(2).max(64),
    reference: z.string().trim().max(300).optional(),
    confirmed: z.boolean().optional().describe("Must be true to record explicit founder confirmation."),
  }).strict(),
  z.object({
    action: z.literal("investor_confirm"),
    ...settlementBase,
    signerAccount: z.string().trim().min(2).max(64),
    confirmed: z.boolean().optional().describe("Must be true to record explicit investor confirmation."),
  }).strict(),
  z.object({ action: z.literal("prepare"), ...settlementBase }).strict(),
  z.object({
    action: z.literal("verify"),
    ...settlementBase,
    transactionHash: z.string().trim().regex(/^[1-9A-HJ-NP-Za-km-z]{40,50}$/).optional(),
  }).strict(),
]);

function sessionKey(raiseId: string, commitmentId: string): string {
  return `${raiseId}\u0000${commitmentId}`;
}

function pruneSessions(sessions: Map<string, LocalCommitSession>): void {
  const cutoff = Date.now() - LOCAL_COMMIT_SESSION_TTL_MS;
  for (const [key, value] of sessions) {
    if (value.createdAt < cutoff) sessions.delete(key);
  }
  while (sessions.size > MAX_LOCAL_COMMIT_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.delete(oldest);
  }
}

function safeSettlement(
  value: unknown,
): z.infer<typeof GetDemoSettlementResponse> {
  return GetDemoSettlementResponse.parse(value);
}

function safeSettlementStatus(
  response: z.infer<typeof GetDemoSettlementResponse>,
): Record<string, unknown> {
  const settlement = response.settlement;
  if (!settlement) {
    return { status: "not_started", nextStep: "founder_confirm" };
  }
  if (settlement.network !== "testnet") {
    throw new SafeToolError("This MCP tool only supports NEAR testnet settlement. No transfer was sent.");
  }
  return {
    status: settlement.status,
    confirmedRoles: settlement.confirmations.map(({ role }) =>
      role === "sponsor" ? "Founder" : "Investor",
    ),
    ...(settlement.recoveryStatus ? { recoveryStatus: settlement.recoveryStatus } : {}),
    ...(settlement.status === "success" && settlement.transactionHash
      ? { transactionHash: settlement.transactionHash }
      : {}),
  };
}

export function createRaiseMcpServer(): McpServer {
  const server = new McpServer({ name: "agent-raised", version: "1.0.0" });
  const localCommitSessions = new Map<string, LocalCommitSession>();

  server.registerTool(
    "list_raises",
    {
      title: "List public raises",
      description: "Read public raise summaries and filter by stage, overlapping ticket range, or case-insensitive keyword. Returns aggregates only; never investor records.",
      inputSchema: listRaisesSchema,
    },
    toolHandler<typeof listRaisesSchema>(async (input) => {
      const rows = GetRaisesResponse.parse(await apiRequest("raises"));
      const keyword = input.keyword?.toLocaleLowerCase();
      const matches = rows.filter((raise) => {
        if (input.stage && raise.stage.toLocaleLowerCase() !== input.stage.toLocaleLowerCase()) return false;
        if (input.minRange !== undefined && raise.range.max < input.minRange) return false;
        if (input.maxRange !== undefined && raise.range.min > input.maxRange) return false;
        if (keyword) {
          const haystack = [
            raise.id,
            raise.name,
            raise.thesis,
            raise.stage,
            ...(raise.categories ?? []),
          ].join(" ").toLocaleLowerCase();
          if (!haystack.includes(keyword)) return false;
        }
        return true;
      });
      return textResult({ raises: matches.map((raise) => publicSummary(raise)) });
    }),
  );

  server.registerTool(
    "claim_or_update_raise",
    {
      title: "Create, claim, or update a raise",
      description: "Create a raise (pending manual approval), claim an approved raise (returns its one-time per-raise token), or update only public fields using that token. A claim is page ownership, not company verification.",
      inputSchema: claimOrUpdateSchema,
    },
    toolHandler<typeof claimOrUpdateSchema>(async (input) => {
      if (input.action === "create") {
        const payload = SubmitRaiseBody.parse({
          name: input.name,
          thesis: input.thesis,
          stage: input.stage,
          range: input.range,
        });
        const created = SubmitRaiseResponse.parse(await apiRequest("raises", {
          method: "POST",
          body: payload,
          redact: [input.name, input.thesis, input.stage],
        }));
        return textResult({
          raiseId: created.id,
          status: created.status,
          message: "Raise submitted for manual approval; it is not public until approved.",
        });
      }

      if (input.action === "claim") {
        const claimed = ReserveAgentRaiseResponse.parse(await apiRequest(
          `raises/${encodeURIComponent(input.raiseId)}/agent-claim`,
          { method: "POST", redact: [input.raiseId] },
        ));
        return textResult({
          raise: publicSummary(publicRaise(claimed.raise)),
          claimToken: claimed.claimToken,
          warning: "This one-time token authorizes public-field updates to this raise only. Store it securely; it does not verify a company or authorize private reads.",
        });
      }

      const body = UpdateAgentRaiseBody.parse({
        ...(input.thesis === undefined ? {} : { thesis: input.thesis }),
        ...(input.stage === undefined ? {} : { stage: input.stage }),
        ...(input.range === undefined ? {} : { range: input.range }),
        ...(input.status === undefined ? {} : { status: input.status }),
      });
      const updated = UpdateAgentRaiseResponse.parse(await apiRequest(
        `raises/${encodeURIComponent(input.raiseId)}`,
        {
          method: "PATCH",
          body,
          claimToken: input.claimToken,
          redact: [input.raiseId, input.claimToken, input.thesis ?? "", input.stage ?? ""],
        },
      ));
      // The API authorizes public updates with the per-raise claim token.
      // Keep it separate from the founder approval header.
      return textResult({ raise: publicSummary(publicRaise(updated)) });
    }),
  );

  server.registerTool(
    "soft_commit",
    {
      title: "Record private soft commitment",
      description: "Submit a synthetic, non-binding whole-dollar soft commitment. The identifier, amount, commitment ID, and investor receipt are never returned.",
      inputSchema: softCommitSchema,
    },
    toolHandler<typeof softCommitSchema>(async (input) => {
      pruneSessions(localCommitSessions);
      const key = sessionKey(input.raiseId, input.commitmentId);
      let session = localCommitSessions.get(key);
      if (!session) {
        session = { receipt: randomBytes(32).toString("hex"), createdAt: Date.now() };
        localCommitSessions.set(key, session);
      }
      const payload = SubmitSoftCommitmentBody.parse({
        id: input.commitmentId,
        identifier: input.identifier,
        amount: input.amount,
        demoReceipt: session.receipt,
      });
      SubmitSoftCommitmentResponse.parse(await apiRequest(
        `raises/${encodeURIComponent(input.raiseId)}/commitments`,
        {
          method: "POST",
          body: payload,
          redact: [input.raiseId, input.commitmentId, input.identifier, String(input.amount), session.receipt],
        },
      ));
      return messageResult("Soft commitment recorded.");
    }),
  );

  server.registerTool(
    "settle_test_usdc",
    {
      title: "Coordinate optional testnet transfer",
      description: "Coordinate the existing non-custodial 1 test USDC flow. Founder and investor confirmations are separate; prepare returns wallet instructions only, never sends a transfer. A signed hash is reported only after the API verifies it on NEAR testnet.",
      inputSchema: settlementSchema,
    },
    toolHandler<typeof settlementSchema>(async (input) => {
      pruneSessions(localCommitSessions);
      const key = sessionKey(input.raiseId, input.commitmentId);
      const session = localCommitSessions.get(key);
      const founderCode = process.env.RAISE_APPROVAL_CODE;
      const path = `raises/${encodeURIComponent(input.raiseId)}/demo-settlements/${encodeURIComponent(input.commitmentId)}`;
      const redactions = [
        input.raiseId,
        input.commitmentId,
        session?.receipt ?? "",
        founderCode ?? "",
        "signerAccount" in input ? input.signerAccount : "",
        "receiverAccount" in input ? input.receiverAccount : "",
        "transactionHash" in input ? input.transactionHash : "",
      ].filter((value): value is string => typeof value === "string");

      if (input.action === "status") {
        const response = safeSettlement(await apiRequest(path, {
          founderCode: session ? undefined : founderCode,
          investorReceipt: session?.receipt,
          redact: redactions,
        }));
        return textResult(safeSettlementStatus(response));
      }

      if (input.action === "founder_confirm") {
        if (input.confirmed !== true) {
          throw new SafeToolError("Founder confirmation is missing. Set confirmed to true only after the founder reviews the testnet receiver.");
        }
        if (!founderCode?.trim()) {
          throw new SafeToolError("Founder setup is unavailable. Set RAISE_APPROVAL_CODE in the MCP process environment.");
        }
        const current = safeSettlement(await apiRequest(path, {
          founderCode,
          redact: redactions,
        }));
        if (current.settlement && current.settlement.network !== "testnet") {
          throw new SafeToolError("This MCP tool only supports NEAR testnet settlement. No transfer was sent.");
        }
        const payload = ConfigureDemoSettlementBody.parse({
          network: "testnet",
          receiverAccount: input.receiverAccount,
          ...(input.reference ? { reference: input.reference } : {}),
          confirmed: input.confirmed,
        });
        const configured = ConfigureDemoSettlementResponse.parse(await apiRequest(path, {
          method: "POST",
          body: payload,
          founderCode,
          redact: redactions,
        }));
        if (!configured.settlement) throw new SafeToolError("The API did not return settlement status.");
        if (session) session.settlementId = configured.settlement.id;
        return textResult({
          status: configured.settlement.status,
          confirmedRoles: configured.settlement.confirmations.map(({ role }) =>
            role === "sponsor" ? "Founder" : "Investor",
          ),
          nextStep: "investor_confirm",
          message: "Founder confirmation recorded. The investor must separately confirm before preparation.",
        });
      }

      if (!session) {
        throw new SafeToolError("Investor authorization is available only for a soft commitment created in this running MCP session. Create a new synthetic commitment here; do not retry an existing commitment ID.");
      }

      const current = safeSettlement(await apiRequest(path, {
        investorReceipt: session.receipt,
        redact: redactions,
      }));
      if (current.settlement && current.settlement.network !== "testnet") {
        throw new SafeToolError("This MCP tool only supports NEAR testnet settlement. No transfer was sent.");
      }

      if (input.action === "investor_confirm") {
        if (input.confirmed !== true) {
          throw new SafeToolError("Investor confirmation is missing. Set confirmed to true only after the investor reviews the transfer.");
        }
        const settlementId = session.settlementId ?? current.settlement?.id;
        if (!settlementId) {
          throw new SafeToolError("Founder transfer details are missing. Complete founder_confirm first.");
        }
        const payload = ConfirmDemoSettlementBody.parse({
          settlementId,
          signerAccount: input.signerAccount,
          confirmed: input.confirmed,
        });
        const confirmed = ConfirmDemoSettlementResponse.parse(await apiRequest(`${path}/confirm`, {
          method: "POST",
          body: payload,
          investorReceipt: session.receipt,
          redact: redactions,
        }));
        if (!confirmed.settlement) throw new SafeToolError("The API did not return settlement status.");
        return textResult({
          status: confirmed.settlement.status,
          confirmedRoles: confirmed.settlement.confirmations.map(({ role }) =>
            role === "sponsor" ? "Founder" : "Investor",
          ),
          nextStep: "prepare",
        });
      }

      if (input.action === "prepare") {
        const prepared = safeSettlement(await apiRequest(`${path}/prepare`, {
          method: "POST",
          body: {},
          investorReceipt: session.receipt,
          redact: redactions,
        }));
        const settlement = prepared.settlement;
        if (!settlement) throw new SafeToolError("The API did not return settlement status.");
        if (settlement.network !== "testnet") {
          throw new SafeToolError("This MCP tool only supports NEAR testnet settlement. No transfer was sent.");
        }
        if (!prepared.maySend || !settlement.transferMemo) {
          return textResult({
            status: settlement.status,
            maySend: false,
            ...(settlement.status === "success" && settlement.transactionHash
              ? { transactionHash: settlement.transactionHash }
              : {}),
            message: "No new transfer is authorized by this result. Do not send again.",
          });
        }
        return textResult({
          status: settlement.status,
          maySend: true,
          network: "testnet",
          walletInstructions: {
            tokenContract: settlement.tokenContract,
            method: "ft_transfer",
            args: {
              receiver_id: settlement.receiverAccount,
              amount: "1000000",
              memo: settlement.transferMemo,
            },
            deposit: "1",
          },
          requiresUserSignature: true,
          message: "These are instructions only. No transfer has been sent; the investor must review and sign with a NEAR testnet wallet.",
          nextStep: "verify",
        });
      }

      if (!current.settlement || current.settlement.status !== "prepared") {
        throw new SafeToolError("Transfer preparation is missing. Both roles must confirm and prepare the testnet transfer before verification.");
      }
      if (!input.transactionHash) {
        throw new SafeToolError("Signed transaction hash is missing. After the investor signs the prepared testnet transfer, provide its hash for verification.");
      }
      const payload = VerifyDemoSettlementBody.parse({ transactionHash: input.transactionHash });
      const verified = VerifyDemoSettlementResponse.parse(await apiRequest(`${path}/verify`, {
        method: "POST",
        body: payload,
        investorReceipt: session.receipt,
        redact: redactions,
      }));
      if (
        verified.settlement?.status !== "success" ||
        verified.settlement.network !== "testnet" ||
        verified.settlement.transactionHash !== input.transactionHash
      ) {
        throw new SafeToolError("The API did not confirm this testnet transfer. Do not report it as settled.");
      }
      return textResult({
        status: "success",
        network: "testnet",
        verified: true,
        transactionHash: verified.settlement.transactionHash,
      });
    }),
  );

  return server;
}
