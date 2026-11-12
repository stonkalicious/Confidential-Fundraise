import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import app from "../src/app.ts";

test("NEAR Intents wallet and quote endpoints are disabled in the testnet-only demo", async (t) => {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const originalFetch = globalThis.fetch;
  const upstreamRequests = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://1click.chaindefuser.com/")) {
      upstreamRequests.push({ url, init });
      throw new Error("NEAR Intents must not be contacted by this test");
    }
    return originalFetch(input, init);
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  async function request(path, { method = "GET", headers = {}, body } = {}) {
    const response = await originalFetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      cacheControl: response.headers.get("cache-control"),
      body: await response.json(),
      cookies: response.headers.getSetCookie(),
    };
  }

  for (const [path, headers, body] of [
    ["/near-intents/session", {}, { signedData: { unexpected: true } }],
    ["/near-intents/session/refresh", { cookie: "near_intents_refresh=legacy-token" }, undefined],
    [
      "/raises/example/commitments/commitment/quote",
      {
        authorization: "Bearer demo-code",
        "x-near-user-session": "legacy-session",
      },
      undefined,
    ],
  ]) {
    const response = await request(path, { method: "POST", headers, body });
    assert.equal(response.status, 410);
    assert.equal(response.cacheControl, "no-store");
    assert.match(response.body.error, /no testnet/i);
  }

  assert.deepEqual(upstreamRequests, []);

  const cleared = await request("/near-intents/session", {
    method: "DELETE",
    headers: { cookie: "near_intents_refresh=legacy-token; near_intents_account=alice.near" },
  });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.body, { cleared: true });
  assert.equal(cleared.cookies.length, 2);
  assert.ok(cleared.cookies.every((cookie) => /Expires=Thu, 01 Jan 1970/i.test(cookie)));
  assert.deepEqual(upstreamRequests, []);
});
