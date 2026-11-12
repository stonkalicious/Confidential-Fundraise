---
name: NEAR testnet-only boundary
description: Agent Raised demo wallet interactions must never use NEAR mainnet.
---

Agent Raised must keep all wallet interactions on NEAR testnet. NEAR Intents 1Click has no testnet, so the app must not authenticate wallets or request quotes through its mainnet-only path.

**Why:** The user said this is a demo app and it should always be testnet.

**How to apply:** When a provider lacks testnet support, disable that interaction in the demo instead of silently using mainnet.
