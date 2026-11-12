import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import express from "express";
import { createPublicMediaRouter, parseByteRange } from "../src/routes/public-media.ts";

test("single byte ranges handle open, closed, suffix, clamped and invalid requests", () => {
  assert.deepEqual(parseByteRange("bytes=0-1", 10), { start: 0, end: 1 });
  assert.deepEqual(parseByteRange("bytes=5-", 10), { start: 5, end: 9 });
  assert.deepEqual(parseByteRange("bytes=-3", 10), { start: 7, end: 9 });
  assert.deepEqual(parseByteRange("bytes=8-99", 10), { start: 8, end: 9 });
  assert.deepEqual(parseByteRange("bytes=-99", 10), { start: 0, end: 9 });
  for (const invalid of ["bytes=10-", "bytes=5-3", "bytes=-0", "bytes=-", "bytes=0-1,4-5", "nonsense", "bytes=9007199254740992-"]) {
    assert.equal(parseByteRange(invalid, 10), null, invalid);
  }
});

test("public media serves complete files, HEAD and seeking without exposing other objects", async (t) => {
  const bytes = Buffer.from("0123456789");
  let streams = 0;
  let lookups = 0;
  const app = express();
  app.use("/api", createPublicMediaRouter(async () => {
    lookups++;
    return {
      getMetadata: async () => [{ size: String(bytes.length), etag: "demo", updated: "2026-11-12T10:00:00Z" }],
      createReadStream: ({ start, end }) => {
        streams++;
        return Readable.from([bytes.subarray(start, end + 1)]);
      },
    };
  }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/storage/public-objects/agent-raised/walkthrough-589be0760638.mp4`;
  const complete = await fetch(url);
  assert.equal(complete.status, 200);
  assert.equal(complete.headers.get("content-type"), "video/mp4");
  assert.equal(complete.headers.get("accept-ranges"), "bytes");
  assert.equal(complete.headers.get("content-length"), "10");
  assert.equal(await complete.text(), "0123456789");
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), "10");
  assert.equal(await head.text(), "");
  assert.equal(streams, 1);
  for (const [range, expected, contentRange] of [
    ["bytes=2-4", "234", "bytes 2-4/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=-2", "89", "bytes 8-9/10"],
  ]) {
    const part = await fetch(url, { headers: { Range: range } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), contentRange);
    assert.equal(await part.text(), expected);
  }
  const invalid = await fetch(url, { headers: { Range: "bytes=99-" } });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get("content-range"), "bytes */10");
  const stale = await fetch(url, { headers: { Range: "bytes=2-4", "If-Range": '"stale"' } });
  assert.equal(stale.status, 200);
  assert.equal(await stale.text(), "0123456789");
  const previousLookups = lookups;
  const privateObject = await fetch(url.replace("walkthrough-589be0760638.mp4", "private-commitments.json"));
  assert.equal(privateObject.status, 404);
  assert.equal(lookups, previousLookups);
});

test("missing or unavailable storage fails explicitly without local file fallback", async (t) => {
  const app = express();
  let mode = "missing";
  app.use("/api", createPublicMediaRouter(async () => {
    if (mode === "error") throw new Error("storage unavailable");
    return null;
  }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/storage/public-objects/agent-raised/walkthrough-589be0760638.webp`;
  assert.equal((await fetch(url)).status, 404);
  mode = "error";
  const unavailable = await fetch(url);
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: "Walkthrough media is temporarily unavailable." });
});
