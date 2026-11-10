import { base58, base64, hex } from '@scure/base';
import { NearConnector } from '@hot-labs/near-connect';
import { createNearSessionRefresher, type NearUserSession } from './near-session-refresh.ts';
import {
  authenticateNearIntentsSession as createNearIntentsSessionApi,
  disconnectNearIntentsSession as clearNearIntentsSessionApi,
  refreshNearIntentsSession as refreshNearIntentsSessionApi,
  type NearIntentsSessionInput,
} from '@workspace/api-client-react';
import {
  NearIntentsKeyRegistrationRequiredError,
  registerNearIntentsKeyAndAuthenticateWith,
} from './near-intents-key-registration.ts';
import {
  checkNearKeyRegistrationStatus,
  parseNearViewResponse,
} from './near-key-status.ts';

const NEAR_RPC_URL = 'https://rpc.mainnet.near.org';
const INTENTS_ACCOUNT_ID = 'intents.near';
const VERSIONED_NONCE_PREFIX = Uint8Array.from([0x56, 0x28, 0xf6, 0xc6, 0]);
type SignedData = NearIntentsSessionInput['signedData'];

export type { NearUserSession } from './near-session-refresh.ts';
export { NearIntentsKeyRegistrationRequiredError } from './near-intents-key-registration.ts';

let connector: NearConnector | null = null;

function getConnector(): NearConnector {
  connector ??= new NearConnector({
    network: 'mainnet',
    features: {
      signMessage: true,
      signInWithoutAddKey: true,
    },
  });
  return connector;
}

async function callNearViewMethod(
  methodName: string,
  args: Record<string, string>,
): Promise<unknown> {
  const response = await fetch(NEAR_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'confidential-fundraise-desk',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'optimistic',
        account_id: INTENTS_ACCOUNT_ID,
        method_name: methodName,
        args_base64: base64.encode(new TextEncoder().encode(JSON.stringify(args))),
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(
      `NEAR RPC could not complete the ${methodName} check (HTTP ${response.status}).`,
    );
  }

  const body: unknown = await response.json();
  return parseNearViewResponse(body, methodName);
}

async function getCurrentSalt(): Promise<Uint8Array> {
  const saltHex = await callNearViewMethod('current_salt', {});
  if (typeof saltHex !== 'string') {
    throw new Error('NEAR Intents returned an invalid salt.');
  }
  const salt = hex.decode(saltHex);
  if (salt.length !== 4) {
    throw new Error('NEAR Intents returned an invalid salt length.');
  }
  return salt;
}

function createVersionedNonce(salt: Uint8Array, deadline: Date): string {
  const timestampedNonce = new Uint8Array(15);
  const startTimeNanos = BigInt(Date.now()) * 1_000_000n;
  new DataView(timestampedNonce.buffer).setBigUint64(0, startTimeNanos, true);
  crypto.getRandomValues(timestampedNonce.subarray(8));

  const nonceBytes = new Uint8Array(32);
  nonceBytes.set(VERSIONED_NONCE_PREFIX);
  nonceBytes.set(salt, 5);
  const deadlineNanos = BigInt(deadline.getTime()) * 1_000_000n;
  new DataView(nonceBytes.buffer).setBigUint64(9, deadlineNanos, true);
  nonceBytes.set(timestampedNonce, 17);
  return base64.encode(nonceBytes);
}

async function hasRegisteredKey(accountId: string, publicKey: string | undefined): Promise<boolean> {
  return checkNearKeyRegistrationStatus(accountId, publicKey, callNearViewMethod);
}

function toEd25519Value(value: string, encoding: 'base58' | 'base64'): string {
  if (value.startsWith('ed25519:')) return value;
  const encoded = encoding === 'base58' ? value : base58.encode(base64.decode(value));
  return `ed25519:${encoded}`;
}

async function createSignedIntentProof(
  wallet: Awaited<ReturnType<NearConnector['connect']>>,
  accountId: string,
): Promise<SignedData> {
  const deadline = new Date(Date.now() + 5 * 60_000);
  const nonce = createVersionedNonce(await getCurrentSalt(), deadline);
  const message = JSON.stringify({
    deadline: deadline.toISOString(),
    intents: [],
    signer_id: accountId,
  });
  const walletSignature = await wallet.signMessage({
    message,
    recipient: INTENTS_ACCOUNT_ID,
    nonce: base64.decode(nonce),
    network: 'mainnet',
    signerId: accountId,
  });
  return {
    standard: 'nep413',
    payload: {
      recipient: INTENTS_ACCOUNT_ID,
      nonce,
      message,
    },
    public_key: toEd25519Value(walletSignature.publicKey, 'base58'),
    signature: toEd25519Value(walletSignature.signature, 'base64'),
  };
}

async function authenticateSignedIntent(signedData: SignedData): Promise<NearUserSession> {
  const session = await createNearIntentsSessionApi({ signedData });

  return {
    accountId: session.accountId,
    accessToken: session.accessToken,
    expiresAt: Date.now() + session.expiresIn * 1_000,
  };
}

export async function authenticateNearWallet(): Promise<NearUserSession> {
  const wallet = await getConnector().connect();
  const [account] = await wallet.getAccounts({ network: 'mainnet' });
  if (!account?.accountId) {
    throw new Error('The connected NEAR wallet did not provide an account.');
  }
  // Some wallets omit the account public key from getAccounts(). The signed
  // NEP-413 proof supplies the wallet's key, which we still verify on-chain
  // before exchanging it for an Intents session or offering key registration.
  const signedData = await createSignedIntentProof(wallet, account.accountId);
  if (!(await hasRegisteredKey(account.accountId, signedData.public_key))) {
    throw new NearIntentsKeyRegistrationRequiredError(
      account.accountId,
      signedData.public_key,
      signedData,
    );
  }
  return authenticateSignedIntent(signedData);
}

export async function registerNearIntentsKeyAndAuthenticate(
  challenge: NearIntentsKeyRegistrationRequiredError,
): Promise<NearUserSession> {
  return registerNearIntentsKeyAndAuthenticateWith(challenge, {
    getConnectedWallet: () => getConnector().getConnectedWallet(),
    hasRegisteredKey,
    authenticateSignedIntent,
  });
}

export async function disconnectNearWallet(): Promise<void> {
  await clearNearIntentsSessionApi();

  const nearConnector = getConnector();
  try {
    const connected = await nearConnector.getConnectedWallet();
    await nearConnector.disconnect(connected.wallet);
  } catch {
    // A missing or already-disconnected wallet does not prevent server cleanup.
  }
}

export const refreshNearWalletSession = createNearSessionRefresher(refreshNearIntentsSessionApi);
