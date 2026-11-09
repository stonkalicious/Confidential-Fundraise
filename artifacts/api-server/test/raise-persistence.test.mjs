import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
import test, { after } from "node:test";
import { eq } from "drizzle-orm";
import { db, pool, raiseStateTable } from "@workspace/db";
import {
  approveRaiseRecord,
  claimRaiseRecord,
  getPrivateRaise,
  getRaise,
  initializeRaiseStore,
  submitRaiseRecord,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
} from "../src/lib/raise-store.ts";

after(() => pool.end());

test("raise fields, claims, and private commitments survive store reinitialization", async (t) => {
  let raiseId;
  t.after(async () => {
    if (raiseId) {
      await db.delete(raiseStateTable).where(eq(raiseStateTable.id, raiseId));
    }
  });

  await initializeRaiseStore();
  const name = `Persistence check ${randomUUID().slice(0, 8)}`;
  const receipt = await submitRaiseRecord({
    name,
    thesis: "Synthetic persistence test data.",
    stage: "Seed",
    range: { min: 10_000, max: 50_000 },
  });
  raiseId = receipt.id;
  await approveRaiseRecord(raiseId);

  const claim = await claimRaiseRecord(raiseId, {
    founderName: "Synthetic Founder",
    email: "founder@example.invalid",
  });
  assert.equal(claim.kind, "success");

  const commitment = await submitSoftCommitmentRecord(raiseId, {
    id: "persistence-test-commitment",
    identifier: "Synthetic Investor",
    amount: 12_500,
  });
  assert.equal(commitment.kind, "success");

  const updated = await updateRaiseCommitmentRecord(
    raiseId,
    "persistence-test-commitment",
    { hard: true, verified: true },
  );
  assert.equal(updated.kind, "success");

  await initializeRaiseStore([{
    id: raiseId,
    position: 0,
    name: "Stale seed value",
    thesis: "This must not replace a live raise.",
    stage: "Draft",
    range: { min: 1, max: 1 },
    status: "approved",
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  }]);

  const publicRaise = getRaise(raiseId);
  assert.ok(publicRaise);
  assert.equal(publicRaise.name, name);
  assert.equal(publicRaise.thesis, "Synthetic persistence test data.");
  assert.equal(publicRaise.stage, "Seed");
  assert.deepEqual(publicRaise.range, { min: 10_000, max: 50_000 });
  assert.equal(publicRaise.claimed, true);
  assert.equal(publicRaise.softTotal, 0);
  assert.equal(publicRaise.hardTotal, 12_500);
  assert.equal("commitments" in publicRaise, false);
  assert.equal("email" in publicRaise, false);
  assert.equal("claim" in publicRaise, false);

  const privateRaise = getPrivateRaise(raiseId);
  assert.ok(privateRaise);
  assert.equal(privateRaise.claim?.founderName, "Synthetic Founder");
  assert.equal(privateRaise.claim?.email, "founder@example.invalid");
  assert.deepEqual(privateRaise.commitments, [{
    id: "persistence-test-commitment",
    identifier: "Synthetic Investor",
    amount: 12_500,
    hard: true,
    verified: true,
  }]);
});

async function startInstance(t) {
  const child = fork(new URL("./fixtures/raise-store-instance.mjs", import.meta.url), {
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  });
  let nextRequestId = 0;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      const error = new Error(`Raise store instance exited (${code})`);
      reject(error);
      for (const request of pending.values()) request.reject(error);
      pending.clear();
    });
    child.on("message", (message) => {
      if (message.ready) return resolve();
      const request = pending.get(message.requestId);
      if (!request) return;
      pending.delete(message.requestId);
      if (message.error) request.reject(new Error(message.error));
      else request.resolve(message.result);
    });
  });
  await ready;
  return (operation, ...args) => new Promise((resolve, reject) => {
    const requestId = ++nextRequestId;
    pending.set(requestId, { resolve, reject });
    child.send({ requestId, operation, args });
  });
}

test("separate API processes mutate the latest persisted state without lost updates", {
  timeout: 30_000,
}, async (t) => {
  const ids = [];
  t.after(async () => {
    for (const id of ids) {
      await db.delete(raiseStateTable).where(eq(raiseStateTable.id, id));
    }
  });
  await initializeRaiseStore();
  async function newRaise(approved = true) {
    const { id } = await submitRaiseRecord({
      name: `Concurrent persistence ${randomUUID().slice(0, 8)}`,
      thesis: "Synthetic concurrent persistence test data.",
      stage: "Seed",
      range: { min: 1, max: 50_000 },
    });
    ids.push(id);
    if (approved) await approveRaiseRecord(id);
    return id;
  }
  async function stored(id) {
    const [row] = await db.select().from(raiseStateTable).where(eq(raiseStateTable.id, id));
    const softTotal = row.state.commitments.filter((c) => !c.hard).reduce((sum, c) => sum + c.amount, 0);
    const hardTotal = row.state.commitments.filter((c) => c.hard).reduce((sum, c) => sum + c.amount, 0);
    assert.equal(row.state.softTotal, softTotal);
    assert.equal(row.state.hardTotal, hardTotal);
    return row.state;
  }
  const id = await newRaise();
  const agentId = await newRaise();
  const overflowId = await newRaise();
  // Both processes load their caches before any of the following writes.
  const [left, right] = await Promise.all([startInstance(t), startInstance(t)]);
  const investor = (id, amount) => ({ id, identifier: "Synthetic Investor", amount });
  const founder = { founderName: "Synthetic Founder", email: "founder@example.invalid" };

  await t.test("newly submitted raises can be approved by another instance", async () => {
    const pendingId = await newRaise(false);
    const approved = await left("approveRaiseRecord", pendingId);
    assert.equal(approved.id, pendingId);
    assert.equal((await stored(pendingId)).status, "approved");
    assert.equal(await right("approveRaiseRecord", pendingId), undefined);
  });

  await t.test("simultaneous commitments and a stale-cache claim preserve each other", async () => {
    const results = await Promise.all([
      left("submitSoftCommitmentRecord", id, investor("first", 100)),
      right("submitSoftCommitmentRecord", id, investor("second", 200)),
    ]);
    assert.ok(results.every((result) => result.kind === "success" && result.created));
    assert.equal((await stored(id)).commitments.length, 2);
    const claims = await Promise.all([
      left("claimRaiseRecord", id, founder),
      right("claimRaiseRecord", id, { ...founder, founderName: "Other Founder" }),
    ]);
    assert.deepEqual(claims.map((result) => result.kind).sort(), ["alreadyClaimed", "success"]);
    assert.equal((await stored(id)).commitments.length, 2);
    const winner = claims.find((result) => result.kind === "success").raise.claimantName;
    assert.equal((await stored(id)).claim.founderName, winner);
  });

  await t.test("hardening and new commitments preserve claims, receipt hashes, and totals", async () => {
    const receipt = "a".repeat(64);
    const results = await Promise.all([
      left("updateRaiseCommitmentRecord", id, "second", { hard: true, verified: true }),
      right("submitSoftCommitmentRecord", id, { ...investor("third", 300), demoReceipt: receipt }),
    ]);
    assert.ok(results.every((result) => result.kind === "success"));
    const state = await stored(id);
    assert.equal(state.softTotal, 400);
    assert.equal(state.hardTotal, 200);
    assert.ok(state.claim);
    assert.ok(state.demoInvestorReceiptHashes.third);
    const hardened = await left("updateRaiseCommitmentRecord", id, "third", { hard: true, verified: true });
    assert.equal(hardened.kind, "success");
    assert.equal((await stored(id)).hardTotal, 500);
    assert.deepEqual((await stored(id)).demoInvestorReceiptHashes, state.demoInvestorReceiptHashes);
  });

  await t.test("cross-instance retries stay idempotent and conflicting retries do not write", async () => {
    const results = await Promise.all([
      left("submitSoftCommitmentRecord", id, investor("retry", 400)),
      right("submitSoftCommitmentRecord", id, investor("retry", 400)),
    ]);
    assert.deepEqual(results.map((result) => result.created).sort(), [false, true]);
    const before = await stored(id);
    assert.equal((await left("submitSoftCommitmentRecord", id, investor("retry", 401))).kind, "conflict");
    assert.deepEqual(await stored(id), before);
  });

  await t.test("founder and agent reservations cannot overwrite each other", async () => {
    const results = await Promise.all([
      left("reserveAgentRaiseRecord", agentId),
      right("claimRaiseRecord", agentId, founder),
    ]);
    assert.deepEqual(results.map((result) => result.kind).sort(), ["alreadyClaimed", "success"]);
    const state = await stored(agentId);
    assert.notEqual(Boolean(state.claim), Boolean(state.agentClaimTokenHash));
    // Exercise agent edits against concurrent commitment writes regardless of which claim won.
    const editableId = state.agentClaimTokenHash ? agentId : await newRaise();
    const agent = state.agentClaimTokenHash ? results[0] : await left("reserveAgentRaiseRecord", editableId);
    const edits = await Promise.all([
      left("updateAgentRaiseRecord", editableId, agent.claimToken, { stage: "Growth", status: "paused" }),
      right("submitSoftCommitmentRecord", editableId, investor("agent-investor", 500)),
    ]);
    assert.ok(edits.every((result) => result.kind === "success"));
    const updated = await stored(editableId);
    assert.equal(updated.stage, "Growth");
    assert.equal(updated.publicStatus, "paused");
    assert.equal(updated.softTotal, 500);
    assert.ok(updated.agentClaimTokenHash);
  });

  await t.test("concurrent overflow is rejected against current totals without partial writes", async () => {
    const results = await Promise.all([
      left("submitSoftCommitmentRecord", overflowId, investor("max-left", Number.MAX_SAFE_INTEGER)),
      right("submitSoftCommitmentRecord", overflowId, investor("max-right", Number.MAX_SAFE_INTEGER)),
    ]);
    assert.deepEqual(results.map((result) => result.kind).sort(), ["amountOutOfRange", "success"]);
    const before = await stored(overflowId);
    assert.equal(before.commitments.length, 1);
    assert.equal((await right("updateRaiseCommitmentRecord", overflowId, before.commitments[0].id, {
      hard: false, verified: true,
    })).kind, "invalidStatus");
    assert.deepEqual(await stored(overflowId), before);
    assert.equal((await left("submitSoftCommitmentRecord", overflowId, investor("after-rejection", 1))).kind, "amountOutOfRange");
  });
});
