import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import app from "../src/app.ts";
import {
  approveRaiseRecord,
  submitRaiseRecord,
} from "../src/lib/raise-store.ts";

const approvalCode = "quote-flow-test-approval";
const userSessionToken = "near-user-session-test-token";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("quote requests stay authorized, hard-only, fixed-value, and sanitized", async (t) => {
  const previousApprovalCode = process.env.RAISE_APPROVAL_CODE;
  process.env.RAISE_APPROVAL_CODE = approvalCode;

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const originalFetch = globalThis.fetch;
  const privateRaiseId = (await submitRaiseRecord({
    name: "Quote route privacy test",
    thesis: "Synthetic test record.",
    stage: "Seed",
    range: { min: 1, max: 10_000_000 },
  })).id;
  await approveRaiseRecord(privateRaiseId);

  const privateCommitment = {
    id: "private-commitment-secret-id",
    identifier: "Private Investor Contact Secret",
    amount: 987_654_321,
  };
  const quotePath = `/raises/${privateRaiseId}/commitments/${privateCommitment.id}/quote`;
  const sponsorHeaders = { authorization: `Bearer ${approvalCode}` };
  const quoteHeaders = {
    ...sponsorHeaders,
    "x-near-user-session": userSessionToken,
  };
  let providerMock = async () => {
    throw new Error("Unexpected quote provider call");
  };
  const providerRequests = [];

  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://1click.chaindefuser.com/v0/quote") {
      providerRequests.push({ input: String(input), init });
      return providerMock(input, init);
    }
    return originalFetch(input, init);
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (previousApprovalCode === undefined) delete process.env.RAISE_APPROVAL_CODE;
    else process.env.RAISE_APPROVAL_CODE = previousApprovalCode;
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
    return { status: response.status, body: await response.json() };
  }

  await t.test("sponsor approval is required before wallet or provider checks", async () => {
    const response = await request(quotePath, {
      headers: { "x-near-user-session": userSessionToken },
      method: "POST",
    });
    assert.equal(response.status, 401);
    assert.match(response.body.error, /sponsor approval/i);
    assert.equal(providerRequests.length, 0);
  });

  await t.test("only hard commitments can request a quote", async () => {
    const submitted = await request(`/raises/${privateRaiseId}/commitments`, {
      method: "POST",
      body: privateCommitment,
    });
    assert.equal(submitted.status, 201);

    const response = await request(quotePath, {
      method: "POST",
      headers: quoteHeaders,
    });
    assert.equal(response.status, 409);
    assert.match(response.body.error, /mark the commitment hard/i);
    assert.equal(providerRequests.length, 0);
  });

  await t.test("confidential-auth rejection is safe and keeps the commitment hard", async () => {
    const hardened = await request(
      `/raises/${privateRaiseId}/commitments/${privateCommitment.id}`,
      {
        method: "PATCH",
        headers: sponsorHeaders,
        body: { hard: true, verified: false },
      },
    );
    assert.equal(hardened.status, 200);

    const providerSecret = "provider echoed private details";
    providerMock = async () =>
      jsonResponse(
        { message: `Authentication is required. ${providerSecret}` },
        401,
      );
    const response = await request(quotePath, {
      method: "POST",
      headers: quoteHeaders,
    });

    assert.equal(response.status, 502);
    assert.match(response.body.error, /rejected the NEAR wallet session/i);
    assert.ok(!JSON.stringify(response.body).includes(providerSecret));
    const privateRaise = await request(`/raises/${privateRaiseId}/private`, {
      headers: sponsorHeaders,
    });
    assert.equal(
      privateRaise.body.commitments.find((item) => item.id === privateCommitment.id).hard,
      true,
    );
  });

  await t.test("provider timeout returns a safe error and keeps the hard status", async () => {
    providerMock = async () => {
      const error = new Error("provider timeout");
      error.name = "TimeoutError";
      throw error;
    };
    const response = await request(quotePath, {
      method: "POST",
      headers: quoteHeaders,
    });

    assert.equal(response.status, 504);
    assert.match(response.body.error, /timed out/i);
    assert.ok(!JSON.stringify(response.body).includes(privateCommitment.identifier));
    assert.ok(!JSON.stringify(response.body).includes(String(privateCommitment.amount)));
    const privateRaise = await request(`/raises/${privateRaiseId}/private`, {
      headers: sponsorHeaders,
    });
    assert.equal(
      privateRaise.body.commitments.find((item) => item.id === privateCommitment.id).hard,
      true,
    );
  });

  await t.test("provider error details are not echoed to the client", async () => {
    const providerSecret = "private provider diagnostic";
    providerMock = async () =>
      jsonResponse({ message: providerSecret }, 500);
    const response = await request(quotePath, {
      method: "POST",
      headers: quoteHeaders,
    });

    assert.equal(response.status, 502);
    assert.match(response.body.error, /HTTP 500/);
    assert.ok(!JSON.stringify(response.body).includes(providerSecret));
    assert.ok(!JSON.stringify(response.body).includes(privateCommitment.identifier));
  });

  await t.test("provider requests use synthetic values and successful responses are sanitized", async () => {
    providerMock = async () =>
      jsonResponse({
        quote: {
          id: "synthetic-quote-reference",
          amountIn: "1000000",
          amountOut: "995000",
          commitmentId: privateCommitment.id,
          privateAmount: String(privateCommitment.amount),
          privateIdentifier: privateCommitment.identifier,
        },
        timestamp: "2026-11-06T12:00:00.000Z",
        privateData: privateCommitment.identifier,
      });

    const response = await request(quotePath, {
      method: "POST",
      headers: quoteHeaders,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), [
      "confidentialityRequested",
      "dry",
      "inputAmount",
      "inputSymbol",
      "outputAmount",
      "outputSymbol",
      "quoteId",
      "quotedAt",
    ]);
    assert.deepEqual(response.body, {
      dry: true,
      confidentialityRequested: "basic",
      inputSymbol: "USDC",
      outputSymbol: "USDC",
      inputAmount: "1000000",
      outputAmount: "995000",
      quoteId: "synthetic-quote-reference",
      quotedAt: "2026-11-06T12:00:00.000Z",
    });
    const providerRequest = providerRequests.at(-1);
    assert.equal(providerRequest.input, "https://1click.chaindefuser.com/v0/quote");
    assert.equal(providerRequest.init.method, "POST");
    assert.equal(providerRequest.init.headers.Authorization, `Bearer ${userSessionToken}`);
    const body = JSON.parse(providerRequest.init.body);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(body).filter(([key]) => key !== "deadline"),
      ),
      {
        dry: true,
        swapType: "EXACT_INPUT",
        slippageTolerance: 100,
        originAsset:
          "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
        depositType: "ORIGIN_CHAIN",
        destinationAsset:
          "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
        amount: "1000000",
        recipient: "0x1111111111111111111111111111111111111111",
        recipientType: "DESTINATION_CHAIN",
        refundTo: "0x2222222222222222222222222222222222222222",
        refundType: "ORIGIN_CHAIN",
        confidentiality: "basic",
      },
    );
    assert.ok(Number.isFinite(Date.parse(body.deadline)));
    const providerPayload = JSON.stringify(body);
    assert.ok(!providerPayload.includes(privateCommitment.id));
    assert.ok(!providerPayload.includes(privateCommitment.identifier));
    assert.ok(!providerPayload.includes(String(privateCommitment.amount)));
    const responseText = JSON.stringify(response.body);
    assert.ok(!responseText.includes(privateCommitment.id));
    assert.ok(!responseText.includes(privateCommitment.identifier));
    assert.ok(!responseText.includes(String(privateCommitment.amount)));
  });
});
