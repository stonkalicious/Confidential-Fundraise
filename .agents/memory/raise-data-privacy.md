---
name: Raise data privacy
description: Product privacy boundary for investor and commitment information.
---

Individual commitments and investor contact details must remain private.

The shared approval code also protects access to this private data in the demo.

Do not silently downgrade a confidential NEAR Intents quote request to a public quote when end-user authentication is missing. Show the provider's clear error instead.

**Why:** The user stated this product requirement and chose the same approval code as the demo access gate.

**How to apply:** Enforce the code on the server for sponsor-only records. Keep personal and per-investor records out of public pages and unauthenticated API responses; expose only approved public raise details and aggregate totals. Do not fall back from a confidential quote to public mode.
