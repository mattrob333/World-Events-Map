# Architecture: Vibe Match, the voice concierge, and trip build

Written by the architecture track on 2026-09-25 and saved by the orchestrator. See `PLAN.md` for what was decided and built.

## What the code does today (checked in code)

**Feeds**
- The intake keeps stories up to 72 h old, at most 3 per source per run (`src/lib/feeds/intake.ts:8-12`).
- Sources that only give signals are skipped (`intake.ts:83`), including the Google News per-place feeds.
- Jev screens 80 stories per run. Most rows stay `unscored`.
- Growth is a few hundred to about 1,500 rows a day, so a 30-day window reaches 10–40k rows. Scanning at request time works only for the first couple of weeks.

**Buzz and dates**
- The calendar's buzz numbers are hand-set baselines (`src/lib/data/adapters/curated.ts:6`). `scoreEvent` is an editorial estimate, never a count.
- "The Alps" is 7 countries (`src/lib/geo/regions.ts`), so Venice Carnival and the Vienna Opera Ball fall in scope.
- route-trip filters by the whole month, though `tripWhen` already works out an exact window.
- `recommendDestinations` keeps one result per city and returns at most 3.

**Places and people**
- `public/geo/cities.txt` has no resorts, which is why `resorts.ts` exists.
- Ambiguous place names: Nice, Reading, Bath, Split, Mobile, Orange, Victoria, Kingston, Male.
- Some resort aliases are whole ski areas, not single resorts: Engadin, Mont Blanc, 3 Vallées, Four Valleys, Jungfrau, Titlis.
- `WorldEvent` has no lineup field. Real artist shows would come only from Ticketmaster or SeatGeek, which have no keys yet.
- `TravelerProfile` has no drinks field. Profiles are stored only on the device (`meridian.designer.v1`, up to 12). `normalizeProfile` is the gate for untrusted input.

**Voice**
- Tools are allowlisted per intent.
- Turn detection is `semantic_vad` with default eagerness.
- The screen context sent to the model is capped at 600 characters.
- Calls last 240 s, 280 s at most.
- `useRealtime` doesn't stream words as they're spoken:
  - The user's words appear only on `.completed`.
  - The Sun's words are held until `.done`.
- "Text only" works by sending a `session.update` of `output_modalities`.

**Designer**
- `composeLocally` is deterministic, and keeps `cards` only for typed-in places.
- Shared cards need a `custom:` id and link hosts on the allowlist.
- Research never runs on page view, and `RESEARCH_PUBLIC` gates it.

**Budgets and caching**
- Budgets live in memory, per server instance.
- `unstable_cache` has been replaced. Use a module-level cache with a time limit, like `research/destination.ts` does.

## Vibe Match engine

Everything lives in the new `src/lib/vibe/` folder.
- **Pure modules:** `window.ts`, `places.ts` (the place index: calendar cities plus resorts, with area aliases marked), `extract.ts`, `candidates.ts`, `score.ts`, `reasons.ts`.
- **Runs on the device:** `affinity.ts`, so the profile never leaves the phone.
- **Server only:** `server/feedIndex.ts`.

**Reading stories.** `extract.ts`:
- Matches whole words, ignoring accents; the longest match wins.
- Takes at most 5 places per story.
- Counts an ambiguous name only when the story also names the country or the source's region agrees.

**Choosing candidates.** `candidates.ts`:
- A ski trip considers resorts in scope, plus calendar cities with fitting events.
- Anything else considers calendar cities with events in the window, plus places at least 2 sources named in the last 30 days.
- At most 60 candidates.
- An event attaches to a place by city name, or within 25 km.

**Loading stories.** `feedIndex.ts`:
- Reads stories through the service role: the last 30 days, excluding anything Jev rejected or sent for review, capped at 10k rows.
- Builds a map from each place to its mentions.
- Keeps it for 20 minutes, rebuilding one at a time and serving the old copy meanwhile.
- If the database fails, it ranks from the calendar only and says the news signal is unavailable.

## Scoring (fixed constants, results sum exactly)

- **Calendar fit (C)** = 1 − e^(−Σ tier × type fit × overlap).
  - Tier: legendary 1, marquee 0.7, insider 0.5.
  - Type fit: 1 if the event matches the trip type, else 0.5.
  - Overlap: days in common ÷ the shorter of the trip and the event.
  - Seasons longer than 21 days count half.
- **News (F)** = a log-scaled sum of story weights, from 0.3 (nothing counted yet) to full at a weight of 12.
  - Each story weighs its source tier (A 1, B 0.7, C 0.4) × 0.5^(age in days ÷ 7).
  - At most 2 stories per source per place, and syndicated copies count once.
  - "In the news" needs 2 or more sources.
  - "Rising" only after 30 days of history.
- **Affinity (A)** = 1 − Π(1 − h) over matches:
  - Artist's show there: 0.9
  - Team: 0.8
  - Artist named in an event: 0.8
  - Food or drink match: 0.6
  - Artist and place in the same story: 0.5
  - Genre: 0.4
  - Interest: 0.3
  - Anything on the avoid list halves it.
- **Prior (B)** = the best calendar buzz in the window ÷ 100, labeled "editorial estimate".
- **Score** = 100 × (0.35C + 0.25F + 0.30A + 0.10B).

**Reasons** look like `{kind, text, points, sources[]}`. A reason without a source is dropped, curated numbers are never printed, and no venue is named unless a source names it.

**Delivery:** route-trip's recommend branch returns `places` alongside the existing recommendations, so today's screens keep working. A separate `/api/designer/vibe-match` route comes later, for trip build.

**Optional:** a `vibe-rank@1` Jev re-rank, blended into at most 20% of the order, running in shadow mode first.

## Migration 008 (HIGH_CAPABILITY_ONLY; needed within about 2 weeks)

```sql
alter table public.meridian_feed_items
  add column if not exists place_keys text[] not null default '{}',
  add column if not exists place_countries text[] not null default '{}',
  add column if not exists places_version smallint;
create index if not exists meridian_feed_items_place_keys on public.meridian_feed_items using gin (place_keys);
create index if not exists meridian_feed_items_place_countries on public.meridian_feed_items using gin (place_countries);
```

The intake fills these columns as stories arrive, and a backfill protected by the cron secret re-reads older rows. After that, `feedIndex` looks up `place_keys` directly instead of scanning.

## Concierge (Phase 2)

- **Voice intents:** `concierge_profile` and `concierge_trip`.
- **Tools:**
  - `lock_fact {field, op, value}`, where field is one of: hometown, home_airport, age, artists, genres, teams, food, drinks, dietary, interests, activities, festivals, favorite_trips, best_moments, bucket_list, avoid, budget, pace, social, lodging, languages.
  - `add_companion`, `remove_companion`, `finish`.
- **Checking:** every value passes a pure `profileFacts.ts` check. Replies are short: "Locked: …", or an error the model can correct.
- **Saving:** new `lockFact` and `undoFact` store actions write through `normalizeProfile`. The last 20 changes can be undone, and the transcript is never stored.
- **New profile fields:** `drinks`, `activities` and `provenance`, all optional. They stay out of share links.
- **Voice settings:** `semantic_vad` at low eagerness, at most 300 output tokens, context capped at 1,200 characters.
- **Mute:** mute the audio element locally, and also switch replies to text only with `output_modalities: ['text']`.
- **Live transcript:** a reducer keyed by item id, fed by transcription deltas for both sides, keeping 40 lines.
- **Fallback:** with voice off, `interview.ts` works out the missing fields and asks scripted questions after dictation.

## Trip build (Phase 3)

1. Read the trip brief, then work out the dates.
2. Run Vibe Match.
3. `buildTrip.ts`: turn the brief into a curated or custom destination with dates and crew, then call `composeLocally`.
4. `eventCards.ts`: add each in-window event as a `custom:event:` card placed in the right slot. This needs a new `extraCards` option in `composeLocally`.
5. Show a "why this place" panel. `tripShare` must strip `vibe` before sharing.
6. Show real progress steps as they finish.
7. Paid research runs only after the user says yes, and only on Preview.

## Keys and costs (check each at its source)

- **Phase 1:** $0. Uses Supabase keys that are already set.
- **Phase 1b:** Ticketmaster (free tier, but check the commercial hold).
- **Phase 2:** OpenAI Realtime. Roughly $0.10–0.50 per 4-minute session (my estimate), Preview only.
- **Phase 3:** optional Treg research, at most $0.10 per run.
- **Later, social counts:** about $0.0015 per Instagram hashtag lookup and $0.0007 per TikTok search.
