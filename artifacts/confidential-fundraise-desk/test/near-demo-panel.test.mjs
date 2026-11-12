import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveNearDemoPanelState } from '../src/lib/near-demo-panel.ts';

const base = { unlocked: true, session: null, sessionUnavailable: false, authLoading: false, authError: false,
  keyRegistrationPending: false, quoteStatus: null, hasQuotedHardCommitment: false, confidentialityRequested: null, now: 1000 };

test('locked founder view exposes no live wallet state', () => {
  const s = deriveNearDemoPanelState({ ...base, unlocked: false, session: { expiresAt: 5000 }, quoteStatus: 'success', hasQuotedHardCommitment: true, confidentialityRequested: 'basic' });
  assert.match(s.wallet, /Locked/);
  assert.match(s.quote, /Locked/);
  assert.equal(s.confidentiality, 'Not requested');
});

test('expired session is never shown as authenticated', () => {
  assert.equal(deriveNearDemoPanelState({ ...base, session: { expiresAt: 999 } }).wallet, 'Session expired');
  assert.equal(deriveNearDemoPanelState({ ...base, session: { expiresAt: 2000 } }).wallet, 'Authenticated');
});

test('success requires a current hard quoted commitment', () => {
  const s = deriveNearDemoPanelState({ ...base, quoteStatus: 'success', confidentialityRequested: 'basic' });
  assert.equal(s.quote, 'No hard commitment selected');
  assert.equal(s.confidentiality, 'Not requested');
  const ok = deriveNearDemoPanelState({ ...base, quoteStatus: 'success', hasQuotedHardCommitment: true, confidentialityRequested: 'basic' });
  assert.equal(ok.quote, 'Dry-run quote received');
  assert.equal(ok.confidentiality, 'basic');
});

test('loading and error states are honest', () => {
  assert.equal(deriveNearDemoPanelState({ ...base, quoteStatus: 'loading', hasQuotedHardCommitment: true }).confidentiality, 'Pending');
  const e = deriveNearDemoPanelState({ ...base, quoteStatus: 'error', hasQuotedHardCommitment: true });
  assert.equal(e.quote, 'Failed');
  assert.equal(e.confidentiality, 'Not requested');
});
