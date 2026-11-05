import {
  GetRaiseClaimResponse,
  SubmitRaiseClaimBody,
  SubmitRaiseClaimResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import {
  claimRaiseRecord,
  DEFAULT_RAISE_ID,
  getRaise,
} from "../lib/raise-store";

const router: IRouter = Router();

router.get("/raise-claim", (_req, res) => {
  const raise = getRaise(DEFAULT_RAISE_ID);
  res.set("Cache-Control", "no-store").json(
    GetRaiseClaimResponse.parse({
      claimed: raise?.claimed ?? false,
      founderName: raise?.claim?.founderName ?? null,
    }),
  );
});

router.post("/raise-claim", (req, res): void => {
  const body =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : {};
  const normalizedBody = {
    ...body,
    founderName:
      typeof body.founderName === "string"
        ? body.founderName.trim()
        : body.founderName,
    email: typeof body.email === "string" ? body.email.trim() : body.email,
    vehicleLink:
      typeof body.vehicleLink === "string"
        ? body.vehicleLink.trim()
        : body.vehicleLink,
  };
  const parsed = SubmitRaiseClaimBody.safeParse(normalizedBody);

  if (!parsed.success) {
    res
      .set("Cache-Control", "no-store")
      .status(400)
      .json({ error: "Enter a valid founder name and email." });
    return;
  }

  const result = claimRaiseRecord(DEFAULT_RAISE_ID, {
    founderName: parsed.data.founderName,
    email: parsed.data.email,
    ...(parsed.data.vehicleLink ? { signatureOrAccount: parsed.data.vehicleLink } : {}),
  });

  if (result.kind === "alreadyClaimed") {
    res
      .set("Cache-Control", "no-store")
      .status(409)
      .json({ error: "This raise has already been claimed." });
    return;
  }
  if (result.kind === "notFound") {
    res
      .set("Cache-Control", "no-store")
      .status(404)
      .json({ error: `Raise '${DEFAULT_RAISE_ID}' not found.` });
    return;
  }
  if (result.kind !== "success") {
    res.set("Cache-Control", "no-store").status(500).json({ error: "Claim could not be saved." });
    return;
  }

  res
    .set("Cache-Control", "no-store")
    .status(201)
    .json(
      SubmitRaiseClaimResponse.parse({
        claimed: true,
        founderName: result.raise.claim?.founderName ?? null,
      }),
    );
});

export default router;
