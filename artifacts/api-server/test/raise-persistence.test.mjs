import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
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

test("raise fields, claims, and private commitments survive store reinitialization", async (t) => {
  let raiseId;
  t.after(async () => {
    if (raiseId) {
      await db.delete(raiseStateTable).where(eq(raiseStateTable.id, raiseId));
    }
    await pool.end();
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
