# MERIDIAN Developer Log

This file records product and architecture decisions that are easy to lose across agent sessions.

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
