import { timingSafeEqual } from "node:crypto";
import { validateRaiseSubmission } from "@workspace/api-zod/raise-submission";
import {
  AuthenticateNearIntentsSessionBody,
  AuthenticateNearIntentsSessionResponse,
  ApproveRaiseParams,
  ApproveRaiseResponse,
  ClaimRaiseBody,
  ClaimRaiseParams,
  ClaimRaiseResponse,
  GetPendingRaisesResponse,
  GetPrivateRaiseParams,
  GetPrivateRaiseResponse,
  GetRaiseByIdParams,
  GetRaiseByIdResponse,
  GetRaisesResponse,
  DisconnectNearIntentsSessionResponse,
  RefreshNearIntentsSessionResponse,
  SubmitRaiseBody,
  SubmitRaiseResponse,
  SubmitSoftCommitmentBody,
  SubmitSoftCommitmentParams,
  SubmitSoftCommitmentResponse,
  RequestDemoQuoteParams,
  RequestDemoQuoteResponse,
  UpdateRaiseCommitmentBody,
  UpdateRaiseCommitmentParams,
  UpdateRaiseCommitmentResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  approveRaiseRecord,
  claimRaiseRecord,
  getPendingRaises,
  getPrivateRaise,
  getRaiseWithConfirmedTestnetCount,
  getRaisesWithConfirmedTestnetCounts,
  submitRaiseRecord,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
} from "../lib/raise-store";

const router: IRouter = Router();
const rateLimitWindows = new Map<string, number[]>();
const INTENTS_QUOTE_URL = "https://1click.chaindefuser.com/v0/quote";
const INTENTS_AUTHENTICATE_URL = "https://1click.chaindefuser.com/v0/auth/authenticate";
const INTENTS_REFRESH_URL = "https://1click.chaindefuser.com/v0/auth/refresh";
const NEAR_REFRESH_COOKIE = "near_intents_refresh";
const NEAR_ACCOUNT_COOKIE = "near_intents_account";
const NEAR_SESSION_COOKIE_PATH = "/api/near-intents/session";
const MAX_REFRESH_COOKIE_AGE_MS = 365 * 24 * 60 * 60 * 1_000;
type ProviderAccessSession = { accessToken: string; expiresIn: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBaseUnitAmount(value: unknown): value is string {
  // Base units are unsigned decimal integers (zero and leading zeros allowed).
  // Reject signs, fractions, exponents, alternate radices, and all whitespace.
  // Keep strings intact so large amounts never lose precision through Number.
  return typeof value === "string" && value.length > 0 && !/[^0-9]/.test(value);
}

function noStore(res: Response): Response {
  return res.set("Cache-Control", "no-store");
}

function nearSessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: NEAR_SESSION_COOKIE_PATH,
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

function getCookie(req: Request, name: string): string | null {
  const header = req.get("cookie");
  if (!header) return null;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    const value = entry.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

function clearNearSessionCookies(res: Response): void {
  const options = nearSessionCookieOptions();
  res.clearCookie(NEAR_REFRESH_COOKIE, options);
  res.clearCookie(NEAR_ACCOUNT_COOKIE, options);
}

function setNearSessionCookies(
  res: Response,
  refreshToken: string,
  accountId: string,
  refreshExpiresIn: number,
): void {
  const maxAge = Math.min(refreshExpiresIn * 1_000, MAX_REFRESH_COOKIE_AGE_MS);
  res.cookie(NEAR_REFRESH_COOKIE, refreshToken, nearSessionCookieOptions(maxAge));
  res.cookie(NEAR_ACCOUNT_COOKIE, accountId, nearSessionCookieOptions(maxAge));
}

function parseNearSession(value: unknown): ProviderAccessSession | null {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== "string" ||
    !value.accessToken ||
    typeof value.expiresIn !== "number" ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0
  ) {
    return null;
  }
  return { accessToken: value.accessToken, expiresIn: value.expiresIn };
}

export function requireApprovalCode(req: Request, res: Response): boolean {
  const expected = process.env.RAISE_APPROVAL_CODE;
  if (!expected?.trim()) {
    noStore(res);
    res.status(503).json({ error: "Founder access is not configured." });
    return false;
  }

  const authorization = req.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  const matches =
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes);

  if (!matches) {
    noStore(res);
    res.status(401).json({ error: "Enter the founder approval code." });
    return false;
  }
  return true;
}

router.post("/near-intents/session", async (req, res): Promise<void> => {
  noStore(res);
  if (isRateLimited(req, "near-session-auth", 10, 10 * 60_000)) {
    res.status(429).json({ error: "Too many wallet authentication attempts. Try again later." });
    return;
  }

  const parsed = AuthenticateNearIntentsSessionBody.safeParse(req.body);
  if (!parsed.success || parsed.data.signedData.payload.recipient !== "intents.near") {
    res.status(400).json({ error: "The signed NEAR wallet proof is invalid." });
    return;
  }

  let accountId: unknown;
  try {
    const message = JSON.parse(parsed.data.signedData.payload.message) as unknown;
    accountId = isRecord(message) ? message.signer_id : undefined;
  } catch {
    accountId = undefined;
  }
  if (typeof accountId !== "string" || !accountId.trim() || accountId.length > 64) {
    res.status(400).json({ error: "The signed NEAR wallet proof is invalid." });
    return;
  }

  let upstream: Awaited<ReturnType<typeof fetch>>;
  let body: unknown;
  try {
    upstream = await fetch(INTENTS_AUTHENTICATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedData: parsed.data.signedData }),
      signal: AbortSignal.timeout(15_000),
    });
    body = await upstream.json().catch(() => ({}));
  } catch {
    res.status(502).json({ error: "NEAR Intents could not authenticate this wallet." });
    return;
  }

  const authSession = parseNearSession(body);
  if (
    !upstream.ok ||
    !authSession ||
    !isRecord(body) ||
    typeof body.refreshToken !== "string" ||
    !body.refreshToken ||
    typeof body.refreshExpiresIn !== "number" ||
    !Number.isFinite(body.refreshExpiresIn) ||
    body.refreshExpiresIn <= 0
  ) {
    req.log.warn(
      { upstreamStatus: upstream.status },
      "NEAR Intents did not issue a valid user session",
    );
    res.status(502).json({ error: "NEAR Intents could not authenticate this wallet." });
    return;
  }

  setNearSessionCookies(res, body.refreshToken, accountId, body.refreshExpiresIn);
  res.json(
    AuthenticateNearIntentsSessionResponse.parse({
      accountId,
      accessToken: authSession.accessToken,
      expiresIn: authSession.expiresIn,
    }),
  );
});

router.post("/near-intents/session/refresh", async (req, res): Promise<void> => {
  noStore(res);
  if (isRateLimited(req, "near-session-refresh", 60, 60_000)) {
    res.status(429).json({ error: "Too many wallet refresh attempts. Try again shortly." });
    return;
  }

  const refreshToken = getCookie(req, NEAR_REFRESH_COOKIE);
  const accountId = getCookie(req, NEAR_ACCOUNT_COOKIE);
  if (!refreshToken || !accountId || accountId.length > 64) {
    clearNearSessionCookies(res);
    res.status(401).json({ error: "No active NEAR wallet session is available." });
    return;
  }

  let upstream: Awaited<ReturnType<typeof fetch>>;
  let body: unknown;
  try {
    upstream = await fetch(INTENTS_REFRESH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(15_000),
    });
    body = await upstream.json().catch(() => ({}));
  } catch {
    res.status(502).json({ error: "NEAR Intents could not refresh this wallet session." });
    return;
  }

  const refreshed = parseNearSession(body);
  if (!upstream.ok || !refreshed) {
    if (upstream.status === 401) clearNearSessionCookies(res);
    req.log.warn(
      { upstreamStatus: upstream.status },
      "NEAR Intents could not refresh the user session",
    );
    res
      .status(upstream.status === 401 ? 401 : 502)
      .json({ error: "NEAR Intents could not refresh this wallet session." });
    return;
  }

  res.json(
    RefreshNearIntentsSessionResponse.parse({
      accountId,
      accessToken: refreshed.accessToken,
      expiresIn: refreshed.expiresIn,
    }),
  );
});

router.delete("/near-intents/session", (_req, res): void => {
  noStore(res);
  clearNearSessionCookies(res);
  res.json(DisconnectNearIntentsSessionResponse.parse({ cleared: true }));
});

function isRateLimited(req: Request, bucket: string, max: number, windowMs: number): boolean {
  const source = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${bucket}:${source}`;
  const now = Date.now();
  const activeTimes = (rateLimitWindows.get(key) ?? []).filter((time) => now - time < windowMs);

  if (activeTimes.length >= max) {
    rateLimitWindows.set(key, activeTimes);
    return true;
  }

  activeTimes.push(now);
  rateLimitWindows.set(key, activeTimes);
  if (rateLimitWindows.size > 2_000) {
    for (const [existingKey, times] of rateLimitWindows) {
      if (times.every((time) => now - time >= windowMs)) rateLimitWindows.delete(existingKey);
    }
  }
  return false;
}

router.post("/raises", async (req, res): Promise<void> => {
  const { input, errors } = validateRaiseSubmission(req.body);
  if (Object.keys(errors).length > 0) {
    noStore(res);
    res.status(400).json({
      error: Object.values(errors).join(" "),
      fieldErrors: errors,
    });
    return;
  }
  // The generated contract remains authoritative after normalization.
  const parsed = SubmitRaiseBody.safeParse(input);
  if (!parsed.success) {
    noStore(res).status(400).json({ error: "The raise details are invalid." });
    return;
  }

  if (isRateLimited(req, "raise-submission", 5, 60 * 60 * 1_000)) {
    noStore(res);
    res.status(429).json({ error: "Submission limit reached. Try again later." });
    return;
  }

  const submitted = await submitRaiseRecord(parsed.data);
  noStore(res).status(201).json(SubmitRaiseResponse.parse(submitted));
});

router.get("/raises", async (_req, res): Promise<void> => {
  noStore(res).json(GetRaisesResponse.parse(await getRaisesWithConfirmedTestnetCounts()));
});

router.get("/raises/pending", async (req, res): Promise<void> => {
  if (!requireApprovalCode(req, res)) return;
  noStore(res).json(GetPendingRaisesResponse.parse(await getPendingRaises()));
});

router.get("/raises/:id", async (req, res): Promise<void> => {
  const params = GetRaiseByIdParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const raise = await getRaiseWithConfirmedTestnetCount(params.data.id);
  if (!raise) {
    noStore(res).status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }

  noStore(res).json(GetRaiseByIdResponse.parse(raise));
});

router.get("/raises/:id/private", async (req, res): Promise<void> => {
  if (!requireApprovalCode(req, res)) return;
  const params = GetPrivateRaiseParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const raise = await getPrivateRaise(params.data.id);
  if (!raise) {
    noStore(res).status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }

  noStore(res).json(GetPrivateRaiseResponse.parse(raise));
});

router.post("/raises/:id/approve", async (req, res): Promise<void> => {
  if (!requireApprovalCode(req, res)) return;
  const params = ApproveRaiseParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const raise = await approveRaiseRecord(params.data.id);
  if (!raise) {
    noStore(res).status(404).json({ error: "Pending raise not found." });
    return;
  }

  noStore(res).json(ApproveRaiseResponse.parse(raise));
});

router.post("/raises/:id/claim", async (req, res): Promise<void> => {
  const params = ClaimRaiseParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const body =
    req.body && typeof req.body === "object"
      ? {
          ...req.body,
          founderName:
            typeof req.body.founderName === "string" ? req.body.founderName.trim() : req.body.founderName,
          email: typeof req.body.email === "string" ? req.body.email.trim() : req.body.email,
          signatureOrAccount:
            typeof req.body.signatureOrAccount === "string"
              ? req.body.signatureOrAccount.trim()
              : req.body.signatureOrAccount,
        }
      : req.body;
  const parsed = ClaimRaiseBody.safeParse(body);
  if (!parsed.success) {
    noStore(res).status(400).json({ error: "Enter a valid founder name and email." });
    return;
  }

  const result = await claimRaiseRecord(params.data.id, parsed.data);
  if (result.kind === "notFound") {
    noStore(res).status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }
  if (result.kind === "alreadyClaimed") {
    noStore(res).status(409).json({ error: "This raise has already been claimed." });
    return;
  }
  if (result.kind !== "success") {
    noStore(res).status(500).json({ error: "Claim could not be saved." });
    return;
  }

  noStore(res).status(201).json(ClaimRaiseResponse.parse(result.raise));
});

router.post("/raises/:id/commitments", async (req, res): Promise<void> => {
  const params = SubmitSoftCommitmentParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const body =
    req.body && typeof req.body === "object"
      ? {
          ...req.body,
          identifier:
            typeof req.body.identifier === "string" ? req.body.identifier.trim() : req.body.identifier,
        }
      : req.body;
  const parsed = SubmitSoftCommitmentBody.safeParse(body);
  if (!parsed.success || !Number.isSafeInteger(parsed.data?.amount)) {
    noStore(res).status(400).json({
      error: "Enter a non-empty identifier and a positive whole amount.",
    });
    return;
  }
  if (isRateLimited(req, "commitment-submission", 30, 60 * 60 * 1_000)) {
    noStore(res);
    res.status(429).json({ error: "Submission limit reached. Try again later." });
    return;
  }

  const result = await submitSoftCommitmentRecord(params.data.id, parsed.data);
  if (result.kind === "amountOutOfRange") {
    noStore(res).status(400).json({ error: "The commitment would exceed the supported total." });
    return;
  }
  if (result.kind === "notFound") {
    noStore(res).status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }
  if (result.kind === "conflict") {
    noStore(res)
      .status(409)
      .json({ error: "That commitment ID already has different details." });
    return;
  }
  if (result.kind !== "success") {
    noStore(res).status(500).json({ error: "Commitment could not be saved." });
    return;
  }

  noStore(res)
    .status(result.created === false ? 200 : 201)
    .json(SubmitSoftCommitmentResponse.parse(result.raise));
});

router.patch(
  "/raises/:id/commitments/:commitmentId",
  async (req, res): Promise<void> => {
  if (!requireApprovalCode(req, res)) return;
  const params = UpdateRaiseCommitmentParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise or commitment ID." });
    return;
  }

  const parsed = UpdateRaiseCommitmentBody.safeParse(req.body);
  if (!parsed.success) {
    noStore(res).status(400).json({ error: "Provide hard and verified boolean statuses." });
    return;
  }

  const result = await updateRaiseCommitmentRecord(
    params.data.id,
    params.data.commitmentId,
    parsed.data,
  );
  if (result.kind === "amountOutOfRange") {
    noStore(res).status(400).json({ error: "The commitment would exceed the supported total." });
    return;
  }
  if (result.kind === "notFound") {
    noStore(res).status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }
  if (result.kind === "commitmentNotFound") {
    noStore(res)
      .status(404)
      .json({ error: `Commitment '${params.data.commitmentId}' not found.` });
    return;
  }
  if (result.kind === "invalidStatus") {
    noStore(res).status(400).json({ error: "A verified commitment must also be hard." });
    return;
  }
  if (result.kind !== "success") {
    noStore(res).status(500).json({ error: "Commitment status could not be saved." });
    return;
  }

  noStore(res).json(UpdateRaiseCommitmentResponse.parse(result.raise));
  },
);

router.post(
  "/raises/:id/commitments/:commitmentId/quote",
  async (req, res): Promise<void> => {
    if (!requireApprovalCode(req, res)) return;

    const userSessionToken = req.get("x-near-user-session")?.trim();
    if (!userSessionToken) {
      noStore(res)
        .status(401)
        .json({ error: "Authenticate a NEAR wallet before requesting a confidential quote." });
      return;
    }

    const params = RequestDemoQuoteParams.safeParse(req.params);
    if (!params.success) {
      noStore(res).status(400).json({ error: "Invalid raise or commitment ID." });
      return;
    }

    const raise = await getPrivateRaise(params.data.id);
    if (!raise) {
      noStore(res).status(404).json({ error: `Raise '${params.data.id}' not found.` });
      return;
    }

    const commitment = raise.commitments.find((item) => item.id === params.data.commitmentId);
    if (!commitment) {
      noStore(res).status(404).json({ error: "Commitment not found." });
      return;
    }
    if (!commitment.hard) {
      noStore(res).status(409).json({ error: "Mark the commitment hard before requesting a quote." });
      return;
    }

    // Never send the private commitment identifier or amount to NEAR.
    // One USDC and these placeholder addresses are used for every demo quote.
    const quoteRequest = {
      dry: true,
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
      depositType: "ORIGIN_CHAIN",
      destinationAsset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
      amount: "1000000",
      recipient: "0x1111111111111111111111111111111111111111",
      recipientType: "DESTINATION_CHAIN",
      refundTo: "0x2222222222222222222222222222222222222222",
      refundType: "ORIGIN_CHAIN",
      confidentiality: "basic",
      deadline: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    };

    let upstreamResponse: Awaited<ReturnType<typeof fetch>>;
    let upstreamBody: unknown;
    try {
      upstreamResponse = await fetch(INTENTS_QUOTE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userSessionToken}`,
        },
        body: JSON.stringify(quoteRequest),
        signal: AbortSignal.timeout(15_000),
      });
      upstreamBody = await upstreamResponse.json().catch(() => ({}));
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      noStore(res)
        .status(timedOut ? 504 : 502)
        .json({
          error: timedOut
            ? "NEAR Intents did not respond before the quote request timed out. No funds moved."
            : "Could not reach NEAR Intents for a dry-run quote. No funds moved.",
        });
      return;
    }

    if (!upstreamResponse.ok) {
      const providerMessage =
        isRecord(upstreamBody) && typeof upstreamBody.message === "string"
          ? upstreamBody.message
          : "";
      req.log.warn(
        { upstreamStatus: upstreamResponse.status },
        "NEAR Intents rejected the synthetic dry-run quote",
      );

      const error =
        upstreamResponse.status === 401 &&
        providerMessage.toLowerCase().includes("authentication is required")
          ? "NEAR Intents rejected the NEAR wallet session for this confidential quote. Reauthenticate the wallet and try again. No funds moved."
          : `NEAR Intents rejected the dry-run quote (HTTP ${upstreamResponse.status}). No funds moved.`;
      noStore(res).status(502).json({ error });
      return;
    }

    const quote =
      isRecord(upstreamBody) && isRecord(upstreamBody.quote)
        ? upstreamBody.quote
        : undefined;
    // Preserve the receipt-time fallback when no string timestamp is supplied,
    // but reject invalid provider dates rather than silently replacing them.
    const quotedAt =
      isRecord(upstreamBody) && typeof upstreamBody.timestamp === "string"
        ? upstreamBody.timestamp
        : new Date().toISOString();
    if (
      !quote ||
      !isBaseUnitAmount(quote.amountIn) ||
      !isBaseUnitAmount(quote.amountOut) ||
      !Number.isFinite(Date.parse(quotedAt))
    ) {
      req.log.warn(
        { upstreamStatus: upstreamResponse.status },
        "NEAR Intents returned an unexpected quote shape",
      );
      noStore(res)
        .status(502)
        .json({ error: "NEAR Intents returned an unreadable quote. No funds moved." });
      return;
    }
    const inputAmount = quote.amountIn;
    const outputAmount = quote.amountOut;

    const quoteId =
      typeof quote.id === "string"
        ? quote.id
        : isRecord(upstreamBody) && typeof upstreamBody.quoteId === "string"
          ? upstreamBody.quoteId
          : null;
    noStore(res).json(
      RequestDemoQuoteResponse.parse({
        dry: true,
        confidentialityRequested: "basic",
        inputSymbol: "USDC",
        outputSymbol: "USDC",
        inputAmount,
        outputAmount,
        quoteId,
        quotedAt,
      }),
    );
  },
);

export default router;
