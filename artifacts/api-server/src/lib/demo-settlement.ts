import type { DemoSettlementRecord } from "@workspace/db";

// Circle's published native USDC contracts, not bridged or lookalike tokens:
// https://developers.circle.com/stablecoins/usdc-contract-addresses
export const USDC_CONTRACTS = {
  testnet: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af",
  mainnet: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
} as const;
export const USDC_AMOUNT = "1000000";
export type SettlementNetwork = keyof typeof USDC_CONTRACTS;

export class SettlementError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validNearAccount(value: string): boolean {
  return value.length >= 2 && value.length <= 64 &&
    /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(value);
}

export function validReference(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    // A hash / CID only. No contract text or uploaded content.
    return /^(?:[a-z0-9-]+:)?[a-zA-Z0-9]{32,160}$/.test(value);
  }
}

export async function nearRpc(
  network: SettlementNetwork, method: string, params: unknown,
): Promise<unknown> {
  let body: unknown;
  try {
    const response = await fetch(`https://rpc.${network}.near.org`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "demo-settlement", method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("RPC HTTP error");
    body = await response.json();
  } catch {
    throw new SettlementError("NEAR is unavailable. Do not send again; retry checking the transaction.", 502);
  }
  if (!record(body) || body.error || !("result" in body)) {
    throw new SettlementError("NEAR could not confirm the account or transaction. Do not send again.", 502);
  }
  return body.result;
}

async function tokenView(network: SettlementNetwork, method: string, args: unknown): Promise<unknown> {
  const result = await nearRpc(network, "query", {
    request_type: "call_function", finality: "final",
    account_id: USDC_CONTRACTS[network], method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  if (!record(result) || !Array.isArray(result.result)) {
    throw new SettlementError("USDC returned an unreadable response.", 502);
  }
  try { return JSON.parse(Buffer.from(result.result).toString("utf8")); }
  catch { throw new SettlementError("USDC returned an unreadable response.", 502); }
}

export async function preflightSettlement(row: DemoSettlementRecord): Promise<void> {
  const network = row.network as SettlementNetwork;
  if (!row.signerAccount || row.signerAccount === row.receiverAccount) {
    throw new SettlementError("Use different sending and receiving NEAR accounts.");
  }
  const [metadata, registration, balance] = await Promise.all([
    tokenView(network, "ft_metadata", {}),
    tokenView(network, "storage_balance_of", { account_id: row.receiverAccount }),
    tokenView(network, "ft_balance_of", { account_id: row.signerAccount }),
  ]);
  if (!record(metadata) || metadata.symbol !== "USDC" || metadata.decimals !== 6) {
    throw new SettlementError("The configured USDC contract could not be verified.", 502);
  }
  if (!registration) {
    throw new SettlementError("The sponsor must register the receiving account with this USDC contract first. No transfer was sent.");
  }
  if (typeof balance !== "string" || !/^\d+$/.test(balance) || BigInt(balance) < 1_000_000n) {
    throw new SettlementError(`The sending wallet needs at least 1 ${network === "testnet" ? "test " : ""}USDC, plus NEAR for gas.`);
  }
}

// Verify the actual finalized transaction, not a hash or wallet success claim.
export function validateSettlementTransaction(row: DemoSettlementRecord, result: unknown): void {
  if (!record(result) || !record(result.transaction) || !record(result.status) ||
      !("SuccessValue" in result.status) || result.final_execution_status !== "FINAL") {
    throw new SettlementError("The transfer is not finalized successfully. Check its status before doing anything else.");
  }
  const tx = result.transaction;
  if (tx.signer_id !== row.signerAccount ||
      tx.receiver_id !== USDC_CONTRACTS[row.network as SettlementNetwork] ||
      !Array.isArray(tx.actions) || tx.actions.length !== 1) {
    throw new SettlementError("This transaction does not match the confirmed demo transfer.", 400);
  }
  const action = tx.actions[0];
  const call = record(action) ? action.FunctionCall : undefined;
  if (!record(call) || call.method_name !== "ft_transfer" || call.deposit !== "1" ||
      typeof call.args !== "string") {
    throw new SettlementError("Expected an exact USDC ft_transfer transaction.", 400);
  }
  let args: unknown;
  try { args = JSON.parse(Buffer.from(call.args, "base64").toString("utf8")); }
  catch { throw new SettlementError("The token transfer arguments are invalid.", 400); }
  if (!record(args) || args.receiver_id !== row.receiverAccount ||
      args.amount !== USDC_AMOUNT || !row.transferMemo || args.memo !== row.transferMemo) {
    throw new SettlementError("The recipient, amount, or demo transfer reference does not match.", 400);
  }
  if (!Array.isArray(result.receipts_outcome) ||
      !record(result.transaction_outcome) ||
      !record(result.transaction_outcome.outcome) ||
      !record(result.transaction_outcome.outcome.status) ||
      "Failure" in result.transaction_outcome.outcome.status) {
    throw new SettlementError("The transfer receipts are incomplete or failed.");
  }
  let transferEvent = false;
  for (const receipt of result.receipts_outcome) {
    const outcome = record(receipt) ? receipt.outcome : undefined;
    if (!record(outcome) || !record(outcome.status) || "Failure" in outcome.status) {
      throw new SettlementError("A transfer receipt failed. No success has been recorded.");
    }
    if (outcome.executor_id !== USDC_CONTRACTS[row.network as SettlementNetwork] ||
        !Array.isArray(outcome.logs)) continue;
    for (const log of outcome.logs) {
      if (typeof log !== "string" || !log.startsWith("EVENT_JSON:")) continue;
      let event: unknown;
      try { event = JSON.parse(log.slice("EVENT_JSON:".length)); } catch { continue; }
      if (!record(event) || event.standard !== "nep141" || event.event !== "ft_transfer" ||
          !Array.isArray(event.data)) continue;
      transferEvent ||= event.data.some((data: unknown) =>
        record(data) && data.old_owner_id === row.signerAccount &&
        data.new_owner_id === row.receiverAccount && data.amount === USDC_AMOUNT);
    }
  }
  if (!transferEvent) throw new SettlementError("No matching USDC transfer event was confirmed.");
}

export async function verifySettlementTransaction(row: DemoSettlementRecord, hash: string): Promise<void> {
  const result = await nearRpc(row.network as SettlementNetwork, "tx", {
    tx_hash: hash, sender_account_id: row.signerAccount, wait_until: "FINAL",
  });
  if (!record(result) || !record(result.transaction) || result.transaction.hash !== hash) {
    throw new SettlementError("NEAR returned a different transaction.", 502);
  }
  validateSettlementTransaction(row, result);
}
