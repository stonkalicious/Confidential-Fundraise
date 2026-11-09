import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, pool, demoSettlementsTable, raiseStateTable } from "@workspace/db";
import app from "../src/app.ts";
import {
  initializeRaiseStore, submitRaiseRecord, approveRaiseRecord,
  getPrivateRaise, getRaise,
} from "../src/lib/raise-store.ts";
import { USDC_CONTRACTS, validateSettlementTransaction } from "../src/lib/demo-settlement.ts";

test("demo settlement gates, exact USDC verification, persistence and core-flow isolation", async (t) => {
  const code = randomBytes(24).toString("hex");
  const previousCode = process.env.RAISE_APPROVAL_CODE;
  process.env.RAISE_APPROVAL_CODE = code;
  await initializeRaiseStore();
  const submitted = await submitRaiseRecord({
    name: `Settlement test ${randomUUID()}`, thesis: "A synthetic raise used for settlement isolation tests.",
    stage: "Demo", range: { min: 1000, max: 5000 },
  });
  const id = submitted.id;
  await approveRaiseRecord(id);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const originalFetch = global.fetch;
  let rpcTx;
  let registered = true;
  let balance = "1000000";
  global.fetch = async (url, options) => {
    if (String(url).startsWith("https://rpc.")) {
      const request = JSON.parse(options.body);
      const result = request.method === "tx" ? rpcTx : {
        result: [...Buffer.from(JSON.stringify(
          request.params.method_name === "ft_metadata" ? { symbol: "USDC", decimals: 6 } :
          request.params.method_name === "storage_balance_of" ? (registered ? { total: "1250000" } : null) :
          balance,
        ))],
      };
      return Response.json({ jsonrpc: "2.0", id: request.id, result });
    }
    return originalFetch(url, options);
  };
  t.after(async () => {
    global.fetch = originalFetch;
    if (previousCode === undefined) delete process.env.RAISE_APPROVAL_CODE;
    else process.env.RAISE_APPROVAL_CODE = previousCode;
    await new Promise((resolve) => server.close(resolve));
    await db.delete(raiseStateTable).where(eq(raiseStateTable.id, id));
    await pool.end();
  });
  const request = async (path, { method = "GET", body, sponsor, receipt } = {}) => {
    const response = await fetch(base + path, { method, headers: {
      "Content-Type": "application/json",
      ...(sponsor ? { Authorization: `Bearer ${code}` } : {}),
      ...(receipt ? { "X-Demo-Receipt": receipt } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const config = await request("/demo-settlement-config");
  assert.deepEqual(config.data, { testnet: USDC_CONTRACTS.testnet });
  const cid = randomUUID(), receipt = randomBytes(32).toString("hex");
  const path = `/raises/${id}/demo-settlements/${cid}`;
  assert.equal((await request(path, { sponsor: true })).status, 404);
  const core = await request(`/raises/${id}/commitments`, {
    method: "POST", body: { id: cid, identifier: "Private demo investor", amount: 1234, demoReceipt: receipt },
  });
  assert.equal(core.status, 201);
  assert.equal(core.data.softTotal, 1234);
  assert.ok(!JSON.stringify(core.data).includes(receipt));
  const publicBefore = await request(`/raises/${id}`);
  assert.equal(publicBefore.status, 200);
  assert.equal(publicBefore.data.confirmedTestnetTransfers, 0);
  assert.ok(!JSON.stringify(publicBefore.data).includes("Private demo investor"));
  const input = { network: "testnet", receiverAccount: "demo-sponsor.testnet", confirmed: true,
    reference: "https://example.com/reviewed-terms" };
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, { receipt: randomBytes(32).toString("hex") })).status, 401);
  assert.equal((await request(path, { receipt })).status, 200);
  assert.equal((await request(path, { method: "POST", body: input, receipt })).status, 401);
  assert.equal((await request(path + "/confirm", {
    method: "POST", receipt, body: { settlementId: randomUUID(), signerAccount: "demo-investor.testnet", confirmed: true },
  })).status, 409);
  assert.equal((await request(path, { method: "POST", sponsor: true, body: { ...input, confirmed: false } })).status, 400);
  for (const reference of ["javascript:alert(1)", "This is a contract with legal terms and other text."]) {
    assert.equal((await request(path, { method: "POST", sponsor: true, body: { ...input, reference } })).status, 400);
  }
  let configured = await request(path, { method: "POST", sponsor: true, body: { ...input, contractText: "MUST NOT BE STORED" } });
  assert.equal(configured.status, 200);
  let settlement = configured.data.settlement;
  assert.equal(settlement.network, "testnet");
  assert.equal(settlement.tokenContract, USDC_CONTRACTS.testnet);
  assert.equal(settlement.reference, input.reference);
  assert.deepEqual(settlement.confirmations.map((c) => c.role), ["sponsor"]);
  const sponsorTime = settlement.confirmations[0].timestamp;
  configured = await request(path, { method: "POST", sponsor: true, body: input });
  assert.equal(configured.data.settlement.confirmations[0].timestamp, sponsorTime);
  assert.equal((await request(path, { method: "POST", sponsor: true, body: { ...input, network: "mainnet" } })).status, 400);
  assert.equal((await request(path + "/prepare", { method: "POST", receipt })).status, 409);
  const confirmation = { settlementId: settlement.id, signerAccount: "demo-investor.testnet", confirmed: true };
  assert.equal((await request(path + "/confirm", { method: "POST", sponsor: true, body: confirmation })).status, 403);
  assert.equal((await request(path + "/confirm", { method: "POST", receipt, body: { ...confirmation, confirmed: false } })).status, 400);
  assert.equal((await request(path + "/confirm", { method: "POST", receipt, body: { ...confirmation, settlementId: randomUUID() } })).status, 409);
  const confirmed = await request(path + "/confirm", { method: "POST", receipt, body: confirmation });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.settlement.status, "ready");
  assert.deepEqual(confirmed.data.settlement.confirmations.map((c) => c.role), ["sponsor", "investor"]);
  const confirmations = confirmed.data.settlement.confirmations;
  assert.deepEqual((await request(path + "/confirm", { method: "POST", receipt, body: confirmation })).data.settlement.confirmations, confirmations);
  assert.equal((await request(path + "/verify", { method: "POST", receipt, body: { transactionHash: "A".repeat(44) } })).status, 409);
  registered = false;
  assert.equal((await request(path + "/prepare", { method: "POST", receipt })).status, 409);
  registered = true; balance = "999999";
  assert.equal((await request(path + "/prepare", { method: "POST", receipt })).status, 409);
  balance = "1000000";
  const preparations = await Promise.all([
    request(path + "/prepare", { method: "POST", receipt }),
    request(path + "/prepare", { method: "POST", receipt }),
  ]);
  assert.ok(preparations.every((r) => r.status === 200));
  assert.equal(preparations.filter((r) => r.data.maySend).length, 1, "only one request can initiate wallet sending");
  settlement = preparations[0].data.settlement;
  assert.equal(settlement.status, "prepared");
  assert.equal((await request(path + "/prepare", { method: "POST", receipt })).data.maySend, false);
  const hash = "A".repeat(44);
  const args = { receiver_id: settlement.receiverAccount, amount: "1000000", memo: settlement.transferMemo };
  const transaction = {
    hash, signer_id: settlement.signerAccount, receiver_id: settlement.tokenContract,
    actions: [{ FunctionCall: { method_name: "ft_transfer", deposit: "1", args: Buffer.from(JSON.stringify(args)).toString("base64") } }],
  };
  const validTx = {
    final_execution_status: "FINAL", status: { SuccessValue: "" }, transaction,
    transaction_outcome: { outcome: { status: { SuccessReceiptId: "receipt" } } },
    receipts_outcome: [{ outcome: {
      executor_id: settlement.tokenContract, status: { SuccessValue: "" },
      logs: ["EVENT_JSON:" + JSON.stringify({
        standard: "nep141", event: "ft_transfer", data: [{
          old_owner_id: settlement.signerAccount, new_owner_id: settlement.receiverAccount, amount: "1000000",
        }],
      })],
    } }],
  };
  const [row] = await db.select().from(demoSettlementsTable).where(eq(demoSettlementsTable.id, settlement.id));
  assert.ok(!JSON.stringify(row).includes("MUST NOT BE STORED"));
  for (const alteration of [
    (r) => { r.status = { Failure: {} }; },
    (r) => { r.final_execution_status = "EXECUTED"; },
    (r) => { r.transaction.signer_id = "wrong.testnet"; },
    (r) => { r.transaction.receiver_id = USDC_CONTRACTS.mainnet; },
    (r) => { r.transaction.actions.push(r.transaction.actions[0]); },
    (r) => { r.receipts_outcome[0].outcome.status = { Failure: {} }; },
    (r) => { r.receipts_outcome[0].outcome.logs = []; },
    ...[
      { ...args, amount: "1000001" }, { ...args, receiver_id: "wrong.testnet" }, { ...args, memo: "wrong" },
    ].map((a) => (r) => { r.transaction.actions[0].FunctionCall.args = Buffer.from(JSON.stringify(a)).toString("base64"); }),
  ]) {
    const invalid = structuredClone(validTx); alteration(invalid);
    assert.throws(() => validateSettlementTransaction(row, invalid));
  }
  rpcTx = structuredClone(validTx); rpcTx.status = { Failure: {} };
  assert.equal((await request(path + "/verify", { method: "POST", receipt, body: { transactionHash: hash } })).status, 409);
  assert.equal((await request(path, { receipt })).data.settlement.transactionHash, undefined);
  rpcTx = validTx;
  const success = await request(path + "/verify", { method: "POST", receipt, body: { transactionHash: hash } });
  assert.equal(success.status, 200);
  assert.equal(success.data.settlement.status, "success");
  assert.equal(success.data.settlement.transactionHash, hash);
  assert.deepEqual(success.data.settlement.confirmations, confirmations);
  const publicAfter = await request(`/raises/${id}`);
  assert.equal(publicAfter.status, 200);
  assert.equal(publicAfter.data.confirmedTestnetTransfers, 1);
  assert.equal(publicAfter.data.softTotal, 1234);
  assert.equal(publicAfter.data.hardTotal, 0);
  assert.ok(!JSON.stringify(publicAfter.data).includes("Private demo investor"));
  assert.ok(!JSON.stringify(publicAfter.data).includes(hash));
  assert.ok(!JSON.stringify(publicAfter.data).includes("demo-investor.testnet"));
  const publicList = await request("/raises");
  const listedRaise = publicList.data.find((raise) => raise.id === id);
  assert.equal(listedRaise.confirmedTestnetTransfers, 1);
  assert.ok(!JSON.stringify(publicList.data).includes("Private demo investor"));
  assert.equal((await request(path + "/verify", { method: "POST", receipt, body: { transactionHash: hash } })).status, 200);
  assert.equal((await request(path + "/verify", { method: "POST", receipt, body: { transactionHash: "B".repeat(44) } })).status, 409);
  await initializeRaiseStore();
  assert.equal((await request(path, { receipt })).data.settlement.transactionHash, hash, "receipt survives rehydration");
  assert.equal((await request(`/raises/${id}`)).data.confirmedTestnetTransfers, 1, "public count survives rehydration");
  assert.equal(getRaise(id).softTotal, 1234);
  assert.equal(getRaise(id).hardTotal, 0);
  assert.equal(getPrivateRaise(id).commitments[0].hard, false);
  assert.ok(!JSON.stringify(getPrivateRaise(id)).includes(receipt));
  assert.ok(!JSON.stringify(getPrivateRaise(id)).includes("demoInvestorReceiptHashes"));
  assert.ok(!JSON.stringify(getRaise(id)).includes(hash), "public aggregates do not leak a payment-to-investor link");
  const retried = await request(`/raises/${id}/commitments`, {
    method: "POST", body: { id: cid, identifier: "Private demo investor", amount: 1234, demoReceipt: "f".repeat(64) },
  });
  assert.equal(retried.status, 200);
  assert.equal((await request(path + "/confirm", { method: "POST", receipt: "f".repeat(64), body: confirmation })).status, 403);
  assert.equal((await request(path, { receipt })).status, 200);
});
