---
name: MVP scope
description: Standing scope constraint for this project.
---

Keep the focus very tight; don't add too much—it's an MVP.

**Why:** The user asked.

**How to apply:** Keep work limited to the requested deliverable rather than adding extra features.

This product is a hackathon demo and uses synthetic raise and commitment data only. Do not add a real prospect tracker or expose investor identities publicly.

**Why:** The user confirmed the demo is for a hackathon and chose demo data only.

**How to apply:** Keep settlement and EUR commitment totals distinct, show only anonymous public aggregates, and avoid building account or real-prospect management unless the user changes this scope.

Optional demo settlement must not make the core claim / update / soft-commit /
aggregate flow depend on a wallet. The user chose exactly 1 USDC, not a
dollar-equivalent amount of NEAR, and said testnet is the best way.

**Why:** The user explicitly limited settlement to a small, optional demo.

**How to apply:** Keep test tokens clearly distinguished from real dollars and
keep mainnet opt-in. Do not expand this into investment execution or treat a
tiny demo transfer as funding the recorded commitment.
