---
name: MVP scope
description: Standing scope constraint for this project.
---

Keep the focus very tight; don't add too much—it's an MVP.

**Why:** The user asked.

**How to apply:** Keep work limited to the requested deliverable rather than adding extra features.

This product is a hackathon demo and uses synthetic raise and commitment data only. Do not add a real prospect tracker or expose investor identities publicly.

**Why:** The user confirmed the demo is for a hackathon, chose synthetic data only, and switched the displayed raise currency to USD without changing numeric values.

**How to apply:** Keep settlement and USD commitment totals distinct, show only anonymous public aggregates, and avoid building account or real-prospect management unless the user changes this scope.

Optional demo settlement must not make the core claim / update / soft-commit /
aggregate flow depend on a wallet. The user chose exactly 1 USDC, not a
dollar-equivalent amount of NEAR, and said testnet is the best way.

**Why:** The user explicitly limited settlement to a small, optional demo.

**How to apply:** Keep test tokens clearly distinguished from real dollars and
do not expand this into investment execution or treat a tiny demo transfer as
funding the recorded commitment.

Nearhunt-sourced project ranges are illustrative estimates, not confirmed
fundraising asks. Do not imply that listed votes establish fundraising demand,
and do not scrape or continuously sync Nearhunt.

**Why:** The user specified these boundaries when asking to seed example
Nearhunt hackathon projects.

**How to apply:** Keep each estimate visibly qualified, link to its public
Nearhunt source, and do not add live vote ranking or synchronization.

The raise.md preparation, investor discovery and critical-review flow is a
proposed workflow using the founder's and investor's own external agents, not
an existing in-app capability. The founder approves public information and the
investor decides whether to proceed.

**Why:** The user-approved animation scope explicitly separates this proposal
from the demonstrated commitment features.

**How to apply:** Retain clear proposed-workflow identification and human
approval/decision beats unless a separate implementation is authorized. Do not
imply the app already ingests files, performs AI reviews or commits for investors.

The proposed Raise.md preparation step includes an agent drafting a sourced
file, identifying missing information, and waiting for founder approval. This
is a larger product workflow, not a small polish task. The animation's
confidential NEAR quote is also future scope: the current app does not request a
live Intents quote.

**Why:** The user explicitly separated these animated capabilities from what
the current app demonstrates.

**How to apply:** Keep the sourced preparation/review workflow and live quote
flow distinct from current capabilities. Treat either as future product work,
and do not claim the live quote flow works until it is built and verified.
