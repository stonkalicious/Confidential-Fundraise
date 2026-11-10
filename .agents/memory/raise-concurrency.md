---
name: Raise concurrency
description: Why raise writes use database row locking rather than schema revisions.
---

Keep cross-server raise mutation safety based on PostgreSQL row locking rather than adding a revision column unless a new requirement calls for optimistic concurrency.

**Why:** The existing JSON state can be read, validated, and replaced atomically under a row lock without migrating stored data or changing request and response contracts. A process-local cache or queue is not a cross-server coordination mechanism.

**How to apply:** Any new existing-raise writer must participate in the same read-modify-write transaction protocol. Read-cache freshness is a separate concern: protecting writes does not by itself make other servers' cached GET responses fresh.

Prefer bounded, request-driven snapshot refreshes over adding database revision fields or a publish/subscribe service for the current raise directory.

**Why:** The current scope needs cross-instance freshness without a schema migration or additional infrastructure. Full validated snapshots preserve the existing privacy projections and moderation behavior.

**How to apply:** Preserve that tradeoff for the current directory size; reconsider it if measured database load or directory size warrants incremental invalidation. Treat the freshness promise as a read-admission cache-age bound, not a response-time guarantee.
