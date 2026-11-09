import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { inArray, eq } from "drizzle-orm";
import { db, pool, raiseStateTable } from "@workspace/db";
import app from "../src/app.ts";
import {
  initializeRaiseStore,
  submitRaiseRecord,
  approveRaiseRecord,
  submitSoftCommitmentRecord,
  getPrivateRaise,
} from "../src/lib/raise-store.ts";

test("agent page ownership stays per-raise, durable, public-only, and distinct from approval", async (t) => {
  const ids = [];
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (ids.length) await db.delete(raiseStateTable).where(inArray(raiseStateTable.id, ids));
    await pool.end();
  });
  await initializeRaiseStore();
  async function newRaise(approved = true) {
    const { id } = await submitRaiseRecord({
      name: "Synthetic agent ownership test",
      thesis: "Synthetic thesis for agent ownership testing.",
      stage: "Seed",
      range: { min: 1000, max: 5000 },
    });
    ids.push(id);
    if (approved) await approveRaiseRecord(id);
    return id;
  }
  async function request(path, method = "GET", body, token) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
  }
  const id = await newRaise();
  const otherId = await newRaise();
  const pendingId = await newRaise(false);
  const path = `/raises/${id}`;
  await submitSoftCommitmentRecord(id, {
    id: "private-agent-test-commitment",
    identifier: "private-investor@example.invalid",
    amount: 1200,
  });
  const privateBefore = getPrivateRaise(id).commitments;

  const results = await Promise.all([
    request(`${path}/agent-claim`, "POST"),
    request(`${path}/agent-claim`, "POST"),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const claimed = results.find((r) => r.status === 201);
  const token = claimed.body.claimToken;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(claimed.cache, "no-store");
  assert.equal(claimed.body.raise.claimed, true);
  assert.equal(claimed.body.raise.claimantName, "agent");
  assert.equal(claimed.body.raise.status, "open");
  assert.equal((await request(`/raises/${pendingId}/agent-claim`, "POST")).status, 404);
  assert.equal((await request("/raises/not-present/agent-claim", "POST")).status, 404);
  assert.equal((await request(`${path}/claim`, "POST", {
    founderName: "Another claimant",
    email: "synthetic@example.invalid",
  })).status, 409);

  assert.equal((await request(path, "PATCH", { stage: "Seed" })).status, 401);
  assert.equal((await request(path, "PATCH", { stage: "Seed" }, "wrong-token")).status, 401);
  assert.equal((await request(`/raises/${otherId}`, "PATCH", { stage: "Seed" }, token)).status, 401);
  for (const body of [
    {}, { name: "Not editable" }, { commitments: [] }, { claim: {} },
    { claimed: false }, { hardTotal: 900 }, { agentClaimTokenHash: "replacement" },
    { status: "approved" }, { status: "pending" }, { stage: " " },
    { range: { min: 500, max: 100 } }, { range: { min: 1, max: 1.5 } },
    { range: { min: 1, max: 100, private: true } },
    { thesis: "Updated synthetic thesis", commitments: [] },
  ]) {
    assert.equal((await request(path, "PATCH", body, token)).status, 400);
  }
  const update = {
    thesis: "Updated synthetic thesis owned by an agent.",
    stage: "Pre-seed",
    range: { min: 2000, max: 8000 },
    status: "paused",
  };
  const updated = await request(path, "PATCH", update, token);
  assert.equal(updated.status, 200);
  for (const [key, value] of Object.entries(update)) assert.deepEqual(updated.body[key], value);
  assert.equal(updated.body.softTotal, 1200);
  assert.equal(updated.body.hardTotal, 0);

  for (const [suffix, method, body] of [
    ["/private", "GET"],
    ["/approve", "POST"],
    ["/commitments/private-agent-test-commitment", "PATCH", { hard: true, verified: true }],
    ["/commitments/private-agent-test-commitment/quote", "POST"],
  ]) {
    const result = await request(`${path}${suffix}`, method, body, token);
    assert.ok(result.status === 401 || result.status === 503);
  }

  await initializeRaiseStore();
  const [row] = await db.select().from(raiseStateTable).where(eq(raiseStateTable.id, id));
  assert.equal(row.state.agentClaimTokenHash, createHash("sha256").update(token).digest("hex"));
  assert.equal(JSON.stringify(row.state).includes(token), false);
  const reloaded = await request(path);
  assert.equal(reloaded.body.status, "paused");
  assert.equal(reloaded.body.thesis, update.thesis);
  assert.equal(reloaded.body.claimed, true);
  assert.equal((await request(path, "PATCH", { status: "closed" }, token)).status, 200);
  assert.equal((await request(path, "PATCH", { status: "open" }, token)).status, 200);
  assert.equal((await request(`${path}/agent-claim`, "POST")).status, 409);
  assert.deepEqual(getPrivateRaise(id).commitments, privateBefore);
  for (const publicResponse of [
    claimed.body.raise, updated.body, reloaded.body, (await request("/raises")).body,
  ]) {
    const json = JSON.stringify(publicResponse);
    for (const secret of [
      token, "agentClaimTokenHash", "private-investor@example.invalid",
      "private-agent-test-commitment", '"commitments"', '"claim":',
    ]) assert.equal(json.includes(secret), false);
  }
});
