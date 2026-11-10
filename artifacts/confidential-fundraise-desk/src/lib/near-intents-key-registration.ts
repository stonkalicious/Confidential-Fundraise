import type { NearIntentsSessionInput } from '@workspace/api-client-react';
import type { NearUserSession } from './near-session-refresh.ts';

type SignedData = NearIntentsSessionInput['signedData'];

export class NearIntentsKeyRegistrationRequiredError extends Error {
  readonly accountId: string;
  readonly publicKey: string;
  readonly signedData: SignedData;

  constructor(accountId: string, publicKey: string, signedData: SignedData) {
    super(`The public key for ${accountId} is not registered with NEAR Intents.`);
    this.name = 'NearIntentsKeyRegistrationRequiredError';
    this.accountId = accountId;
    this.publicKey = publicKey;
    this.signedData = signedData;
  }
}

type RegistrationTransaction = {
  network: 'mainnet';
  signerId: string;
  receiverId: 'intents.near';
  actions: [
    {
      type: 'FunctionCall';
      params: {
        methodName: 'add_public_key';
        args: { public_key: string };
        gas: '100000000000000';
        deposit: '1';
      };
    },
  ];
};

type ConnectedWallet = {
  signAndSendTransaction(transaction: RegistrationTransaction): Promise<{
    status?: unknown;
  }>;
};

type NearKeyRegistrationDependencies = {
  getConnectedWallet: () => Promise<{
    wallet: ConnectedWallet;
    accounts: Array<{ accountId: string }>;
  }>;
  hasRegisteredKey: (accountId: string, publicKey: string) => Promise<boolean>;
  authenticateSignedIntent: (signedData: SignedData) => Promise<NearUserSession>;
};

function asEd25519PublicKey(publicKey: string): string {
  return publicKey.startsWith('ed25519:') ? publicKey : `ed25519:${publicKey}`;
}

export async function registerNearIntentsKeyAndAuthenticateWith(
  challenge: NearIntentsKeyRegistrationRequiredError,
  dependencies: NearKeyRegistrationDependencies,
): Promise<NearUserSession> {
  const { wallet, accounts } = await dependencies.getConnectedWallet();
  const account = accounts.find(({ accountId }) => accountId === challenge.accountId);
  if (!account) {
    throw new Error('The connected NEAR wallet account changed. Connect it again to continue.');
  }

  const isAlreadyRegistered = await dependencies.hasRegisteredKey(
    account.accountId,
    challenge.publicKey,
  );
  if (!isAlreadyRegistered) {
    const outcome = await wallet.signAndSendTransaction({
      network: 'mainnet',
      signerId: account.accountId,
      receiverId: 'intents.near',
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'add_public_key',
            args: { public_key: asEd25519PublicKey(challenge.publicKey) },
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

  if (!(await dependencies.hasRegisteredKey(account.accountId, challenge.publicKey))) {
    throw new Error('NEAR Intents did not confirm that the wallet key was registered.');
  }
  return dependencies.authenticateSignedIntent(challenge.signedData);
}
