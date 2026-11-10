---
name: Demo settlement recovery
description: Safety invariants for releasing a reserved NEAR test-USDC transfer after a rejected wallet request.
---

Reservation release is a dual-approval recovery, not an automatic retry. Only a strict wallet pre-broadcast rejection signal can offer the investor a recovery request; the investor must affirm that no transaction was submitted, and the founder must separately approve another attempt.

Keep the confirmed network, USDC contract, recipient, exact amount, and original founder and investor confirmation timestamps unchanged. Archive the released reservation's prepared timestamp and transfer memo so a retry receives a new memo and old attempts remain auditable. Uncertain wallet or network errors stay reserved for transaction-hash reconciliation.

**Why:** An uncertain wallet outcome can hide a submitted payment; clearing its reservation could permit a duplicate USDC send or bypass the original reviews.

**How to apply:** Keep this policy across any changes to the demo settlement routes, wallet error handling, retry UI, and recovery audit records.
