# MERIDIAN

**Know where the world is gathering. Find your people. Make the whole trip better.**

MERIDIAN is a social travel intelligence platform built around the entire emotional lifecycle of a trip, not just the transaction in the middle.

The product loop is:

**IDENTITY → ANTICIPATION → CIRCLE → TRIP → NOW → MEMORIES**

MERIDIAN should help someone build a traveler identity they are proud to share, discover what is pulling attention around the world, find the right people for a specific trip, get excited together before departure, access relevant travel opportunities, make better day-of decisions after arrival, and carry the story forward afterward.

## Core product surfaces

1. **PROFILE** - a first-class traveler identity, not a settings form.
2. **PULSE** - where the world is gathering and which events are heating up.
3. **CONSTELLATION / CIRCLES** - who is relevant to this trip, not just who resembles a static profile.
4. **HYPEBOARD** - the shared pre-trip rabbit hole for videos, places, photos, guides and ideas.
5. **ACCESS** - partner opportunities for stays, aviation, access, transportation and experiences.
6. **NOW** - the day-of decision engine for answering “where should we go right now?”

The core thesis is simple: travel recommendations get dramatically better when MERIDIAN understands the traveler, the trip context, the people involved, the event, the available opportunities and the current local conditions at the same time.

## Product architecture

MERIDIAN joins three graphs:

- **World Graph**: events, cities, buzz, venues, seasons, destination content and live demand signals.
- **People Graph**: members, traveler profiles, Travel Modes, interests, home bases, Circles and relationships.
- **Opportunity Graph**: stays, flights, empty legs, access, venues and partner inventory.

A person does not have one permanent traveler identity. The same member can have a Family Ski mode, Solo Weekend mode, Work Layover mode and Couples mode. Matching is trip-contextual, not profile-global.

The **Constellation** experience visualizes people, interests and Circles as a navigable 3D affinity graph. The **Hypeboard** gives each accepted Circle a durable place to collect and discuss the content that builds anticipation before departure.

## What is implemented

The current codebase includes:

- Responsive 3D globe discovery with searchable Pulse, Now and future-date planning.
- Curated event calendar plus optional external signal enrichment.
- Supabase email sign-in and private-by-default member identity.
- First-class traveler profile studio with handle, headline, theme, home base privacy, interests, social links, places shelf and travel wall.
- Shareable public traveler profiles exposed through a narrow privacy-aware RPC rather than direct anonymous table access.
- Travel Modes, weighted interests, context-aware affinity scoring and the Constellation explorer.
- Saved events, Travel Circles, host approval and private circle chat.
- Circle Hypeboards for attributed YouTube, Instagram, image and web links.
- Partner applications, approved offers, event submissions and traveler inquiries.
- Provider-neutral contracts for venue facts, structured judgment and aviation opportunities.
- Server-side demand enrichment with durable snapshots and scheduled refresh.
- A transparent buzz model with named signals and documented weights.
- CI covering lint, TypeScript, dataset validation, tests, SQL/RLS execution and production build.

## Run locally

Node 24 and npm 10+ are recommended.

```sh
npm ci
npm run dev -- --hostname localhost --port 3127
```

Open `http://localhost:3127`.

Without credentials, curated event discovery still works. Member, profile, affinity, Circle, Hypeboard and partner features require Supabase.

## Supabase

Copy `.env.example` to `.env.local`, then apply migrations in order:

1. `supabase/migrations/001_platform.sql`
2. `supabase/migrations/002_live_signals.sql`
3. `supabase/migrations/003_affinity_graph.sql`
4. `supabase/migrations/004_traveler_profiles_and_inspiration.sql`

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
| `/profile` | first-class traveler profile studio |
| `/traveler/[handle]` | shareable public traveler profile |
| `/constellation` | affinity graph and Travel Mode explorer |
| `/community` | Circles and partner opportunities |
| `/hype` | private Circle Hypeboards and pre-trip inspiration |
| `/account` | account details, saved events and Travel Modes |
| `/partners` | provider application and offer studio |

## External content policy

MERIDIAN stores attributed links and user-written notes, not copied third-party media. YouTube links can be rendered through the official embed player. Instagram, TikTok and generic web content initially remain attributed outbound links unless a platform-approved embed/integration is used. Personal Instagram feed importing should not be assumed: Meta ended the old consumer Basic Display API, so professional-account integrations and public-post embeds are separate future adapters.

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
- Member discovery is opt-in. Profiles remain private until deliberately published.
- Travel Modes can remain private even when a profile is visible.
- Precise current location is never a public profile attribute.
- MERIDIAN never invents live members, bookings or partner availability in real mode.
- External aviation, venue, judgment and media providers are adapters, not assumptions baked into the product model.

## Near-term build order

1. Harden Profile + Hypeboard through real-user onboarding and mobile testing.
2. Add destination inspiration search, starting with embeddable YouTube travel content and saved destination boards.
3. Make Travel Modes and Hypeboards first-class inside Circle detail flows.
4. Add the NOW decision-engine adapters for BestTime and TypeSafe/Jev.
5. Add aviation opportunities behind the provider contract, then qualify Avinode or broker integrations.
6. Feed outcomes back into affinity so recommendations improve from actual behavior instead of profile copy alone.

MERIDIAN should answer more than “where can I book something?” It should answer:

**Who am I as a traveler? Where should I go? Who should I go with? What should we get excited about? How should we get there? What should we do right now? What do we remember afterward?**
