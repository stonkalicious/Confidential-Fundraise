import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkNearKeyRegistrationStatus,
  NearKeyStatusUnavailableError,
  parseNearViewResponse,
} from '../src/lib/near-key-status.ts';
import {
  NearIntentsKeyRegistrationRequiredError,
  registerNearIntentsKeyAndAuthenticateWith,
} from '../src/lib/near-intents-key-registration.ts';

test('only literal boolean NEAR key statuses are accepted', async (context) => {
  await context.test('false is a confirmed unregistered key', async () => {
    const result = await checkNearKeyRegistrationStatus(
      'sponsor.near',
      'wallet-key',
      async (methodName, args) => {
        assert.equal(methodName, 'has_public_key');
        assert.deepEqual(args, {
          account_id: 'sponsor.near',
          public_key: 'ed25519:wallet-key',
        });
        return false;
      },
    );

    assert.equal(result, false);
  });

  await context.test('true is a confirmed registered key', async () => {
    assert.equal(
      await checkNearKeyRegistrationStatus('sponsor.near', 'ed25519:key', async () => true),
      true,
    );
  });

  for (const value of ['true', 0, 1, null, {}, []]) {
    await context.test(`rejects ambiguous RPC result ${JSON.stringify(value)}`, async () => {
      await assert.rejects(
        checkNearKeyRegistrationStatus('sponsor.near', 'wallet-key', async () => value),
        NearKeyStatusUnavailableError,
      );
    });
  }
});

test('NEAR RPC failures become a retryable status error', async () => {
  const timeout = new Error('The operation timed out');

  await assert.rejects(
    checkNearKeyRegistrationStatus('sponsor.near', 'wallet-key', async () => {
      throw timeout;
    }),
    (error) => {
      assert.ok(error instanceof NearKeyStatusUnavailableError);
      assert.match(error.message, /retry authentication/i);
      assert.equal(error.cause, timeout);
      return true;
    },
  );
});

test('unreadable NEAR RPC response bodies never become an unregistered status', async () => {
  const malformedResponses = [
    { error: { code: -32000, message: 'view call failed' } },
    { result: { result: 'false' } },
    { result: { result: [256] } },
    { result: { result: [110, 111, 116, 45, 106, 115, 111, 110] } },
  ];

  for (const body of malformedResponses) {
    await assert.rejects(
      checkNearKeyRegistrationStatus('sponsor.near', 'wallet-key', async () =>
        parseNearViewResponse(body, 'has_public_key'),
      ),
      NearKeyStatusUnavailableError,
    );
  }
});

test('an unconfirmed status never prompts for add_public_key or creates a session', async () => {
  const calls = { registration: 0, authentication: 0 };
  const challenge = new NearIntentsKeyRegistrationRequiredError(
    'sponsor.near',
    'ed25519:wallet-key',
    {
      standard: 'nep413',
      payload: { recipient: 'intents.near', nonce: 'nonce', message: 'message' },
      public_key: 'ed25519:wallet-key',
      signature: 'ed25519:signature',
    },
  );
  const dependencies = {
    getConnectedWallet: async () => ({
      wallet: {
        signAndSendTransaction: async () => {
          calls.registration += 1;
          return { status: { SuccessValue: '' } };
        },
      },
      accounts: [{ accountId: 'sponsor.near' }],
    }),
    hasRegisteredKey: (accountId, publicKey) =>
      checkNearKeyRegistrationStatus(accountId, publicKey, async () => {
        throw new Error('RPC unavailable');
      }),
    authenticateSignedIntent: async () => {
      calls.authentication += 1;
      return { accountId: 'sponsor.near', accessToken: 'session', expiresAt: 1 };
    },
  };

  await assert.rejects(
    registerNearIntentsKeyAndAuthenticateWith(challenge, dependencies),
    NearKeyStatusUnavailableError,
  );
  assert.deepEqual(calls, { registration: 0, authentication: 0 });
});
