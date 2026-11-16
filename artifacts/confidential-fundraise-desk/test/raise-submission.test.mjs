import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRaiseForm } from '../src/lib/raise-submission.ts';
import { submissionErrorsFromResponse } from '@workspace/api-zod/raise-submission';

const example = {
  name: 'test', thesis: 'test', stage: 'angel', rangeMin: '1000000', rangeMax: '5000000', sourceLink: '',
};
const valid = { ...example, thesis: '1234567890' };

test('screenshot payload identifies only the short thesis', () => {
  assert.deepEqual(validateRaiseForm(example).errors, {
    thesis: 'Short thesis must be at least 10 characters.',
  });
});

test('text is trimmed before all minimum and maximum checks', () => {
  for (const [field, min, max] of [['name', 2, 120], ['thesis', 10, 280], ['stage', 1, 60]]) {
    for (const length of [min, max]) {
      const result = validateRaiseForm({ ...valid, [field]: ` \t${'x'.repeat(length)}\n ` });
      assert.deepEqual(result.errors, {});
      assert.equal(result.input[field], 'x'.repeat(length));
    }
    for (const value of ['', ' \t\n ', 'x'.repeat(min - 1), 'x'.repeat(max + 1)]) {
      assert.deepEqual(Object.keys(validateRaiseForm({ ...valid, [field]: value }).errors), [field]);
    }
  }
  assert.equal(validateRaiseForm({ ...valid, thesis: ' 123456789 ' }).errors.thesis,
    'Short thesis must be at least 10 characters.');
});

test('optional source URL is trimmed, included when valid, and rejects non-web URLs', () => {
  const validSource = validateRaiseForm({ ...valid, sourceLink: ' https://example.org/raise ' });
  assert.deepEqual(validSource.errors, {});
  assert.equal(validSource.input.sourceLink, 'https://example.org/raise');
  assert.equal(Object.hasOwn(validateRaiseForm(valid).input, 'sourceLink'), false);

  for (const sourceLink of ['ftp://example.org', 'javascript:alert(1)', 'example.org', 'x'.repeat(2049)]) {
    assert.ok(validateRaiseForm({ ...valid, sourceLink }).errors.sourceLink);
  }
});

test('range fields reject malformed, nonpositive, fractional, unsafe, and reversed bounds', () => {
  for (const field of ['rangeMin', 'rangeMax']) {
    for (const value of ['', ' ', 'bad', '0x10', '1,000', '$100', '0', '-1', '1.5', '9007199254740992', '1e309']) {
      assert.deepEqual(Object.keys(validateRaiseForm({ ...valid, [field]: value }).errors), [field]);
    }
  }
  assert.deepEqual(Object.keys(validateRaiseForm({ ...valid, rangeMax: '999999' }).errors), ['rangeMax']);
  for (const value of ['1', String(Number.MAX_SAFE_INTEGER), '1e6']) {
    assert.deepEqual(validateRaiseForm({ ...valid, rangeMin: value, rangeMax: value }).errors, {});
  }
});

test('server field errors accept only known bounded messages and preserve generic fallback', () => {
  assert.deepEqual(submissionErrorsFromResponse({ fieldErrors: {
    thesis: 'Short thesis must be at least 10 characters.',
    arbitrary: 'not a field', name: ['raw validator'], stage: 'x'.repeat(161),
    rangeMin: '', rangeMax: null,
  } }), { thesis: 'Short thesis must be at least 10 characters.' });
  for (const value of [null, [], { error: 'Submission limit reached. Try again later.' }]) {
    assert.deepEqual(submissionErrorsFromResponse(value), {});
  }
});
