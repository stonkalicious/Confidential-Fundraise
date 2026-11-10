---
name: Raise data privacy
description: Product privacy boundary for investor and commitment information.
---

Individual commitments and investor contact details must remain private.

Founders and sponsors need a shareable, commitment-specific settlement link that the investor opens in their own browser.

**Why:** The user preferred a separate investor link after the wallet flow stayed in the sponsor's browser.

**How to apply:** Keep investor wallet approval on the investor's own device or browser; do not assume the sponsor can sign for the investor.

Use “Founder” instead of “Sponsor” in all user-facing app wording.

**Why:** The user explicitly asked to remove sponsor wording in favor of founder.

**How to apply:** Change visible labels, instructions, and error messages; internal role names and API fields may remain unchanged.

The shared approval code also protects access to this private data in the demo.

Do not silently downgrade a confidential NEAR Intents quote request to a public quote when end-user authentication is missing. Show the provider's clear error instead.

Persist raise claims, public fields, and private commitments; treat seeded raises as insert-only so startup never overwrites live changes.

Agent claims reserve ownership of a raise page; they do not verify a company. A per-raise claim token authorizes only thesis, stage, range, and public status updates. Public statuses are open, paused, and closed, separate from moderation approval. Agent ownership never grants access to private commitments or sponsor actions.

**Why:** The user explicitly requires privacy, persistence across restarts, and preserving live changes; they chose the same approval code as the demo access gate.

**How to apply:** Enforce the code on the server for sponsor-only records. Keep personal and per-investor records out of public pages and unauthenticated API responses; expose only approved public raise details and aggregate totals. Seed only missing raise IDs. Do not fall back from a confidential quote to public mode.
