import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { SubmitRaiseBody } from '@workspace/api-zod';
import { validateRaiseSubmission } from '@workspace/api-zod/raise-submission';
import app from '../src/app.ts';
import { getRaises, getPendingRaises } from '../src/lib/raise-store.ts';

const screenshot = {
  name: 'test', thesis: 'test', stage: 'angel', range: { min: 1000000, max: 5000000 },
};
const valid = { ...screenshot, thesis: '1234567890' };
const sourceLink = 'https://example.org/company';

test('submission route validates fields and queues valid raises only in isolated memory', async (t) => {
  // Deliberately do not initializeRaiseStore: this process never writes to the database.
  // Replace configuration without reading or using the real founder approval code.
  t.mock.property(process, 'env', { RAISE_APPROVAL_CODE: 'isolated-submission-approval' });
  const server = createServer(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/raises`;
  async function post(body, status) {
    const response = await fetch(base, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return data;
  }
  const publicBefore = await getRaises();
  const pendingBefore = await getPendingRaises();
  async function invalid(body, fields) {
    const result = await post(body, 400);
    assert.deepEqual(Object.keys(result.fieldErrors), fields);
    assert.equal(result.error, Object.values(result.fieldErrors).join(' '));
    assert.ok(result.error.length <= 800);
    for (const message of Object.values(result.fieldErrors)) {
      assert.equal(typeof message, 'string');
      assert.ok(message.length > 0 && message.length <= 160);
    }
    assert.deepEqual(await getPendingRaises(), pendingBefore);
    return result;
  }
  const reproduced = await invalid(screenshot, ['thesis']);
  assert.equal(reproduced.error, 'Short thesis must be at least 10 characters.');
  await invalid({ ...valid, thesis: '123456789' }, ['thesis']);
  await invalid({ ...valid, thesis: ' 123456789 ' }, ['thesis']);
  for (const [field, min, max] of [['name', 2, 120], ['thesis', 10, 280], ['stage', 1, 60]]) {
    for (const value of [undefined, null, 42, {}, [], '', ' \t\n ', 'x'.repeat(min - 1), 'x'.repeat(max + 1)]) {
      await invalid({ ...valid, [field]: value }, [field]);
    }
    for (const length of [min, max]) {
      const input = { ...valid, [field]: ` ${'x'.repeat(length)} ` };
      const normalized = validateRaiseSubmission(input);
      assert.deepEqual(normalized.errors, {});
      assert.equal(SubmitRaiseBody.safeParse(normalized.input).success, true);
    }
  }
  for (const field of ['min', 'max']) {
    for (const value of [undefined, null, '1000000', true, {}, [], 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await invalid({ ...valid, range: { ...valid.range, [field]: value } },
        [field === 'min' ? 'rangeMin' : 'rangeMax']);
    }
  }
  await invalid({ ...valid, range: { min: 2, max: 1 } }, ['rangeMax']);
  for (const range of [undefined, null, [], '100-200']) {
    await invalid({ ...valid, range }, ['rangeMin', 'rangeMax']);
  }
  for (const body of [[], {}]) {
    await invalid(body, ['name', 'thesis', 'stage', 'rangeMin', 'rangeMax']);
  }
  for (const value of [null, 42, [], {}, 'ftp://example.org', 'javascript:alert(1)', 'example.org', 'x'.repeat(2049)]) {
    await invalid({ ...valid, sourceLink: value }, ['sourceLink']);
  }
  // JSON primitives are rejected by the existing body parser before routing.
  for (const body of [null, 'bad']) {
    assert.deepEqual(Object.keys(validateRaiseSubmission(body).errors),
      ['name', 'thesis', 'stage', 'rangeMin', 'rangeMax']);
  }
  // Exercise the real route/store without any persisted records or live approval code.
  const submitted = [];
  for (const input of [
    { ...valid, sourceLink },
    { name: ' xy ', thesis: ' 1234567890 ', stage: ' a ', range: { min: 1, max: 1 } },
    { name: 'n'.repeat(120), thesis: 't'.repeat(280), stage: 's'.repeat(60),
      range: { min: Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } },
  ]) {
    const receipt = await post(input, 201);
    submitted.push(receipt);
    assert.deepEqual(receipt, { id: receipt.id, status: 'pending' });
    const pending = (await getPendingRaises()).find((raise) => raise.id === receipt.id);
    assert.deepEqual(pending, { id: receipt.id, status: 'pending',
      name: input.name.trim(), thesis: input.thesis.trim(), stage: input.stage.trim(), range: input.range,
      ...(input.sourceLink ? { sourceLink: input.sourceLink } : {}) });
    assert.deepEqual(await getRaises(), publicBefore);
    assert.equal((await fetch(`${base}/${receipt.id}`)).status, 404);
    assert.equal((await fetch(`${base}/pending`)).status, 401);
    const response = await fetch(`${base}/pending`, {
      headers: { authorization: 'Bearer isolated-submission-approval' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await response.json()).find((raise) => raise.id === receipt.id), pending);
  }
  const sourceRaiseId = submitted[0].id;
  const approved = await fetch(`${base}/${sourceRaiseId}/approve`, {
    method: 'POST',
    headers: { authorization: 'Bearer isolated-submission-approval' },
  });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).sourceLink, sourceLink);
  const publicRaise = await fetch(`${base}/${sourceRaiseId}`);
  assert.equal(publicRaise.status, 200);
  assert.equal((await publicRaise.json()).sourceLink, sourceLink);
  const markdown = await fetch(`${base}/${sourceRaiseId}/markdown`);
  assert.equal(markdown.status, 200);
  assert.match(await markdown.text(), new RegExp(`Public source: ${sourceLink.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`));
});
