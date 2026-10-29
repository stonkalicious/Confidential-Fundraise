import {
  GetRaiseClaimResponse,
  SubmitRaiseClaimBody,
  SubmitRaiseClaimResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

type StoredRaiseClaim = {
  founderName: string;
  email: string;
  vehicleLink?: string;
};

const router: IRouter = Router();
let storedClaim: StoredRaiseClaim | null = null;

router.get("/raise-claim", (_req, res) => {
  res.set("Cache-Control", "no-store").json(
    GetRaiseClaimResponse.parse({
      claimed: storedClaim !== null,
      founderName: storedClaim?.founderName ?? null,
    }),
  );
});

router.post("/raise-claim", (req, res): void => {
  if (storedClaim) {
    res
      .set("Cache-Control", "no-store")
      .status(409)
      .json({ error: "This raise has already been claimed." });
    return;
  }

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

  storedClaim = {
    founderName: parsed.data.founderName,
    email: parsed.data.email,
    ...(parsed.data.vehicleLink
      ? { vehicleLink: parsed.data.vehicleLink }
      : {}),
  };

  res
    .set("Cache-Control", "no-store")
    .status(201)
    .json(
      SubmitRaiseClaimResponse.parse({
        claimed: true,
        founderName: storedClaim.founderName,
      }),
    );
});

export default router;
