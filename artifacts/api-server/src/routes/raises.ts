import {
  GetRaiseByIdParams,
  GetRaiseByIdResponse,
  GetRaisesResponse,
  SyncRaiseSummariesBody,
  SyncRaiseSummariesResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

const seededRaises = [
  {
    id: "confidential-fundraise-thesis",
    name: "Confidential Fundraise Thesis",
    thesis: "Fund-wide thesis for private money and confidential cross-chain settlement.",
    stage: "Fundraise",
    range: { min: 2_000_000, max: 5_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
  },
  {
    id: "cedar-grid",
    name: "AI Encyclopedia",
    thesis: "Each disputed fact becomes an ongoing market; AI writes a public page from the market’s current view.",
    stage: "Seed",
    range: { min: 1_000_000, max: 2_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
  },
  {
    id: "harbor-materials",
    name: "Private Social Trading",
    thesis: "Traders keep NEAR Intents positions private by default and share temporary viewing keys with selected followers; everyone else sees public PnL.",
    stage: "Pre-seed",
    range: { min: 500_000, max: 1_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
  },
  {
    id: "lumen-labs",
    name: "Universal Checkout Widget",
    thesis: "A single checkout button lets users pay with an existing wallet and chain through NEAR Intents.",
    stage: "Series A",
    range: { min: 3_000_000, max: 5_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
  },
  {
    id: "swarm-for-hire",
    name: "Swarm-for-Hire",
    thesis: "Job posters set a NEAR budget; others fund agent inference, and accepted work is paid from the budget.",
    stage: "Pre-seed",
    range: { min: 500_000, max: 1_000_000 },
    claimed: false,
    softTotal: 0,
    hardTotal: 0,
  },
];

let raises = GetRaisesResponse.parse(seededRaises);
const raiseIds = new Set(raises.map((raise) => raise.id));

router.get("/raises", (_req, res) => {
  res.set("Cache-Control", "no-store").json(GetRaisesResponse.parse(raises));
});

router.get("/raises/:id", (req, res): void => {
  const params = GetRaiseByIdParams.safeParse(req.params);
  if (!params.success) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Invalid raise ID." });
    return;
  }

  const raise = raises.find((item) => item.id === params.data.id);
  if (!raise) {
    res.set("Cache-Control", "no-store").status(404).json({
      error: `Raise '${params.data.id}' not found.`,
    });
    return;
  }

  res.set("Cache-Control", "no-store").json(GetRaiseByIdResponse.parse(raise));
});

router.put("/raises", (req, res): void => {
  const parsed = SyncRaiseSummariesBody.safeParse(req.body);
  if (!parsed.success) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Invalid raise summaries." });
    return;
  }

  const updates = parsed.data.raises;
  const updateIds = updates.map((raise) => raise.id);
  if (
    updates.length !== raises.length ||
    new Set(updateIds).size !== raiseIds.size ||
    updateIds.some((id) => !raiseIds.has(id))
  ) {
    res.set("Cache-Control", "no-store").status(400).json({ error: "Raise IDs do not match the demo list." });
    return;
  }

  const updatesById = new Map(updates.map((raise) => [raise.id, raise]));
  raises = GetRaisesResponse.parse(
    raises.map((raise) => {
      const update = updatesById.get(raise.id)!;
      return {
        ...raise,
        claimed: update.claimed,
        softTotal: update.softTotal,
        hardTotal: update.hardTotal,
      };
    }),
  );

  res.set("Cache-Control", "no-store").json(SyncRaiseSummariesResponse.parse(raises));
});

export default router;
