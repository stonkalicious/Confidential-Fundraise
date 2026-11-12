import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, pool, raiseStateTable } from "@workspace/db";
import app from "../src/app.ts";
import {
  claimRaiseRecord,
  getPrivateRaise,
  getRaise,
  getRaises,
  initializeRaiseStore,
  parsePublicRaiseSeeds,
  publicRaiseId,
  submitSoftCommitmentRecord,
} from "../src/lib/raise-store.ts";

test("public raise seed entries validate, insert once, expose attribution, and preserve live state", async (t) => {
  const name = `Synthetic seeded raise ${randomUUID().slice(0, 8)}`;
  const id = publicRaiseId(name);
  const sourceLink = "https://example.com/source";
  const seed = {
    id,
    position: 10_000_000,
    name,
    thesis: "A concise synthetic thesis for the public raise seeding test.",
    stage: "Demo concept",
    range: { min: 25_000, max: 75_000 },
    rangeIsIndicative: true,
    categories: ["privacy-security"],
    status: "approved",
    sourceLink,
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  };
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.delete(raiseStateTable).where(eq(raiseStateTable.id, id));
    await pool.end();
  });

  assert.equal(publicRaiseId(name), id);
  assert.equal(publicRaiseId(name.toUpperCase()), id);
  assert.deepEqual(
    parsePublicRaiseSeeds([
      {
        name,
        thesis: seed.thesis,
        stage: seed.stage,
        range: seed.range,
        rangeIsIndicative: seed.rangeIsIndicative,
        categories: seed.categories,
        sourceLink,
      },
      {
        name,
        thesis: seed.thesis,
        stage: seed.stage,
        range: seed.range,
      },
    ]),
    [{
      name,
      thesis: seed.thesis,
      stage: seed.stage,
      range: seed.range,
      rangeIsIndicative: true,
      categories: ["privacy-security"],
      sourceLink,
    }],
  );

  for (const invalid of [
    { name: "Missing thesis", stage: "Demo", range: { min: 1, max: 2 } },
    { name: "Bad range", thesis: seed.thesis, stage: "Demo", range: { min: 0, max: 2 } },
    { name: "Bad order", thesis: seed.thesis, stage: "Demo", range: { min: 4, max: 2 } },
    { name: "Bad link", thesis: seed.thesis, stage: "Demo", range: { min: 1, max: 2 }, sourceLink: "javascript:alert(1)" },
    { name: "Bad range qualifier", thesis: seed.thesis, stage: "Demo", range: { min: 1, max: 2 }, rangeIsIndicative: "yes" },
    { name: "Bad category", thesis: seed.thesis, stage: "Demo", range: seed.range, categories: ["unreviewed"] },
    { name: "Duplicate categories", thesis: seed.thesis, stage: "Demo", range: seed.range, categories: ["ai-agents", "ai-agents"] },
    { name: "Empty categories", thesis: seed.thesis, stage: "Demo", range: seed.range, categories: [] },
  ]) {
    assert.throws(() => parsePublicRaiseSeeds([invalid]));
  }
  assert.throws(() => parsePublicRaiseSeeds({}));

  await initializeRaiseStore();
  const newNearhuntRaises = [
    "NEARPORTAL",
    "CareRail",
    "Grind District",
    "Ballast",
    "Lantern Caravan",
    "Intents Desk",
    "Kinwarden",
    "nearx402",
    "PipTradeDex Private Intent",
    "NEARpedia",
  ];
  for (const bundledName of ["NEAR Agent Commerce", "Developer Workflow Copilot", ...newNearhuntRaises]) {
    const bundledRaise = (await getRaises()).find((raise) => raise.name === bundledName);
    assert.ok(bundledRaise, `${bundledName} should be seeded on startup`);
    assert.equal(bundledRaise.claimed, false);
    assert.equal(bundledRaise.softTotal, 0);
    assert.equal(bundledRaise.hardTotal, 0);
    assert.ok(bundledRaise.sourceLink);
    if (newNearhuntRaises.includes(bundledName)) {
      assert.equal(bundledRaise.rangeIsIndicative, true);
      assert.ok(bundledRaise.sourceLink.startsWith("https://nearhunt.xyz/p/"));
      assert.ok(bundledRaise.range.min >= 2_000 && bundledRaise.range.max <= 55_000);
      assert.ok(bundledRaise.categories?.length);
    }
  }

  await initializeRaiseStore([seed, { ...seed, name: "Duplicate input must be ignored." }]);
  const initialPublic = await getRaise(id);
  assert.ok(initialPublic);
  assert.equal(initialPublic.claimed, false);
  assert.equal(initialPublic.softTotal, 0);
  assert.equal(initialPublic.hardTotal, 0);
  assert.equal(initialPublic.sourceLink, sourceLink);
  assert.equal(initialPublic.rangeIsIndicative, true);
  assert.deepEqual(initialPublic.categories, ["privacy-security"]);

  const [initialRows] = await Promise.all([
    db.select().from(raiseStateTable).where(eq(raiseStateTable.id, id)),
  ]);
  assert.equal(initialRows.length, 1);

  const listResponse = await fetch(`${base}/raises`);
  assert.equal(listResponse.status, 200);
  const publicList = await listResponse.json();
  assert.ok(publicList.some((raise) => raise.id === id && raise.sourceLink === sourceLink));
  assert.ok(publicList.some((raise) => raise.id === id && raise.rangeIsIndicative === true));
  assert.ok(publicList.some((raise) => raise.id === id && raise.categories?.includes("privacy-security")));

  const detailResponse = await fetch(`${base}/raises/${id}`);
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.sourceLink, sourceLink);
  assert.equal(detail.rangeIsIndicative, true);
  assert.equal(detail.claimed, false);
  assert.deepEqual(detail.categories, ["privacy-security"]);

  const claim = await claimRaiseRecord(id, {
    founderName: "Synthetic Founder",
    email: "founder@example.invalid",
  });
  assert.equal(claim.kind, "success");
  const commitment = await submitSoftCommitmentRecord(id, {
    id: "seed-test-commitment",
    identifier: "Synthetic Investor",
    amount: 12_500,
  });
  assert.equal(commitment.kind, "success");

  const staleSeed = {
    ...seed,
    name: "Stale seed value",
    thesis: "This content must never replace the live raise.",
    sourceLink: "https://example.org/stale",
    rangeIsIndicative: false,
    commitments: [],
    softTotal: 0,
    hardTotal: 0,
  };
  await initializeRaiseStore([staleSeed, seed]);
  const preserved = await getRaise(id);
  assert.ok(preserved);
  assert.equal(preserved.name, name);
  assert.equal(preserved.sourceLink, sourceLink);
  assert.equal(preserved.rangeIsIndicative, true);
  assert.equal(preserved.claimed, true);
  assert.equal(preserved.softTotal, 12_500);
  assert.equal(preserved.hardTotal, 0);
  assert.equal((await getPrivateRaise(id))?.claim?.email, "founder@example.invalid");
  assert.equal((await getPrivateRaise(id))?.commitments[0]?.identifier, "Synthetic Investor");

  const [rowsAfterRestart] = await Promise.all([
    db.select().from(raiseStateTable).where(eq(raiseStateTable.id, id)),
  ]);
  assert.equal(rowsAfterRestart.length, 1);
});
