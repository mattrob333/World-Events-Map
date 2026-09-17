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

The first implementation of that idea lives in the **Constellation** experience. It visualizes people, interests and circles as a navigable 3D affinity graph and lets a member switch between travel modes to change the graph.

## What is implemented

The current codebase includes:

- Responsive 3D globe discovery with searchable Pulse, Now and future-date planning.
- Curated event calendar plus optional external signal enrichment.
- Supabase email sign-in and private-by-default member profiles.
- Saved events, travel circles, host approval and private circle chat.
- Partner applications, approved offers, event submissions and traveler inquiries.
- Server-side demand enrichment with durable snapshots and scheduled refresh.
- A transparent buzz model with named signals and documented weights.
- Affinity graph foundation: travel modes, weighted interests, context-aware matching and the Constellation explorer.
- CI covering lint, TypeScript, dataset validation, tests, SQL/RLS execution and production build.

## Run locally

Node 24 and npm 10+ are recommended.

```sh
npm ci
npm run dev -- --hostname localhost --port 3127
```

Open `http://localhost:3127`.

Without credentials, the curated event discovery experience still works. Account-backed member, affinity and partner features require Supabase.

## Supabase

Copy `.env.example` to `.env.local`, then apply migrations in order:

1. `supabase/migrations/001_platform.sql`
2. `supabase/migrations/002_live_signals.sql`
3. `supabase/migrations/003_affinity_graph.sql`

Set:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Read [docs/LIVE-SETUP.md](docs/LIVE-SETUP.md) for external feed configuration.

## Main routes

| Route | Purpose |
|---|---|
| `/` | PULSE: event discovery and globe |
| `/constellation` | affinity graph and travel-mode explorer |
| `/community` | circles and partner opportunities |
| `/account` | profile, home base, interests and travel modes |
| `/partners` | provider application and offer studio |

## Development docs

Start here:

- [Product direction](docs/PRODUCT.md)
- [System architecture](docs/ARCHITECTURE.md)
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
- Partner offers create inquiries, not confirmed reservations or inventory locks.
- Charter calculations are planning estimates, not quotes.
- Member discovery is opt-in. Profiles remain private by default.
- Travel modes can remain private even when a profile is visible.
- MERIDIAN never invents live members, bookings or partner availability in real mode.
- External aviation and venue providers are adapters, not assumptions baked into the product model.

## Near-term build order

1. Finish the affinity and Constellation foundation.
2. Make travel modes first-class throughout circle discovery.
3. Add the NOW decision-engine adapter layer for BestTime and TypeSafe/Jev.
4. Add an aviation opportunity provider interface, then qualify Avinode or broker integrations behind it.
5. Feed outcome signals back into affinity so recommendations improve from actual behavior instead of profile copy alone.

MERIDIAN should answer five questions better than a collection of disconnected travel apps:

**Where should I go? Who should I go with? How should we get there? Where should we stay? What should we do right now?**
