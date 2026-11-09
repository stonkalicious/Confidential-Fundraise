// Isolated browser-test harness. NEVER use this server for a real payment.
// NEAR RPC is simulated. Only this process uses the synthetic sponsor code.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, raiseStateTable, demoSettlementsTable } from "@workspace/db";
import app from "../../src/app.ts";
import { initializeRaiseStore, submitRaiseRecord, approveRaiseRecord } from "../../src/lib/raise-store.ts";
import { USDC_CONTRACTS } from "../../src/lib/demo-settlement.ts";

process.env.RAISE_APPROVAL_CODE = "demo-browser-only-code";
await initializeRaiseStore();
const { id } = await submitRaiseRecord({
  name: `Isolated browser demo ${randomUUID().slice(0, 8)}`,
  thesis: "Synthetic browser fixture with simulated chain responses, never real funds.",
  stage: "Demo", range: { min: 1000, max: 5000 },
});
await approveRaiseRecord(id);
let verificationAttempts = 0;
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  if (!String(url).startsWith("https://rpc.")) return originalFetch(url, options);
  const request = JSON.parse(options.body);
  let result;
  if (request.method === "tx") {
    // The first verification fails to exercise safe manual reconciliation.
    if (++verificationAttempts === 1) return Response.json({ error: { message: "Simulated pending transaction" } });
    const [row] = await db.select().from(demoSettlementsTable).where(eq(demoSettlementsTable.raiseId, id));
    result = {
      final_execution_status: "FINAL", status: { SuccessValue: "" },
      transaction: {
        hash: request.params.tx_hash, signer_id: row.signerAccount,
        receiver_id: USDC_CONTRACTS[row.network],
        actions: [{ FunctionCall: {
          method_name: "ft_transfer", deposit: "1",
          args: Buffer.from(JSON.stringify({
            receiver_id: row.receiverAccount, amount: "1000000", memo: row.transferMemo,
          })).toString("base64"),
        } }],
      },
      transaction_outcome: { outcome: { status: { SuccessReceiptId: "fixture" } } },
      receipts_outcome: [{ outcome: {
        executor_id: USDC_CONTRACTS[row.network], status: { SuccessValue: "" },
        logs: ["EVENT_JSON:" + JSON.stringify({
          standard: "nep141", event: "ft_transfer",
          data: [{ old_owner_id: row.signerAccount, new_owner_id: row.receiverAccount, amount: "1000000" }],
        })],
      } }],
    };
  } else {
    result = { result: [...Buffer.from(JSON.stringify(
      request.params.method_name === "ft_metadata" ? { symbol: "USDC", decimals: 6 } :
      request.params.method_name === "storage_balance_of" ? { total: "1250000" } : "1000000",
    ))] };
  }
  return Response.json({ jsonrpc: "2.0", id: request.id, result });
};
const server = app.listen(3107, "0.0.0.0", () => {
  console.log(JSON.stringify({ fixtureRaiseId: id, port: 3107, simulatedChain: true }));
});
async function stop() {
  server.close();
  await db.delete(raiseStateTable).where(eq(raiseStateTable.id, id));
  await pool.end();
  process.exit(0);
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
