# Raise read freshness

Initialized API processes cache the complete validated raise snapshot for at most
**1,000 milliseconds**, measured with a monotonic clock from the start of the
database read. After expiry, the next read waits for PostgreSQL before responding.
There is no background timer and no stale-on-error fallback.

A read started at least one second after another instance's committed write will
load that write (or a later state) before returning. This is a cache-age bound,
not a database latency or HTTP response deadline; a request already in progress
can observe its earlier snapshot. Database outages produce a retryable HTTP 503,
not indefinitely stale results. Failed refreshes do not renew the cache lifetime.

Public list/detail, pending moderation, private detail, legacy claim status, and
quote eligibility reads all use the same refresh-aware getters. Public/private
response schemas and founder authorization are unchanged. Unauthorized private
requests are rejected before refreshing or reading private data. Transfer counts
continue to be queried directly from PostgreSQL.

Concurrent expired reads share one refresh. Snapshot publication is serialized
with local mutations through the existing queue to prevent refresh/write races.
A reader joining a slow refresh whose query started before that reader's allowed
cache window waits for another shared refresh instead of accepting old state.
Local mutations update their record only after commit and **do not renew the
whole snapshot's lifetime**: they cannot keep unrelated remote changes stale.
Refreshes replace the snapshot atomically, including removals and ordering.

The seed-only in-memory mode remains available only for isolated tests. Normal
server startup awaits database initialization before listening.

Verification: `pnpm --filter @workspace/api-server test` includes independently
initialized child processes against the same development database, testing
cross-instance public, pending, private, claim, commitment, and agent-edit reads.
