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

- **Header "Vibe" (owner ask, 2026-09-24):** the sun button reads "Set your vibe" until a profile exists, then "Vibe". It always opens the Sun with the `vibe` intent, which can capture the profile (`describe_me`), start a trip (`set_trip_basics`, `add_traveler`, `create_trip`) or set Now's city. A tool that lives on another page opens that page and runs its registered handler (`src/lib/voice/vibe.ts`). With voice off, typed text is routed on the device: talk about yourself builds the board on `/moodboard` (the owner still taps Save), and a place opens the designer with it filled in.
- **Home location row:** one `LocationPicker` pill (device location, or type to filter the 11 `VIEWER_CITIES`; no remote geocoding). "Choose your dates" left the toolbar; the date timeline still opens from the page's other planning links.
- **"Why now" on home (owner ask, 2026-09-24):** the site's pitch is timing: what's on, what starts soon, what to lock in before it's gone.
  - `ComingUp` (under the toolbar, collapsible, collapsed by default on phones) shows eight weeks from today. Bars are events; diamonds are plan-by dates. `src/lib/discovery/comingUp.ts` ranks on-now moments (max 3, by buzz), then starting-soon, and keeps up to 3 rows for plan-by heads-ups; runs over 21 days are seasons and rank last.
  - Plan-by dates come from the editorial booking windows in `src/lib/alerts` (when the best rooms, tables and spots usually go). They are not flight, hotel or restaurant availability; the UI says so. Separate flight/hotel/restaurant deadlines would need live data we don't have.
  - `whyNow()` feeds the hero card ("Happening now", timing, the event's own first reason, plan-by) and the "Worth catching now" cards.
  - Hero photos carry a per-photo `focusY` in `src/lib/hero/pool.json`; the credit caption sits bottom-left.
- **Speed pass (2026-09-24), measured with a production build in headless Chrome (phone = 4x CPU throttle, slow 4G):**
  - Home was a client-only render (reading the URL made the static page bail out to "Opening your world…"). It now renders per request (`src/app/page.tsx`, `dynamic = 'force-dynamic'`). Phone LCP went from about 3.8 s to 1.5 s; desktop LCP about 0.5 s.
  - The WebGL globe mounts only within a screen of view (or when a flight is requested) and stops drawing frames off-screen. Desktop main-thread work on load dropped from 6.2 s to 1.4 s.
  - Header and tab-bar links prefetch on hover, focus or touch (`NavLink`) instead of fetching every section twice on load.
  - `/api/events` (445 KB) waits for idle, polls every 5 min instead of 1, and only re-ranks when the calendar actually changed.
  - The hero has a server-rendered lead photo, a 1200 px variant for phones, and no longer downloads the old collage or the run's last photo up front. The calendar no longer shifts layout on phones (CLS 0.28 to 0).
  - Not done: the Fraunces variable fonts (about 264 KB) carry every axis; shrinking them means pinning axes and changing the type.
- **"Set your vibe" prompt:** the floating strip that said "Set your traveler lens" is now the Vibe prompt. It shows until there's a profile (or "Not now"), and opens the Sun modal.
- **The Vibe stage (owner ask, 2026-09-24):** the header sun and the "Set your vibe" prompt open a full-screen stage (`src/components/voice/SunModal.tsx`), not a small modal.
  - About me / A trip tabs. The intro lists what to talk about, with a big sun to tap. While talking, the words stream in large serif and the list ticks as each topic is covered (`src/lib/voice/vibeChecklist.ts`). "I'm done" leads to a "Here's what I heard" recap, where the transcript is editable. One tap builds the board on `/moodboard`, or opens the designer with the place.
  - With server voice off (Production), speech-to-text is the browser's own (`useLiveTranscript`; Chrome sends audio to Google, and the footnote says so). Android runs short auto-restarting sessions because continuous mode repeats phrases there. With `VOICE_ENABLED`, the same stage runs the live OpenAI conversation with the `vibe` tools.
  - Tested in headless Chrome with a fake recognizer; not yet on a real phone's microphone.
- **Jev decision layer (2026-09-24), following the owner's Jev guide:** LLM generates, Jev decides, code enforces. Shared client `src/lib/jev/client.ts` (typed Choice/Score/Noul, one batched call per state, strict parsing, receipts). Versioned contracts in `src/lib/jev/contracts/`:
  - `feed-item@1`: daily intake of the source library (`/api/cron/feeds`, 04:40 UTC, 20-hour lease), each new story screened once, code routes with per-action thresholds (personal vs public; risky or salesy goes to review). **Shadow mode:** stories and receipts are stored, nothing is shown on the route yet. Next: label about 50 receipts (`jev_decisions.human_label`), check confidence against accuracy, then switch the personal feed on.
  - `trip-router@1` (`/api/designer/route-trip`): the Vibe stage in trip mode asks it first. It recommends destinations from the curated calendar (`src/lib/discovery/recommend.ts`), opens the planner for a named place, or asks one follow-up. Without Jev it falls back to word rules and says so.
  - `trip-fit@1` (`/api/designer/basket`): ranks listings the device already fetched (no new paid research) for the traveler and trip; without Jev it ranks by rating and says so.
  - Migration `007_feed_library.sql` (stories, receipts, lease) was applied to dope.travel on 2026-09-24. Advisors show only the expected "RLS on, no policies" notices for these server-only tables.
- **Basket and schedule:** under the research tabs, "Rank for my crew" gives a swipe deck (drag, buttons, or arrow keys); keeps are saved per trip on the device. "Fit N into my days" runs the deterministic scheduler (`src/lib/designer/schedule.ts`: meal windows, pace, geographic clustering, travel time, opening hours and BestTime busyness when known). Meals get an OpenTable hand-off.
- **Booking hand-offs:** `src/lib/booking/partners.ts` handles OpenTable, Booking.com, Airbnb and Vrbo, with affiliate IDs via `NEXT_PUBLIC_*` (see `docs/LIVE-SETUP.md`). We don't book.
- **Source library v2 (wired into the daily intake):** 713 verified live feeds (45 signal-only forums and news queries), tagged with kind, trip types, regions and trust, plus 611 dropped with reasons, in `docs/research/source-library-v2.json` (summary in `.md`). A dry run read 591 of 668 readable feeds in 35 s and found 1,367 new stories; Jev screens 80 per run while in shadow. General-news feeds are keyword-filtered to travel, food and events.
- **Supabase project "dope.travel"** (ref `lkexkbygtdsunicqkrgd`, Canada Central). Migrations 001–006 were applied on 2026-09-24 with the owner watching.
  - `006_advisor_hardening.sql` closes the RPC surface of the trigger functions and the RLS helpers, wraps `auth.uid()` in `(select …)` in 22 policies, and adds 5 foreign-key indexes. It doesn't change any access rules. `src/lib/platform/__tests__/rls.test.ts` now runs against 001 + 003 + 006.
  - Advisor leftovers, all accepted:
    - `owns_provider` is still callable by anon, because the anon offer and event policies need it; for anon it always returns false.
    - 6 helpers are callable by signed-in users; each returns only a true/false about the caller.
    - The six `meridian_*` tables have RLS on with no policies (server-only by design).
    - Unused-index notices, expected on a new database.
    - The Auth connection-strategy notice.
- **Vercel:** the connector reaches team "matt's projects". `world-events-map-onq7` is the one live project, and Production serves `main`. The duplicate projects `world-events-map` and `meridian` (same repo) were paused on 2026-09-24.
  - Set on Production + Preview: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `CRON_SECRET` (sensitive, generated), `TYPESAFE_MODEL=jev-latest`.
  - Still needed from the owner: `SUPABASE_SERVICE_ROLE_KEY`. The Supabase connector doesn't expose secret keys.
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

## Vibe Match and the Concierge (2026-09-25)

The plan is in `docs/plans/vibe-concierge/`: `PLAN.md` decides between the product (`PRD.md`), UX (`UX.md`) and architecture (`ARCH.md`) tracks.

**Phase 1 (Vibe Match) is live.**
- **Where it runs:** route-trip's recommend branch returns `vibe: {window, places, alsoInRange, news}`.
- **How it scores** (`src/lib/vibe/`):
  - calendar events overlapping the exact trip window (other kinds of event at the same place count half);
  - counted news mentions from `meridian_feed_items` (30-day index, cached 20 min, calendar-only fallback);
  - the calendar's editorial buzz, as a small labeled prior;
  - taste from the traveler's profile, added on the device (`affinity.ts`), so the profile never leaves it.
- **Places:** 57 resorts (`src/lib/geo/resorts.ts`) plus calendar cities. "The Alps" means resorts and places within 40 km of one.
- **Honesty rules:** no reason without a source, no "trending" until 30 days of news history exist, and curated buzz is never printed.

**Next:**
- Migration 008 (place keys on feed items, needed within about 2 weeks as rows grow).
- Ticketmaster artist shows.
- Phase 2, the live voice concierge (needs `VOICE_ENABLED=1` on Preview and a voice budget decision).
- Phase 3, trip build.

## Vibe stage, home declutter, live stories (2026-09-25, evening)

- **Vibe stage** (`src/components/voice/SunModal.tsx`): two tabs, *My profile* and *A trip*. The topics in `src/lib/voice/topics.ts` are the agenda on screen: essentials as bullets, extras as chips. With live voice on, the stage opens `vibe_profile` or `vibe_trip` sessions, whose only tools are `lock_fact` (lights a topic with a few words), then `describe_me` (profile) or `finish_trip` (trip), plus `switch_profile`. The concierge's first line is fixed: "Vibe with me for a second about the topics above." The instructions in `tools.ts` are brief by design: questions under 12 words, no praise, either-or clarifiers.
- **Voice cut-off fixed.** A tool that opened another page changed the route, which closed the stage and killed the call mid-sentence. Voice-driven navigation now keeps the stage open, and closing or building waits until the concierge stops speaking (`whenQuiet`, with an 8-second fallback). `END:` tool results ask for no further reply.
- **Mute voice** switches the session to text replies. **I'm done** builds from what was said and locked, in both modes.
- **Voice name:** set `VOICE_NAME` to one of `REALTIME_VOICES` in `src/lib/voice/session.ts`. The default is marin.
- **Profile style from voice:** `describe_me` takes pace, budget, avoid and splurge, merged by `withVoiceStyle` in `profile.ts`.
- **Home** (per the mobile audit):
  - Cut: the departure board, the finder's summary card and disclaimer, the empty Research Pulse lanes, the scene/wire tabs, the ideas rail and trail, the replay button, and the empty X panel.
  - Hidden on phones: the route pass, the World Heat ranking and the stats.
  - Place photos (`EventPhoto`) on the spotlight and on the "next move" cards, which are a swipe rail on phones. Scene cards lead with the curated photo.
  - Fixed: shortlist cards no longer clip their credit, and the "Start a Circle" link no longer sits on a black box.
- **Live stories:** `GET /api/feed/latest` (public, no input, cached 10 minutes at the edge) serves headlines from `meridian_feed_items` that name a place we cover. Filtering is in `src/lib/vibe/latestStories.ts`: tier A/B only, no service-notice or gear noise, English only, one story per source and per place, at most 4 days old, pictured places first. `LiveStories` renders nothing until there are at least 2.

## Red team 2026-09-25 (third pass)

Report: `docs/redteam/2026-09-25/REPORT.md` (six personas, about 80 findings, most fixed in the same change). The blocker was the basket deck covering its own Keep, Pass and Done buttons (a CSS module class collision); it's fixed and verified in a browser.

- **Also fixed:**
  - the rules router: spoken questions are no longer read as places, speech without commas works, dates and months carry through, and the stage says when word rules decided;
  - the scheduler uses the real trip days, counts travel from a stand-in lodging point, and holds clubs out of the plan when kids come;
  - Build my vibe saves and shows the board; pausing no longer duplicates words;
  - focus traps for the stage and the search palette;
  - privacy and honesty copy, and the basket payload (no names, no music);
  - "Find a table on OpenTable", plus the affiliate disclosure once IDs are set;
  - client re-checks of research links;
  - the pre-paint calendar choice (CLS 0);
  - the hero follows the journey or a nearby event;
  - cron answers 401 when unconfigured.
- **Still open:**
  - the durable research budget (09-24 cluster A remainder; needs a migration);
  - companions said aloud aren't carried to the designer;
  - repeated itinerary cards;
  - a country is planned as a city;
  - the globe isn't centred on a deep-linked event;
  - some touch targets are under 44px.
- **Test environment:** this container's environment has `TYPESAFE_API_KEY`, `TREG_TOKEN` and `OPENAI_API_KEY`. Start local test servers with `env -u TYPESAFE_API_KEY -u TREG_TOKEN -u OPENAI_API_KEY` so red-team runs don't spend money.

## Red team 2026-09-24 (second pass)

Report: `docs/redteam/2026-09-24/REPORT.md`. Retest of the 09-23 fixes: 28/31 pass, 1 regression (NOW notice under the phone tab bar). 84 new findings in ten clusters. **Before `TREG_TOKEN` goes on any public URL, fix cluster A** (research runs on page load, and its budget is per-instance, in-memory and fails open; the limiter and origin checks trust request headers). Until then, keep the key in the Vercel Preview environment only, which sits behind Vercel sign-in. Cluster B (forged or impersonated picks links, prototype pollution from link ids, any-https card links) is the other P0. Both are HIGH_CAPABILITY_ONLY under AGENTS.md.

The design system is documented in `docs/design/UNIFIED-DESIGN.md` ("Afterglow"); the four-way critique that produced it and the round-2 adversarial review are summarized there.

## Open caveats

- The Spotify playlist reading is tested against sample data only. Confirm it against the real API once keys exist; the 2026 API renamed `/tracks` to `/items`, and artist `genres` may be empty.
- Share links show names, kids' ages and hometown to anyone who has the link; the UI says so.
- No independent senior review (Astra or Codex) has run on the share-link parsing yet.
