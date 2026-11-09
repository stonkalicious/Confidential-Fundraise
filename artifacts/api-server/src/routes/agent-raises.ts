import { Router, type IRouter } from "express";
import {
  ReserveAgentRaiseParams,
  ReserveAgentRaiseResponse,
  UpdateAgentRaiseBody,
  UpdateAgentRaiseParams,
  UpdateAgentRaiseResponse,
} from "@workspace/api-zod";
import { reserveAgentRaiseRecord, updateAgentRaiseRecord } from "../lib/raise-store";

const router: IRouter = Router();

router.post("/raises/:id/agent-claim", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const params = ReserveAgentRaiseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid raise ID." });
    return;
  }
  const result = await reserveAgentRaiseRecord(params.data.id);
  if (result.kind === "notFound") {
    res.status(404).json({ error: "Raise not found." });
    return;
  }
  if (result.kind !== "success") {
    res.status(409).json({ error: "This raise page has already been claimed." });
    return;
  }
  res.status(201).json(ReserveAgentRaiseResponse.parse({
    raise: result.raise,
    claimToken: result.claimToken,
  }));
});

router.patch("/raises/:id", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const params = UpdateAgentRaiseParams.safeParse(req.params);
  const authorization = req.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || token.length > 256) {
    res.status(401).json({ error: "A valid per-raise claim token is required." });
    return;
  }
  if (!params.success) {
    res.status(400).json({ error: "Invalid raise ID." });
    return;
  }
  const body = req.body;
  const allowed = new Set(["thesis", "stage", "range", "status"]);
  const parsed = UpdateAgentRaiseBody.safeParse(body);
  if (
    !parsed.success || !body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).length === 0 || Object.keys(body).some((key) => !allowed.has(key)) ||
    (parsed.data.thesis !== undefined && parsed.data.thesis.trim().length < 10) ||
    (parsed.data.stage !== undefined && !parsed.data.stage.trim()) ||
    (parsed.data.range !== undefined && (
      Object.keys(body.range).some((key) => key !== "min" && key !== "max") ||
      !Number.isSafeInteger(parsed.data.range.min) ||
      !Number.isSafeInteger(parsed.data.range.max) ||
      parsed.data.range.min <= 0 || parsed.data.range.max < parsed.data.range.min
    ))
  ) {
    res.status(400).json({ error: "Supply only valid public fields: thesis, stage, range, status (open, paused, closed)." });
    return;
  }
  const result = await updateAgentRaiseRecord(params.data.id, token, parsed.data);
  if (result.kind === "notFound") {
    res.status(404).json({ error: "Raise not found." });
    return;
  }
  if (result.kind !== "success") {
    res.status(401).json({ error: "A valid per-raise claim token is required." });
    return;
  }
  res.json(UpdateAgentRaiseResponse.parse(result.raise));
});

export default router;
