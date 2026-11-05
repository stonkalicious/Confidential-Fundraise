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

export default router;
