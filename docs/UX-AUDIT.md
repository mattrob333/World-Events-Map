# MERIDIAN UX Audit

Inspected against `main` at `1552d95` (location-first World Pulse merged) on 19 Sep 2026.

This audit is the overnight sprint's source of truth. It records what is actually in the repository, not what the product copy claims.

## Current routes

| Route | What a traveler sees | Visual family |
|---|---|---|
| `/` | World Pulse globe, Near You / World Heat, event dossier overlay | Discovery CSS (`discovery.module.css`) — cinematic, custom |
| `/now` | Day-of local decision engine | Dedicated NOW surface |
| `/constellation` | 3D affinity graph | Constellation CSS — separate palette |
| `/community` | Circles CRUD, partner offers tab, inline chat | Platform CSS (`community.module.css`) — beige/gold cards, rounded 14px |
| `/account` | Profile as a settings form | Same platform CSS |
| `/partners` | Provider application + offer forms | `studio.module.css` — form-heavy studio |

Missing as first-class routes:

- `/destinations/[slug]`
- `/circles/[id]` trip room
- `/people` and `/people/[handle]`
- `/trips`
- `/access` traveler marketplace
- `/welcome` onboarding
- global command overlay

## Navigation

There are two competing nav models.

1. **World Pulse header** (`DiscoveryExperience`): Pulse / Plan a trip / Circles, plus partner and account links. No People, Trips, Access, NOW, or search overlay.
2. **PlatformShell**: Pulse / Now / Constellation / Travel circles / Your profile / For partners. Different labels, different order, different chrome.

The globe TopBar is letterhead (clocks + date), not product navigation. Community, account, constellation, NOW, and partners do not share a shell.

## Design system

A real token layer already exists:

- `src/app/globals.css` `@theme` — void/obsidian/ink/brass/heat/signal
- `src/components/ui/tokens.ts` — typed heat, dates, motion
- primitives: Button, Chip, Panel, Sheet, Skeleton, EmptyState, Field, Heat

Platform pages ignore it. `community.module.css` and `studio.module.css` invent their own surfaces, radii, and gold. That is the main reason MERIDIAN still feels like several demos.

Do not replace the token layer. Extend it. Route every new surface through tokens and `components/ui`.

## World / Destination

World Pulse already answers “near me” and “world heat” using event buzz. Selecting a place opens `EventDossier` (an event briefing), not a destination.

There is no destination object in the UX. Cities exist only as event fields. Heat is event-scored. That matches Gap B and Gap C in the sprint plan.

Honest constraints already in the UI:

- Rankings are modeled, not live attendance
- Location is ephemeral launch context
- Globe does not trap page scroll (PR #10)

## Circles

Implemented: create, join request, host accept, chat.

Missing: destination-specific Trip Room, inspiration board, plan buckets, contextual Access, countdown, Must Do voting. Circles currently feel like a chat room attached to a form.

## Profiles / People

`/account` is a membership form (home city, interests, travel modes). Constellation is a graph, not a people directory.

**PR #8** (`feat/meridian-profile-identity`) has the right product shape (public `/people/[handle]`, directory, themes, connections) and must not be merged in this sprint.

Unresolved review findings (Codex, unresolved):

1. Authenticated direct-read bypass of home-field visibility (`005_profile_identity.sql`)
2. Arbitrary remote image tracking via `hero_url` / `avatar_url`
3. Branded social-link hostname validation
4. Missing index for public directory ordering
5. Unbounded public profile payload size
6. Declined connection can be deleted and immediately retried

Sprint decision: **frontend-only identity surfaces**, generated avatars, editorial/fixture portraits labeled as such. No migrations from PR #8.

## ACCESS

Partner offers exist as a community tab and a provider studio. Travelers are sent into a generic list. Offers are inquiry-first (`availability: request | provider_updated`) — keep that semantics.

Missing: opportunity cards on destination pages, trip rooms, and a traveler-facing `/access` feed.

## Onboarding / intent / search

No first-run journey. Save exists for events (`EventSaveButton`) but not as a shared Save / Watch / I'd Go / Start Circle vocabulary. Search is a local filter on the homepage, not a global overlay.

## Open issues

| # | Title | Sprint relevance |
|---|---|---|
| 9 | Location-first World Pulse dashboard | Partially shipped on main; destination page still missing |
| 7 | Cost-aware agent workflow | Followed: cheap UI agents, strong review, no unattended RLS |
| 6 | Anticipation layer for Circles and destinations | Core of this sprint (Inspiration board) |
| 5 | First-class traveler profiles | Visual direction only; PR #8 stays unmerged |

## Product risks to carry through the sprint

- Do not label modeled buzz, seasonal calendar context, or fixture boards as live.
- Do not invent members, inventory, or confirmed bookings.
- Do not hotlink member-controlled remote images.
- Do not add paid vendors.
- Do not rewrite the Three.js globe architecture for style.
- Keep precise location ephemeral.

## Highest-leverage work

1. One app shell and one action vocabulary
2. Destination as a first-class page, derived from curated events
3. Circle → Trip Room with fixture inspiration
4. Traveler ACCESS cards in destination and trip context
5. Fixture people identity that does not fight PR #8
6. Short skippable onboarding
7. Command search over local + fixture data
