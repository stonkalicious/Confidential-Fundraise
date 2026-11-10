import assert from "node:assert/strict";
import test from "node:test";
import {
  approveRaiseRecord,
  getPrivateRaise,
  getRaise,
  getRaises,
  submitRaiseRecord,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
} from "../src/lib/raise-store.ts";

async function newRaise() {
  const { id } = await submitRaiseRecord({
    name: "Overflow regression",
    thesis: "Synthetic data for aggregate boundary tests.",
    stage: "Seed",
    range: { min: 1, max: 100 },
  });
  await approveRaiseRecord(id);
  return id;
}

function add(id, commitmentId, amount) {
  return submitSoftCommitmentRecord(id, {
    id: commitmentId,
    identifier: "Synthetic investor",
    amount,
  });
}

async function assertReadable(id, softTotal, hardTotal) {
  assert.equal((await getRaise(id)).softTotal, softTotal);
  assert.equal((await getRaise(id)).hardTotal, hardTotal);
  assert.ok((await getRaises()).some((raise) => raise.id === id));
}

test("two individually valid amounts cannot overflow soft totals or corrupt reads", async () => {
  const id = await newRaise();
  assert.equal((await add(id, "first", Number.MAX_SAFE_INTEGER)).kind, "success");
  assert.equal((await add(id, "second", Number.MAX_SAFE_INTEGER)).kind, "amountOutOfRange");
  assert.equal((await getPrivateRaise(id)).commitments.length, 1);
  await assertReadable(id, Number.MAX_SAFE_INTEGER, 0);
  // Retrying an existing commitment remains idempotent at the boundary.
  const retry = await add(id, "first", Number.MAX_SAFE_INTEGER);
  assert.equal(retry.kind, "success");
  assert.equal(retry.created, false);
});

test("hardening cannot overflow hard totals or partially change a commitment", async () => {
  const id = await newRaise();
  await add(id, "first", Number.MAX_SAFE_INTEGER);
  assert.equal((await updateRaiseCommitmentRecord(id, "first", {
    hard: true, verified: false,
  })).kind, "success");
  assert.equal((await add(id, "second", 1)).kind, "success");
  assert.equal((await updateRaiseCommitmentRecord(id, "second", {
    hard: true, verified: true,
  })).kind, "amountOutOfRange");
  const second = (await getPrivateRaise(id)).commitments.find((c) => c.id === "second");
  assert.equal(second.hard, false);
  assert.equal(second.verified, false);
  await assertReadable(id, 1, Number.MAX_SAFE_INTEGER);
});

test("softening cannot overflow soft totals and leaves the previous state intact", async () => {
  const id = await newRaise();
  await add(id, "first", 1);
  await updateRaiseCommitmentRecord(id, "first", { hard: true, verified: true });
  await add(id, "second", Number.MAX_SAFE_INTEGER);
  assert.equal((await updateRaiseCommitmentRecord(id, "first", {
    hard: false, verified: false,
  })).kind, "amountOutOfRange");
  const first = (await getPrivateRaise(id)).commitments.find((c) => c.id === "first");
  assert.equal(first.hard, true);
  assert.equal(first.verified, true);
  await assertReadable(id, Number.MAX_SAFE_INTEGER, 1);
});
