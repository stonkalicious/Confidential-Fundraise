import { base58, base64, hex } from '@scure/base';
import { NearConnector } from '@hot-labs/near-connect';
import {
  authenticateNearIntentsSession as createNearIntentsSessionApi,
  disconnectNearIntentsSession as clearNearIntentsSessionApi,
  refreshNearIntentsSession as refreshNearIntentsSessionApi,
  type NearIntentsSessionInput,
} from '@workspace/api-client-react';

const NEAR_RPC_URL = 'https://rpc.mainnet.near.org';
const INTENTS_ACCOUNT_ID = 'intents.near';
const VERSIONED_NONCE_PREFIX = Uint8Array.from([0x56, 0x28, 0xf6, 0xc6, 0]);
type SignedData = NearIntentsSessionInput['signedData'];

export type NearUserSession = {
  accountId: string;
  accessToken: string;
  expiresAt: number;
};

export class NearIntentsKeyRegistrationRequiredError extends Error {
  readonly accountId: string;

  constructor(accountId: string) {
    super(`The public key for ${accountId} is not registered with NEAR Intents.`);
    this.name = 'NearIntentsKeyRegistrationRequiredError';
    this.accountId = accountId;
  }
}

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
  if (
    !body ||
    typeof body !== 'object' ||
    !('result' in body) ||
    !body.result ||
    typeof body.result !== 'object' ||
    !('result' in body.result) ||
    !Array.isArray(body.result.result) ||
    !body.result.result.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    throw new Error(`NEAR RPC returned an unreadable response for ${methodName}.`);
  }

  return JSON.parse(new TextDecoder().decode(Uint8Array.from(body.result.result)));
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
  if (/^[0-9a-f]{64}$/i.test(accountId)) return true;
  if (!publicKey) {
    throw new Error('This NEAR wallet did not provide a public key to verify its demo account.');
  }

  const formattedPublicKey = publicKey.startsWith('ed25519:')
    ? publicKey
    : `ed25519:${publicKey}`;
  const isRegistered = await callNearViewMethod('has_public_key', {
    account_id: accountId,
    public_key: formattedPublicKey,
  });
  return isRegistered === true;
}

function toEd25519Value(value: string, encoding: 'base58' | 'base64'): string {
  if (value.startsWith('ed25519:')) return value;
  const encoded = encoding === 'base58' ? value : base58.encode(base64.decode(value));
  return `ed25519:${encoded}`;
}

async function authenticateConnectedWallet(
  wallet: Awaited<ReturnType<NearConnector['connect']>>,
  account: { accountId: string; publicKey?: string },
): Promise<NearUserSession> {
  const deadline = new Date(Date.now() + 5 * 60_000);
  const nonce = createVersionedNonce(await getCurrentSalt(), deadline);
  const message = JSON.stringify({
    deadline: deadline.toISOString(),
    intents: [],
    signer_id: account.accountId,
  });
  const walletSignature = await wallet.signMessage({
    message,
    recipient: INTENTS_ACCOUNT_ID,
    nonce: base64.decode(nonce),
    network: 'mainnet',
    signerId: account.accountId,
  });
  const signedData: SignedData = {
    standard: 'nep413',
    payload: {
      recipient: INTENTS_ACCOUNT_ID,
      nonce,
      message,
    },
    public_key: toEd25519Value(walletSignature.publicKey, 'base58'),
    signature: toEd25519Value(walletSignature.signature, 'base64'),
  };

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
  if (!(await hasRegisteredKey(account.accountId, account.publicKey))) {
    throw new NearIntentsKeyRegistrationRequiredError(account.accountId);
  }
  return authenticateConnectedWallet(wallet, account);
}

export async function registerNearIntentsKeyAndAuthenticate(
  expectedAccountId: string,
): Promise<NearUserSession> {
  const { wallet, accounts } = await getConnector().getConnectedWallet();
  const account = accounts.find(({ accountId }) => accountId === expectedAccountId);
  if (!account) {
    throw new Error('The connected NEAR wallet account changed. Connect it again to continue.');
  }
  if (!account.publicKey) {
    throw new Error('This NEAR wallet did not provide a public key to register.');
  }

  const isAlreadyRegistered = await hasRegisteredKey(account.accountId, account.publicKey);
  if (!isAlreadyRegistered) {
    const outcome = await wallet.signAndSendTransaction({
      network: 'mainnet',
      signerId: account.accountId,
      receiverId: INTENTS_ACCOUNT_ID,
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'add_public_key',
            args: { public_key: toEd25519Value(account.publicKey, 'base58') },
            gas: '100000000000000',
            deposit: '1',
          },
        },
      ],
    });
    if (
      !outcome.status ||
      typeof outcome.status !== 'object' ||
      'Failure' in outcome.status
    ) {
      throw new Error('NEAR Intents key registration did not complete successfully.');
    }
  }

  if (!(await hasRegisteredKey(account.accountId, account.publicKey))) {
    throw new Error('NEAR Intents did not confirm that the wallet key was registered.');
  }
  return authenticateConnectedWallet(wallet, account);
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

export async function refreshNearWalletSession(): Promise<NearUserSession> {
  const session = await refreshNearIntentsSessionApi();
  return {
    accountId: session.accountId,
    accessToken: session.accessToken,
    expiresAt: Date.now() + session.expiresIn * 1_000,
  };
}
