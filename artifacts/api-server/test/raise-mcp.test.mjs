import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";
import app from "../src/app.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const API_PATH = "/api";
const FOUNDER_CODE = "synthetic-founder-code";
const CLAIM_TOKEN = "synthetic-one-time-claim-token";
const TESTNET_USDC = "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af";
const VERIFIED_HASH = "A".repeat(44);

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function makeRaise(overrides = {}) {
  return {
    id: "approved-raise",
    name: "Privacy Fund",
    thesis: "Private money and confidential settlement.",
    stage: "Seed",
    range: { min: 100_000, max: 500_000 },
    categories: ["privacy-security"],
    sourceLink: "https://example.com/privacy-fund",
    claimed: false,
    status: "open",
    softTotal: 0,
    hardTotal: 0,
    confirmedTestnetTransfers: 0,
    ...overrides,
  };
}

async function startFakeApi() {
  const state = {
    raises: [
      makeRaise(),
      makeRaise({
        id: "other-raise",
        name: "AI Tools",
        thesis: "Tools for independent AI developers.",
        stage: "Pre-seed",
        range: { min: 25_000, max: 80_000 },
        categories: ["ai-agents"],
      }),
    ],
    commitment: undefined,
    settlement: undefined,
    requestLog: [],
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let body;
    if (request.method !== "GET") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    }
    const headers = {
      authorization: request.headers.authorization,
      investorReceipt: request.headers["x-demo-receipt"],
    };
    state.requestLog.push({ method: request.method, path: url.pathname, body, headers });

    if (url.pathname === `${API_PATH}/healthz`) {
      sendJson(response, 200, { status: "ok" });
      return;
    }
    if (url.pathname === `${API_PATH}/raises` && request.method === "GET") {
      sendJson(response, 200, state.raises);
      return;
    }
    const raiseMatch = url.pathname.match(/^\/api\/raises\/([^/]+)$/);
    if (raiseMatch && request.method === "GET") {
      const raise = state.raises.find(({ id }) => id === decodeURIComponent(raiseMatch[1]));
      if (!raise) {
        sendJson(response, 404, { error: "Raise not found." });
        return;
      }
      sendJson(response, 200, raise);
      return;
    }
    if (url.pathname === `${API_PATH}/raises` && request.method === "POST") {
      sendJson(response, 201, { id: "pending-raise", status: "pending" });
      return;
    }

    const claimMatch = url.pathname.match(/^\/api\/raises\/([^/]+)\/agent-claim$/);
    if (claimMatch && request.method === "POST") {
      const raise = state.raises.find(({ id }) => id === decodeURIComponent(claimMatch[1]));
      if (!raise) {
        sendJson(response, 404, { error: "Raise not found." });
        return;
      }
      raise.claimed = true;
      sendJson(response, 201, { raise, claimToken: CLAIM_TOKEN });
      return;
    }

    const updateMatch = url.pathname.match(/^\/api\/raises\/([^/]+)$/);
    if (updateMatch && request.method === "PATCH") {
      if (headers.authorization !== `Bearer ${CLAIM_TOKEN}`) {
        sendJson(response, 401, { error: "A valid per-raise claim token is required." });
        return;
      }
      const raise = state.raises.find(({ id }) => id === decodeURIComponent(updateMatch[1]));
      if (!raise) {
        sendJson(response, 404, { error: "Raise not found." });
        return;
      }
      if (body.thesis !== undefined) raise.thesis = body.thesis;
      if (body.stage !== undefined) raise.stage = body.stage;
      if (body.range !== undefined) raise.range = body.range;
      if (body.status !== undefined) raise.status = body.status;
      sendJson(response, 200, raise);
      return;
    }

    const commitmentMatch = url.pathname.match(/^\/api\/raises\/([^/]+)\/commitments$/);
    if (commitmentMatch && request.method === "POST") {
      state.commitment = {
        raiseId: decodeURIComponent(commitmentMatch[1]),
        id: body.id,
        identifier: body.identifier,
        amount: body.amount,
        receipt: body.demoReceipt,
      };
      sendJson(response, 201, { ...state.raises[0], softTotal: body.amount });
      return;
    }

    const settlementMatch = url.pathname.match(
      /^\/api\/raises\/([^/]+)\/demo-settlements\/([^/]+)(?:\/(confirm|prepare|verify))?$/,
    );
    if (settlementMatch) {
      const [, raiseIdEncoded, commitmentIdEncoded, action] = settlementMatch;
      const raiseId = decodeURIComponent(raiseIdEncoded);
      const commitmentId = decodeURIComponent(commitmentIdEncoded);
      const validCommitment =
        state.commitment?.raiseId === raiseId &&
        state.commitment?.id === commitmentId;
      const founderAuthorized = headers.authorization === `Bearer ${FOUNDER_CODE}`;
      const investorAuthorized = headers.investorReceipt === state.commitment?.receipt;
      if (!validCommitment) {
        sendJson(response, 404, { error: "An existing soft commitment is required." });
        return;
      }
      if (action === undefined && request.method === "GET") {
        if (!founderAuthorized && !investorAuthorized) {
          sendJson(response, 401, { error: "Use the browser receipt from your original soft commitment." });
          return;
        }
        sendJson(response, 200, state.settlement ? { settlement: state.settlement } : {});
        return;
      }
      if (action === undefined && request.method === "POST") {
        if (!founderAuthorized) {
          sendJson(response, 401, { error: "Enter the founder approval code." });
          return;
        }
        if (body?.network !== "testnet" || body?.confirmed !== true) {
          sendJson(response, 400, { error: "Confirm the testnet transfer details." });
          return;
        }
        state.settlement = {
          id: "00000000-0000-4000-8000-000000000001",
          network: "testnet",
          tokenContract: TESTNET_USDC,
          receiverAccount: body.receiverAccount,
          confirmations: [{ role: "sponsor", timestamp: new Date().toISOString() }],
          status: "awaiting_investor",
        };
        sendJson(response, 200, { settlement: state.settlement });
        return;
      }
      if (action === "confirm" && request.method === "POST") {
        if (!investorAuthorized) {
          sendJson(response, 401, { error: "Use the browser receipt from your original soft commitment." });
          return;
        }
        if (!state.settlement || body?.settlementId !== state.settlement.id || body?.confirmed !== true) {
          sendJson(response, 409, { error: "Review the founder's current transfer details first." });
          return;
        }
        state.settlement.signerAccount = body.signerAccount;
        state.settlement.confirmations.push({ role: "investor", timestamp: new Date().toISOString() });
        state.settlement.status = "ready";
        sendJson(response, 200, { settlement: state.settlement });
        return;
      }
      if (action === "prepare" && request.method === "POST") {
        if (!investorAuthorized) {
          sendJson(response, 401, { error: "Use the browser receipt from your original soft commitment." });
          return;
        }
        if (!state.settlement?.confirmations.some(({ role }) => role === "investor")) {
          sendJson(response, 409, { error: "Both the founder and investor must confirm before a transfer can be prepared." });
          return;
        }
        state.settlement.status = "prepared";
        state.settlement.transferMemo = "demo-settlement:synthetic-reference";
        sendJson(response, 200, { settlement: state.settlement, maySend: true });
        return;
      }
      if (action === "verify" && request.method === "POST") {
        if (!investorAuthorized) {
          sendJson(response, 401, { error: "Use the browser receipt from your original soft commitment." });
          return;
        }
        if (state.settlement?.status !== "prepared") {
          sendJson(response, 409, { error: "Both confirmations and transfer preparation are required." });
          return;
        }
        if (body?.transactionHash !== VERIFIED_HASH) {
          sendJson(response, 400, { error: "The transaction does not match the confirmed testnet transfer." });
          return;
        }
        state.settlement.status = "success";
        state.settlement.transactionHash = VERIFIED_HASH;
        sendJson(response, 200, { settlement: state.settlement });
        return;
      }
    }
    sendJson(response, 404, { error: "Not found." });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    state,
    baseUrl: `http://127.0.0.1:${server.address().port}${API_PATH}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function startMcp(baseUrl, extraEnv = {}) {
  const child = spawn(process.execPath, ["--import", "tsx", "src/mcp.ts"], {
    cwd: packageRoot,
    env: {
      ...process.env,
      AGENT_RAISED_API_BASE_URL: baseUrl,
      RAISE_APPROVAL_CODE: FOUNDER_CODE,
      ...extraEnv,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffer = "";
  let stderr = "";
  const pending = new Map();
  let nextId = 0;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    while (buffer.includes("\n")) {
      const newline = buffer.indexOf("\n");
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id !== undefined && pending.has(message.id)) {
        const resolve = pending.get(message.id);
        pending.delete(message.id);
        resolve(message);
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  function request(method, params = {}) {
    const id = ++nextId;
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for MCP ${method}. stderr=${stderr}`));
      }, 5_000);
      pending.set(id, (message) => {
        clearTimeout(timeout);
        resolve(message);
      });
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return promise;
  }
  function notify(method, params = {}) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }
  async function initialize() {
    const response = await request("initialize", {
      protocolVersion: "2026-07-28",
      capabilities: {},
      clientInfo: { name: "agent-raised-mcp-test", version: "1.0.0" },
    });
    assert.equal(response.error, undefined, JSON.stringify(response.error));
    notify("notifications/initialized");
  }
  async function callTool(name, args) {
    const response = await request("tools/call", { name, arguments: args });
    if (response.error) return { isProtocolError: true, error: response.error };
    return response.result;
  }
  async function close() {
    if (child.exitCode !== null) return;
    const exited = once(child, "exit");
    child.stdin.end();
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  return { child, request, notify, initialize, callTool, close, get stderr() { return stderr; } };
}

function toolText(result) {
  return result?.content?.find((block) => block.type === "text")?.text ?? "";
}

async function remoteMcpRequest(baseUrl, message, options = {}) {
  const response = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(message),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return { status: response.status, result: undefined, text };
  if (contentType.includes("text/event-stream")) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    return {
      status: response.status,
      result: data.length ? JSON.parse(data.at(-1)) : undefined,
      text,
    };
  }
  return { status: response.status, result: JSON.parse(text), text };
}

async function remoteMcpRequestWithHost(baseUrl, host, message) {
  const url = new URL(`${baseUrl}/api/mcp`);
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, {
      method: "POST",
      headers: {
        host,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: response.statusCode,
          text,
          result: text ? JSON.parse(text) : undefined,
        });
      });
    });
    request.on("error", reject);
    request.end(JSON.stringify(message));
  });
}

test("hosted MCP exposes safe public raise tools over stateless HTTP", async (t) => {
  const fakeApi = await startFakeApi();
  const apiServer = createServer(app);
  await new Promise((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  const originalBaseUrl = process.env.AGENT_RAISED_API_BASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.AGENT_RAISED_API_BASE_URL = fakeApi.baseUrl;
  process.env.NODE_ENV = "test";
  t.after(async () => {
    if (originalBaseUrl === undefined) delete process.env.AGENT_RAISED_API_BASE_URL;
    else process.env.AGENT_RAISED_API_BASE_URL = originalBaseUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    await fakeApi.close();
    await new Promise((resolve) => apiServer.close(resolve));
  });
  const mcpUrl = `http://127.0.0.1:${apiServer.address().port}`;

  const rejectedHost = await remoteMcpRequestWithHost(
    mcpUrl,
    "untrusted.example",
    { jsonrpc: "2.0", id: 99, method: "initialize", params: {} },
  );
  assert.equal(rejectedHost.status, 403);

  const initialize = await remoteMcpRequest(mcpUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "agent-raised-remote-test", version: "1.0.0" },
    },
  });
  assert.equal(initialize.status, 200, initialize.text);
  assert.equal(initialize.result.error, undefined, initialize.text);

  await remoteMcpRequest(mcpUrl, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, { headers: { "mcp-protocol-version": "2025-11-25" } });

  const listed = await remoteMcpRequest(mcpUrl, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  }, { headers: { "mcp-protocol-version": "2025-11-25" } });
  assert.equal(listed.status, 200, listed.text);
  const names = listed.result.result.tools.map(({ name }) => name).sort();
  assert.deepEqual(names, [
    "claim_or_update_raise",
    "get_raise",
    "list_raises",
    "soft_commit",
  ]);

  const listResult = await remoteMcpRequest(mcpUrl, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "list_raises", arguments: { keyword: "privacy" } },
  }, { headers: { "mcp-protocol-version": "2025-11-25" } });
  assert.equal(listResult.status, 200, listResult.text);
  const publicRaises = JSON.parse(listResult.result.result.content[0].text).raises;
  assert.deepEqual(publicRaises.map(({ id }) => id), ["approved-raise"]);
  assert.equal(JSON.stringify(publicRaises).includes("commitments"), false);

  const detail = await remoteMcpRequest(mcpUrl, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "get_raise", arguments: { raiseId: "approved-raise" } },
  }, { headers: { "mcp-protocol-version": "2025-11-25" } });
  assert.equal(detail.status, 200, detail.text);
  assert.equal(JSON.parse(detail.result.result.content[0].text).raise.name, "Privacy Fund");

  const publish = await remoteMcpRequest(mcpUrl, {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "claim_or_update_raise",
      arguments: {
        action: "create",
        name: "Synthetic hosted raise",
        thesis: "A sufficiently detailed hosted demo thesis.",
        stage: "Seed",
        range: { min: 100_000, max: 500_000 },
      },
    },
  }, { headers: { "mcp-protocol-version": "2025-11-25" } });
  assert.equal(publish.status, 200, publish.text);
  assert.equal(JSON.parse(publish.result.result.content[0].text).status, "pending");

  const commitment = await remoteMcpRequest(mcpUrl, {
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "soft_commit",
      arguments: {
        raiseId: "approved-raise",
        commitmentId: "remote-demo-commitment",
        identifier: "private-demo-alias",
        amount: 1200,
      },
    },
  }, { headers: { "mcp-protocol-version": "2025-11-25" } });
  assert.equal(commitment.status, 200, commitment.text);
  assert.equal(commitment.result.result.content[0].text, "Soft commitment recorded.");
  assert.equal(commitment.text.includes("private-demo-alias"), false);
  assert.equal(commitment.text.includes("1200"), false);
});

test("standalone MCP exposes exactly four tools and preserves the existing public/role boundaries", async (t) => {
  const fakeApi = await startFakeApi();
  const mcp = startMcp(fakeApi.baseUrl);
  t.after(async () => {
    await mcp.close();
    await fakeApi.close();
  });
  await mcp.initialize();

  const listed = await mcp.request("tools/list");
  const toolNames = listed.result.tools.map(({ name }) => name).sort();
  assert.deepEqual(toolNames, [
    "claim_or_update_raise",
    "list_raises",
    "settle_test_usdc",
    "soft_commit",
  ]);

  const filtered = await mcp.callTool("list_raises", {
    stage: "seed",
    minRange: 200_000,
    maxRange: 250_000,
    keyword: "PRIVACY",
  });
  const filteredBody = JSON.parse(toolText(filtered));
  assert.deepEqual(filteredBody.raises.map(({ id }) => id), ["approved-raise"]);
  assert.deepEqual(Object.keys(filteredBody.raises[0]).sort(), [
    "categories", "claimed", "confirmedTestnetTransfers", "hardTotal", "id",
    "name", "range", "sourceLink", "softTotal", "stage", "status", "thesis",
  ].sort());
  assert.equal(JSON.stringify(filteredBody).includes("commitments"), false);
  assert.equal(JSON.stringify(filteredBody).includes("claimantName"), false);

  const created = await mcp.callTool("claim_or_update_raise", {
    action: "create",
    name: "Synthetic pending raise",
    thesis: "A sufficiently long synthetic investment thesis.",
    stage: "Seed",
    range: { min: 100_000, max: 400_000 },
  });
  assert.deepEqual(JSON.parse(toolText(created)), {
    raiseId: "pending-raise",
    status: "pending",
    message: "Raise submitted for manual approval; it is not public until approved.",
  });

  const claimed = await mcp.callTool("claim_or_update_raise", {
    action: "claim",
    raiseId: "approved-raise",
  });
  const claimedBody = JSON.parse(toolText(claimed));
  assert.equal(claimedBody.claimToken, CLAIM_TOKEN);
  assert.equal(claimedBody.raise.claimed, true);
  assert.equal(claimedBody.raise.claimantName, undefined);
  const rejectedUpdate = await mcp.callTool("claim_or_update_raise", {
    action: "update",
    raiseId: "approved-raise",
    claimToken: "wrong-token",
    status: "closed",
  });
  assert.equal(rejectedUpdate.isError, true);
  assert.match(toolText(rejectedUpdate), /authorization failed/i);
  assert.equal(fakeApi.state.raises[0].status, "open");
  const update = await mcp.callTool("claim_or_update_raise", {
    action: "update",
    raiseId: "approved-raise",
    claimToken: CLAIM_TOKEN,
    thesis: "Updated public thesis with enough detail.",
    status: "paused",
  });
  assert.equal(JSON.parse(toolText(update)).raise.status, "paused");
  assert.equal(JSON.parse(toolText(update)).raise.thesis, "Updated public thesis with enough detail.");
  assert.equal(fakeApi.state.requestLog.at(-1).headers.authorization, `Bearer ${CLAIM_TOKEN}`);
  assert.equal(JSON.stringify(fakeApi.state.requestLog.at(-1).body).includes(CLAIM_TOKEN), false);

  const secretIdentifier = "synthetic-private-investor-alias";
  const commitmentId = "synthetic-private-commitment-id";
  const softCommit = await mcp.callTool("soft_commit", {
    raiseId: "approved-raise",
    commitmentId,
    identifier: secretIdentifier,
    amount: 1_200,
  });
  assert.equal(toolText(softCommit), "Soft commitment recorded.");
  assert.equal(softCommit.isError, undefined);
  const receipt = fakeApi.state.commitment.receipt;
  assert.match(receipt, /^[a-f0-9]{64}$/);
  for (const privateValue of [secretIdentifier, commitmentId, "1200", receipt]) {
    assert.equal(toolText(softCommit).includes(privateValue), false);
  }

  const beforeConfirm = await mcp.callTool("settle_test_usdc", {
    action: "prepare",
    raiseId: "approved-raise",
    commitmentId,
  });
  assert.equal(beforeConfirm.isError, true);
  assert.match(toolText(beforeConfirm), /founder and investor must confirm/i);

  const missingFounderConfirmation = await mcp.callTool("settle_test_usdc", {
    action: "founder_confirm",
    raiseId: "approved-raise",
    commitmentId,
    receiverAccount: "founder.testnet",
  });
  assert.equal(missingFounderConfirmation.isError, true);
  assert.match(toolText(missingFounderConfirmation), /founder confirmation is missing/i);

  const founderConfirm = await mcp.callTool("settle_test_usdc", {
    action: "founder_confirm",
    raiseId: "approved-raise",
    commitmentId,
    receiverAccount: "founder.testnet",
    confirmed: true,
  });
  const founderConfirmText = toolText(founderConfirm);
  assert.match(founderConfirmText, /investor_confirm/);
  assert.deepEqual(JSON.parse(founderConfirmText).confirmedRoles, ["Founder"]);
  assert.equal(founderConfirmText.includes(FOUNDER_CODE), false);
  assert.equal(founderConfirmText.includes(receipt), false);
  assert.equal(founderConfirmText.includes(commitmentId), false);

  const missingInvestorConfirmation = await mcp.callTool("settle_test_usdc", {
    action: "investor_confirm",
    raiseId: "approved-raise",
    commitmentId,
    signerAccount: "investor.testnet",
  });
  assert.equal(missingInvestorConfirmation.isError, true);
  assert.match(toolText(missingInvestorConfirmation), /investor confirmation is missing/i);

  const investorConfirm = await mcp.callTool("settle_test_usdc", {
    action: "investor_confirm",
    raiseId: "approved-raise",
    commitmentId,
    signerAccount: "investor.testnet",
    confirmed: true,
  });
  assert.equal(JSON.parse(toolText(investorConfirm)).status, "ready", toolText(investorConfirm));
  const status = await mcp.callTool("settle_test_usdc", {
    action: "status",
    raiseId: "approved-raise",
    commitmentId,
  });
  assert.deepEqual(JSON.parse(toolText(status)).confirmedRoles, ["Founder", "Investor"]);
  assert.equal(toolText(status).includes("sponsor"), false);

  const verifyBeforePrepare = await mcp.callTool("settle_test_usdc", {
    action: "verify",
    raiseId: "approved-raise",
    commitmentId,
    transactionHash: VERIFIED_HASH,
  });
  assert.equal(verifyBeforePrepare.isError, true);
  assert.match(toolText(verifyBeforePrepare), /preparation is missing/i);
  assert.equal(toolText(verifyBeforePrepare).includes(receipt), false);
  assert.equal(toolText(verifyBeforePrepare).includes(VERIFIED_HASH), false);

  const prepared = await mcp.callTool("settle_test_usdc", {
    action: "prepare",
    raiseId: "approved-raise",
    commitmentId,
  });
  const preparedBody = JSON.parse(toolText(prepared));
  assert.equal(preparedBody.maySend, true);
  assert.equal(preparedBody.requiresUserSignature, true);
  assert.equal(preparedBody.network, "testnet");
  assert.deepEqual(preparedBody.walletInstructions, {
    tokenContract: TESTNET_USDC,
    method: "ft_transfer",
    args: {
      receiver_id: "founder.testnet",
      amount: "1000000",
      memo: "demo-settlement:synthetic-reference",
    },
    deposit: "1",
  });
  assert.equal(preparedBody.transactionHash, undefined);
  assert.equal(preparedBody.sent, undefined);
  assert.equal(fakeApi.state.settlement.transactionHash, undefined);

  const missingSignedHash = await mcp.callTool("settle_test_usdc", {
    action: "verify",
    raiseId: "approved-raise",
    commitmentId,
  });
  assert.equal(missingSignedHash.isError, true);
  assert.match(toolText(missingSignedHash), /signed transaction hash is missing/i);

  const verified = await mcp.callTool("settle_test_usdc", {
    action: "verify",
    raiseId: "approved-raise",
    commitmentId,
    transactionHash: VERIFIED_HASH,
  });
  assert.deepEqual(JSON.parse(toolText(verified)), {
    status: "success",
    network: "testnet",
    verified: true,
    transactionHash: VERIFIED_HASH,
  });
  assert.equal(fakeApi.state.settlement.status, "success");

  const privateStrings = [
    secretIdentifier,
    commitmentId,
    receipt,
    FOUNDER_CODE,
    "investor.testnet",
  ];
  for (const output of [filtered, created, claimed, update, softCommit, founderConfirm, investorConfirm, prepared]) {
    for (const privateValue of privateStrings) assert.equal(toolText(output).includes(privateValue), false);
  }
});

test("the API remains usable when the MCP process is stopped or cannot start", async (t) => {
  const apiServer = createServer(app);
  await new Promise((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => apiServer.close(resolve)));
  const healthUrl = `http://127.0.0.1:${apiServer.address().port}/api/healthz`;
  assert.equal((await fetch(healthUrl)).status, 200);

  const stoppedMcp = startMcp("http://127.0.0.1:1/api");
  await stoppedMcp.initialize();
  await stoppedMcp.close();
  assert.equal((await fetch(healthUrl)).status, 200);

  const invalidMcp = startMcp("not-a-valid-api-url");
  const [exitCode] = await Promise.race([
    once(invalidMcp.child, "exit"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("MCP did not exit on invalid configuration.")), 5_000)),
  ]);
  assert.equal(exitCode, 1);
  assert.equal((await fetch(healthUrl)).status, 200);
});
