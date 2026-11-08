---
name: Raise data privacy
description: Product privacy boundary for investor and commitment information.
---

Individual commitments and investor contact details must remain private.

The shared approval code also protects access to this private data in the demo.

Do not silently downgrade a confidential NEAR Intents quote request to a public quote when end-user authentication is missing. Show the provider's clear error instead.

Persist raise claims, public fields, and private commitments; treat seeded raises as insert-only so startup never overwrites live changes.

**Why:** The user explicitly requires privacy, persistence across restarts, and preserving live changes; they chose the same approval code as the demo access gate.

**How to apply:** Enforce the code on the server for sponsor-only records. Keep personal and per-investor records out of public pages and unauthenticated API responses; expose only approved public raise details and aggregate totals. Seed only missing raise IDs. Do not fall back from a confidential quote to public mode.
