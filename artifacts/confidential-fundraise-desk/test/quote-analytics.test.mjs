import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createQuoteOutcomeReporter,
  getQuoteFailureOutcome,
  trackQuoteOutcome,
} from '../src/lib/analytics.ts';

test('quote analytics emits only approved outcomes and no private quote data', (t) => {
  const events = [];
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      umami: {
        track: (name, data) => events.push({ name, data }),
      },
    },
  });

  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });

  const privateDetails = {
    raiseId: 'raise-id-private-41',
    commitmentId: 'commitment-id-private-82',
    name: 'Private Raise Name',
    identifier: 'investor@example.invalid',
    amount: 987654321,
    providerResponse: 'provider diagnostic private text',
  };

  trackQuoteOutcome('success');
  trackQuoteOutcome(
    getQuoteFailureOutcome({
      data: {
        error: `The provider rejected the NEAR wallet session. ${privateDetails.providerResponse}`,
        ...privateDetails,
      },
    }),
  );
  trackQuoteOutcome(
    getQuoteFailureOutcome({
      data: {
        error: privateDetails.providerResponse,
        ...privateDetails,
      },
    }),
  );

  assert.deepEqual(events, [
    { name: 'quote_outcome', data: { outcome: 'success' } },
    { name: 'quote_outcome', data: { outcome: 'auth_required' } },
    { name: 'quote_outcome', data: { outcome: 'provider_error' } },
  ]);

  const serializedEvents = JSON.stringify(events);
  for (const privateValue of Object.values(privateDetails)) {
    assert.ok(
      !serializedEvents.includes(String(privateValue)),
      `analytics unexpectedly included private value: ${String(privateValue)}`,
    );
  }
});

test('a quote attempt reports once and a retry reports its own outcome', (t) => {
  const events = [];
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      umami: {
        track: (name, data) => events.push({ name, data }),
      },
    },
  });

  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });

  const reportFirstAttempt = createQuoteOutcomeReporter();
  reportFirstAttempt('provider_error');
  reportFirstAttempt('provider_error');

  const reportRetry = createQuoteOutcomeReporter();
  reportRetry('success');
  reportRetry('success');

  assert.deepEqual(events, [
    { name: 'quote_outcome', data: { outcome: 'provider_error' } },
    { name: 'quote_outcome', data: { outcome: 'success' } },
  ]);
});
