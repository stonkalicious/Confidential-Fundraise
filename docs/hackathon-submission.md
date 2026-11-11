# NEAR Hackathon Submission Pack

Prepared 9 November 2026. **Drafts for owner review, not a submitted entry.**
No publication, push, repository visibility change, token transfer, or
hackathon submission was performed by this preparation task.

## Requirements checked

Re-read the [live HACKATHON.md](https://nearhackathon.com/HACKATHON.md) before
submitting; these notes reflect its 9 November version.

- Deadline: **14 November 2026, 23:59 UTC** (23:59 Dublin).
- Work since the 19 October announcement is eligible; earlier work is baseline.
- The repository must be public by the deadline and remain public through
  judging. Include a license and instructions judges can reproduce.
- The human publishes a public X demo post with video or screenshots,
  **@NEARProtocol**, **#NEARHackathon**, and a statement that it was built for
  NEAR HACKATHON. If the demo is local-only, the guide requires video rather
  than screenshots alone.
- One entry per project. Final details require owner confirmation before
  submitting. Corrections after submission use
  [request changes](https://nearhackathon.com/request-changes), not a duplicate
  entry.
- Hosted demo availability is a plus, not mandatory. The guide recommends
  keeping it available through 18 November, ideally 25 November.

## Recommended positioning

**Primary recommendation: Privacy & Private AI (`privacy`).**
The fit is private-finance coordination with founder-protected records and a
confidential NEAR Intents quote path. There is no private-AI inference or TEE
implementation in this app; do not imply one.

**Optional secondary: Open Innovation (`open`).** The human should confirm the
final track selection. An HTTP API that external agents can call is not by
itself a demonstrated autonomous business or earning/spending AI agent.

Keep these distinctions in the recording and description:

1. Commitment privacy is enforced by application access control. Operators can
   read the database; this is not trustless or end-to-end encrypted storage.
2. A confidential Intents request is a fixed-value **dry-run quote**, not
   completed settlement.
3. Optional testnet USDC uses a separate **public** NEAR transfer. It is not an
   Intents swap and does not fund the displayed USD commitment.
4. Claiming reserves a page. It does not verify a company or its fundraising.
5. Example raises and public-source listings are not endorsements or confirmed
   live investment opportunities. Use synthetic commitments only.

## Short recording script (about two minutes)

Prepare a disposable demo database/raise and two browser sessions before
recording. Do not display founder approval codes, bearer tokens, email addresses,
wallet seed phrases, or private commitment data from real people.

| Time | Show | Say / expected visible result |
| --- | --- | --- |
| 0:00–0:15 | Landing list, then a raise's Progress view | “Confidential Fundraising coordinates interest without publishing individual commitments. These are demo figures.” |
| 0:15–0:35 | Prospect: submit `demo-investor-001`, USD `10000` | “Submitting interest does not require a wallet.” Show the recorded result. |
| 0:35–0:55 | Founder review, already unlocked off-camera | “The founder can review individual records privately.” Mark the synthetic record verified; show its demo status change. |
| 0:55–1:10 | Separate unauthenticated session: Progress, then public JSON | “Everyone else sees aggregate USD totals, not the investor list.” Show the updated aggregate, then refresh. |
| 1:10–1:35 | Founder quote panel, authenticated off-camera if approved | “NEAR Intents can quote a confidential cross-chain path. This request uses a fixed synthetic 1-USDC amount and never sends the investor identifier or commitment amount.” Show an actual successful live result only if obtained. Otherwise show the honest error and label the live success check outstanding. |
| 1:35–1:50 | Agent public API result, with token output and request headers hidden | “An external agent can reserve a page and update only its public fields. This is page ownership, not company verification.” Show a public field changed through the API and then the same field on the page. |
| 1:50–2:00 | Return to Progress | “Coordination, quotes, and test-token transfers remain separate. No legal investment settlement occurs.” |

For the agent segment, claim a separate unclaimed approved demo page in advance,
then use its one-time token for a public-field update. Never record the raw claim
response or Authorization header; the response contains the credential. The
[root README](../README.md) documents the endpoints and limits. Do not claim
that a separate AI agent has been integrated merely because an HTTP client
performed the action.

### Optional testnet-transfer clip (only after actual verification)

Use a new synthetic commitment with its original browser receipt and two
user-controlled NEAR testnet accounts. The founder confirms immutable receiver
details; the investor reviews and confirms separately. Show **Send 1 test USDC**,
the wallet approval, the server-verified result, and unchanged USD totals.
Explain: “This is a public testnet transfer with valueless test tokens, separate
from Intents.” Public progress should expose only the anonymous count, not
private transfer details.

Do not substitute a simulated receipt for a live transaction. If the wallet
rejects or its outcome is uncertain, stop: do not send again automatically.
Check the wallet and reconcile the existing transaction hash as described in
the [wallet walkthrough](../artifacts/confidential-fundraise-desk/README.md).
The real-wallet evidence check remains outstanding until completed separately.

## Draft X post

Review before posting; attach the actual recording. This text is a draft,
not evidence that the repository is already public:

```text
Fundraise without publishing investor details. Built for NEAR HACKATHON: private commitments, public totals & agent-owned pages. NEAR Intents quotes, not investment settlement. @NEARProtocol #NEARHackathon
https://github.com/stonkalicious/Confidential-Fundraise
```

Add a verified hosted-demo link in a reply if desired. Do not use an expiring
workspace Preview URL as if it were the final published demo.

## Draft submission description

The following is within the required 20–2,000-character range. Review it
against the actual recording and final code before submission:

```text
Confidential Fundraising is a prototype for coordinating fundraising interest without publishing individual investor records. People and external agents can discover raises, reserve an unclaimed page, and submit synthetic soft commitments. A founder reviews individual records behind an approval code; public pages and JSON expose aggregate totals. Claims reserve page ownership, not company verification.

NEAR Intents provides a wallet-authenticated, confidential dry-run quote path using a fixed synthetic 1-USDC amount and placeholder addresses. Investor identifiers and commitment amounts are not sent to the quote provider. The quote does not execute a swap or settle an investment.

A separate optional demo asks an investor's wallet to transfer exactly 1 test USDC on NEAR testnet after founder and investor confirmations. This is a public token transfer, not confidential Intents settlement, and it does not change the USD commitment totals.

Raise state persists in PostgreSQL. Per-raise agent tokens allow public-field updates without granting access to private commitments. Commitment privacy relies on application access controls, not onchain storage or private-AI inference. The project uses synthetic commitments and is not an investment offer.
```

## Readiness checklist

Checked boxes below refer only to documentation produced here. They do not
certify live-provider success, security audit results, or submission acceptance.

### Prepared

- [x] Root README: problem, NEAR role, setup, judge steps, API boundaries.
- [x] Artifact README corrected for wallet authentication and testnet-only
  transfers; mainnet key-registration costs disclosed.
- [x] Baseline starter disclosed, with baseline commit and diff links.
- [x] MIT license explicitly approved by the owner and included.
- [x] Recording script, X draft, description, and track recommendation prepared.

### Still requires verification or owner action

- [ ] Confirm the configured repository
  `https://github.com/stonkalicious/Confidential-Fundraise` is public and contains
  the intended latest code. No visibility or remote-content check was completed
  in this task.
- [ ] Review the eligible-work diff and approve a dedicated submission branch
  or baseline/final tags; pin the final judging revision. Do not push or tag
  without owner approval.
- [ ] Reproduce the README setup from a clean checkout against a disposable
  database; record the tool versions, date, and results outside this checklist
  until actually verified.
- [ ] Finish the separately queued privacy, public-refresh, copy, disclaimer,
  and wallet checks needed for the chosen demo. Check current task states
  rather than assuming proposed or queued work is merged.
- [ ] Demonstrate an actual wallet-authenticated confidential quote if it
  appears as a successful outcome in the recording. Otherwise disclose that
  live success remains unverified.
- [ ] Complete the separately scoped funded-testnet-wallet check before
  presenting a real 1-USDC transfer as demonstrated.
- [ ] Confirm the final hosted URL and latest published version, or explicitly
  use the local-only/video route allowed by the guide. Keep a hosted demo
  available through judging if supplied. No production URL was verified here.
- [ ] Review the final recording for privacy and accidental credential exposure.
- [ ] Human publishes the X demo post; verify it opens without signing in and
  includes the required tags, hackathon statement, and video/screenshots.
- [ ] Human confirms final project name, lead name, contact email, team size,
  track IDs, mainnet NEAR prize account, public repository URL, public X-post
  URL, and 20–2,000-character description. Do not invent missing details.
- [ ] Ask whether an entry already exists. Do not submit a second entry.
- [ ] Obtain explicit consent to the notice: “I agree that the organizers may
  use these details to review our submission and contact us about this hackathon.”
- [ ] Review every final field with the human before using the
  [submission form](https://nearhackathon.com/#apply). Keep any full payload,
  personal details, request identifier, and response outside the repository.
- [ ] Confirm actual acceptance, not merely an attempted submission. For
  API submission, a `201` means saved; preserve the same request identifier
  for a retry after a network failure. Never evade a duplicate-entry rejection.

No final payload, personal submission data, payout account, credentials,
recording, or success evidence has been generated or stored in this pack.
