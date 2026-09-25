# Vibe Match and the Concierge: the plan

This combines the three tracks from 2026-09-25: product (`PRD.md`), UX (`UX.md`) and architecture (`ARCH.md`). Where they disagreed, this file decides.

## The promise

"Tell us when and roughly where; we'll show you where your week is, and exactly why, with receipts."

## What we have to work with

- **Calendar:** about 250 events with dates, coordinates and editorial buzz. The buzz is an estimate, never "trending".
- **News:** a daily news intake. The first run was 2026-09-25 at 04:40 UTC: 1,491 stories from 632 sources. Place mentions are sparse on day one (St. Moritz 1, Tokyo 7, Paris 21) and grow daily. "Rising" can't be claimed until about 30 days of history exist.
- **Your profile:** likes, artists, teams, food. It lives on the device.
- **Places:**
  - 57 Alps and Japan resorts with GeoNames coordinates (`src/lib/geo/resorts.ts`).
  - Region and country geography (`src/lib/geo/regions.ts`).
  - Exact trip windows from `tripWhen`.
- **Live voice:** the plumbing exists (OpenAI Realtime over WebRTC, tool allowlists, a server hang-up), switched off with `VOICE_ENABLED`.

## Phases

| Phase | What | Cost | Status |
|---|---|---|---|
| 1 | **Vibe Match.** Rank places inside the named region and window. Uses calendar events overlapping the exact dates, resorts for ski trips, counted news mentions, and profile affinity on the device. Reasons carry sources. | $0 | building now |
| 1b | Migration 008 (place keys on feed items), Ticketmaster artist shows, Jev re-rank in shadow mode | free tiers | next |
| 2 | **Concierge onboarding.** A live-voice interview that listens first, then asks up to 5 short probing questions, streams both voices as text, mutes to text-only, and locks answers into the profile | about $0.10–0.50 per session, Preview only | after 1 |
| 3 | **"Let's build a trip."** Brief, then Vibe Match, then pick, then the designer fills with event cards; paid research only after an explicit yes | $0, plus optional research | after 2 |
| 4 | **Social signal.** A capped daily hashtag and TikTok sample for the top places, and co-occurring hashtags that surface hidden happenings | about $4 a month | later |

## Decisions (and why)

- **The profile never leaves the device.** The server returns candidates with evidence, and the phone adds taste affinity. This is consistent with the privacy fixes from red-team cluster C.
- **Honesty rules:**
  - Counts are counts.
  - Curated buzz is only ever labeled "editorial estimate".
  - "In the news" needs 2 or more sources.
  - "Rising" needs 30 days of history.
  - No reason without a source.
  - No invented venues or lineups.
- **Ski trips consider resorts, not whole countries.** A ski trip to the Alps ranks resorts plus calendar places with fitting events. It never ranks Paris.
- **Exact windows beat whole months.** "First week of Feb" means Feb 1–8.
- **Voice listens first in code, not just by asking the model.** Replies are off (`create_response:false`) while the traveler talks, and "Done" hands over the turn.
- **Mute** mutes the audio element locally and also switches replies to text only.
- **Paid research never runs automatically.**

## Phase 1: build list

- `src/lib/vibe/window.ts`: trip brief to `{from, to}`.
- `src/lib/vibe/places.ts`: place index built from calendar cities and resorts, with area aliases flagged.
- `src/lib/vibe/extract.ts`: which places a story names (whole words, ignoring accents; ambiguous names need their country).
- `src/lib/vibe/match.ts`:
  - candidates, calendar fit C, news N, prior B;
  - fixed constants, components that sum to the score, and reasons with sources.
- `src/lib/vibe/affinity.ts`: profile matches on the device, and the final score.
- `src/lib/vibe/server/feedIndex.ts`: reads 30 days of stories through the service role, cached for 20 minutes, falls back to the calendar only.
- route-trip returns `places` (plus `vibeStatus`) next to the existing `recommendations`.
- The Vibe stage shows ranked places with reason rows and sources, and says plainly what's personalized and what isn't.
- Tests: extraction, window, scoring, reasons with sources, and the calendar-only fallback.
