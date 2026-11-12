import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import app from "../src/app.ts";

test("malformed JSON on API routes returns a safe JSON error", async (t) => {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/raises`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"name":',
    },
  );

  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: "Malformed JSON request body.",
  });
});
