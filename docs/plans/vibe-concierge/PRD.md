# PRD: Vibe Match and the Concierge

Written by the product track on 2026-09-25 and saved by the orchestrator. See `PLAN.md` for what was decided and built.

> **Correction (orchestrator, 04:45 UTC):** the product track read the news table before the first scheduled intake and concluded `SUPABASE_SERVICE_ROLE_KEY` was missing. It isn't. The key is set in Production and Preview. The 04:40 UTC run completed: 668 sources, 632 read, 1,491 fresh stories, 80 screened by Jev. The research sweep runs at 05:15 UTC.

## What's true today

- **News signal is brand new.** Everything in the news table was fetched today. "Trending" needs about 28 days of history to compare against.
- **The calendar's buzz numbers aren't measurements.** It has about 250 events, 17 of them ski. Their `signals` are editorial baselines: they can rank events, but can never justify the word "trending".
- **"Alps, first week of February" is thin.** Only St. Moritz has events that week: White Turf and the Cresta Run season. "The Alps" covers 7 whole countries, so a country filter alone pulls in Paris and Vienna. There's no list of ski resorts.
- **"Your artist is playing there" has no data source yet.** Ticketmaster and SeatGeek aren't connected, and Ticketmaster is on hold for commercial use.
- **Live voice doesn't fit the brief yet.** Calls are capped at 240 s. The AI's words appear only when its turn is over, and the model replies at every pause.
- **Trip requests lose precision.** route-trip filters by the whole month even when a week is named, returns only 3 results, and knows only whether a profile exists, not what's in it.

## Promise

"Tell us when and roughly where; we'll show you where your week is, and exactly why, with receipts."

## Phases

- **P1, Vibe Match (about 1 day, $0).** Ranks places using the curated calendar, map distance and your profile, plus the news signal as it builds up.
- **P2, concierge onboarding.** Live voice interviews you and fills the profile variables that P1 reads.
- **P3, concierge trip build.** Ties together "Look around" research, fit ranking and the day scheduler, then fills the designer on screen.
- **P4, social signal.** A capped daily sample of Instagram hashtags and TikTok. Start it early: a baseline takes weeks to build.

## P1: Vibe Match

**What it covers**
- A new pure module, `src/lib/discovery/vibeMatch.ts`. Same inputs always give the same output, and it never reads the clock.
- `src/lib/geo/resorts.ts`: about 30 Alpine and 8 Japanese resorts, with aliases, coordinates, country and top elevation.
- **Candidate places:** calendar cities plus resorts inside the named region. A ski trip only considers ski places. Other events within 150 km attach as "nearby extras".
- **Dates:** the exact trip window (start to start + nights). The whole month is used only when no week or day was named.
- **Profile affinity** runs on the device.
- **News mentions:** the server matches the last 30 days of stories (up to 500) against each candidate's name and aliases. Cached for 1 hour. No migration needed.
- Show the top 5 places, each with up to 3 reasons and their sources.

**Acceptance**
- Alps, Feb 1–8:
  - St. Moritz ranks first, with the reason "White Turf, overlaps 2 of your 7 days".
  - No city-only picks for a ski request.
  - Resorts with no events show "No dated events in our calendar that week".
- A profile with "wine" ranks the Hospices de Beaune (Nov 14–16) higher for mid-November.
- Every reason has a source.
- With no news rows, the card says "News signal: not collecting yet" and shows no number.
- `npm run gate` passes.

**Honesty rules**
- Curated buzz is shown only as an "editorial estimate".
- "Trending" appears only under the counted rule in Scoring.
- "In the news" always shows the count, the publishers and links to the stories.

**Task class:** REVIEW_REQUIRED (ranking, and a change to a public API).

## P2: Live concierge onboarding

- **Tools:**
  - `set_vibe({key, value, quote})`, with the key from the schema below and the value checked in code.
  - `vibe_gaps()`, which returns the variables still unfilled.
  - `finish_vibe()`
- **Listening first:** automatic replies are off while you talk. "Done" hands the turn to the AI.
- **Streaming:** the AI's words appear as they're spoken.
- **Longer calls:** one reconnect is allowed, carrying over what's already captured, up to 8 minutes in total.
- **Persona:** at most 12 seconds per turn, cheeky and never judgmental, at most one "be honest" question per session, and anything can be skipped. It tones down when kids are coming.
- **Acceptance:**
  - A scripted conversation fills at least 12 variables.
  - Mute stops the voice while text continues.
  - Hitting the call cap mid-question loses nothing.
  - Profile variables never go into share links or to Jev.
- **Privacy:** audio goes straight from the browser to OpenAI. Variables stay on the device, with Export and Delete.
- **Cost:** about $0.10–0.30 per minute (estimate; check current pricing). Target at most $1.50 per onboarding, with a daily dollar cap. Preview only until the budget is durable.
- **Task class:** the caps and the privacy boundary are HIGH_CAPABILITY_ONLY; the UI is REVIEW_REQUIRED.

## P3: "Let's build a trip"

- **Flow:** "Tell me what you're feeling." It covers where (or a mood), when, how long, crew, must-dos and things to skip, with at most 3 extra questions. If the place is vague, Vibe Match runs and it offers the top 3. Then the designer opens and research, fit ranking and scheduling fill in dashed "suggested" cards.
- **Acceptance:**
  - Every card is a real provider listing with its source and fetch time.
  - A 4am+ bedtime gets at least one late-night pick each night.
  - No clubs when kids are coming.
  - Under 90 seconds.
  - With research switched off, it fills from the calendar and search links, and says why.
- **Cost:** Treg research at most $0.20, plus 1–2 Jev calls, plus voice minutes. Opening it to the public needs a durable research budget (a migration, HIGH_CAPABILITY_ONLY).

## P4: Social signal

- A capped daily sample of Instagram hashtags and TikTok searches for the top 60 candidate places. Roughly $4 a month.
- Stores post IDs, timestamps and hashtags only; no media.
- Rate shown as an estimate, for example: "~400/day on #stmoritz, from the 50 newest posts, fetched Oct 3".
- Hashtags that keep appearing alongside a place surface happenings the calendar doesn't have. They're always shown with the actual posts, and never called an "event" without the organizer's own source.
- Before going public: a terms review, official embeds, a durable budget, and a place-signals table.

## Profile variables (`profile.vibe`, `vibe@1`)

Each variable stores its value plus a source (said, inferred, imported or edited), a confidence, an optional quote and a timestamp.

| Variable | Type | What it changes in ranking |
|---|---|---|
| bedtime | early / midnight / 2am / 4am+ | how much nightlife counts; late-night picks per night |
| barTypes | from the list below | nightlife search; event tag matches |
| crowd | see-and-be-seen / locals / underground / mixed | famous vs insider |
| artists | ranked list | exact name match (the strongest reason) |
| genres | list | music event tags |
| liveAppetite | fly for it / if in town / not a priority | how much music counts |
| teams | list | sports events |
| sportsPlay | activity + level | ski, golf and surf fit |
| apres | big / civilized / none | nightlife at ski places |
| cuisines, foodStyle | list; tasting menu / bistro / street / mixed | food events and search |
| drinks | list | wine and spirits events |
| dietary | list | filter only |
| budget, splurgeOn | tier; list | penalty for events far over budget |
| pace, mornings | slow / balanced / packed; early / late | how much "stacking" counts; the scheduler |
| crewDefault | solo / partner / friends / family / mixed | tone; adults-only rule |
| lodging | boutique / grand / villa / chalet / social | stays |
| discovery | icons / hidden gems / both | famous vs insider |
| dealbreakers | list | excluded |
| accessibility | optional list | filter |
| timeOffDays, typicalNights | numbers | trip-length defaults |

`barTypes` options: DJ club, live music, cocktail, dive, wine bar, pool hall, rooftop, jazz, karaoke, speakeasy, beach club.

## Scoring

For each place:

- **Event fit** = the event's own buzz (the buzz score without the adjustment for how soon it is) × overlap × distance.
  - Overlap = days the event overlaps the trip ÷ the shorter of the trip and the event. Seasons over 21 days count half.
  - Distance = 1 in town, falling to 0 at 150 km.
- **Affinity** (0–1):
  - The best single match: artist 1.0, team 0.9, drinks or cuisine 0.7, genre or interest 0.6, bar type or crowd 0.4.
  - Each extra match adds 0.15, up to 1.
  - × 0.7 when the event is priced far over budget.
  - 0 if it hits a dealbreaker.
- **News:**
  - Each story counts: source tier (A 1, B 0.7, C 0.4) × Jev verdict (approved 1, not yet screened 0.5, flagged 0) × a recency factor that halves every 14 days.
  - Over 30 days, at most 1 story per publisher per day.
  - About 12 weighted stories counts as full.
  - Matches the whole name or an alias, ignoring accents. Ambiguous names also need the country.
- **Stacking** = how many distinct fitting things are within 150 km during the trip, ÷ 4, capped at 1.
- **Total** = 100 × (0.40 × best event fit × affinity + 0.25 × extra events + 0.20 × news + 0.15 × stacking).
  - Extra events add less each time: the 1st counts fully, the 2nd half, the 3rd a quarter.
  - "Pack it in" requests move 0.15 of the weight from the best event to stacking.
  - With no profile, affinity is 0.5 and the card says it's not personalized.
- **"Trending"** only when at least 3 publishers mention it and the last 7 days are at least twice the weekly average of the previous 28 days.
- **Reasons** are fill-in templates built by code from the top contributions. The concierge may read them out but never invents new ones.

## Open questions (recommended default in brackets)

1. For "your artist is playing", use a free Ticketmaster key for your own use? [Yes, Preview only.]
2. Keep the vibe profile on the device until accounts exist? [Yes, with Export and Delete.]
3. Voice budget? [$5 a day, 8 minutes per onboarding, Preview only.]
4. Should the concierge always lean party, or read the room? [Read the room; lean party for the owner.]
5. When building a trip, place suggestions into days or only suggest? [Place them as dashed "suggested" cards.]

## Metrics

- **P1:**
  - "Didn't know that" in at least half of queries.
  - Zero unsourced reasons in an audit.
  - At least 3 places for 90% of region-and-week requests.
- **P2:**
  - Median onboarding of 6 minutes or less.
  - At least 15 variables.
  - Under 20% of answers edited afterwards.
  - $1.50 or less each.
- **P3:**
  - Under 90 s.
  - At least 60% of suggested cards kept.
  - Zero invented venues.
- **P4:**
  - At least 70% of candidate places have a social signal.
  - At least 70% of trending flags match the owner's judgment.
