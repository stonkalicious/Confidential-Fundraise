import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = source('../src/App.tsx');
const navigation = source('../src/lib/raise-navigation.ts');
const header = source('../src/components/site-header.tsx');
const legal = source('../src/components/legal-disclaimer-page.tsx');
const list = source('../src/components/raise-list.tsx');

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
    'Wallet and transfer risks. Optional demo transfers are separate from recorded commitments. Testnet tokens have no real monetary value; mainnet transfers use real assets, incur fees, and may be irreversible. Review the network, recipient, and amount before approving any wallet action.',
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

test('approved journey notices explain demo limits before acting', () => {
  assert.ok(app.includes('Hackathon demo. Listings are not independently verified. Recording interest is non-binding and does not transfer money. A page claim does not verify a founder or company.'));
  assert.match(app, /data-testid="text-investor-demo-notice">\{DEMO_ACTION_NOTICE\}/);
  assert.match(app, /data-testid="text-progress-demo-notice">\{DEMO_ACTION_NOTICE\}/);
  assert.equal(app.match(/Record non-binding interest/g)?.length, 2);
  for (const copy of [
    'Your name or alias and amount are not shown publicly.',
    'Interest recorded. This is not an investment, and no money has moved. This demo does not send an introduction or follow-up message.',
    'Claiming reserves this page. It does not verify your identity or unlock private commitment records.',
    'Private review is controlled by the demo operator. Claiming a raise does not grant access. The shared code is not a founder-specific account.',
    'Any testnet transfer is separate from recorded interest.',
    'Demo form only. Submitting this form does not send a message.',
  ]) assert.ok(app.includes(copy), copy);
  assert.match(app, /text-near-funding-separation[\s\S]*?<\/p>/);
  assert.doesNotMatch(app, /NearDemoPanel|requestDemoQuote|Authenticate with NEAR wallet/);
  assert.match(app, /onSubmit=\{submitRaiseClaim\}[\s\S]*?text-claim-access-notice[\s\S]*?htmlFor="raise-claim-founder-name"/);
  assert.match(app, /onSubmit=\{submitContactRequest\}[\s\S]*?text-contact-demo-notice[\s\S]*?htmlFor="contact-name"/);
});

test('operator wording and manual review receipt preserve existing forms and references', () => {
  assert.ok(app.includes('>Demo operator code</label>'));
  assert.ok(list.includes('>Demo operator code</label>'));
  assert.ok(app.includes("'Unlock demo review'"));
  assert.ok(list.includes('Submitted for manual review. Reference: ${receipt.id}. Your raise is not public yet. No notification is sent; keep this reference.'));
  assert.doesNotMatch(app + list, /Founder approval code|Unlock founder view|Soft commitment submitted\./);
  assert.ok(app.includes('onSubmit={unlockSponsor}'));
  assert.ok(list.includes('onSubmit={loadPendingRaises}'));
  assert.ok(app.includes('await onSubmitSoftCommitment(identifier.trim(), parsedAmount)'));
});
