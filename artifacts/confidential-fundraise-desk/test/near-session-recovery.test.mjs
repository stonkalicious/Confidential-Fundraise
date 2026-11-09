import assert from 'node:assert/strict';
import test from 'node:test';
import { isTemporaryNearSessionRefreshFailure } from '../src/lib/near-session-recovery.ts';

test('expired or missing refresh credentials are not classified as temporary', () => {
  assert.equal(isTemporaryNearSessionRefreshFailure({ status: 401 }), false);
});

test('provider, rate-limit, and network errors keep the saved session retryable', () => {
  assert.equal(isTemporaryNearSessionRefreshFailure({ status: 502 }), true);
  assert.equal(isTemporaryNearSessionRefreshFailure({ status: 429 }), true);
  assert.equal(isTemporaryNearSessionRefreshFailure(new TypeError('Network unavailable')), true);
});
