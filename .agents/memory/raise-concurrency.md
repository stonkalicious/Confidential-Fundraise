---
name: Raise concurrency
description: Why raise writes use database row locking rather than schema revisions.
---

Keep cross-server raise mutation safety based on PostgreSQL row locking rather than adding a revision column unless a new requirement calls for optimistic concurrency.

**Why:** The existing JSON state can be read, validated, and replaced atomically under a row lock without migrating stored data or changing request and response contracts. A process-local cache or queue is not a cross-server coordination mechanism.

**How to apply:** Any new existing-raise writer must participate in the same read-modify-write transaction protocol. Read-cache freshness is a separate concern: protecting writes does not by itself make other servers' cached GET responses fresh.
