# dope.travel handoff

Read this first when picking up the work in a new session. Last updated 2026-09-24.

## What we're building and for whom

dope.travel (repo still says MERIDIAN in places) plans trips that feel made for you: places worth being, your music and teams when you get there, and your crew along for it. **Right now it's for the owner, personally.** The goal is to make it genuinely useful and fun for him first, get it right, then open it to others. Optimize for "this is great for me" over scale, polish for strangers, or monetization.

The owner is on mobile a lot. Test every UI change at phone width (390×844) as well as desktop.

## Standing rules

- Work and push only on `claude/review-recent-work-5li9lw`. No PR unless he asks.
- Follow `AGENTS.md`: `npm run gate` must pass (lint, typecheck, tests, build). Provider truth: never invent venues, prices or listings; label sources and fetch times; show honest "not connected" states.
- Never print secrets, read `.env` files, or ask for keys in chat. Keys go in the environment settings (Claude) and the Vercel project (live site).
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

## Keys

| Status | Key | Notes |
|---|---|---|
| Connected | `TYPESAFE_API_KEY` | Jev |
| Connected | `TREG_TOKEN` | Just added; verify it's visible |
| Connected but unused | `OPENAI_API_KEY` | |
| Still needed | `ANTHROPIC_API_KEY` + `MERIDIAN_DESIGNER_AI=on` | AI parsing and curation |
| Still needed | `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` | Spotify |
| Still needed | `TICKETMASTER_API_KEY` | Event feed |
| Optional | `SEATGEEK_CLIENT_ID` | Second event feed |
| Still needed | `BESTTIME_API_KEY_PRIVATE` + Supabase keys | NOW |

## Next up, in order

1. **Verify Treg.** Confirm `TREG_TOKEN` is set (check presence only; never print it). Check the pinned endpoints in `src/lib/research/treg.ts` (`anyapi.instagram.hashtag_recent_posts`, `anyapi.tiktok.search.videos`) against https://treg.to/catalog and https://treg.to/docs with one cheap call each.
2. **Destination research for any place.** When a trip is planned for a typed-in place, pull real, current info through Treg:
   - top spots and hidden gems from Tripadvisor, Yelp and Google;
   - recent Instagram and TikTok posts for the place and its venues;
   - events and flights where the catalog has them.

   Show it on the trip canvas with source and fetch time. Images must be real and must match what they're labeled as. Cache per place and cap spend per trip. Fall back to the current search cards when Treg is unavailable.
3. **Brand imagery.** Run `npm run brand:assets` (a few cents per image, capped), review the results, and wire the good ones in.
4. **Personal end-to-end test.** Ask the owner for a real upcoming trip. Plan it with his profile and his playlist, invite his crew, and fix whatever feels off.
5. **Later:** Supabase accounts for live group voting and syncing profiles across devices. That work is HIGH_CAPABILITY under AGENTS.md: migrations and RLS need a careful review.

## Open caveats

- The Spotify playlist reading is tested against sample data only. Confirm it against the real API once keys exist; the 2026 API renamed `/tracks` to `/items`, and artist `genres` may be empty.
- Share links show names, kids' ages and hometown to anyone who has the link; the UI says so.
- No independent senior review (Astra or Codex) has run on the share-link parsing yet.
