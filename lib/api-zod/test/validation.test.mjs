import assert from "node:assert/strict";
import test from "node:test";
import {
  ClaimRaiseBody,
  GetRaiseByIdResponse,
  SubmitRaiseBody,
  SubmitRaiseClaimBody,
  SubmitSoftCommitmentBody,
  UpdateRaiseCommitmentBody,
} from "../src/generated/api.ts";

test("Zod 4 preserves raise submission limits and whole-number amounts", () => {
  const valid = {
    name: "Example raise",
    thesis: "A synthetic test investment thesis.",
    stage: "Seed",
    range: { min: 1, max: 1000 },
  };
  assert.equal(SubmitRaiseBody.safeParse(valid).success, true);
  for (const range of [
    { min: 0, max: 1000 },
    { min: 1.5, max: 1000 },
    { min: 1, max: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.equal(SubmitRaiseBody.safeParse({ ...valid, range }).success, false);
  }
  assert.equal(
    SubmitRaiseBody.safeParse({ ...valid, name: "x" }).success,
    false,
  );
});

test("claim schemas accept valid input and reject malformed contact fields", () => {
  for (const schema of [SubmitRaiseClaimBody, ClaimRaiseBody]) {
    const valid = { founderName: "Test Founder", email: "test@example.com" };
    assert.equal(schema.safeParse(valid).success, true);
    assert.equal(schema.safeParse({ ...valid, email: "invalid" }).success, false);
    assert.equal(schema.safeParse({ ...valid, founderName: "" }).success, false);
    assert.equal(
      schema.safeParse({ ...valid, founderName: "x".repeat(121) }).success,
      false,
    );
  }
});

test("commitment validation preserves numeric and boolean boundaries", () => {
  const valid = { id: "test-commitment", identifier: "Test investor", amount: 1 };
  assert.equal(SubmitSoftCommitmentBody.safeParse(valid).success, true);
  for (const amount of [0, -1, 1.5, "100", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      SubmitSoftCommitmentBody.safeParse({ ...valid, amount }).success,
      false,
    );
  }
  assert.equal(
    UpdateRaiseCommitmentBody.safeParse({ hard: true, verified: false }).success,
    true,
  );
  assert.equal(
    UpdateRaiseCommitmentBody.safeParse({ hard: "true", verified: false }).success,
    false,
  );
});

test("public response schemas strip private investor and contact details", () => {
  const parsed = GetRaiseByIdResponse.parse({
    id: "test-raise",
    name: "Example raise",
    thesis: "Synthetic test",
    stage: "Seed",
    range: { min: 1, max: 1000 },
    claimed: true,
    claimantName: "Test Founder",
    softTotal: 100,
    hardTotal: 0,
    email: "test@example.com",
    commitments: [{ identifier: "Private investor", amount: 100 }],
  });
  assert.equal(Object.hasOwn(parsed, "email"), false);
  assert.equal(Object.hasOwn(parsed, "commitments"), false);
});
