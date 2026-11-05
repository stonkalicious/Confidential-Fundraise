import { timingSafeEqual } from "node:crypto";
import {
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
  getRaise,
  getRaises,
  submitRaiseRecord,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
} from "../lib/raise-store";

const router: IRouter = Router();
const rateLimitWindows = new Map<string, number[]>();
const INTENTS_QUOTE_URL = "https://1click.chaindefuser.com/v0/quote";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function noStore(res: Response): Response {
  return res.set("Cache-Control", "no-store");
}

function requireApprovalCode(req: Request, res: Response): boolean {
  const expected = process.env.RAISE_APPROVAL_CODE;
  if (!expected?.trim()) {
    noStore(res);
    res.status(503).json({ error: "Sponsor access is not configured." });
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
    res.status(401).json({ error: "Enter the sponsor approval code." });
    return false;
  }
  return true;
}

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

router.post("/raises", (req, res): void => {
  const body =
    req.body && typeof req.body === "object"
      ? {
          ...req.body,
          name: typeof req.body.name === "string" ? req.body.name.trim() : req.body.name,
          thesis: typeof req.body.thesis === "string" ? req.body.thesis.trim() : req.body.thesis,
          stage: typeof req.body.stage === "string" ? req.body.stage.trim() : req.body.stage,
        }
      : req.body;
  const parsed = SubmitRaiseBody.safeParse(body);
  if (
    !parsed.success ||
    !Number.isSafeInteger(parsed.data?.range.min) ||
    !Number.isSafeInteger(parsed.data?.range.max) ||
    parsed.data.range.min <= 0 ||
    parsed.data.range.max < parsed.data.range.min
  ) {
    noStore(res);
    res.status(400).json({
      error: "Enter a name, short thesis, stage, and valid positive round range.",
    });
    return;
  }

  if (isRateLimited(req, "raise-submission", 5, 60 * 60 * 1_000)) {
    noStore(res);
    res.status(429).json({ error: "Submission limit reached. Try again later." });
    return;
  }

  noStore(res).status(201).json(SubmitRaiseResponse.parse(submitRaiseRecord(parsed.data)));
});

router.get("/raises", (_req, res) => {
  noStore(res).json(GetRaisesResponse.parse(getRaises()));
});

router.get("/raises/pending", (req, res): void => {
  if (!requireApprovalCode(req, res)) return;
  noStore(res).json(GetPendingRaisesResponse.parse(getPendingRaises()));
});

router.get("/raises/:id", (req, res): void => {
  const params = GetRaiseByIdParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const raise = getRaise(params.data.id);
  if (!raise) {
    noStore(res).status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }

  noStore(res).json(GetRaiseByIdResponse.parse(raise));
});

router.get("/raises/:id/private", (req, res): void => {
  if (!requireApprovalCode(req, res)) return;
  const params = GetPrivateRaiseParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const raise = getPrivateRaise(params.data.id);
  if (!raise) {
    noStore(res).status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }

  noStore(res).json(GetPrivateRaiseResponse.parse(raise));
});

router.post("/raises/:id/approve", (req, res): void => {
  if (!requireApprovalCode(req, res)) return;
  const params = ApproveRaiseParams.safeParse(req.params);
  if (!params.success) {
    noStore(res).status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const raise = approveRaiseRecord(params.data.id);
  if (!raise) {
    noStore(res).status(404).json({ error: "Pending raise not found." });
    return;
  }

  noStore(res).json(ApproveRaiseResponse.parse(raise));
});

router.post("/raises/:id/claim", (req, res): void => {
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

  const result = claimRaiseRecord(params.data.id, parsed.data);
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

router.post("/raises/:id/commitments", (req, res): void => {
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

  const result = submitSoftCommitmentRecord(params.data.id, parsed.data);
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

router.patch("/raises/:id/commitments/:commitmentId", (req, res): void => {
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

  const result = updateRaiseCommitmentRecord(
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
});

router.post(
  "/raises/:id/commitments/:commitmentId/quote",
  async (req, res): Promise<void> => {
    if (!requireApprovalCode(req, res)) return;

    const params = RequestDemoQuoteParams.safeParse(req.params);
    if (!params.success) {
      noStore(res).status(400).json({ error: "Invalid raise or commitment ID." });
      return;
    }

    const raise = getPrivateRaise(params.data.id);
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
        headers: { "Content-Type": "application/json" },
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
          ? "NEAR Intents requires an end-user wallet-authenticated session for confidential quotes. This demo does not request signatures, so no confidential quote was issued. No funds moved."
          : `NEAR Intents rejected the dry-run quote (HTTP ${upstreamResponse.status}).${providerMessage ? ` ${providerMessage}` : ""} No funds moved.`;
      noStore(res).status(502).json({ error });
      return;
    }

    const quote =
      isRecord(upstreamBody) && isRecord(upstreamBody.quote)
        ? upstreamBody.quote
        : undefined;
    if (
      !quote ||
      typeof quote.amountIn !== "string" ||
      typeof quote.amountOut !== "string"
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
    const quotedAt =
      isRecord(upstreamBody) && typeof upstreamBody.timestamp === "string"
        ? upstreamBody.timestamp
        : new Date().toISOString();

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
