import test from 'node:test';
import assert from 'node:assert/strict';
import { getSafeSourceLink } from '../src/data/raises.ts';

test('source links only allow absolute HTTP and HTTPS URLs', () => {
  assert.equal(getSafeSourceLink('https://example.com/raise'), 'https://example.com/raise');
  assert.equal(getSafeSourceLink('http://example.com/raise'), 'http://example.com/raise');
  assert.equal(getSafeSourceLink('javascript:alert(1)'), undefined);
  assert.equal(getSafeSourceLink('/relative/path'), undefined);
  assert.equal(getSafeSourceLink('not a URL'), undefined);
  assert.equal(getSafeSourceLink(undefined), undefined);
});
