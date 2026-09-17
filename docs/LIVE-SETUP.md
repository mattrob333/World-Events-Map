# Connect MERIDIAN

The redesign runs without credentials. Live membership, provider publication and external feeds require the connections below. Credentials have not been provisioned or activated by this change.

## Start with Supabase

Create a project at [Supabase](https://supabase.com/dashboard). Copy its project URL and public anon key (a publishable key can also be used in the ANON_KEY variable), plus the server-side service-role key for signal persistence.

| Variable | Purpose | Visibility |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project address | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser auth and RLS-protected data | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Read/write scheduled signal and X snapshots | Server secret |

Apply `supabase/migrations/001_platform.sql`, then `002_live_signals.sql`, in order to the intended new project. These create tables and policies; review before applying to an existing project. No hosted migration was run for you.

Enable email authentication. In Auth > URL configuration, set your site URL and allow the `/account`, `/community` and `/partners` redirect paths on your production domain and localhost development origin. Include query strings in allowed development redirects if your configuration requires it. Configure production SMTP in Supabase for reliable sign-in email delivery. See [passwordless email documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless).

Set environment variables in `.env.local` for local use and in your hosting project's environment settings for previews/production. Rebuild after changing any `NEXT_PUBLIC_` value. Keep `NEXT_PUBLIC_MERIDIAN_DEMO=0` for real users. Never put a service-role key in a public variable or send credentials in a PR.

Sign in as two different people and verify saving, circle request/host approval, chat, and provider inquiries. Provider/event approval is currently an administrator SQL action, documented in [partner setup](partner-setup.md). Verified offers become public; expired offers and suspended providers are hidden by database rules. Approved submitted events become globe events on the next calendar poll.

## Choose the feeds you want

You do **not** need every vendor. Start with Supabase, then whichever demand sources cover your events. The underlying calendar remains editorial.

| Connection | Exact variable(s) | What this build uses it for | Get access |
|---|---|---|---|
| Ticketmaster | `TICKETMASTER_API_KEY` | Discovery-derived demand signals for matching indexed events | [Developer portal](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) |
| PredictHQ | `PREDICTHQ_TOKEN` | Event demand/rank enrichment | [PredictHQ docs](https://docs.predicthq.com/) |
| X | `X_BEARER_TOKEN` | Recent mention counts and momentum | [X developer console](https://developer.x.com/) |
| X readable scene posts | Same bearer token plus `X_POSTS_ENABLED=1` | Recent posts with author/time/source links, fetched only by the scheduled worker | [Recent search API](https://docs.x.com/x-api/posts/search-recent-posts) |
| Google Trends via SerpAPI | `SERPAPI_KEY` | Search-interest enrichment | [SerpAPI Google Trends](https://serpapi.com/google-trends-api) |
| Amadeus production | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` | Sampled hotel availability pressure; no booking inventory | [Amadeus developers](https://developers.amadeus.com/) |

The Amadeus adapter targets `api.amadeus.com`; test-environment keys will not work there. Vendor keys require suitable API entitlements; adding a key does not establish that your account has access. X is usage-billed: check the current console limits before enabling counts and posts. No API subscriptions or credits have been purchased.

Matching, source coverage and response parsing must be smoke-tested with your actual vendor accounts. Mention volume is not attendance; hotel availability is a sampled proxy; future demand is not a live crowd count. Date-only records say happening today in the destination timezone, not that the venue is open this minute.

## Turn on refresh

Generate distinct long random values for `CRON_SECRET` and `REFRESH_ADMIN_TOKEN`. Keep both server-only.

Schedule an authenticated GET to `/api/cron/refresh`, normally every 10 minutes, with header `Authorization: Bearer <CRON_SECRET>`. Use your host's supported scheduler or another scheduler you already operate. Scheduler setup is required; simply saving vendor keys does not fetch data. No recurring job is automatically activated by this PR.

The route requires migration 002 and service-role configuration. A Postgres lease allows one scheduled batch globally per 10 minutes; the worker refreshes at most **two events per batch**, cycling through up to 60 current/nearest upcoming indexed events. It optionally refreshes posts for one scene. This intentionally starts with a small API budget. Increase coverage only after measuring vendor quotas and execution time. It is not a guarantee of ten-minute freshness across the entire catalog.

An alternative invocation from a trusted scheduler is:

```sh
node --env-file=.env.local scripts/refresh-feeds.mjs
```

This sends the scheduler request to `APP_BASE_URL` and reports only the result, not credentials. Production must use an HTTPS base URL.

For a specific event, an administrator may POST `{"ids":["monaco-grand-prix"]}` to `/api/admin/refresh` with the separate admin bearer token. Up to 60 IDs are accepted; `{"all":true}` explicitly requests a full sweep. A sweep can be expensive and exceed short host execution limits, so use small subsets for initial validation. Manual calls do not use the scheduler lease.

Public `/api/events`, `/api/signals` and `/api/scene-posts` requests only read cached data; page views cannot initiate vendor calls. Browser calendar polling is every minute, offer polling every 30 seconds, and member chat polling every 15 seconds. This is periodically refreshed activity, not a streaming firehose.

Signal snapshots expire after 10 minutes; expired values revert to curated signals. X snapshots expire after 15 minutes and are replaced on refresh. A missing feed stays empty. Public vendor health is worker-local diagnostics, so a cold instance can say awaiting sync while reading another worker's persisted snapshots; the calendar's `enrichedAt` field is the timestamp for fresh persisted enrichment. Check scheduler responses for storage/social errors.

## Maps and availability

The globe needs no key. The neighborhood view uses an attributed OpenStreetMap embed, with a Google Maps venue-search link. It shows an approximate event area, not a verified door or private party location. Venue verification and review remain operational responsibilities. The photo on the discovery screen is atmospheric, not proof of a particular event.

Offers support inquiries and provider replies. There is no instant checkout, real inventory hold, automated charter purchase, or booking confirmation. Those require operator/inventory integrations beyond these credentials. Responses appear in the app; response emails and push notifications are not enabled.

## Release check

Run `npm ci` and `npm run gate`. The suite includes an isolated PostgreSQL/PGlite execution of the membership/provider RLS migration, with mocked Supabase auth roles. This does not replace hosted verification: confirm magic-link delivery, redirect handling, two-account isolation, publication/expiry, provider replies and one real vendor refresh before a production launch.
