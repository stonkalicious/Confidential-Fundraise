---
name: Quote timestamp policy
description: Why malformed provider timestamps are rejected instead of replaced.
---

Reject a supplied, unparseable quote timestamp string with a sanitized provider error. Preserve the receipt-time fallback for missing or non-string timestamps.

**Why:** Silently replacing an invalid provider date can misrepresent when a quote was created. Keeping the existing fallback for absent dates avoids an unrelated compatibility change.

**How to apply:** When changing provider quote normalization, preserve the distinction between an invalid supplied date and an unavailable date; never include raw provider values in client errors.
