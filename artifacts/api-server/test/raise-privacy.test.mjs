import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, pool, raiseStateTable } from "@workspace/db";
import app from "../src/app.ts";
import {
  DEFAULT_RAISE_ID,
  initializeRaiseStore,
} from "../src/lib/raise-store.ts";

// Independent of the generated response schemas: widening a schema must not
// silently widen the privacy boundary enforced by these assertions.
const publicRaiseKeys = new Set([
  "id", "name", "thesis", "stage", "range", "sourceLink", "claimed",
  "status", "claimantName", "softTotal", "hardTotal", "confirmedTestnetTransfers",
]);
const privateKeys = new Set([
  "claim", "email", "signatureOrAccount", "vehicleLink", "commitments",
  "identifier", "amount", "hard", "verified", "demoReceipt",
  "demoInvestorReceiptHashes", "agentClaimTokenHash", "claimToken",
]);
const claim = {
  founderName: "Synthetic Public Founder",
  email: "private-founder@example.invalid",
  signatureOrAccount: "private-founder-account.near",
};
const commitments = [
  { id: "private-soft-one", identifier: "private-investor-one@example.invalid", amount: 12_347 },
  { id: "private-hard", identifier: "private-investor-two.near", amount: 34_561 },
  { id: "private-soft-two", identifier: "private-investor-three@example.invalid", amount: 23_459 },
];

function assertPublic(body) {
  function visit(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(privateKeys.has(key), false, `Private field leaked: ${key}`);
      visit(child);
    }
  }
  visit(body);
  const json = JSON.stringify(body);
  for (const secret of [
    claim.email, claim.signatureOrAccount,
    ...commitments.flatMap(({ id, identifier }) => [id, identifier]),
  ]) {
    assert.equal(json.includes(secret), false, `Private value leaked: ${secret}`);
  }
}

function assertSummary(body, id, softTotal, hardTotal) {
  assertPublic(body);
  for (const key of Object.keys(body)) {
    assert.ok(publicRaiseKeys.has(key), `Unexpected public raise field: ${key}`);
  }
  assert.equal(body.id, id);
  assert.equal(body.claimed, true);
  // The founder display name is intentionally public; contact details are not.
  assert.equal(body.claimantName, claim.founderName);
  assert.equal(body.softTotal, softTotal);
  assert.equal(body.hardTotal, hardTotal);
}

test("public raise routes expose summaries only while sponsors retain private details", {
  timeout: 30_000,
}, async (t) => {
  const ids = [];
  const approvalCode = `synthetic-privacy-${randomUUID()}`;
  // Mock the configuration without reading the workspace's real approval code.
  t.mock.property(process, "env", {
    ...process.env,
    RAISE_APPROVAL_CODE: approvalCode,
  });
  const server = createServer(app);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    try {
      for (const id of ids) {
        await db.delete(raiseStateTable).where(eq(raiseStateTable.id, id));
      }
    } finally {
      await pool.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, status, { method = "GET", body, token } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
    return result;
  }
  async function requestMarkdown(path, status) {
    const response = await fetch(`${base}${path}`);
    const text = await response.text();
    assert.equal(response.status, status, `GET ${path}: ${text}`);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
    return { response, text };
  }

  await t.test("legacy claim GET and POST hide contact details and commitments", async () => {
    // Before initialization the store is in-memory only. Never claim or modify
    // the actual persisted default raise, which may already belong to a user.
    await request(`/raises/${DEFAULT_RAISE_ID}/commitments`, 201, {
      method: "POST", body: commitments[0],
    });
    const posted = await request("/raise-claim", 201, {
      method: "POST",
      body: {
        founderName: claim.founderName,
        email: claim.email,
        vehicleLink: claim.signatureOrAccount,
      },
    });
    const expected = { claimed: true, founderName: claim.founderName };
    assert.deepEqual(posted, expected);
    assertPublic(posted);
    const loaded = await request("/raise-claim", 200);
    assert.deepEqual(loaded, expected);
    assertPublic(loaded);
  });

  // Replace the transient legacy fixture with real persisted records, then
  // exercise the routes against a unique raise owned entirely by this test.
  await initializeRaiseStore();
  const submission = {
    name: `Privacy regression ${randomUUID().slice(0, 8)}`,
    thesis: "Synthetic route-level privacy regression data.",
    stage: "Seed",
    range: { min: 100_000, max: 500_000 },
  };
  async function submit() {
    const receipt = await request("/raises", 201, { method: "POST", body: submission });
    ids.push(receipt.id);
    assert.deepEqual(receipt, { id: receipt.id, status: "pending" });
    assertPublic(receipt);
    return receipt.id;
  }
  const id = await submit();
  const path = `/raises/${id}`;
  await request(`${path}/approve`, 200, { method: "POST", token: approvalCode });
  for (const [index, commitment] of commitments.slice(0, 2).entries()) {
    const submittedCommitment = index === 0
      ? { ...commitment, hard: true, verified: true }
      : commitment;
    const body = await request(`${path}/commitments`, 201, {
      method: "POST", body: submittedCommitment,
    });
    assertPublic(body);
    if (index === 0) {
      assert.equal(body.softTotal, commitment.amount);
      assert.equal(body.hardTotal, 0);
    }
  }
  await request(`${path}/commitments/${commitments[1].id}`, 200, {
    method: "PATCH", token: approvalCode, body: { hard: true, verified: true },
  });

  await t.test("claim and commitment submissions return only public aggregates", async () => {
    const claimed = await request(`${path}/claim`, 201, { method: "POST", body: claim });
    assertSummary(claimed, id, commitments[0].amount, commitments[1].amount);
    const submitted = await request(`${path}/commitments`, 201, {
      method: "POST", body: commitments[2],
    });
    assertSummary(submitted, id, 35_806, 34_561);
    const retried = await request(`${path}/commitments`, 200, {
      method: "POST", body: commitments[2],
    });
    assertSummary(retried, id, 35_806, 34_561);
    // A new raise submission must not serialize any existing private records.
    await submit();
  });

  await t.test("list and detail stay public after persisted private data is reloaded", async () => {
    await initializeRaiseStore();
    const list = await request("/raises", 200);
    assert.ok(Array.isArray(list));
    assertPublic(list);
    const summary = list.find((raise) => raise.id === id);
    assert.ok(summary, "The claimed raise must remain in the public list");
    assertSummary(summary, id, 35_806, 34_561);
    const detail = await request(path, 200);
    assertSummary(detail, id, 35_806, 34_561);
    for (const body of [summary, detail]) {
      assert.equal(body.name, submission.name);
      assert.equal(body.thesis, submission.thesis);
      assert.equal(body.stage, submission.stage);
      assert.deepEqual(body.range, submission.range);
      assert.equal(body.status, "open");
      assert.equal(body.confirmedTestnetTransfers, 0);
    }
  });

  await t.test("public category filters return only matching raises", async () => {
    const matching = await request("/raises?category=ai-agents", 200);
    assert.ok(matching.length > 0, "The seeded directory includes AI-agent raises");
    assert.ok(matching.every((raise) => raise.categories?.includes("ai-agents")));
    assertPublic(matching);
    await request("/raises?category=not-a-category", 400);
  });

  await t.test("Raise.md exposes the public summary without private records", async () => {
    const { response, text } = await requestMarkdown(`${path}/markdown`, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/markdown\b/);
    assert.match(text, /^# Privacy regression /);
    assert.match(text, /Synthetic route-level privacy regression data\./);
    assert.match(text, /Stage: Seed/);
    assert.match(text, /Page claimed: yes by Synthetic Public Founder/);
    assert.match(text, /Soft total: USD 35,806/);
    assert.match(text, /Hard total: USD 34,561/);
    for (const secret of [
      claim.email, claim.signatureOrAccount,
      ...commitments.flatMap(({ id: commitmentId, identifier }) => [commitmentId, identifier]),
    ]) {
      assert.equal(text.includes(secret), false, `Private value leaked into Markdown: ${secret}`);
    }

    const missing = await fetch(`${base}/raises/missing-raise-${randomUUID()}/markdown`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    assert.match((await missing.json()).error, /not found/i);
  });

  await t.test("private details require sponsor authorization and remain complete", async () => {
    for (const token of [undefined, "incorrect-synthetic-code"]) {
      assertPublic(await request(`${path}/private`, 401, { token }));
    }
    const sponsor = await request(`${path}/private`, 200, { token: approvalCode });
    assert.deepEqual(sponsor.claim, claim);
    assert.deepEqual(sponsor.commitments, commitments.map((commitment, index) => ({
      ...commitment, hard: index === 1, verified: index === 1,
    })));
    assert.equal(sponsor.softTotal, 35_806);
    assert.equal(sponsor.hardTotal, 34_561);
  });
});
