import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component = await readFile(new URL('../src/components/raise-list.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

test('desktop keeps raise submission beside the raise list, directly under the walkthrough', () => {
  const list = component.indexOf('<section className="raise-list-column">');
  const rightColumn = component.indexOf('<div className="raise-right-column">');
  const walkthrough = component.indexOf('<section className="raise-submit-card raise-how-card"');
  const submission = component.indexOf('<aside className="raise-submission-column">');

  assert.ok(list >= 0 && rightColumn > list && walkthrough > rightColumn && submission > walkthrough);
  assert.match(styles, /\.raise-home-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.raise-right-column\s*\{\s*display:\s*grid;[^}]*\}/);
});

test('mobile keeps the walkthrough first, then raises, then the submission form', () => {
  assert.match(
    styles,
    /@media \(max-width: 760px\) \{[\s\S]*?\.raise-right-column \{ display: contents; \}[\s\S]*?\.raise-how-card \{ order: 1; \}[\s\S]*?\.raise-list-column \{ order: 2; \}[\s\S]*?\.raise-submission-column \{ order: 3; \}/,
  );
});
