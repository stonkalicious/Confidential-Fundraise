import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, demoSettlementsTable, type DemoSettlementRecord } from "@workspace/db";
import {
  ConfigureDemoSettlementBody, ConfirmDemoSettlementBody,
  VerifyDemoSettlementBody, GetDemoSettlementResponse,
  GetDemoSettlementConfigResponse, GetDemoSettlementParams,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import { getDemoCommitmentAccess } from "../lib/raise-store";
import { requireApprovalCode } from "./raises";
import {
  USDC_CONTRACTS, SettlementError, validNearAccount, validReference,
  preflightSettlement, verifySettlementTransaction, type SettlementNetwork,
} from "../lib/demo-settlement";

const router: IRouter = Router();
const path = "/raises/:id/demo-settlements/:commitmentId";

function snapshot(row?: DemoSettlementRecord) {
  return GetDemoSettlementResponse.parse(row ? { settlement: {
    id: row.id, network: row.network,
    tokenContract: USDC_CONTRACTS[row.network as SettlementNetwork],
    receiverAccount: row.receiverAccount,
    ...(row.reference ? { reference: row.reference } : {}),
    ...(row.signerAccount ? { signerAccount: row.signerAccount } : {}),
    confirmations: [
      { role: "sponsor", timestamp: row.sponsorConfirmedAt.toISOString() },
      ...(row.investorConfirmedAt ? [{ role: "investor", timestamp: row.investorConfirmedAt.toISOString() }] : []),
    ],
    status: row.transactionHash ? "success" : row.preparedAt ? "prepared" : row.investorConfirmedAt ? "ready" : "awaiting_investor",
    ...(row.transferMemo ? { transferMemo: row.transferMemo } : {}),
    ...(row.transactionHash ? { transactionHash: row.transactionHash } : {}),
  } } : {});
}

type Handler = (req: Request, res: Response, id: string, commitmentId: string) => Promise<void>;
function handle(role: "sponsor" | "investor" | "either", handler: Handler) {
  return async (req: Request, res: Response): Promise<void> => {
    res.set("Cache-Control", "no-store");
    try {
      const params = GetDemoSettlementParams.safeParse(req.params);
      if (!params.success) throw new SettlementError("Invalid raise or commitment.", 400);
      const { id, commitmentId } = params.data;
      // A sponsor credential cannot stand in for an investor confirmation.
      if (role === "sponsor" && !requireApprovalCode(req, res)) return;
      const access = await getDemoCommitmentAccess(id, commitmentId, req.get("X-Demo-Receipt"));
      if (!access.exists) throw new SettlementError("An existing soft commitment is required.", 404);
      if (role !== "sponsor" && !access.investor) {
        if (role === "investor") throw new SettlementError("Use the browser receipt from your original soft commitment.", 403);
        if (!requireApprovalCode(req, res)) return;
      }
      await handler(req, res, id, commitmentId);
    } catch (error) {
      if (error instanceof SettlementError) res.status(error.status).json({ error: error.message });
      else {
        req.log.error({ err: error }, "Demo settlement request failed");
        res.status(500).json({ error: "The demo transfer could not be saved. Do not send again; check its status." });
      }
    }
  };
}

function whereCommitment(id: string, commitmentId: string) {
  return and(eq(demoSettlementsTable.raiseId, id), eq(demoSettlementsTable.commitmentId, commitmentId));
}
async function find(id: string, commitmentId: string): Promise<DemoSettlementRecord> {
  const [row] = await db.select().from(demoSettlementsTable).where(whereCommitment(id, commitmentId));
  if (!row) throw new SettlementError("Waiting for the sponsor to confirm the demo transfer.");
  return row;
}

router.get("/demo-settlement-config", (_req, res) => {
  res.json(GetDemoSettlementConfigResponse.parse(USDC_CONTRACTS));
});
router.get(path, handle("either", async (_req, res, id, cid) => {
  const [row] = await db.select().from(demoSettlementsTable).where(whereCommitment(id, cid));
  res.json(snapshot(row));
}));
router.post(path, handle("sponsor", async (req, res, id, cid) => {
  const parsed = ConfigureDemoSettlementBody.safeParse(req.body);
  if (!parsed.success || parsed.data.confirmed !== true ||
      !validNearAccount(parsed.data.receiverAccount) ||
      !validReference(parsed.data.reference?.trim() ?? "")) {
    throw new SettlementError("Confirm the demo terms and enter a valid NEAR account and optional HTTP(S) link or document hash.", 400);
  }
  const input = parsed.data;
  const reference = input.reference?.trim() || null;
  await db.insert(demoSettlementsTable).values({
    raiseId: id, commitmentId: cid, network: input.network,
    receiverAccount: input.receiverAccount, reference, sponsorConfirmedAt: new Date(),
  }).onConflictDoNothing();
  const row = await find(id, cid);
  if (row.network !== input.network || row.receiverAccount !== input.receiverAccount || row.reference !== reference) {
    throw new SettlementError("The sponsor has already confirmed different details. Confirmed transfers cannot be changed.");
  }
  res.json(snapshot(row));
}));
router.post(`${path}/confirm`, handle("investor", async (req, res, id, cid) => {
  const parsed = ConfirmDemoSettlementBody.safeParse(req.body);
  if (!parsed.success || parsed.data.confirmed !== true || !validNearAccount(parsed.data.signerAccount)) {
    throw new SettlementError("The investor must tick the demo confirmation before sending.", 400);
  }
  const input = parsed.data;
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(demoSettlementsTable).where(whereCommitment(id, cid)).for("update");
    if (!row || row.id !== input.settlementId) throw new SettlementError("Review the sponsor's current transfer details first.");
    if (input.signerAccount === row.receiverAccount) throw new SettlementError("Use different investor and sponsor receiving accounts.", 400);
    if (row.investorConfirmedAt) {
      if (row.signerAccount !== input.signerAccount) throw new SettlementError("The investor already confirmed another sending account.");
      return;
    }
    await tx.update(demoSettlementsTable).set({
      signerAccount: input.signerAccount, investorConfirmedAt: new Date(),
    }).where(eq(demoSettlementsTable.id, row.id));
  });
  res.json(snapshot(await find(id, cid)));
}));
router.post(`${path}/prepare`, handle("investor", async (_req, res, id, cid) => {
  const row = await find(id, cid);
  if (!row.sponsorConfirmedAt || !row.investorConfirmedAt || !row.signerAccount) {
    throw new SettlementError("Both sponsor and investor must confirm before a transfer can be prepared.");
  }
  if (row.transactionHash || row.preparedAt) { res.json({ ...snapshot(row), maySend: false }); return; }
  await preflightSettlement(row);
  // A locked, single memo per commitment makes retries deterministic and
  // prevents a different payment from being reused as demo evidence.
  const maySend = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(demoSettlementsTable).where(eq(demoSettlementsTable.id, row.id)).for("update");
    if (!current || current.preparedAt) return false;
    await tx.update(demoSettlementsTable).set({
      preparedAt: new Date(), transferMemo: `demo-settlement:${randomUUID()}`,
    }).where(eq(demoSettlementsTable.id, row.id));
    return true;
  });
  res.json({ ...snapshot(await find(id, cid)), maySend });
}));
router.post(`${path}/verify`, handle("investor", async (req, res, id, cid) => {
  const parsed = VerifyDemoSettlementBody.safeParse(req.body);
  if (!parsed.success || !/^[1-9A-HJ-NP-Za-km-z]{40,50}$/.test(parsed.data.transactionHash)) {
    throw new SettlementError("Enter a valid NEAR transaction hash.", 400);
  }
  const hash = parsed.data.transactionHash;
  const row = await find(id, cid);
  if (!row.preparedAt || !row.investorConfirmedAt || !row.sponsorConfirmedAt) {
    throw new SettlementError("Both confirmations and transfer preparation are required.");
  }
  if (row.transactionHash) {
    if (row.transactionHash !== hash) throw new SettlementError("This demo transfer is already settled.");
    res.json(snapshot(row)); return;
  }
  await verifySettlementTransaction(row, hash);
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(demoSettlementsTable).where(eq(demoSettlementsTable.id, row.id)).for("update");
    if (current?.transactionHash && current.transactionHash !== hash) throw new SettlementError("This transfer has already settled.");
    await tx.update(demoSettlementsTable).set({ transactionHash: hash }).where(eq(demoSettlementsTable.id, row.id));
  });
  res.json(snapshot(await find(id, cid)));
}));

export default router;
