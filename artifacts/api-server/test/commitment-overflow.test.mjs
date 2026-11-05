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

function newRaise() {
  const { id } = submitRaiseRecord({
    name: "Overflow regression",
    thesis: "Synthetic data for aggregate boundary tests.",
    stage: "Seed",
    range: { min: 1, max: 100 },
  });
  approveRaiseRecord(id);
  return id;
}

function add(id, commitmentId, amount) {
  return submitSoftCommitmentRecord(id, {
    id: commitmentId,
    identifier: "Synthetic investor",
    amount,
  });
}

function assertReadable(id, softTotal, hardTotal) {
  assert.equal(getRaise(id).softTotal, softTotal);
  assert.equal(getRaise(id).hardTotal, hardTotal);
  assert.ok(getRaises().some((raise) => raise.id === id));
}

test("two individually valid amounts cannot overflow soft totals or corrupt reads", () => {
  const id = newRaise();
  assert.equal(add(id, "first", Number.MAX_SAFE_INTEGER).kind, "success");
  assert.equal(add(id, "second", Number.MAX_SAFE_INTEGER).kind, "amountOutOfRange");
  assert.equal(getPrivateRaise(id).commitments.length, 1);
  assertReadable(id, Number.MAX_SAFE_INTEGER, 0);
  // Retrying an existing commitment remains idempotent at the boundary.
  const retry = add(id, "first", Number.MAX_SAFE_INTEGER);
  assert.equal(retry.kind, "success");
  assert.equal(retry.created, false);
});

test("hardening cannot overflow hard totals or partially change a commitment", () => {
  const id = newRaise();
  add(id, "first", Number.MAX_SAFE_INTEGER);
  assert.equal(updateRaiseCommitmentRecord(id, "first", {
    hard: true, verified: false,
  }).kind, "success");
  assert.equal(add(id, "second", 1).kind, "success");
  assert.equal(updateRaiseCommitmentRecord(id, "second", {
    hard: true, verified: true,
  }).kind, "amountOutOfRange");
  const second = getPrivateRaise(id).commitments.find((c) => c.id === "second");
  assert.equal(second.hard, false);
  assert.equal(second.verified, false);
  assertReadable(id, 1, Number.MAX_SAFE_INTEGER);
});

test("softening cannot overflow soft totals and leaves the previous state intact", () => {
  const id = newRaise();
  add(id, "first", 1);
  updateRaiseCommitmentRecord(id, "first", { hard: true, verified: true });
  add(id, "second", Number.MAX_SAFE_INTEGER);
  assert.equal(updateRaiseCommitmentRecord(id, "first", {
    hard: false, verified: false,
  }).kind, "amountOutOfRange");
  const first = getPrivateRaise(id).commitments.find((c) => c.id === "first");
  assert.equal(first.hard, true);
  assert.equal(first.verified, true);
  assertReadable(id, Number.MAX_SAFE_INTEGER, 1);
});
