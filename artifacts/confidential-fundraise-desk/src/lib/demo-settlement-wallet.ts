import { NearConnector } from '@hot-labs/near-connect';
import type { DemoSettlement } from '@workspace/api-client-react';

type Network = DemoSettlement['network'];
const connectors: Partial<Record<Network, NearConnector>> = {};
export function settlementConnector(network: Network): NearConnector {
  return connectors[network] ??= new NearConnector({ network, features: { signInWithoutAddKey: true } });
}

export async function connectSettlementWallet(network: Network): Promise<string> {
  const wallet = await settlementConnector(network).connect();
  const [account] = await wallet.getAccounts({ network });
  if (!account?.accountId) throw new Error(`No ${network} account was returned by the wallet.`);
  return account.accountId;
}

export async function sendDemoUsdc(settlement: DemoSettlement): Promise<string> {
  const { network, signerAccount, tokenContract, receiverAccount, transferMemo } = settlement;
  if (network !== 'testnet') throw new Error('Demo transfers are limited to NEAR testnet.');
  if (!signerAccount || !transferMemo) throw new Error('Both confirmations and preparation are required.');
  const { wallet } = await settlementConnector(network).getConnectedWallet();
  const accounts = await wallet.getAccounts({ network });
  if (!accounts.some(({ accountId }) => accountId === signerAccount)) {
    throw new Error('The connected wallet changed. Reconnect the confirmed sending account.');
  }
  const outcome = await wallet.signAndSendTransaction({
    network, signerId: signerAccount, receiverId: tokenContract,
    actions: [{
      type: 'FunctionCall',
      params: {
        methodName: 'ft_transfer',
        args: { receiver_id: receiverAccount, amount: '1000000', memo: transferMemo },
        gas: '30000000000000', deposit: '1',
      },
    }],
  });
  // The server independently checks finality and token transfer receipts.
  if (!outcome.transaction?.hash) throw new Error('No transaction hash returned. Check your wallet before sending again.');
  return outcome.transaction.hash;
}

export type InvestorDemoReceipt = { commitmentId: string; token: string; persisted: boolean };
const prefix = 'confidential-fundraise:demo-receipts:';
const memory = new Map<string, InvestorDemoReceipt[]>();

export function demoReceipts(raiseId: string): InvestorDemoReceipt[] {
  if (memory.has(raiseId)) return memory.get(raiseId)!;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(prefix + raiseId) ?? '[]');
    if (Array.isArray(raw)) return raw.filter((item): item is InvestorDemoReceipt =>
      item && typeof item.commitmentId === 'string' && /^[a-f0-9]{64}$/.test(item.token));
  } catch { /* Core commitment flow does not require browser storage. */ }
  return [];
}

export function rememberDemoReceipt(raiseId: string, commitmentId: string, token: string): void {
  const receipts = [...demoReceipts(raiseId).filter((item) => item.commitmentId !== commitmentId),
    { commitmentId, token, persisted: true }];
  try { localStorage.setItem(prefix + raiseId, JSON.stringify(receipts)); }
  catch { receipts[receipts.length - 1].persisted = false; }
  memory.set(raiseId, receipts);
  window.dispatchEvent(new Event('demo-receipts-changed'));
}

export function newDemoReceipt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function attemptKey(settlement: DemoSettlement): string { return `demo-transfer-attempt:${settlement.id}`; }
export function savedDemoAttempt(settlement: DemoSettlement): string | null {
  try { return localStorage.getItem(attemptKey(settlement)); }
  catch { return 'unknown'; }
}
export function saveDemoAttempt(settlement: DemoSettlement, hash = 'unknown'): void {
  // Refuse to send when we cannot durably guard against a reload/double payment.
  localStorage.setItem(attemptKey(settlement), hash);
}
