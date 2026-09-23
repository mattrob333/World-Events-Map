# Living World

Merged to `main` in PR #16 (from `feat/meridian-living-world`).

Combines the existing travel OS screens with Travel Wire and a connected world / scene / ideas discovery experience. Vercel builds a preview for each pull request, protected by Vercel Authentication. The provider-backed parts below are not yet activated in any production deployment.

## Try it

Run `npm run dev -- --hostname localhost --port 3127`.

- Explore region buttons above the globe; select a marker to fly closer and open its briefing.
- Choose an origin city (or grant browser location), then tap a photographic shortlist card. The page travels to the globe and draws a flight path from your labeled position to the selected place. The distance and airtime are indicative estimates, not a flight search.
- The opening globe is deliberately cropped for a closer view. Drag to orbit and scroll or pinch to zoom; wheel scrolling returns to the page at the zoom limits.
- Hover a marker to open a stable, interactive photo preview. Enter the card before its 350ms exit delay; use the gallery arrows or swipe.
- Photo galleries appear on event briefings, destination pages and editorial scene cards.
- Open a neighborhood map or follow the Street View link. Ski locations also offer official Google Maps satellite and terrain links from the globe story and destination page. Those links show an approximate destination area, not verified lift or snow conditions; this is not native photorealistic globe zoom. See [MOUNTAIN-EXPLORER.md](MOUNTAIN-EXPLORER.md) for a future licensed terrain-map path.
- Filter The Scene by interest, select a scene for its public posts, save an idea, or opt into the editorial replay.
- Travel Wire shows the existing source observations; empty provider responses remain empty.
- Travel ideas explain their curated evidence and support local Save / Watch / Circle handoffs.
- Choose Winter to switch the hero, cards, ticker, globe story, crystal ski markers and modeled shortlist to ski occasions. Other seasons and interests change the corresponding curated places. The snow outlook links to official reports; it does not claim to have current snow depth or forecasts.
- From Winter, open the family ski starter in Trips. It gathers a brief for comparing the Colorado Rockies and Swiss Alps and explains the membership-gated Circle handoff. On this preview, creation is disabled because Supabase membership is not connected.
- Open NOW to see the local-decision flow. Location and live search stay off on this preview because its venue provider and private budget store are unconfigured.

## Data boundaries

Photos are retrieved from the Wikimedia Commons public API with exact-host URL checks, plain-text metadata, attribution, licenses, dates when available, bounded caching, request timeouts and in-flight deduplication. Event archive imagery and place imagery are separately labeled. Photos are historical; they are not current social posts. Coverage varies by event.

The Scene is an authored editorial feed drawn from the event catalog. Replay rotates existing editorial cards; it does not simulate live people. Public X text posts use the existing read-only scene-posts endpoint and only appear if the configured scheduler has supplied recent data. The UI distinguishes no recent source check from a checked source with no posts. Two static illustrative travel collages were generated for the hero and shortlist; they are explicitly labeled as illustrations and are not live social imagery.

The Research Pulse reads a stored feed; opening a page does not trigger paid searches. Its Exa, Treg, and TypeSafe Jev pipeline, daily Vercel cron, and Supabase migration are implemented but not activated on the preview. It shows an explicit awaiting-setup state, with no synthetic social activity, deals, prices, or seats. See [RESEARCH-PIPELINE.md](RESEARCH-PIPELINE.md) for collection limits and source-verification boundaries and [FAMILY-SKI-FLOW.md](FAMILY-SKI-FLOW.md) for the staged planning flow.

Ideas are deterministic curated recommendations filtered by an explicit interest choice. Watch is a device-local return list with no push notification service. Save activity reflects this browser's intent store, not other travelers.

## Validation

Before merge, `npm run gate` passed (lint with no errors, TypeScript, dataset validation, Vitest and a production build). Browser checks covered Atlanta → Kyoto, Winter mode → Aspen, the family ski starter, NOW's honest unavailable state, the winter globe legend and the hosted satellite/terrain handoff. A targeted privacy review found the account-switch race closed; hosted multi-account acceptance, provider-backed feeds, live snow, lodging availability, supplier quotes, and production cron remain unverified.

The embedded OpenStreetMap view depends on the external site and browser embedding support; a direct map link is available. Provider-backed social posts and real-time readings need their existing configured services before they can be accepted as live.

## Open follow-ups from the merge review

Release reviews of the merged diff found no blocking issues. These were deferred for an owner or product decision:

- **Manual takedowns (research).** A sweep upserts research items by ID and overwrites `decision`, so a row set to `reject` by hand can be republished if the same URL returns. This needs a reviewer-lock column, which means a migration. Fix it before an operator starts moderating the feed.
- **Social handles and captions (research).** Treg items publish usernames and up to 260 characters of caption from hashtag and search results, which can include private individuals. Decide on author display and reuse rights before enabling `TREG_TOKEN` in production.
- **Circle dates visibility (trips).** The public circle row created by the family ski starter shows travel dates to signed-in members. This is disclosed in the UI; product should confirm it is intended.
- **Remaining lint warnings.** About 40 React hooks warnings (set-state-in-effect, refs/immutability in the globe camera and beacon field) change render behavior when fixed. `useViewerLocation` handles location and needs a high-capability review.
