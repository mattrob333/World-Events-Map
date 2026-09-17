# Social travel implementation

## Delivered

The globe opens with an editorial spotlight, a dominant scene beacon, visible next actions, curated activity and an opportunity feed. Now uses destination-local dates; future planning remains separate. Search, date changes, event links, mobile layouts and a no-WebGL fallback support discovery.

Supabase-backed accounts, private-by-default profiles, saves, circles, host approval, member-only chat, partner verification, offer publication, event submissions and inquiry replies form the first functional marketplace loop. Approved submitted events appear on the map. Requests do not claim to reserve inventory.

The client now reads server enrichment rather than remaining fixed on the bundled baseline. Signal-only changes invalidate rankings. Shared snapshots, expiring caches, a globally leased scheduler and public read-only endpoints keep vendor traffic independent of visitor counts. Optional X scene posts preserve author, timestamp and source link. Public source failures do not expose credential-bearing URLs or vendor response bodies.

## Verification performed

- `npm run gate`: lint, TypeScript, curated-data validation, tests and production build passed.
- Final test suite: **112 tests across 19 files passed**.
- SQL/RLS tests execute both migrations in embedded PostgreSQL/PGlite with mocked Supabase authentication roles. They cover private profile reads, provider self-approval rejection, event moderation, publication, inquiry isolation, membership approval/capacity/revocation, private messages, geographic validation, private signal storage and the global refresh lease.
- Production browser checks at 1440×1000 and 390×844 passed: spotlight selection, neighborhood map opening, future date selection, Now reset, empty search/recovery, saved-event deep links, account/community/partner routes and no-WebGL discovery fallback.
- No JavaScript page errors during those browser flows. No horizontal overflow at tested widths. Mobile scene panel stayed inside the viewport; discovery and subsequent content did not overlap.
- Production dependency audit: **0 vulnerabilities** after upgrading Next.js to 16.3.5.
- Curated-data validation retains 12 existing advisory warnings; ESLint retains existing advisory warnings plus async data-loading effect warnings. No gate errors.

## Not verified or activated

No production deployment, hosted database migration, account provisioning, paid API activation or outbound outreach was performed. Hosted magic-link delivery, real two-device Supabase round trips and vendor-entitled responses require the owner's credentials. SQL tests verify database behavior locally, not the configured hosted environment.

This release has an inquiry marketplace, not transactional reservations. Operator inventory holds, payments, full itinerary fulfillment, push/email response notifications and an administrator web console are not implemented. Provider/event moderation currently uses administrator SQL. The neighborhood map is approximate, not verified door-level navigation.

The initial scheduler batch is intentionally capped at two events per ten-minute lease; freshness coverage is partial. Worker-local source diagnostics and persisted snapshot freshness are distinct. Future calendar dates and inferred demand should be confirmed with organizers.

## Setup

Use [LIVE-SETUP.md](LIVE-SETUP.md) for exact environment names, official provider links, migration order, auth configuration and scheduler activation. [Partner setup](partner-setup.md) covers approval and the hosted acceptance exercise.
