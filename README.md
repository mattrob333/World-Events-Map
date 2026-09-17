# MERIDIAN

**Know where the world is gathering. Find your way in.**

A social travel discovery platform built around a cinematic globe, a curated event calendar, private travel circles, and approved partner opportunities.

## Run locally

Node 24 and npm 10+ are recommended.

```sh
npm ci
npm run dev -- --hostname localhost --port 3127
```

Open http://localhost:3127. Without credentials, discovery works from the curated calendar; member and partner routes explain that their services are not connected. Simulated members are off by default.

## What is implemented

- Responsive globe discovery, destination spotlight, searchable Pulse, Now and future-date planning, event deep links, and a list alternative.
- Happening-today filtering in the destination timezone, account-backed saved events, and a neighborhood map with venue-search links.
- Supabase email sign-in, private-by-default profiles, hometown/interests, travel circles, host approval, member-only messages, and membership revocation.
- Partner applications, administrator verification, offer drafting/publication/expiry, event submissions, traveler inquiries and provider replies.
- Approved partner events appear on the globe without fabricated popularity or spend estimates.
- Server-fed demand enrichment with durable snapshots, bounded authenticated refresh, source health, and optional recent X posts.
- CI with lint, types, dataset validation, unit tests, SQL/RLS execution and production build.

## Connect real services

Read **[LIVE-SETUP.md](docs/LIVE-SETUP.md)** for the exact keys, vendor links, migration order, auth redirects, scheduler setup and release checks. Start with Supabase for the actual network. External demand sources are optional.

Copy `.env.example` to `.env.local`. Apply the two Supabase migrations in order, configure authentication, and set host environment variables. Rebuild when public environment values change. A scheduled invocation is required for external enrichment; saving keys alone does not start paid API requests.

[Partner setup](docs/partner-setup.md) explains provider/event approval and access control.

## Validation

```sh
npm run gate
```

SQL tests use embedded PostgreSQL through PGlite with Supabase auth roles mocked. Browser checks cover desktop/mobile discovery, event selection, date planning, deep links and disconnected account/community/partner screens. Actual hosted Supabase email/auth and credentialed vendor payloads must still be exercised with your own accounts before production release.

## Boundaries

- Curated rankings are modeled demand, not live attendance. Some future calendar dates are established windows rather than published schedules. Confirm with organizers.
- The app never invents members, purchases, offer availability or feed updates. Optional legacy demonstration mode requires `NEXT_PUBLIC_MERIDIAN_DEMO=1`.
- Offers create inquiries, not reservations. There is no checkout, inventory locking or confirmed shared-charter booking. Charter calculations are planning estimates.
- Exact venues need organizer confirmation. The local map is an approximate neighborhood view using OpenStreetMap, not satellite/door-level verification.
- Community/provider data is polled; response emails and push notifications are not implemented. Provider and event review uses administrator SQL rather than an admin console.
- Feed snapshots are shared through Supabase; source-health diagnostics are worker-local. The initial scheduled batch is deliberately small and does not guarantee fresh coverage for every event.
- No hosted credentials, database migrations, paid feeds or production deployments were activated as part of this implementation.

## Main code areas

| Area | Location |
|---|---|
| Discovery | `src/components/discovery` |
| Globe and event scene | `src/components/globe`, `src/components/panels` |
| Accounts and circles | `src/components/community`, `src/app/account`, `src/app/community` |
| Partner studio | `src/app/partners` |
| Auth and access policies | `src/lib/platform`, `supabase/migrations` |
| Calendar and feed adapters | `src/lib/data`, `src/app/api` |
| Ranking and date controls | `src/lib/buzz`, `src/lib/selectors`, `src/components/timeline` |
