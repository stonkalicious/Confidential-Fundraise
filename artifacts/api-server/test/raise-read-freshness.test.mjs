import assert from "node:assert/strict";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { setImmediate as tick } from "node:timers/promises";
import test from "node:test";
import { db, pool } from "@workspace/db";
import app from "../src/app.ts";
import {
  getRaise, getRaises, getPendingRaises, getPrivateRaise, initializeRaiseStore,
  RAISE_READ_MAX_AGE_MS, RaiseSnapshotUnavailableError, submitRaiseRecord,
} from "../src/lib/raise-store.ts";

function row(id, position, status = "approved") {
  return { id, position, state: {
    id, name: "Synthetic freshness", thesis: "Synthetic freshness test data.",
    stage: "Seed", range: { min: 1, max: 100 }, status,
    commitments: [], softTotal: 0, hardTotal: 0,
  } };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("bounded reads coalesce, fail closed, retry, and serialize with writes", async (t) => {
  t.after(() => pool.end());
  let now = 0;
  let reads = 0;
  let rows = [row("first", 0), row("pending", 1, "pending")];
  let gate;
  let fail = false;
  t.mock.method(performance, "now", () => now);
  t.mock.method(db, "select", () => ({
    async from() {
      reads++;
      const snapshot = structuredClone(rows);
      if (gate) await gate.promise;
      if (fail) throw new Error("sensitive database failure");
      return snapshot;
    },
  }));
  t.mock.method(db, "insert", () => ({
    async values(value) { rows.push(structuredClone(value)); },
  }));
  // No real database access or persisted changes in this process.
  await initializeRaiseStore([]);
  const initialReads = reads;
  await getRaises();
  now = RAISE_READ_MAX_AGE_MS - 1;
  await getPendingRaises();
  assert.equal(reads, initialReads, "fresh reads reuse the snapshot");

  now = RAISE_READ_MAX_AGE_MS;
  rows[0].state.stage = "Growth";
  gate = deferred();
  const waiting = [getRaises(), getPendingRaises(), getPrivateRaise("first"), getRaise("first")];
  await tick();
  assert.equal(reads, initialReads + 1, "concurrent expired reads share one query");
  gate.resolve();
  const [, pending, privateRaise, publicRaise] = await Promise.all(waiting);
  gate = undefined;
  assert.equal(pending.length, 1);
  assert.equal(privateRaise.stage, "Growth");
  assert.equal(publicRaise.stage, "Growth");

  // A slow refresh must use query start time, not completion time.
  now += RAISE_READ_MAX_AGE_MS;
  gate = deferred();
  const slow = getRaise("first");
  await tick();
  now += RAISE_READ_MAX_AGE_MS + 1;
  rows[0].state.stage = "Written during slow query";
  const lateReader = getRaise("first");
  gate.resolve();
  await slow;
  gate = undefined;
  assert.equal((await lateReader).stage, "Written during slow query",
    "late readers do not accept an in-flight snapshot older than their bound");
  const beforeSlowRetry = reads;
  await getRaise("first");
  assert.equal(reads, beforeSlowRetry);

  now += RAISE_READ_MAX_AGE_MS;
  fail = true;
  const failures = await Promise.allSettled([getRaises(), getPrivateRaise("first"), getPendingRaises()]);
  for (const result of failures) {
    assert.equal(result.status, "rejected");
    assert.ok(result.reason instanceof RaiseSnapshotUnavailableError);
    assert.ok(!result.reason.message.includes("sensitive"));
  }
  // Authorization still runs before a database refresh, even during an outage.
  t.mock.property(process, "env", { RAISE_APPROVAL_CODE: "isolated-freshness-approval" });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = (path, token) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const beforeDenied = reads;
  for (const path of ["/raises/pending", "/raises/first/private"]) {
    const response = await request(path);
    assert.equal(response.status, 401);
    await response.json();
  }
  assert.equal(reads, beforeDenied, "unauthorized reads never refresh private state");
  for (const path of ["/raises", "/raises/first", "/raises/pending", "/raises/first/private", "/raise-claim"]) {
    const response = await request(path, "isolated-freshness-approval");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      error: "Raise details are temporarily unavailable. Try again shortly.",
    });
  }
  fail = false;
  rows[0].state.stage = "Recovered";
  assert.equal((await getRaise("first")).stage, "Recovered", "failure does not postpone retries");

  // The refresh captures old rows, then a local insertion queues behind it.
  now += RAISE_READ_MAX_AGE_MS;
  gate = deferred();
  const refreshing = getRaises();
  await tick();
  const inserting = submitRaiseRecord({
    name: "Queued insertion", thesis: "Synthetic queued insertion test.",
    stage: "Seed", range: { min: 1, max: 100 },
  });
  gate.resolve();
  await refreshing;
  const inserted = await inserting;
  gate = undefined;
  assert.ok((await getPendingRaises()).some((r) => r.id === inserted.id));

  // Reload replaces the complete snapshot, including deleted rows.
  rows = rows.filter((r) => r.id !== "first");
  now += RAISE_READ_MAX_AGE_MS;
  assert.equal(await getRaise("first"), undefined);
});
