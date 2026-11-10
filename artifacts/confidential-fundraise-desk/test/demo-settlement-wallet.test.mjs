import assert from 'node:assert/strict';
import test from 'node:test';
import { isDefinitePreBroadcastRejection } from '../src/lib/demo-settlement-wallet.ts';

test('only an explicit wallet rejection is eligible for recovery', () => {
  assert.equal(isDefinitePreBroadcastRejection('User rejected'), true);
  assert.equal(isDefinitePreBroadcastRejection({ message: 'User rejected' }), true);
  assert.equal(isDefinitePreBroadcastRejection({ code: 'USER_REJECTED' }), true);
  assert.equal(isDefinitePreBroadcastRejection({ name: 'UserRejectedError' }), true);
});

test('uncertain wallet and network errors never qualify for a retry request', () => {
  assert.equal(isDefinitePreBroadcastRejection(new Error('Network timeout')), false);
  assert.equal(isDefinitePreBroadcastRejection({ message: 'User rejected after transaction submission' }), false);
  assert.equal(isDefinitePreBroadcastRejection({ code: 'RPC_ERROR', message: 'Rejected by node' }), false);
  assert.equal(isDefinitePreBroadcastRejection(null), false);
});
