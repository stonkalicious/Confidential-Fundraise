# NEAR Hackathon Submission Pack

Refreshed 12 November 2026. **Drafts for owner review, not a submitted entry.**
Project name: **Agent Raised**. Repository:
https://github.com/stonkalicious/Confidential-Fundraise

Live app: https://agentraised.com

The approved app cleanup was pushed to GitHub separately. This submission-copy
refresh does not authorize a new push, app publication, X post, or hackathon
submission; none of those actions is performed by this preparation.

## Requirements checked

Re-read the [live HACKATHON.md](https://nearhackathon.com/HACKATHON.md) before
submitting; these notes reflect the live guide re-read on 12 November 2026.

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
The fit is private-finance coordination with operator-protected records and a
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
6. The animation illustrates the product direction as well as the app.
   Founder agents preparing `raise.md`, investor-agent matching, and the
   visualized MCP-style process are proposed workflows, not a demonstrated MCP
   server or autonomous matching system. The implemented agent interface is HTTP.
   Do not describe an animated wallet sequence as evidence of a live transaction.

## Current submission evidence

- Public repository metadata checked on 12 November: the repository is public,
  and its default branch is `main`. The existing authenticated Git remote works.
- Clean-checkout rehearsal: Node `v24.22.1`, pnpm `10.26.1`, PostgreSQL `16.15`;
  110 API tests and 39 desk tests passed at the revision recorded in the README.
  Same-origin page/API checks and persistence after API restart also passed.
- Latest app checks after legal wording, mobile navigation, and journey-copy
  changes: app typecheck, production build, and 47 desk tests passed. These are
  the prior app checks, not a fresh clean-checkout rehearsal. The mobile entry screen
  is How this app works; desktop still opens Progress. Explicit tab links win.
- The shared menu includes the legal disclaimer. It identifies the hackathon
  prototype, mixed data sources, non-binding soft commitments, and the fact that
  a page claim does not verify a founder or company.
- The Potential investor form uses “Your name or alias.” Private records remain
  behind the shared demo operator code; claiming a page does not grant private
  access. Public endpoints expose raise details and totals.
- The primary public deployment URL was verified as https://agentraised.com
  on 12 November. This confirms the configured URL, not that every workspace
  change is already published.
- Live unauthenticated `GET https://agentraised.com/api/raises` returned HTTP
  `200` and `application/json` on 12 November. It returns structured public raise
  objects, not individual commitments or claim contact details.
- A successful real-wallet confidential quote and an exact funded-wallet
  testnet transfer are **not certified by these checks**. Omit successful
  outcomes from the submission unless separately demonstrated.

Before handing the repository to judges, record the pushed revision with
`git rev-parse HEAD` and retain that commit's GitHub link. The README links the
starter baseline and eligible-work comparison. A final submission tag or
dedicated branch can be added only if the owner requests it.

## Short recording script (about two minutes)

Prepare a disposable demo database/raise and two browser sessions before
recording. Do not display founder approval codes, bearer tokens, email addresses,
wallet seed phrases, or private commitment data from real people.

Optional opening before going straight into the app: “What if company.md became
a live raise page?” This is script guidance only; no re-recording or animation
change is required.

| Time | Show | Say / expected visible result |
| --- | --- | --- |
| 0:00–0:15 | Landing list, then a raise; on phones How this app works opens first, so select Progress | “Agent Raised coordinates interest without publishing individual commitments. These are demo figures.” |
| 0:15–0:35 | Potential investor: enter `demo-investor-001`, USD `10000`, then choose Record non-binding interest | “Recording interest does not require a wallet.” Show the confirmation on Progress explaining that no money moved and no introduction was sent; do not show individual details publicly. |
| 0:35–0:55 | Founder review, already unlocked off-camera | “The demo operator can review individual records privately. Claiming a page does not unlock this view.” Mark the synthetic record verified; show its demo status change. |
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

### Live agent-readable interface

Judges can inspect the public raise list without login:
[GET /api/raises](https://agentraised.com/api/raises).

```sh
curl --fail --silent --show-error https://agentraised.com/api/raises
```

The response is a JSON array of structured public objects with `id`, `name`,
`thesis`, `stage`, `range`, `categories`, `claimed`, `status`, `softTotal`,
`hardTotal`, and `confirmedTestnetTransfers`. The last field is an anonymous
count, not a transfer receipt. A returned ID can also be used with
`GET https://agentraised.com/api/raises/ID` to inspect that raise.
Individual investor records and claim contact details are excluded.
This is a live HTTP interface that external agents can call, not an implemented
MCP server or evidence of autonomous investor matching.

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

## X demo post

The owner supplied the X demo-post URL:
https://x.com/NeartoZEC/status/2120868806058754324

The post text and attached media have not been independently reviewed. The
earlier wording below is a draft, not a transcript of the published post:

```text
Agent Raised — public raise pages, private soft commitments, agent-owned updates. One structured source an investor’s agent can read. Built for NEAR HACKATHON. @NEARProtocol #NEARHackathon
```

Attach the animation and link the public repository in a reply. When using the
animation, also explain in the reply that it includes proposed raise.md and
agent-matching workflows, not completed matching or settlement. If possible,
also include a short capture of the actual app: submit synthetic interest,
show the confirmation, and show the public total without individual details.
Link https://agentraised.com as the hosted demo. Do not use an expiring workspace
Preview URL as if it were the final published demo.

## Draft submission description

The following is within the required 20–2,000-character range. Review it
against the actual recording and final code before submission:

```text
Agent Raised is a public, agent-readable raise directory with private soft commitments. Founders and agents can claim raise pages; agent tokens authorize updates to public fields. Individual commitments stay private; public pages and JSON show raise details and aggregate totals. Built for NEAR HACKATHON.

NEAR Intents provides a wallet-authenticated, confidential dry-run quote path using a fixed synthetic 1-USDC amount and placeholder addresses. Investor identifiers and commitment amounts are not sent to the quote provider. The quote does not execute a swap or settle an investment.

A separate optional testnet demo implements a founder/investor-confirmed 1-test-USDC transfer flow. A successful funded-wallet run is not claimed here. It is public, separate from Intents, and does not change USD totals.

The live public GET https://agentraised.com/api/raises returns structured raise objects that external agents can read. Raise state persists in PostgreSQL. Per-raise agent tokens permit public-field updates, not access to private commitments. Individual records require the shared demo operator code; claiming a page does not grant access or verify a founder or company. Soft commitments are non-binding. Privacy relies on application access controls, not onchain storage or private-AI inference. Listings may include synthetic examples, public-source material and user submissions. The animation also shows a proposed raise.md and agent-matching workflow; that matching/MCP workflow is not implemented. This hackathon prototype is not a live investment platform or an investment offer.
```

## Readiness checklist

Checked boxes below record preparation and local verification only. They do not
certify live-provider success, security audit results, or submission acceptance.

### Prepared

- [x] Root README: problem, NEAR role, setup, judge steps, API boundaries.
- [x] Artifact README corrected for wallet authentication and testnet-only
  transfers; mainnet key-registration costs disclosed.
- [x] Baseline starter disclosed, with baseline commit and diff links.
- [x] MIT license explicitly approved by the owner and included.
- [x] Recording script, X-post draft, and description prepared.
- [x] Owner supplied the X demo-post URL:
  https://x.com/NeartoZEC/status/2120868806058754324.
- [x] Public GitHub repository and default branch checked on 12 November.
- [x] Primary public domain and unauthenticated structured raises endpoint
  verified on 12 November: https://agentraised.com and
  https://agentraised.com/api/raises.
- [x] Legal disclaimer, data/claim clarifications, investor labels, and mobile-first
  How this app works entry implemented in the current app.
- [x] Clean checkout reproduced on 12 November 2026 with Node `v24.22.1`,
  pnpm `10.26.1`, and PostgreSQL `16.15`; typechecks, 110 API tests, 39 desk
  tests, same-origin routes, and persistence after API restart passed. Exact
  commands and results are in the [root README](../README.md).

### Still requires verification or owner action

- [ ] Verify the final push contains the intended latest code and record its
  exact commit link.
- [ ] Review the eligible-work diff and approve a dedicated submission branch
  or baseline/final tags; pin the final judging revision. Do not push or tag
  without owner approval.
- [ ] Review any remaining security/privacy findings against the actual demo.
  Do not treat this pack or passing tests as a security audit.
- [ ] Demonstrate an actual wallet-authenticated confidential quote if it
  appears as a successful outcome in the recording. Otherwise disclose that
  live success remains unverified.
- [ ] Complete the separately scoped funded-testnet-wallet check before
  presenting a real 1-USDC transfer as demonstrated.
- [ ] Confirm the final hosted URL and latest published version, or explicitly
  use the local-only/video route allowed by the guide. Keep a hosted demo
  available through judging if supplied. The configured public URL is
  https://agentraised.com; the latest intended production revision still
  needs confirmation.
- [ ] Review the final recording for privacy and accidental credential exposure.
- [ ] Verify the supplied X post opens publicly and includes the required
  @NEARProtocol tag, #NEARHackathon hashtag, NEAR HACKATHON statement, and demo
  video or screenshots. If the post was not included in the already-submitted
  entry, use the organizers' request-changes flow if needed; do not submit a
  duplicate entry.
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
