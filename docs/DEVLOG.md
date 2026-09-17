# MERIDIAN Developer Log

This file records product and architecture decisions that are easy to lose across agent sessions.

## 2026-09-17 - NOW vertical slice

### Why NOW is the next build

The World Graph and People Graph are now substantial enough that MERIDIAN needs a repeat-use travel-day workflow, not only long-range event discovery. NOW is the first Opportunity Graph decision surface.

It answers one narrow question:

`Where should I go right now?`

The output is intentionally small:

- Best Match
- Most Alive
- Wildcard

### Facts, constraints and judgment are separate

NOW is deliberately not implemented as one model prompt.

The request pipeline is:

1. Retrieve current venue facts through a `VenueFactsProvider`.
2. Apply deterministic hard constraints in MERIDIAN code.
3. Compute an inspectable MERIDIAN baseline score.
4. Optionally ask a `JudgmentProvider` several atomic questions.
5. Blend contextual judgment with the deterministic baseline.
6. Select three differentiated actions.

This prevents a judgment model from overriding explicit radius, price, time or known-closed constraints.

### First providers

- BestTime is the first `VenueFactsProvider` adapter.
- TypeSafe/Jev is the first `JudgmentProvider` adapter.
- TypeSafe remains optional; failure falls back to deterministic ranking.
- BestTime is required for the first live venue implementation. Missing/failing facts do not become fake venues.

Expected/current-hour BestTime traffic remains labeled expected. Opening-hour information is interpreted conservatively at current-hour resolution because the filter response supplies the local hour rather than an exact local minute.

### Privacy decision

Precise device location is ephemeral request context for NOW. It is not persisted to the profile or Travel Mode tables and does not become a discoverable People Graph edge.

### Cost and abuse controls

The first slice includes:

- bounded request body
- input validation
- provider timeouts
- provider-neutral parsing
- five-minute warm-instance venue cache
- per-client warm-instance rate limit
- global warm-instance provider-call guard

These are not a substitute for durable distributed rate accounting before broad anonymous traffic.

### Production rule

The code can ship before provider credentials are configured because it fails closed and does not fabricate results. It should not be marketed as live until credentialed BestTime and TypeSafe payloads have been exercised in multiple cities and the provider cost envelope is understood.

## 2026-09-17 - Productionization and identity direction

### Merge strategy

The social-travel and affinity/Constellation work was consolidated onto `main` instead of leaving stacked experimental PRs. A follow-up hardening PR then moved Travel Mode creation to a single PostgreSQL transaction and kept Circle date integrity at the database boundary.

`main` is now treated as a releasable product baseline. Material work should branch from it and return through reviewed PRs.

### Reliability fixes before continuing feature work

Codex review found two useful edge cases and both were addressed at the persistence boundary:

1. Undated Travel Modes could create undated Circles, while the legacy Circle list assumed dates always existed. New Circle writes now require both start and end dates at the database boundary. Travel Modes may remain aspirational and undated.
2. A second-step Travel Mode interest insert could fail after the mode row had already committed. Travel Mode creation now runs through `create_travel_mode(...)`, a single PostgreSQL transaction that validates and commits the mode plus its interests together or rolls the entire action back.

### Profile is now a first-class product surface

The member profile is no longer treated as a small Settings form. A future product slice should turn it into a public, customizable traveler identity that members can be proud to build and share.

Working principles:

- public profile handle and shareable route
- expressive hero / identity area rather than a utility form
- travel modes, interests, home base and travel style as visible identity
- favorite places, bucket list and travel history
- external social links such as Instagram and YouTube
- traveler media/highlights with attribution and user-controlled visibility
- profile completeness/onboarding that rewards thoughtful setup rather than one-click emptiness
- privacy controls remain granular and opt-in

### Anticipation is part of the trip

MERIDIAN should model the pre-trip excitement loop as a product, not incidental chat.

A destination or Circle should be able to collect and discuss inspiration such as:

- YouTube destination videos
- Instagram posts/reels shared by URL or connected account where platform permissions allow
- restaurants and venue links
- articles and local guides
- saved MERIDIAN events/places
- personal notes and recommendations

The Circle becomes a shared hype board before departure, the coordination space during the trip, and later a memory surface after the trip.

This extends the lifecycle to:

`IDENTITY -> ANTICIPATION -> CIRCLE -> TRIP -> NOW -> MEMORIES`

External media should be linked/embedded with attribution. MERIDIAN should not copy third-party media into its own storage unless rights and platform terms explicitly allow it.

## 2026-09-17 - Affinity graph workstream

### Starting point

This branch was created from `feat/meridian-social-travel` at commit `7e7ea31cb28f0dbf0762910e8647f61e5e92704c`.

The inherited branch already included:

- responsive event discovery
- Supabase authentication
- member profiles and saved events
- travel circles and private chat
- partner applications and offers
- provider event submissions
- live signal refresh infrastructure
- mobile and desktop validation

### Review findings inherited from PR #1

Two P2 review findings need to remain visible during this workstream:

1. Charter estimates must not appear personalized in real mode while the source airport still comes from the legacy demo member.
2. An approved provider event is editorially approved, not proof that current inventory or availability is confirmed.

This branch fixes both before building new social graph features.

### Product decision

MERIDIAN is now defined as four connected surfaces:

- PULSE
- CIRCLES
- ACCESS
- NOW

The user model moves from one static identity to many contextual Travel Modes.

### Architecture decision

Keep PostgreSQL/Supabase as the source of truth for the first People Graph implementation. Add explicit travel-mode and relationship semantics before considering Neo4j.

Reasons:

- current infrastructure is already Supabase-backed
- first-order matching is simple enough for indexed relational queries
- a second database would add synchronization and operational cost before graph traversal is proven to be a bottleneck

### First build slice

The first slice contains:

- `003_affinity_graph.sql`
- Travel Mode data model and RLS
- deterministic affinity scoring
- Constellation 3D explorer
- profile/home-airport improvements
- travel-mode editor
- circle creation from an active travel lens
- new product/architecture/wiki docs

### Provider direction

External travel services must be adapters.

Planned interfaces:

- venue facts provider, with BestTime as a candidate adapter
- structured judgment provider, with TypeSafe/Jev as a candidate adapter
- aviation opportunity provider, with Avinode as a candidate adapter

No vendor should define MERIDIAN's internal data model.
