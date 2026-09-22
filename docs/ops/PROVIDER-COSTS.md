# Provider costs

No vendor price was copied into this file. Inventing a rate would become a false quote. TODO: the account owner fills the dollar column after reading each vendor's current plan. Stop if the plan requires a card, a signature, or business verification.

## Spend controls that already exist

| Surface | Control | Env names involved |
|---|---|---|
| World buzz refresh | One leased batch per 10 minutes, at most 2 events, and only from the authorized worker | `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |
| Manual refresh | Separate bearer token. Subsets capped at 60 ids | `REFRESH_ADMIN_TOKEN` |
| Public reads | `/api/signals`, `/api/events`, `/api/scene-posts`, `/api/travel-wire` do not call vendors | None |
| X posts | Off unless `X_POSTS_ENABLED=1`, then one scene per batch | `X_BEARER_TOKEN`, `X_POSTS_ENABLED` |
| Amadeus token | Reused until shortly before expiry | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` |
| NOW | 12 requests per client per 10 minutes, then a shared durable cap of 120 BestTime or TypeSafe calls per 10 minutes | `BESTTIME_API_KEY_PRIVATE`, `TYPESAFE_API_KEY` |
| NOW cache | 5-minute in-memory venue cache on a warm instance. Cache hits do not spend the durable budget | `BESTTIME_API_KEY_PRIVATE` |

## Not a cost control

`src/lib/data/refresh/schedule.ts` estimates a cheaper proximity cadence. The cron route does not use it. Do not quote those estimates as the current bill.

The Live Travel Wire adds no vendor calls.

## TODOs before any new spend

- Confirm whether Ticketmaster, PredictHQ, X, SerpAPI, and Amadeus accounts are free, trial, or billed.
- SerpAPI and X are the most likely to charge per call. Escalate before enabling them in production.
- Amadeus production access may be a contract. The adapter does not target the test host.
- Do not raise the NOW cap of 120 until the BestTime and TypeSafe prices are known.
- Idea-engine model calls and Jev calls are not wired. They need a budget check before the first request.
