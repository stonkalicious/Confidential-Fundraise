import assert from 'node:assert/strict';
import test from 'node:test';
import { createNearSessionRefresher } from '../src/lib/near-session-refresh.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const refreshedSession = {
  accountId: 'wallet.near',
  accessToken: 'renewed-access-token',
  expiresIn: 300,
};

test('overlapping restore and quote refreshes share one request and the renewed token', async () => {
  const provider = deferred();
  let providerCalls = 0;
  const refresh = createNearSessionRefresher(() => {
    providerCalls += 1;
    return provider.promise;
  });
  const restore = refresh();
  const quoteTokens = [];
  const requestQuote = async () => {
    const session = await refresh();
    quoteTokens.push(session.accessToken);
    return session;
  };
  const firstQuote = requestQuote();
  // A caller arriving on a later microtask must still join the same request.
  await Promise.resolve();
  const secondQuote = requestQuote();
  assert.equal(providerCalls, 1);
  assert.strictEqual(refresh(), restore);

  const beforeRefresh = Date.now();
  provider.resolve(refreshedSession);
  const sessions = await Promise.all([restore, firstQuote, secondQuote]);
  assert.deepEqual(quoteTokens, ['renewed-access-token', 'renewed-access-token']);
  for (const session of sessions) {
    assert.strictEqual(session, sessions[0]);
    assert.equal(session.accountId, refreshedSession.accountId);
    assert.ok(session.expiresAt >= beforeRefresh + 300_000);
    assert.ok(session.expiresAt <= Date.now() + 300_000);
  }
  assert.equal(providerCalls, 1);
});

test('a completed refresh is not cached for subsequent refreshes', async () => {
  let providerCalls = 0;
  const refresh = createNearSessionRefresher(async () => ({
    ...refreshedSession,
    accessToken: `token-${++providerCalls}`,
  }));
  assert.equal((await refresh()).accessToken, 'token-1');
  assert.equal((await refresh()).accessToken, 'token-2');
  assert.equal(providerCalls, 2);
});

test('all waiting callers see the failure and a fresh overlapping retry succeeds', async () => {
  const failure = new Error('Provider temporarily unavailable');
  const firstProvider = deferred();
  const retryProvider = deferred();
  let providerCalls = 0;
  const refresh = createNearSessionRefresher(() => {
    providerCalls += 1;
    return providerCalls === 1 ? firstProvider.promise : retryProvider.promise;
  });
  const first = refresh();
  const second = refresh();
  const outcomes = Promise.allSettled([first, second]);
  firstProvider.reject(failure);
  assert.deepEqual(await outcomes, [
    { status: 'rejected', reason: failure },
    { status: 'rejected', reason: failure },
  ]);
  assert.equal(providerCalls, 1);

  const retry = refresh();
  const waitingRetry = refresh();
  assert.notStrictEqual(retry, first);
  assert.strictEqual(retry, waitingRetry);
  assert.equal(providerCalls, 2);
  retryProvider.resolve(refreshedSession);
  const sessions = await Promise.all([retry, waitingRetry]);
  assert.equal(sessions[0].accessToken, refreshedSession.accessToken);
  assert.strictEqual(sessions[0], sessions[1]);
});

test('a synchronous provider error also clears the operation for retry', async () => {
  let providerCalls = 0;
  const refresh = createNearSessionRefresher(() => {
    if (++providerCalls === 1) throw new Error('Network unavailable');
    return Promise.resolve(refreshedSession);
  });
  await assert.rejects(refresh(), /Network unavailable/);
  assert.equal((await refresh()).accessToken, refreshedSession.accessToken);
  assert.equal(providerCalls, 2);
});
