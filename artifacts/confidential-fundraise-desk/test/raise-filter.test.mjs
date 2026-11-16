import test from 'node:test';
import assert from 'node:assert/strict';

const { parseInvestorTicketRange, raiseMatchesInvestorTicketRange } =
  await import('../src/lib/raise-filter.ts');

test('investor ticket range accepts either bound or both bounds', () => {
  assert.deepEqual(parseInvestorTicketRange('', ''), { range: {} });
  assert.deepEqual(parseInvestorTicketRange('25000', ''), { range: { min: 25000 } });
  assert.deepEqual(parseInvestorTicketRange('', '100000'), { range: { max: 100000 } });
  assert.deepEqual(parseInvestorTicketRange('25000', '100000'), {
    range: { min: 25000, max: 100000 },
  });
});

test('investor ticket range rejects invalid and reversed bounds', () => {
  for (const value of ['0', '-1', '1.5', '9007199254740992']) {
    assert.match(parseInvestorTicketRange(value, '').error, /positive whole-dollar/);
  }
  assert.match(parseInvestorTicketRange('100000', '25000').error, /must not exceed/);
});

test('a raise matches when its stated round range overlaps the investor range', () => {
  const raise = { min: 50000, max: 150000 };

  assert.equal(raiseMatchesInvestorTicketRange(raise, {}), true);
  assert.equal(raiseMatchesInvestorTicketRange(raise, { min: 150000 }), true);
  assert.equal(raiseMatchesInvestorTicketRange(raise, { max: 50000 }), true);
  assert.equal(raiseMatchesInvestorTicketRange(raise, { min: 150001 }), false);
  assert.equal(raiseMatchesInvestorTicketRange(raise, { max: 49999 }), false);
  assert.equal(raiseMatchesInvestorTicketRange(raise, { min: 75000, max: 100000 }), true);
});
