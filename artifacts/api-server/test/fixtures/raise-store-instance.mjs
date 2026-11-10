// A separate process gives each simulated API instance its own cache and queue.
import { pool } from "@workspace/db";
import { createServer } from "node:http";
import app from "../../src/app.ts";
import {
  initializeRaiseStore,
  approveRaiseRecord,
  claimRaiseRecord,
  reserveAgentRaiseRecord,
  updateAgentRaiseRecord,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
  getRaise,
  getRaises,
  getPrivateRaise,
  getPendingRaises,
} from "../../src/lib/raise-store.ts";

// Only synthetic credentials are used by this test server.
process.env.RAISE_APPROVAL_CODE = "isolated-freshness-approval";
const server = createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const operations = {
  approveRaiseRecord,
  claimRaiseRecord,
  reserveAgentRaiseRecord,
  updateAgentRaiseRecord,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
  getRaise,
  getRaises,
  getPrivateRaise,
  getPendingRaises,
  async request(path, { method = "GET", body, token } = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      body: await response.json(),
      cache: response.headers.get("cache-control"),
    };
  },
};

process.on("message", async ({ requestId, operation, args }) => {
  try {
    const result = await operations[operation](...args);
    process.send({ requestId, result });
  } catch (error) {
    process.send({ requestId, error: error.message });
  }
});
process.on("disconnect", async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

await initializeRaiseStore();
process.send({ ready: true });
