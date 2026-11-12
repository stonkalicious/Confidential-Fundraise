import { timingSafeEqual } from "node:crypto";
import { validateRaiseSubmission } from "@workspace/api-zod/raise-submission";
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
  DisconnectNearIntentsSessionResponse,
  SubmitRaiseBody,
  SubmitRaiseResponse,
  SubmitSoftCommitmentBody,
  SubmitSoftCommitmentParams,
  SubmitSoftCommitmentResponse,
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
const NEAR_REFRESH_COOKIE = "near_intents_refresh";
const NEAR_ACCOUNT_COOKIE = "near_intents_account";
const NEAR_SESSION_COOKIE_PATH = "/api/near-intents/session";

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

function clearNearSessionCookies(res: Response): void {
  const options = nearSessionCookieOptions();
  res.clearCookie(NEAR_REFRESH_COOKIE, options);
  res.clearCookie(NEAR_ACCOUNT_COOKIE, options);
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

function rejectIntentsOnTestnetOnlyDemo(res: Response): void {
  noStore(res).status(410).json({
    error: "NEAR Intents has no testnet. Wallet authentication and quote requests are disabled in this testnet-only demo.",
  });
}

router.post("/near-intents/session", (_req, res): void => {
  rejectIntentsOnTestnetOnlyDemo(res);
});

router.post("/near-intents/session/refresh", (_req, res): void => {
  rejectIntentsOnTestnetOnlyDemo(res);
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
  (_req, res): void => rejectIntentsOnTestnetOnlyDemo(res),
);

export default router;
