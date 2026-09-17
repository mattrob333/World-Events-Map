# MERIDIAN Developer Log

This file records product and architecture decisions that are easy to lose across agent sessions.

## 2026-09-17 - NOW production hardening and cost discipline

### Durable paid-provider accounting

A process-local "global" provider quota is not global on a serverless host. Multiple Vercel isolates could each mint their own allowance, so the paid-provider ceiling has moved into Postgres.

`004_now_provider_budget.sql` owns an atomic shared ten-minute window for outbound BestTime/TypeSafe calls. Each real outbound paid-provider call claims one unit immediately before the provider request. Venue-cache hits do not consume budget. Required BestTime work fails closed if durable accounting is unavailable; optional TypeSafe judgment degrades to deterministic ranking instead.

The process-local limiter remains useful only as an early per-client abuse speed bump. It is not described as the spend ledger.

### NOW browser boundary

The public NOW route now requires same-origin `application/json`, streams and cancels request bodies above 20 KB, rejects malformed provider containers, and never exposes precise location as persistent profile data.

### Cost-aware agent workflow

MERIDIAN development now distinguishes three task classes in `AGENTS.md`:

- `CHEAP_OK` for bounded mechanical work
- `REVIEW_REQUIRED` for meaningful behavior changes
- `HIGH_CAPABILITY_ONLY` for architecture, migrations, RLS/auth, security, provider contracts and privacy-sensitive code

The goal is to use lower-cost coding agents for grunt work without handing them product or security authority. A high-capability integrated review remains required. Astra is the preferred senior release reviewer when it is actually available in the orchestration environment. GitHub/Codex review remains an independent second opinion. No workflow may claim Astra reviewed a change when that review did not run.

## 2026-09-17 - Productionization and identity direction

### Merge strategy

The affinity branch now supersedes the original social-travel PR and should land as the first consolidated MERIDIAN product baseline on `main` after CI passes. This avoids temporarily shipping review findings from the older branch that are already corrected here.

### Reliability fixes before main

Codex review found two useful edge cases and both were addressed before merge:

1. Undated Travel Modes could create undated Circles, while the legacy Circle list assumed dates always existed. New Circle writes now require both start and end dates at the database boundary. Travel Modes may remain aspirational and undated.
2. A second-step travel-mode interest insert could fail after the mode row had already committed. The editor now validates each interest before persistence and rolls the newly created mode back if interest persistence still fails.

### Profile is now a first-class product surface

The member profile is no longer treated as a small Settings form. The next product slice will turn it into a public, customizable traveler identity that members can be proud to build and share.

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
