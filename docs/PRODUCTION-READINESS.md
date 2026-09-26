# MERIDIAN Production Readiness

This is the release checklist for moving MERIDIAN from a fast-built product into a dependable service. A feature can be visually impressive and still fail this checklist.

## Release rule

`main` should remain releasable. Material work lands through a reviewed feature branch after the full repository gate passes.

```sh
npm ci
npm run gate
```

A green build is necessary, not sufficient. Provider integrations and hosted Supabase behavior still require environment-specific verification.

## 1. Data layer

Before enabling account-backed features in a new environment:

- Apply Supabase migrations in numeric order.
- Confirm the deployed database migration level matches the code release.
- Run RLS behavior against real Supabase auth, not only PGlite.
- Verify new users receive private profiles by default.
- Verify one user cannot read or mutate another user's private Travel Modes.
- Verify Circle membership revocation removes private-chat access.
- Verify dependent multi-write actions are transactional.
- Take a database backup before destructive or structural production migrations.

Current migrations:

1. `001_platform.sql`
2. `002_live_signals.sql`
3. `003_affinity_graph.sql`
4. `004_now_provider_budget.sql`
5. `005_research.sql`
6. `006_advisor_hardening.sql`
7. `007_feed_library.sql`
8. `008_daily_budgets.sql` (must be applied before deploying code that uses `sharedBudget.ts`: in production, paid calls fail closed without it)

## 2. Secrets and configuration

Server-only credentials must stay server-only.

Never expose these through `NEXT_PUBLIC_` variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `REFRESH_ADMIN_TOKEN`
- `TICKETMASTER_API_KEY`
- `PREDICTHQ_TOKEN`
- `X_BEARER_TOKEN`
- `SERPAPI_KEY`
- `AMADEUS_CLIENT_SECRET`
- `BESTTIME_API_KEY_PRIVATE`
- `TYPESAFE_API_KEY`

Before production:

- configure secrets in the hosting environment, not committed files
- rotate any credential that has ever appeared in a public log, screenshot or repository
- use distinct secrets for development, preview and production where supported
- verify preview deployments cannot consume production provider quotas unintentionally

## 3. NOW launch gate

Do not describe NOW as live until all of these are true:

- BestTime private credentials are configured server-side.
- Supabase service-role access is configured server-side and migration `004_now_provider_budget.sql` is applied.
- The durable provider-budget RPC is verified against the hosted production database, including exhaustion and window reset behavior.
- A real request succeeds in at least three materially different cities.
- Food, drinks and experience intents each return plausible candidates.
- Closed venues are excluded when opening-hour data makes that determination possible.
- Expected foot traffic is labeled expected, not live.
- TypeSafe/Jev requests are validated against the current API schema.
- TypeSafe failure produces a deterministic fallback rather than a failed trip decision.
- Provider timeouts and error responses do not leak credentials or upstream payloads to the browser.
- Paid-provider usage is observed during testing so a realistic cost envelope is known.
- Same-origin JSON enforcement is verified through the deployed proxy/host headers.

MERIDIAN uses two separate protections: a warm-instance per-client abuse guard and a durable Postgres paid-provider ledger. The durable ledger is the actual spend ceiling across server instances. If it is unavailable, required paid provider work fails closed.

## 4. Provider truth rules

Every provider-backed field needs a provenance and freshness interpretation.

Examples:

- event demand: modeled/observed signal, not attendance
- BestTime `day_raw`: expected/current-hour foot traffic, not live unless a live endpoint supplied it
- partner offer: inquiry opportunity, not locked inventory
- Avinode or broker result: opportunity until provider confirmation
- charter calculator: planning estimate, not quote

If a source is unavailable, degrade honestly. Never replace unavailable provider data with realistic-looking fabricated data.

## 5. Privacy

Before a feature exposes a member or trip relationship, answer:

1. Did the member explicitly opt into discovery?
2. Is this profile-level information or more sensitive trip intent?
3. Is the minimum necessary location precision being used?
4. Who can read the data under RLS?
5. How can the member stop sharing it?

Current rules:

- profiles private by default
- Travel Modes private by default
- discoverable Travel Modes require opt-in plus a discoverable profile
- precise current location is used ephemerally for NOW and is not persisted in the People Graph
- Circle chat is accepted-members-only

## 6. Reliability and failure modes

For every network dependency:

- set an explicit timeout
- reject malformed provider responses
- bound list sizes
- bound request body size
- avoid client-side private credentials
- define degraded behavior
- test the degraded behavior

NOW currently treats BestTime as required for live venue facts and TypeSafe/Jev as optional. TypeSafe failure degrades to deterministic ranking. BestTime failure returns a transparent service error rather than invented venues. Failure to claim durable spend budget also prevents required provider work rather than silently falling back to a process-local counter.

## 7. Observability

Before meaningful production traffic, add durable telemetry for:

- API request count and latency by route
- provider request count, latency, failures and estimated cost
- durable provider-budget utilization and exhaustion
- NOW candidate count before and after hard filters
- fallback frequency from structured judgment to deterministic ranking
- Supabase auth failures
- RLS/permission errors
- scheduled feed freshness
- unhandled server exceptions

Do not log private provider keys, auth tokens, full precise-location histories or private Circle messages.

## 8. Product outcome instrumentation

Recommendation quality should eventually be evaluated from outcomes rather than page views alone.

High-value outcome events:

- opened venue in maps
- marked went / skipped
- saved event
- joined or created Circle
- invited another member
- sent partner inquiry
- repeated a venue category or destination
- traveled again with the same Circle members

Outcome data should improve ranking without silently overwriting explicit member preferences.

## 9. Browser and device checks

For every major release verify:

- current Chrome desktop
- current Safari desktop
- iPhone-sized viewport
- Android-sized viewport
- reduced-motion mode
- denied geolocation
- disconnected Supabase
- provider-not-configured state
- slow provider response
- no WebGL fallback for PULSE

NOW is a travel-day workflow, so mobile failures are release blockers.

## 10. Rollback

A release should have a simple rollback path:

- application code: redeploy the previous known-good commit
- provider integration: disable the provider credential/feature path and fall back where supported
- database: prefer additive migrations; do not depend on automatic destructive rollback
- scheduled workers: disable scheduler invocation before changing data contracts

Document any migration that cannot safely coexist with the previous application version before merging it.

## Current next production work

1. Complete CI and review for the first NOW vertical slice.
2. Apply and verify the NOW durable-budget migration in the hosted environment before enabling paid provider credentials.
3. Exercise BestTime and TypeSafe with real credentials and capture representative provider fixtures for regression tests.
4. Build the first-class traveler profile surface and privacy model.
5. Build the Circle anticipation/research layer.
6. Add outcome-event infrastructure and travel-time/return-by constraints.
7. Qualify aviation providers behind the existing opportunity interface rather than coupling the product to one vendor.
