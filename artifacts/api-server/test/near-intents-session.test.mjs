import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import app from "../src/app.ts";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("NEAR refresh credentials stay server-side and are cleared on disconnect", async (t) => {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const originalFetch = globalThis.fetch;
  const refreshSecret = "near-refresh-token-must-not-leak";
  const providerRequests = [];
  let sessionCookieHeader = "";
  let providerMock = async () => jsonResponse({
    accessToken: "near-access-token",
    expiresIn: 300,
    refreshToken: refreshSecret,
    refreshExpiresIn: 86_400,
  });

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (
      url === "https://1click.chaindefuser.com/v0/auth/authenticate" ||
      url === "https://1click.chaindefuser.com/v0/auth/refresh"
    ) {
      providerRequests.push({ url, init });
      return providerMock(input, init);
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
      body: response.status === 204 ? null : await response.json(),
      cookies: response.headers.getSetCookie(),
    };
  }

  const signedData = {
    standard: "nep413",
    payload: {
      recipient: "intents.near",
      nonce: "signed-wallet-nonce",
      message: JSON.stringify({ signer_id: "alice.near", intents: [] }),
    },
    public_key: "ed25519:wallet-public-key",
    signature: "ed25519:wallet-signature",
  };

  await t.test("authentication stores refresh token only in HttpOnly cookies", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    let response;
    try {
      response = await request("/near-intents/session", {
        method: "POST",
        body: { signedData },
      });
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      accountId: "alice.near",
      accessToken: "near-access-token",
      expiresIn: 300,
    });
    assert.ok(!JSON.stringify(response.body).includes(refreshSecret));

    const cookies = response.cookies;
    assert.equal(cookies.length, 2);
    assert.ok(cookies.every((cookie) => /HttpOnly/i.test(cookie)));
    assert.ok(cookies.every((cookie) => /SameSite=Strict/i.test(cookie)));
    assert.ok(cookies.every((cookie) => cookie.includes("Path=/api/near-intents/session")));
    assert.ok(cookies.every((cookie) => /Secure/i.test(cookie)));
    assert.ok(cookies.some((cookie) => cookie.startsWith("near_intents_refresh=")));
    sessionCookieHeader = cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
  });

  await t.test("refresh uses the HttpOnly cookie and never returns the refresh token", async () => {
    providerMock = async (_input, init) => {
      assert.equal(JSON.parse(init.body).refreshToken, refreshSecret);
      return jsonResponse({ accessToken: "refreshed-access-token", expiresIn: 300 });
    };

    const response = await request("/near-intents/session/refresh", {
      method: "POST",
      headers: { cookie: sessionCookieHeader },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      accountId: "alice.near",
      accessToken: "refreshed-access-token",
      expiresIn: 300,
    });
    assert.ok(!JSON.stringify(response.body).includes(refreshSecret));
  });

  await t.test("temporary provider failures preserve the cookie for a successful retry", async () => {
    providerMock = async () => jsonResponse({ message: "temporarily unavailable" }, 503);
    const failedResponse = await request("/near-intents/session/refresh", {
      method: "POST",
      headers: { cookie: sessionCookieHeader },
    });
    assert.equal(failedResponse.status, 502);
    assert.equal(failedResponse.cookies.length, 0);

    providerMock = async () => {
      throw new TypeError("Network unavailable");
    };
    const networkFailureResponse = await request("/near-intents/session/refresh", {
      method: "POST",
      headers: { cookie: sessionCookieHeader },
    });
    assert.equal(networkFailureResponse.status, 502);
    assert.equal(networkFailureResponse.cookies.length, 0);

    providerMock = async (_input, init) => {
      assert.equal(JSON.parse(init.body).refreshToken, refreshSecret);
      return jsonResponse({ accessToken: "recovered-access-token", expiresIn: 300 });
    };
    const recoveredResponse = await request("/near-intents/session/refresh", {
      method: "POST",
      headers: { cookie: sessionCookieHeader },
    });
    assert.equal(recoveredResponse.status, 200);
    assert.deepEqual(recoveredResponse.body, {
      accountId: "alice.near",
      accessToken: "recovered-access-token",
      expiresIn: 300,
    });
    assert.ok(!JSON.stringify(recoveredResponse.body).includes(refreshSecret));
  });

  await t.test("expired provider refresh tokens clear the browser session", async () => {
    providerMock = async () => jsonResponse({ message: "invalid refresh token" }, 401);
    const response = await request("/near-intents/session/refresh", {
      method: "POST",
      headers: { cookie: sessionCookieHeader },
    });
    assert.equal(response.status, 401);
    assert.equal(response.cookies.length, 2);
    assert.ok(response.cookies.every((cookie) => /Expires=Thu, 01 Jan 1970/i.test(cookie)));
    assert.ok(!JSON.stringify(response.body).includes(refreshSecret));
  });

  await t.test("disconnect expires both session cookies", async () => {
    const response = await request("/near-intents/session", {
      method: "DELETE",
      headers: { cookie: `near_intents_refresh=${refreshSecret}; near_intents_account=alice.near` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { cleared: true });
    assert.equal(response.cookies.length, 2);
    assert.ok(response.cookies.every((cookie) => /Expires=Thu, 01 Jan 1970/i.test(cookie)));
    assert.ok(response.cookies.every((cookie) => /HttpOnly/i.test(cookie)));
  });

  await t.test("invalid signed proofs are rejected before contacting NEAR Intents", async () => {
    const requestCount = providerRequests.length;
    const response = await request("/near-intents/session", {
      method: "POST",
      body: { signedData: { ...signedData, payload: { ...signedData.payload, recipient: "other.near" } } },
    });
    assert.equal(response.status, 400);
    assert.equal(providerRequests.length, requestCount);
  });
});
