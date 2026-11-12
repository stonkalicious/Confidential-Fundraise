import assert from 'node:assert/strict';
import test from 'node:test';
import { getInitialRaiseView, getRaiseViews } from '../src/lib/raise-navigation.ts';

test('mobile opens How this app works and puts it first in DOM order', () => {
  assert.equal(getInitialRaiseView('', true), 'how');
  assert.deepEqual(getRaiseViews(true).slice(0, 2).map(({ id, index }) => [id, index]), [
    ['how', '01'], ['progress', '02'],
  ]);
});

test('desktop retains Progress as its first tab and default view', () => {
  assert.equal(getInitialRaiseView('', false), 'progress');
  assert.deepEqual(getRaiseViews(false).slice(0, 2).map(({ id, index }) => [id, index]), [
    ['progress', '01'], ['how', '02'],
  ]);
});

test('explicit tab links override either viewport default and invalid views fall back', () => {
  for (const isMobile of [true, false]) {
    for (const view of ['progress', 'how', 'prospect', 'sponsor', 'thesis', 'rules']) {
      assert.equal(getInitialRaiseView(`?view=${view}`, isMobile), view);
    }
    assert.equal(getInitialRaiseView('?view=missing', isMobile), isMobile ? 'how' : 'progress');
  }
});
