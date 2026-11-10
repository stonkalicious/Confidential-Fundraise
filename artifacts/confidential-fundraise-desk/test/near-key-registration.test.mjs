import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  NearIntentsKeyRegistrationRequiredError,
  registerNearIntentsKeyAndAuthenticateWith,
} from '../src/lib/near-intents-key-registration.ts';

const signedData = {
  standard: 'nep413',
  payload: { recipient: 'intents.near', nonce: 'nonce', message: 'message' },
  public_key: 'ed25519:connected-wallet-key',
  signature: 'ed25519:signature',
};

function createChallenge() {
  return new NearIntentsKeyRegistrationRequiredError(
    'sponsor.near',
    'ed25519:connected-wallet-key',
    signedData,
  );
}

function createDependencies(overrides = {}) {
  const calls = { addPublicKey: [], authenticate: [], keyChecks: [] };
  let registrationOutcome = { status: { SuccessValue: '' } };
  let registered = false;
  const wallet = {
    signAndSendTransaction: async (transaction) => {
      calls.addPublicKey.push(transaction);
      registered = true;
      return registrationOutcome;
    },
  };
  const dependencies = {
    getConnectedWallet: async () => ({
      wallet,
      accounts: [{ accountId: 'sponsor.near', publicKey: 'connected-wallet-key' }],
    }),
    hasRegisteredKey: async (accountId, publicKey) => {
      calls.keyChecks.push({ accountId, publicKey });
      return registered;
    },
    authenticateSignedIntent: async (data) => {
      calls.authenticate.push(data);
      return { accountId: 'sponsor.near', accessToken: 'session', expiresAt: 1 };
    },
  };
  Object.assign(dependencies, overrides);
  return {
    calls,
    dependencies,
    failRegistration(outcome) {
      registrationOutcome = outcome;
    },
  };
}

test('approval registers the signed connected key with 100 Tgas and one yoctoNEAR', async () => {
  const { calls, dependencies } = createDependencies();
  const session = await registerNearIntentsKeyAndAuthenticateWith(
    createChallenge(),
    dependencies,
  );

  assert.deepEqual(calls.addPublicKey, [
    {
      network: 'mainnet',
      signerId: 'sponsor.near',
      receiverId: 'intents.near',
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'add_public_key',
            args: { public_key: 'ed25519:connected-wallet-key' },
            gas: '100000000000000',
            deposit: '1',
          },
        },
      ],
    },
  ]);
  assert.deepEqual(calls.authenticate, [signedData]);
  assert.equal(session.accountId, 'sponsor.near');
});

test('a failed transaction does not authenticate a wallet session', async () => {
  const { calls, dependencies, failRegistration } = createDependencies();
  failRegistration({ status: { Failure: { error_message: 'rejected' } } });

  await assert.rejects(
    registerNearIntentsKeyAndAuthenticateWith(createChallenge(), dependencies),
    /did not complete successfully/,
  );

  assert.equal(calls.addPublicKey.length, 1);
  assert.equal(calls.authenticate.length, 0);
});

test('a wallet-rejected transaction does not authenticate a wallet session', async () => {
  const rejection = new Error('User rejected the transaction');
  const { calls, dependencies } = createDependencies({
    getConnectedWallet: async () => ({
      wallet: {
        signAndSendTransaction: async () => {
          calls.addPublicKey.push('prompted');
          throw rejection;
        },
      },
      accounts: [{ accountId: 'sponsor.near', publicKey: 'connected-wallet-key' }],
    }),
  });

  await assert.rejects(
    registerNearIntentsKeyAndAuthenticateWith(createChallenge(), dependencies),
    (error) => error === rejection,
  );

  assert.deepEqual(calls.addPublicKey, ['prompted']);
  assert.equal(calls.authenticate.length, 0);
});

test('declining the registration prompt neither registers a key nor creates a session', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const declineStart = source.indexOf('data-testid="button-decline-near-key-registration"');
  const declineEnd = source.indexOf('</button>', declineStart);
  const declineButton = source.slice(declineStart, declineEnd);

  assert.notEqual(declineStart, -1, 'the registration prompt must offer a decline action');
  assert.match(declineButton, /onClick=\{\(\) => setNearKeyRegistration\(null\)\}/);
  assert.doesNotMatch(
    declineButton,
    /registerNearWalletKey|registerNearIntentsKeyAndAuthenticate|authenticateNearWallet|setNearSession/,
  );
});

test('quote requests remain hidden until registration succeeds and yields a session', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const registrationHandler = source.slice(
    source.indexOf('async function registerNearWalletKey()'),
    source.indexOf('async function clearNearWalletSession()'),
  );

  assert.match(registrationHandler, /const session = await registerNearIntentsKeyAndAuthenticate/);
  assert.match(registrationHandler, /setNearSession\(session\)/);
  assert.ok(
    registrationHandler.indexOf('const session = await registerNearIntentsKeyAndAuthenticate') <
      registrationHandler.indexOf('setNearSession(session)'),
    'a wallet session must only be stored after registration resolves',
  );
  assert.match(source, /\(quoteState\.status === 'ready' \|\| quoteState\.status === 'error'\)[\s\S]*?nearSession/);
});
