# MERIDIAN

**Know where the world is gathering. Find your people. Know what to do next.**

MERIDIAN is a social travel intelligence platform. It starts with real-world event demand, connects travelers through context-aware affinity, helps groups form around trips, and becomes a local decision engine after arrival.

The product is organized around four surfaces:

1. **PULSE** - where the world is gathering and which events are heating up.
2. **CIRCLES** - who is relevant to this trip, not just who looks similar on a static profile.
3. **ACCESS** - partner opportunities for stays, aviation, access, transportation and experiences.
4. **NOW** - the day-of decision engine for answering "where should we go right now?"

The core thesis is simple: travel recommendations get dramatically better when MERIDIAN understands the event, the trip context, the people involved, the available opportunities and the current local conditions at the same time.

## Product architecture

MERIDIAN joins three graphs:

- **World Graph**: events, cities, buzz, venues, seasons and live demand signals.
- **People Graph**: members, travel modes, interests, home bases, circles and relationships.
- **Opportunity Graph**: stays, flights, empty legs, access, venues and partner inventory.

A person does not have one permanent traveler identity. The same member can have a Family Ski mode, Solo Weekend mode, Work Layover mode and Couples mode. Matching is therefore trip-contextual, not profile-global.

The first People Graph interface is **Constellation**, a navigable 3D affinity graph that reorganizes around the member's active Travel Mode.

The first Opportunity decision interface is **NOW**, which combines provider facts, hard constraints and optional structured judgment to return three distinct choices instead of a search-results directory.

## What is implemented

The current codebase includes:

- Responsive 3D globe discovery with searchable Pulse and future-date planning.
- Curated event calendar plus optional external signal enrichment.
- Supabase email sign-in and private-by-default member profiles.
- Saved events, travel circles, host approval and private circle chat.
- Partner applications, approved offers, event submissions and traveler inquiries.
- Server-side demand enrichment with durable snapshots and scheduled refresh.
- A transparent buzz model with named signals and documented weights.
- Affinity graph foundation: Travel Modes, weighted interests, context-aware matching and the Constellation explorer.
- NOW decision engine with browser-location input, hard deterministic filters, Best Match / Most Alive / Wildcard selection and Travel Mode context.
- Provider-neutral interfaces for venue facts, structured judgment and aviation opportunities.
- BestTime venue-facts adapter and TypeSafe/Jev structured-judgment adapter, both server-only.
- Durable Postgres accounting for NOW paid-provider calls so serverless scale-out cannot mint additional budget.
- Graceful deterministic NOW fallback when the optional judgment provider is unavailable.
- CI covering lint, TypeScript, dataset validation, tests, SQL/RLS execution and production build.

## Run locally

Node 24 and npm 10+ are recommended.

```sh
npm ci
npm run dev -- --hostname localhost --port 3127
```

Open `http://localhost:3127`.

Without credentials, the curated event discovery experience still works. Account-backed member, affinity and partner features require Supabase. Live NOW venue intelligence requires a BestTime private API key plus durable Supabase provider accounting.

## Supabase

Copy `.env.example` to `.env.local`, then apply migrations in order:

1. `supabase/migrations/001_platform.sql`
2. `supabase/migrations/002_live_signals.sql`
3. `supabase/migrations/003_affinity_graph.sql`
4. `supabase/migrations/004_now_provider_budget.sql`

Set:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The service-role key stays server-only. NOW deliberately fails closed if the durable provider-budget function is unavailable rather than exposing unbounded paid API calls.

Read [docs/LIVE-SETUP.md](docs/LIVE-SETUP.md) for external feed configuration.

## NOW providers

The first live NOW stack uses server-only credentials:

```text
BESTTIME_API_KEY_PRIVATE=
TYPESAFE_API_KEY=
TYPESAFE_MODEL=jev-latest
```

BestTime supplies venue and foot-traffic facts. TypeSafe/Jev is optional and supplies contextual judgment. When TypeSafe is absent or fails, MERIDIAN falls back to its deterministic ranking model rather than failing the request.

Read [docs/NOW-ENGINE.md](docs/NOW-ENGINE.md) for the full pipeline, privacy rules and provider boundaries.

## Main routes

| Route | Purpose |
|---|---|
| `/` | PULSE: event discovery and globe |
| `/now` | NOW: day-of local decision engine |
| `/constellation` | affinity graph and Travel Mode explorer |
| `/community` | circles and partner opportunities |
| `/account` | profile, home base, interests and Travel Modes |
| `/partners` | provider application and offer studio |

## Development docs

Start here:

- [Product direction](docs/PRODUCT.md)
- [System architecture](docs/ARCHITECTURE.md)
- [NOW engine](docs/NOW-ENGINE.md)
- [Developer log](docs/DEVLOG.md)
- [Repo wiki index](docs/wiki/README.md)
- [Affinity graph model](docs/wiki/AFFINITY-GRAPH.md)
- [Live feed setup](docs/LIVE-SETUP.md)
- [Partner setup](docs/partner-setup.md)

## Validation

```sh
npm run gate
```

`npm run gate` runs lint, TypeScript, data validation, tests and the production build.

## Product boundaries

- Event buzz is modeled demand, not live attendance.
- Expected foot traffic is not labeled as live busyness.
- Partner offers create inquiries, not confirmed reservations or inventory locks.
- Charter calculations are planning estimates, not quotes.
- Member discovery is opt-in. Profiles remain private by default.
- Travel Modes can remain private even when a profile is visible.
- Precise current location is used for a NOW request but is not written into the People Graph.
- MERIDIAN never invents live members, bookings or partner availability in real mode.
- External aviation, venue and judgment providers are adapters, not assumptions baked into the product model.

## Near-term build order

1. Exercise NOW against real BestTime and TypeSafe credentials in multiple cities and layover scenarios.
2. Build first-class public traveler profiles and route Constellation/Circle identity through them.
3. Add Circle anticipation/research boards for YouTube, Instagram links, articles, places and collaborative trip inspiration.
4. Add outcome events such as opened-in-maps, went, skipped and saved so ranking can learn from behavior.
5. Add travel-time constraints to NOW so a hard return-by time includes transit, not just venue dwell time.
6. Qualify Avinode or broker integrations behind the existing aviation opportunity interface.

MERIDIAN should answer five questions better than a collection of disconnected travel apps:

**Where should I go? Who should I go with? How should we get there? Where should we stay? What should we do right now?**
