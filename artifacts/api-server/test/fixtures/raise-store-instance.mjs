// A separate process gives each simulated API instance its own cache and queue.
import { pool } from "@workspace/db";
import {
  initializeRaiseStore,
  approveRaiseRecord,
  claimRaiseRecord,
  reserveAgentRaiseRecord,
  updateAgentRaiseRecord,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
} from "../../src/lib/raise-store.ts";

const operations = {
  approveRaiseRecord,
  claimRaiseRecord,
  reserveAgentRaiseRecord,
  updateAgentRaiseRecord,
  submitSoftCommitmentRecord,
  updateRaiseCommitmentRecord,
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
  await pool.end();
});

await initializeRaiseStore();
process.send({ ready: true });
