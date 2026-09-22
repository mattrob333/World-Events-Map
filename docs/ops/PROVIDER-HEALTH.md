# Provider health

How to tell whether a source is usable. Dollar costs are in `docs/ops/PROVIDER-COSTS.md`. Access unknowns are in `docs/data/SOURCE-ACCESS-MATRIX.md`.

## Buzz adapters

`SourceHealth.status` on Ticketmaster, PredictHQ, Trends, X, and Amadeus:

| Status | Meaning |
|---|---|
| `unconfigured` | The env name for that adapter is empty. This is the normal local state |
| `live` | A key is present and the last fetch in **this process** succeeded |
| `error` | A key is present and the last fetch failed. The curated baseline stays. That source's new patch is empty |
| `stale` | Used when a source is configured and has not completed a successful sync yet |

`GET /api/sources` reports this in-memory state. It does not call vendors. A cold instance can say "waiting" while another instance holds the last snapshot. Trust `enrichedAt` on the calendar for persisted buzz patches.

Public health text is scrubbed of credential-looking URL values. See `src/lib/data/__tests__/health-redaction.test.ts`.

## Travel wire

| Wire status | Meaning |
|---|---|
| `empty` | No per-source reading in this process, or only editorial baselines |
| `observations` | At least one fresh or mixed card |
| `degraded` | Every visible card is past its 10-minute freshness window |

Process memory keeps a per-source patch for up to 24 hours so an old reading can be labeled stale with its original `observedAt`. It is not re-stamped.

## NOW providers

BestTime missing: `/api/now` refuses the venue lookup. TypeSafe missing: deterministic ranking continues and the response says judgment was skipped. The shared Postgres budget fails closed for BestTime when the budget store is unavailable.

## Scheduler

`GET /api/cron/refresh` returns:

- 503 when the secret, database, or migration is missing
- 401 when the bearer token does not match
- a skipped body when another worker holds the 10-minute lease
- a skipped body when no live source is configured

There is no hosted uptime probe in this repository.
