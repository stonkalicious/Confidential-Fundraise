import {
  ClaimRaiseBody,
  ClaimRaiseParams,
  ClaimRaiseResponse,
  GetRaiseByIdParams,
  GetRaiseByIdResponse,
  GetRaisesResponse,
  SubmitSoftCommitmentBody,
  SubmitSoftCommitmentParams,
  SubmitSoftCommitmentResponse,
  UpdateRaiseCommitmentBody,
  UpdateRaiseCommitmentParams,
  UpdateRaiseCommitmentResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import {
  claimRaiseRecord,
  getRaise,
  getRaises,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
} from "../lib/raise-store";

const router: IRouter = Router();

router.get("/raises", (_req, res) => {
  res.set("Cache-Control", "no-store").json(GetRaisesResponse.parse(getRaises()));
});

router.get("/raises/:id", (req, res): void => {
  const params = GetRaiseByIdParams.safeParse(req.params);
  if (!params.success) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const raise = getRaise(params.data.id);
  if (!raise) {
    res.set("Cache-Control", "no-store").status(404).json({
      error: `Raise '${params.data.id}' not found.`,
    });
    return;
  }

  res.set("Cache-Control", "no-store").json(GetRaiseByIdResponse.parse(raise));
});

router.post("/raises/:id/claim", (req, res): void => {
  const params = ClaimRaiseParams.safeParse(req.params);
  if (!params.success) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const body =
    req.body && typeof req.body === "object"
      ? {
          ...req.body,
          founderName: typeof req.body.founderName === "string" ? req.body.founderName.trim() : req.body.founderName,
          email: typeof req.body.email === "string" ? req.body.email.trim() : req.body.email,
          signatureOrAccount: typeof req.body.signatureOrAccount === "string"
            ? req.body.signatureOrAccount.trim()
            : req.body.signatureOrAccount,
        }
      : req.body;
  const parsed = ClaimRaiseBody.safeParse(body);
  if (!parsed.success) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Enter a valid founder name and email." });
    return;
  }

  const result = claimRaiseRecord(params.data.id, parsed.data);
  if (result.kind === "notFound") {
    res.set("Cache-Control", "no-store").status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }
  if (result.kind === "alreadyClaimed") {
    res.set("Cache-Control", "no-store").status(409).json({ error: "This raise has already been claimed." });
    return;
  }
  if (result.kind !== "success") {
    res.set("Cache-Control", "no-store").status(500).json({ error: "Claim could not be saved." });
    return;
  }

  res.set("Cache-Control", "no-store").status(201).json(ClaimRaiseResponse.parse(result.raise));
});

router.post("/raises/:id/commitments", (req, res): void => {
  const params = SubmitSoftCommitmentParams.safeParse(req.params);
  if (!params.success) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const body =
    req.body && typeof req.body === "object"
      ? {
          ...req.body,
          identifier: typeof req.body.identifier === "string" ? req.body.identifier.trim() : req.body.identifier,
        }
      : req.body;
  const parsed = SubmitSoftCommitmentBody.safeParse(body);
  if (!parsed.success || !Number.isSafeInteger(parsed.data?.amount)) {
    res.set("Cache-Control", "no-store").status(400).json({
      error: "Enter a non-empty identifier and a positive whole amount.",
    });
    return;
  }

  const result = submitSoftCommitmentRecord(params.data.id, parsed.data);
  if (result.kind === "notFound") {
    res.set("Cache-Control", "no-store").status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }
  if (result.kind === "conflict") {
    res.set("Cache-Control", "no-store").status(409).json({ error: "That commitment ID already has different details." });
    return;
  }
  if (result.kind !== "success") {
    res.set("Cache-Control", "no-store").status(500).json({ error: "Commitment could not be saved." });
    return;
  }

  res
    .set("Cache-Control", "no-store")
    .status(result.created === false ? 200 : 201)
    .json(SubmitSoftCommitmentResponse.parse(result.raise));
});

router.patch("/raises/:id/commitments/:commitmentId", (req, res): void => {
  const params = UpdateRaiseCommitmentParams.safeParse(req.params);
  if (!params.success) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Invalid raise or commitment ID." });
    return;
  }

  const parsed = UpdateRaiseCommitmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Provide hard and verified boolean statuses." });
    return;
  }

  const result = updateRaiseCommitmentRecord(
    params.data.id,
    params.data.commitmentId,
    parsed.data,
  );
  if (result.kind === "notFound") {
    res.set("Cache-Control", "no-store").status(404).json({ error: `Raise '${params.data.id}' not found.` });
    return;
  }
  if (result.kind === "commitmentNotFound") {
    res.set("Cache-Control", "no-store").status(404).json({
      error: `Commitment '${params.data.commitmentId}' not found.`,
    });
    return;
  }
  if (result.kind === "invalidStatus") {
    res.set("Cache-Control", "no-store").status(400).json({
      error: "A verified commitment must also be hard.",
    });
    return;
  }
  if (result.kind !== "success") {
    res.set("Cache-Control", "no-store").status(500).json({ error: "Commitment status could not be saved." });
    return;
  }

  res.set("Cache-Control", "no-store").json(UpdateRaiseCommitmentResponse.parse(result.raise));
});

export default router;
