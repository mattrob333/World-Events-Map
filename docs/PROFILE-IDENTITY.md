# MERIDIAN Profile Identity

## Product rule

A MERIDIAN Profile is the canonical person-level social identity. It should feel authored and worth sharing, not like a settings record.

Three concepts stay deliberately separate:

- **Profile**: who the member is across trips.
- **Travel Mode**: the version of that member relevant to a particular kind of trip.
- **Circle**: a shared trip relationship and collaboration space.

Publishing one never implicitly publishes the others.

## Public profile route

Canonical public identity lives at:

```text
/people/[handle]
```

Handles are normalized to lowercase and must be unique. Reserved application names cannot be claimed.

## First-class identity surface

The initial profile includes:

- cover/hero image URL
- avatar image URL
- display name and `@handle`
- travel philosophy/tagline
- bio
- coarse home city with independent visibility
- home airport with independent visibility
- broad interests
- controlled theme and accent choices
- featured public Travel Modes
- favorite places
- Instagram, YouTube, website, and other canonical links
- person-to-person connection state

Customization is structured. MERIDIAN does not accept arbitrary member HTML, CSS, or JavaScript.

## Privacy model

Profiles are private by default.

A public profile payload is assembled through the security-definer RPC `get_public_traveler_profile(handle)`. Anonymous viewers can execute that function but do not receive direct SELECT permission on `profiles`, `profile_links`, `profile_places`, or Travel Mode tables.

The public RPC includes only:

- a profile whose `is_public` flag is true
- home city when `show_home_city` is true
- home airport when `show_home_airport` is true
- profile links whose visibility is `public`
- profile places whose visibility is `public`
- Travel Modes that are both `discoverable` and explicitly `is_featured`

Private Travel Modes, private Circle details, email, and precise current location are never profile content.

## Traveler connections

`profile_connections` is the first person-to-person relationship primitive. It is independent of Circle membership.

A connection begins as a request from one member to another. Only the addressee can accept or decline the pending request. Either participant can later remove the relationship.

Connections are visible only to their participants under RLS.

A one-way follow model can be added later if MERIDIAN develops creator dynamics. The initial relationship stays closer to `people I may actually travel with` than a follower-count system.

## Featured Travel Modes

Travel Modes remain contextual and privacy-sensitive.

A member must make a mode discoverable before it can be useful to other members. Even then, it does not appear on the public Profile unless the member separately selects **Feature on profile**.

This two-step rule prevents a discoverability choice from silently becoming a public-profile publishing choice.

## Media

The first slice accepts HTTPS URLs for avatar and cover imagery. Native media upload is intentionally deferred until storage limits, deletion semantics, content moderation, and abuse controls are defined.

External Instagram and YouTube links remain canonical third-party links. MERIDIAN does not mirror their media into its own storage in this profile slice.

## Migrations

Profile identity requires:

```text
005_profile_identity.sql
006_profile_connections.sql
```

Run them after the existing platform and affinity migrations.

## Next profile work

1. Route Constellation person nodes and Circle member names into `/people/[handle]`.
2. Add mutual-context explanations to public profiles.
3. Add module ordering controls to the editor.
4. Add safe native media upload with moderation/deletion rules.
5. Add published trip highlights and selected memories.
6. Connect profile identity to the future Circle anticipation layer.
