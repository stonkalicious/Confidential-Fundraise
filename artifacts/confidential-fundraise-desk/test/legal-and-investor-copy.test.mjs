import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = source('../src/App.tsx');
const navigation = source('../src/lib/raise-navigation.ts');
const header = source('../src/components/site-header.tsx');
const legal = source('../src/components/legal-disclaimer-page.tsx');

test('legal route and shared menu preserve existing navigation and close on selection', () => {
  assert.match(app, /<Route path="\/legal-disclaimer"><LegalDisclaimerPage \/><\/Route>/);
  assert.match(header, /href="\/legal-disclaimer"[\s\S]*?onClick=\{\(\) => setMenuOpen\(false\)\}[\s\S]*?Legal disclaimer/);
  for (const path of ['/why-near', '/roadmap']) assert.ok(header.includes(`href="${path}"`));
  assert.ok(legal.includes('<SiteHeader />'));
  assert.ok(legal.includes('href="/"'));
});

test('legal page retains the exact approved disclosures without superseded duplicates', () => {
  const text = legal.replace(/<[^>]+>/g, '');
  for (const copy of [
    'Hackathon prototype. Agent Raised is a hackathon submission, not a live fundraising business or investment platform.',
    'Data and claim status. Raise listings may include synthetic examples, public-source material, and user submissions; information is not independently verified. The app accepts soft commitments before a raise is claimed. These are non-binding records, not an offer, investment agreement, confirmed investment, or funds transfer. “Claimed” records someone’s claim to the page; it does not verify a founder’s identity or a company. Do not submit sensitive personal or confidential business information.',
    'No professional advice. Content is for informational and demonstration purposes only and is not investment, financial, legal, or tax advice. Seek independent professional advice before making investment decisions.',
    'Wallet and transfer risks. Quotes do not execute transfers. Optional demo transfers are separate from recorded commitments. Testnet tokens have no real monetary value; mainnet transfers use real assets, incur fees, and may be irreversible. Review the network, recipient, and amount before approving any wallet action.',
  ]) assert.ok(text.includes(copy), copy);
  assert.doesNotMatch(text, /No investment agreement\.|Data caution\.|Demo only\. Confidential Fundraising/);
});

test('approved investor copy preserves internal fields, submission behavior, and mobile wrapping', () => {
  for (const copy of [
    "label: 'Potential investor'",
    '>Your name or alias</label>',
    'placeholder="Your name or alias"',
    "setFormError('Enter your name or alias.')",
    'A potential investor submits a soft commitment.',
    'No soft commitments have been submitted.',
    'Do not enter sensitive personal or confidential business information.',
    'Individual investor names or aliases, amounts, and claim contact details are not included in public responses.',
  ]) assert.ok((app + navigation).includes(copy), copy);
  assert.doesNotMatch(app, /label: 'Prospect'|>Identifier<\/label>|A prospect submits|No prospect commitment/);
  assert.ok(app.includes('name="identifier"'));
  assert.ok(app.includes('await onSubmitSoftCommitment(identifier.trim(), parsedAmount)'));
  assert.ok(app.includes("setView('progress')"));
  const css = source('../src/index.css');
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /white-space: normal/);
});
