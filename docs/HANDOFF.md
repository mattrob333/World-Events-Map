# dope.travel handoff

Read this first when picking up the work in a new session. Last updated 2026-09-24 (destination research landed).

## What we're building and for whom

dope.travel (repo still says MERIDIAN in places) plans trips that feel made for you: places worth being, your music and teams when you get there, and your crew along for it. **Right now it's for the owner, personally.** The goal is to make it genuinely useful and fun for him first, get it right, then open it to others. Optimize for "this is great for me" over scale, polish for strangers, or monetization.

The owner is on mobile a lot. Test every UI change at phone width (390×844) as well as desktop.

## Standing rules

- `main` is the current build: on 2026-09-24 the owner made this branch's work the new `main` (a fresh start, no users yet). Work on a `claude/…` branch, and merge to `main` only when he asks.
- Follow `AGENTS.md`: `npm run gate` must pass (lint, typecheck, tests, build). Provider truth: never invent venues, prices or listings; label sources and fetch times; show honest "not connected" states.
- Never print secrets, read `.env` files, or ask for keys in chat. Keys go in the environment settings (Claude) and the Vercel project (live site).
- **Look (owner feedback 2026-09-24):** the first rebrand hue-shifted every surface to warm brown, and he called it a saturation knob, not a design. The rule now: the base is a cool evening sky (the original navy near-blacks, bone ink, brass chrome), and the golden-hour gradient is used only for brand moments (the sun logo, trip heroes, one hype line). Never tint whole pages again. The header uses the one-piece lockup SVG (`public/brand/dope-travel-lockup.svg`) so ".travel" shares the wordmark's baseline.
- Brand voice: fun but premium, a hint of psychedelic. Never use the word "dope" in a sentence of copy, and no forced taglines like "Go somewhere dope."
- **Instagram and TikTok:** the owner approved pulling live posts through Treg for his personal use. Before opening the app to other people, revisit platform terms (see `docs/RESEARCH-PIPELINE.md`) and prefer links or embeds over re-hosting content.
- Don't spend paid APIs (OpenAI, Treg image generation) on anything he didn't ask for. Treg calls carry a per-call cost ceiling; keep it.

## What works today (commit 51953d3)

- **Profile (`/moodboard`):** ramble by voice or text, which is parsed into a bento-grid profile. Spotify import either by PKCE sign-in, or by pasting a public playlist link (server-side read). The music feeds a scene playbook (e.g. rock cover bands), a Jev persona, and a world map of shows.
- **Agent setup (`/api/mcp`, docs at `/agents`):** a stateless MCP server. It opens with the five-prompt ramble (an experience, how you travel, food, music, best moment on a trip). Tools:
  - Profile: `dope_profile_guide`, `dope_save_profile` (accepts `spotifyPlaylist`), `dope_read_playlist`.
  - Events: `dope_find_events`, `dope_trip_ideas`, `dope_live_music_scene`, `dope_curated_occasions`.
  - Trips: `dope_plan_trip` (returns a link that opens as the traveler's own trip), `dope_find_stays`.
- **Trips (`/trips/designer`):**
  - Plans for any typed-in place. `src/lib/designer/place.ts` generates search-backed idea cards shaped by the crew's food and music. Four curated destinations remain.
  - Day-by-day slots with drag, swipe and vote.
  - Stays: Airbnb, Vrbo and Booking.com search links sized to the party (`stays.ts`).
- **Share and join (`/trips/join`):** the trip and votes travel in the URL fragment (`tripShare.ts`, sanitized as untrusted input). Friends join, vote, and send a picks link back that merges into the organizer's copy. There is no live sync yet; that needs Supabase accounts.
- **NOW:**
  - During a trip, the canvas shows "Right now" (current and next pick) plus live music tonight.
  - `/now` has "For you" ideas for any city based on the profile.
  - BestTime venue scoring is still unconfigured.
- **Brand:** `/brand` page, SVG logos in `public/brand`. `npm run brand:assets` generates imagery with Treg image models. It has not run yet, and the `src/lib/brand/assets.json` manifest is empty.

- **Destination research (trip canvas, "{Place}, right now"):** live through Treg for any place, curated or typed-in. Tabs: Top spots, Hidden gems, Instagram, TikTok, Eat, Nights out, Tripadvisor, Yelp, Events, Flights. Code: `src/lib/research/destination.ts` (orchestrator, cap, cache), `destinationSources.ts` (parsers), `tregClient.ts` (shared Treg transport), route `POST /api/designer/research`, UI `src/components/designer/DestinationResearch.tsx`. Details under "Destination research" below.

## Keys

| Status | Key | Notes |
|---|---|---|
| Connected | `TYPESAFE_API_KEY` | Jev |
| Connected | `TREG_TOKEN` | Verified 2026-09-24 in the Claude environment. **Also add it to the Vercel project `world-events-map-onq7` (Preview + Production)** or the research panel says "not connected" there. |
| Connected | `OPENAI_API_KEY` | Voice (the Sun). Also needs **`VOICE_ENABLED=1`**; voice stays off without it. Put both in Vercel Preview only until the budget is durable (review S5). |
| Still needed | `ANTHROPIC_API_KEY` + `MERIDIAN_DESIGNER_AI=on` | AI parsing and curation |
| Still needed | `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` | Spotify |
| Still needed | `TICKETMASTER_API_KEY` | Event feed |
| Optional | `SEATGEEK_CLIENT_ID` | Second event feed |
| Still needed | `BESTTIME_API_KEY_PRIVATE` + Supabase keys | NOW |

## Agent-first work (2026-09-24)

See `docs/AGENTIC-PLAN.md` for the plan and its status.
- **Built:** the Sun voice concierge (server-side call setup, a hard time cap, and the caveman typing fallback); travel profiles with a header switcher; pick up where you left off; and a rotating pool of 35 hero photos, all licensed and credited.
- **Scaffolded:** The Wire's beats and story rules. The daily scout is specified in `docs/agents/daily-scout.md` but not running; it needs Anthropic/Supabase keys and a reviewed migration.
- New env vars:
  - `VOICE_ENABLED`, `VOICE_MAX_SECONDS`, `VOICE_DAILY_SESSIONS`, `VOICE_REALTIME_MODEL`.
  - `EXTRA_ALLOWED_ORIGINS`: comma-separated extra hosts, e.g. `www.` plus the apex domain.
- **Senior review (a Claude stand-in; Astra was not available and did not review):**
  - Blocking items fixed: B1, voice cost; B2, two ReDoS patterns in the profile parser.
  - Also fixed: S1–S4, S6, and the nits.
  - S5, a durable daily budget, is still an **open blocker for a public launch**. The caps are per instance.

## Where we are (end of 2026-09-24 session)

- **Source library (research only, not wired in):** 141 live feeds plus 57 dropped ones with reasons, in `docs/research/source-library-2026-09-24.json`.
- **Supabase project "dope.travel"** (ref `lkexkbygtdsunicqkrgd`, Canada Central). Migrations 001–006 were applied on 2026-09-24 with the owner watching.
  - `006_advisor_hardening.sql` closes the RPC surface of the trigger functions and the RLS helpers, wraps `auth.uid()` in `(select …)` in 22 policies, and adds 5 foreign-key indexes. It doesn't change any access rules. `src/lib/platform/__tests__/rls.test.ts` now runs against 001 + 003 + 006.
  - Advisor leftovers, all accepted:
    - `owns_provider` is still callable by anon, because the anon offer and event policies need it; for anon it always returns false.
    - 6 helpers are callable by signed-in users; each returns only a true/false about the caller.
    - The six `meridian_*` tables have RLS on with no policies (server-only by design).
    - Unused-index notices, expected on a new database.
    - The Auth connection-strategy notice.
- **Vercel connector:** it's scoped to project `takeoff-speed` only, so `world-events-map-onq7` returns 404. Until the connector is re-scoped, the owner sets env vars and redeploys by hand. Production serves `main`.
- **Before a public launch:** flip `robots: { index: false }` in `src/app/layout.tsx`, fix red-team clusters A and B, and turn off Vercel Authentication for Production. Until then keep `TREG_TOKEN`, `OPENAI_API_KEY` and `VOICE_ENABLED` off Production.
- **Mobile audit:** fixed in aa663c9. Remaining P1/P2 items:
  - home hero first on phones
  - /now CLS
  - a sticky CTA dock on the designer
  - 15px body copy
  - notices after the first action
  - profile switcher on phones
  - Fraunces subset
  - lazy globe on phones

## Next up, in order

1. ~~Verify Treg~~ Done 2026-09-24. Both pinned endpoints exist in the catalog and returned live data (Instagram $0.0015, TikTok $0.0007).
2. ~~Destination research for any place~~ First version done 2026-09-24; **get the owner's UI feedback on the preview** and iterate. Open ideas: "add to day" from a research card into a slot; use research spots as the idea cards themselves; venue-level Instagram is thin (venue hashtags are rarely used), so consider TikTok-only for venues.
3. **Brand imagery.** Run `npm run brand:assets` (a few cents per image, capped), review the results, and wire the good ones in.
4. **Personal end-to-end test.** Ask the owner for a real upcoming trip. Plan it with his profile and his playlist, invite his crew, and fix whatever feels off.
5. **Later:** Supabase accounts for live group voting and syncing profiles across devices. That work is HIGH_CAPABILITY under AGENTS.md: migrations and RLS need a careful review.

## Destination research

- **Sources and prices (Treg catalog, checked 2026-09-24):** `anyapi.google.serp.maps` ×3 (~$0.00175 each: attractions, food, nightlife steered by the crew's top music scene), `serpapi.x.tripadvisor-search` (~$0.015; tour products dropped, sights kept), `serpapi.x.yelp-search` (~$0.015), `anyapi.instagram.hashtag_recent_posts` (place, plus the top sight's hashtag), `anyapi.tiktok.search.videos` (place, plus top sight), `dataforseo.x.serp-google-events-live-advanced` (~$0.002), `serpapi.x.google-flights` (~$0.015, only when home and destination airports are both known and the start date is 1–330 days out). TikTok covers come from TikTok's free public oEmbed.
- **Real run for Lisbon:** 13 s, $0.055; every tab filled except Events.
- **Events are down at the provider:** DataForSEO answers `50304 temporarily unavailable` (no charge), and SerpApi's `google_events` engine is unsupported through Treg. The tab says so honestly. The DataForSEO item parser follows its documented fields but hasn't been checked against a live response; check it when the feed returns.
- **Spend:** every call carries its own `X-Treg-Route-Max-Cost` ceiling. A run stops starting calls once reserved ceilings would pass $0.10 (flights have their own $0.02 ceiling). There's a per-instance daily ceiling of $2 and 4 runs per 10 minutes per client. Results are cached 6 h per place on the server (failures 10 min) and 6 h per trip on the device, and Treg's own archive is accepted (24 h for places, 1 h for social). These caps are per server instance, not durable; a durable budget is needed before opening to others.
- **Truth rules:** only rows linking to the provider's own domain are kept; images come only from that provider's CDN, so each photo is the listing's or post's own. Instagram and TikTok posts must name the place in their words or tagged location (hashtags alone don't count on Instagram), no ads or paid partnerships, and nothing older than 60 days. "Hidden gems" is a stated rule (4.6+ with 30–1,500 Google reviews), not an editorial call. Every tab shows source and fetch time.
- **Instagram/TikTok terms:** the panel hot-links post images from the platform CDNs and links out to each post; nothing is re-hosted. Fine for the owner's personal use. Before opening to others, switch to official embeds or revisit terms (see `docs/RESEARCH-PIPELINE.md`).

## Red team 2026-09-24 (second pass)

Report: `docs/redteam/2026-09-24/REPORT.md`. Retest of the 09-23 fixes: 28/31 pass, 1 regression (NOW notice under the phone tab bar). 84 new findings in ten clusters. **Before `TREG_TOKEN` goes on any public URL, fix cluster A** (research runs on page load, and its budget is per-instance, in-memory and fails open; the limiter and origin checks trust request headers). Until then, keep the key in the Vercel Preview environment only, which sits behind Vercel sign-in. Cluster B (forged or impersonated picks links, prototype pollution from link ids, any-https card links) is the other P0. Both are HIGH_CAPABILITY_ONLY under AGENTS.md.

The design system is documented in `docs/design/UNIFIED-DESIGN.md` ("Afterglow"); the four-way critique that produced it and the round-2 adversarial review are summarized there.

## Open caveats

- The Spotify playlist reading is tested against sample data only. Confirm it against the real API once keys exist; the 2026 API renamed `/tracks` to `/items`, and artist `genres` may be empty.
- Share links show names, kids' ages and hometown to anyone who has the link; the UI says so.
- No independent senior review (Astra or Codex) has run on the share-link parsing yet.
