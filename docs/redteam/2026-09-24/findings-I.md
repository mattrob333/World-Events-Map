<!-- Saved by the orchestrator from the tester's returned report: the harness blocked the subagent's own file write. -->

# UserFlow Red Team (second pass): Persona I findings ("On the ground, tonight")

Branch `claude/review-recent-work-5li9lw` @ `386241b`, `http://localhost:3127` (production build; Treg and Jev configured; Ticketmaster/SeatGeek, BestTime, Supabase and the designer AI NOT configured). Test date 2026-09-24. Playwright Chromium, phone 390x844 (`isMobile`, `hasTouch`, `timezoneId: Europe/Lisbon`) and laptop 1440x900 for the globe. Scripts: `scratchpad/rt-I/*.mjs` (`seed.mjs`, `canvas.mjs`, `now.mjs`, `misc.mjs`, `globe.mjs`); raw outputs `scratchpad/rt-I/canvas-out.json`, `now-out.json`.

**Jev executed:** 6 calls, all HTTP 200, model `jev-1.13.0`. Every number below is copied from `artifacts/jev/I-0*.json`. No application code, config or data was modified.

**Paid-call budget:** zero Treg spend. Shifting the trip dates changes the research cache key (it includes `depart`, and `scene` once the trip has a `taste`), and the research panel **sends its request automatically when the trip page loads** (see UFR2-I12). So every browser context intercepted `POST /api/designer/research` with `page.route` and answered 503 locally. The would-be request bodies were recorded; none reached the server.

**Seed:** my own copy of `scratchpad/store.json` (Lisbon trip, Matt + Sam, hometown New York). `startDate` and every `day.date` are shifted so the faked "today" (2026-09-24, Lisbon time) is trip day 2. Other scenarios move the trip so today is day 1, day 3, day 6 (last day), the day after the trip ends, or the day before it starts. I added `trip.taste = { genres: ['rock','classic rock'], topArtists: ['Foo Fighters','Pearl Jam'], energy: 'high' }`. Some `/now` runs also have a mood-board profile (Matt: classic rock, rock, seafood, pastries). The clock is faked with `page.clock.install`.

**Severity counts (12 findings):** LOGIC FAILURE 3 · AMBIGUITY 3 · UX FRICTION 1 · EDGE CASE 1 · STATE FAILURE 1 · COST EXPOSURE 1 · POLISH 2

## 1. Persona
| Field | Value |
|---|---|
| Who | Matt, a New Yorker on day 2 of a 6-day Lisbon trip with Sam. On a phone with a low battery, standing on a street, deciding within minutes |
| Knowledge | Built the trip himself on this device weeks ago. Knows nothing about providers, caches or fixtures |
| Permissions | Anonymous; the trip and mood board live in this browser's localStorage only |
| Job to be done | (1) "What should I do right now?" (2) "Is there live rock music tonight?" (3) "Something else nearby, right now." Plus sensible behavior on the arrival day, the last day, after midnight and after the trip |
| Entry points | `/trips/designer` (saved trip) → "Right now" card; "Something else nearby, right now →" → `/now?city=Lisbon`; `/now` deep link; browser Back and reload |
| Expected end state | One tap to a concrete, honest next move. Clear "not connected" states that still give a useful route. Correct behavior at the edges of the trip |

## 2. Flow maps
- **F1, "Right now" on the trip page (day 2): EXECUTED - PARTIAL.**
  `MATT -> /trips/designer -> "DAY 2 OF 6 · YOU'RE HERE / Right now in Lisbon" at y≈465 (first screen) -> NOW · MORNING "Walk Lisbon's best neighborhoods / Search Maps ↗" + UP NEXT · LUNCH -> tap -> Google Maps city-wide search in a new tab`.
  - Slot change without reload works: 11:58 Morning → 12:01 Lunch after `clock.runFor(3 min)`. PASS.
  - ★-picking another card updates the card at once and survives reload. PASS.
  - It does not answer "what do I do now" (UFR2-I06).
- **F2, time of day across the trip: EXECUTED - FAIL.** 12 clock and day scenarios (table §3).
  - Morning, lunch, dinner and late night on a normal day: PASS.
  - Arrival day (I02), last day (I01), after midnight (I07) and the day after the trip (I05): FAIL.
- **F3, live music tonight with the feeds not connected: EXECUTED - PARTIAL.**
  `trip page -> "Live music tonight in Lisbon" panel (y≈1311, second screen) -> scene "Rock cover bands" + "IN LISBON ON YOUR DATES" + grey badge "Event feeds not connected" + one Maps button`.
  - The small print is honest, but the headline promises tonight's shows (I03).
  - `/api/designer/scene` was called with `startDate=endDate=2026-09-24`, which is the correct window.
- **F4, jump to NOW: EXECUTED - FAIL (the page contradicts itself).**
  `"Something else nearby, right now →" -> /now?city=Lisbon -> hero "gives you three decisions instead of another directory" -> the Right now card again -> "More ideas in Lisbon" (2–3 Maps searches) -> live music panel -> "NOW can't pick venues tonight… no recommendations to show" -> "On today: Mara River Crossings · Masai Mara…" -> guide picker without Lisbon -> archive photo -> disabled form with "Find my next move" at y≈4014`. See I04.
- **F5, `/now` "For you" with and without a profile: EXECUTED - PARTIAL.**
  - With a profile: "LATE NIGHT · FOR MATT", Cocktails and "Rock cover bands in Lisbon".
  - Without a profile but with a trip `taste`: no live-music panel on `/now`, although the trip page shows one (I09).
- **F6, reload, Back and city change: EXECUTED - PARTIAL.**
  - Reload `/now`: same content. PASS.
  - Type "Porto" and tap "Show me": the ideas switch to Porto, but the URL stays `?city=Lisbon`, so reload or share reverts (I08).
  - Back to `/trips/designer`: Right now is intact. PASS. The scroll position came back as 0 in one run and 361 in another.
- **F7, `/now` deep links without a trip: EXECUTED - PASS.**
  - `?city=Lisbon`: 2 Maps ideas.
  - Bare `/now`: "Where are you right now?"
  - `?city=<b>x</b>` is escaped; a 200-character city is cut to 60. No overflow and no page errors.
- **F8, globe scroll fix at 1440x900: EXECUTED - PASS.** The globe is at y≈1599 on `/`.
  - Four plain wheel ticks over the globe scroll the page 1429 → 1829, with `defaultPrevented=false`.
  - Three ctrl+wheel ticks: no page scroll, `defaultPrevented=true`, and the globe visibly zooms (I-11 vs I-12). meta+wheel is also captured.
  - The hint reads "DRAG TO ORBIT · PINCH OR ⌘/CTRL + SCROLL TO ZOOM".
  - Observation, not a finding: each tick is capped at about 17.5% (120 × 0.0016), so three mouse-notch ticks go from the overview almost to the surface.

## 3. Test cases
| ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| T01 | happy: day 2, 10:00 | current + next pick | NOW · MORNING Walk…/UP NEXT · LUNCH, both Maps searches | PASS (it works) / FAIL (not useful, I06) | I-02 |
| T02 | day 2, 06:50 | next pick | UP NEXT · MORNING | PASS | canvas-out.json |
| T03 | day 2, 13:00 / 20:15 / 23:30 | lunch / dinner→late / late | as expected | PASS | canvas-out.json |
| T04 | slot changes without reload | 12:00 switches to Lunch | switched after +3 min | PASS | misc.mjs |
| T05 | change mind: ★ another lunch card | Right now follows it | "NOW · LUNCH Lisbon's food market", kept after reload | PASS | I-09 |
| T06 | day 3, 01:30 | still tonight | UP NEXT · MORNING food market | FAIL | I-05, I07 |
| T07 | arrival day, 10:00 | travel-day guidance | "DAY 1 OF 6 · YOU'RE HERE / Right now in Lisbon / UP NEXT · DINNER" | FAIL | I-03, I02 |
| T08 | last day, 15:30 and 21:00 | airport, then flight | "NOW · LUNCH" at both times | FAIL | I-01, I01 |
| T09 | day after the trip | trip over, next step | card gone; hero "Underway · ENJOY EVERY MINUTE" | FAIL | I-04, I05 |
| T10 | day before the trip | countdown, no card | "Tomorrow · PACK TONIGHT" | PASS | canvas-out.json |
| T11 | live music, feeds off | honest + a useful route | badge + one Maps button under a "tonight" heading | PARTIAL | I-07, I03 |
| T12 | jump to /now | nearby options or an honest alternative | contradicting copy, worldwide "On today", disabled form at 4014 px | FAIL | I-06, I-08, I04 |
| T13 | /now, profile, morning | ideas beyond the plan | repeats the Right now pick | PARTIAL | now-out.json, I11 |
| T14 | /now, no profile, trip has taste | live music panel | missing | FAIL | now-out.json, I09 |
| T15 | reload /now | same state | same | PASS | now-out.json |
| T16 | change city, then reload | Porto kept | back to Lisbon | FAIL | now-out.json, I08 |
| T17 | Back from /now | trip page with Right now | yes | PASS | now-out.json |
| T18 | deep link, empty store | ideas for Lisbon | yes | PASS | I-10 |
| T19 | `?city=<b>x</b>`, 200 characters | escaped, cut to length | yes | PASS | misc.mjs |
| T20 | research fails (503) | honest error, the rest works | error shown; "The idea cards above still work." | PASS | canvas-out.json |
| T21 | horizontal overflow on phone | none | none | PASS | outputs |
| T22 | globe, plain wheel | page scrolls | yes | PASS | globe.mjs |
| T23 | globe, ctrl/⌘ + wheel | zooms, page still | yes | PASS | I-11, I-12 |
| T24 | cost when the trip page loads | no paid call without a tap | research POST sent on load (blocked locally) | FAIL (low) | I12 |

## 4. Findings

### UFR2-I01 · LOGIC FAILURE · OBSERVED: on the last day, "Right now" stays on Lunch until midnight; the airport transfer and flight never appear
- **Location:** the "Right now" card on the trip page, and the same card on `/now`.
- **Problem:** On day 6 of 6, at both 15:30 and 21:00, the card reads "DAY 6 OF 6 · YOU'RE HERE / Right now in Lisbon / NOW · LUNCH — Lunch where locals go". Today's plan has "Head to the airport" and "Fly home" after lunch, and neither is ever shown.
- **Impact:** On the one day the traveler most needs a nudge from the clock, the card points back to lunch. It also costs the card his trust on later trips.
- **Jev (I-02-last-day-lunch):** correct **0.06**; harm **3.06** (p(3 "could make him miss something like the airport transfer")=0.80, p(4 "miss the flight")=0.14); trust **0.25**. I agree.
- **Root cause:**
  - `src/lib/designer/tripNow.ts:10-12` gives start times only to morning through late night, and `:26` then filters out the `depart`, `flight` and `arrive` slots.
  - The return-day `depart` slot shows the time "Early" (`src/lib/designer/catalog.ts:54`) although it comes after lunch; `itinerary.ts:195-199` only changes its label.
- **Fix:**
  - Give travel slots start times on the days they happen: on the last day, `depart` (for example 14:00, or a flight time the user sets) and then `flight`; on day 0, `arrive`.
  - Label the return transfer "Afternoon", not "Early".
- **Acceptance:** `tripMoment` on the last day returns `depart` at 15:30 and `flight` (or a "wrapping up" state) at 21:00. In Playwright, no "NOW · LUNCH" at 21:00.

### UFR2-I02 · LOGIC FAILURE · OBSERVED: on the arrival day, "YOU'RE HERE / Right now in Lisbon" shows while he is still at JFK or in the air
- **Problem:** At 10:00 on day 1, the plan is Leave home → the flight JFK→LIS → Arrive → Dinner 19:30. The card reads "DAY 1 OF 6 · YOU'RE HERE / Right now in Lisbon / UP NEXT · DINNER — The dinner in Lisbon / Something else nearby, right now →".
- **Impact:** The card claims a place he isn't in. It skips the arrival note ("LIS, then …"), which is the useful part, and offers "nearby" ideas for a city he hasn't reached.
- **Jev (I-06-arrival-day):** accurate **0.08**; confusing **2.55** (p(3 "wrong and sends him to the wrong place")=0.58). I agree.
- **Root cause:** `tripNow.ts:21-33` treats every trip day as being on the ground. `src/components/designer/TripExtras.tsx:58-71` always shows "you're here", "Right now in {city}" and the nearby button.
- **Fix:** On day 0, until the `arrive` slot, show a travel-day variant ("Travel day · JFK → LIS", with the arrive note as Up next). No "you're here" and no nearby button.
- **Acceptance:** `tripMoment` on day 0 at 10:00 returns a `travel` phase, and the card shows no "YOU'RE HERE".

### UFR2-I03 · AMBIGUITY (fake/live confusion) · OBSERVED: "Live music tonight in Lisbon" has no information about tonight
- **Location:**
  - The trip page's `ScenePlaybook` panel.
  - The idea card "Live music tonight in Lisbon", which is the late-night pick and shows in Right now from 20:15.
  - The same panel on `/now`.
- **Problem:**
  - With the ticket feeds off, the panel shows only a fixed scene description, "IN LISBON ON YOUR DATES", a small grey "Event feeds not connected" badge, and one Maps search ("rock cover band bar Lisbon").
  - No sentence says that no gig listings were checked. The "No listed shows…" line only appears when a feed is connected.
  - The idea card ("Whoever's playing, wherever it's loud") is a Maps search for "live music bar Lisbon Portugal". Maps does not know tonight's lineups.
- **Jev (I-03-live-music-unconfigured):** honest **0.51**; believes the Maps result means tonight **0.53**; useful **1.27** (p(1 "a hint of where to look")=0.59). I agree this is material under the AGENTS.md rule on fake/live confusion: not false, but the headline claims too much.
- **Root cause:** `src/components/designer/TripCanvas.tsx:175` (the title); `src/lib/designer/place.ts:81` (the card title); `src/components/designer/ScenePlaybook.tsx:187-200` ("on your dates", and no empty-state sentence when no feed is connected).
- **Fix:**
  - With no feeds, title the panel "Where to find live rock tonight" and add: "Gig listings aren't connected, so we can't see who's playing tonight. These open Maps searches for bars that usually have a band; check their page for tonight."
  - Rename the idea card "Find a live-music bar".
  - Say "Tonight", not "on your dates", when the window is today.
- **Acceptance:** With no Ticketmaster/SeatGeek keys, no heading says "tonight" unless events are listed, and the not-connected sentence is visible.

### UFR2-I04 · AMBIGUITY / POOR FEEDBACK · OBSERVED: `/now` contradicts itself for a traveler on a live trip
- **Evidence:** I-06, I-07, I-08.
- **Problem:** From top to bottom:
  1. The hero says NOW "gives you three decisions instead of another directory".
  2. The Right now card again.
  3. "More ideas in Lisbon": 2–3 Maps searches.
  4. The live music panel.
  5. "NOW can't pick venues tonight. … there are no recommendations to show".
  6. "ON TODAY: Mara River Crossings · Masai Mara / Vava'u Humpback Season · Neiafu / Hanifaru Bay Manta Aggregation · Baa Atoll".
  7. A guide picker of about 200 places, without Lisbon.
  8. An archive photo.
  9. A disabled form, with "Find my next move" at y≈4014.

  Last pass's dead end (C01) is gone, but the page now tells the same user there are no recommendations right after showing some.
- **Jev (I-04-now-page-night):** contradiction **0.84**; On today relevant **0.03**; useful **0.93** (p(1 "marginally: a couple of generic searches")=0.77); next choice **tap_idea 0.61**, leave the app 0.37. I agree.
- **Root cause:**
  - `src/components/now/NowExperience.tsx:173-179` always renders the hero copy and `NowUnavailable`.
  - `src/components/now/NowUnavailable.tsx:35-37` says there are no recommendations.
  - `NowUnavailable.tsx:22` lists today's events worldwide.
  - `NowExperience.tsx:180-248` keeps the disabled form on the page.
- **Fix:**
  - When a city is known, replace `NowUnavailable` with one line: "Venue-by-venue picks (distance, how busy) aren't connected yet; these are Maps searches."
  - Show "On today" only for events in that city.
  - Fold the form into a "How NOW will work" disclosure.
  - Soften the hero while the provider is off.
- **Acceptance:** Provider off and a live Lisbon trip: `/now?city=Lisbon` has no "no recommendations to show", no out-of-city events, and is under about 2,000 px at 390x844.

### UFR2-I05 · LOGIC FAILURE · OBSERVED: after the trip ends, "Underway · ENJOY EVERY MINUTE" stays forever, and Right now disappears without a word
- **Evidence:** I-04.
- **Problem:** The countdown label has no "trip over" state: any date after the start is "Underway". Right now simply disappears. The page still shows the "LISBON, RIGHT NOW" research panel and "Live music for your crew… on your dates" for dates already past.
- **Jev (I-05-after-trip):** thinks the trip is still on **0.77**; clear next step **1.68** (p(2 "somewhat clear")=0.54). I think 1.68 is generous: the only forward action is the small "New trip" button.
- **Root cause:** `TripCanvas.tsx:20-25`; `:45` and `:173-175`.
- **Fix:** After the end date, show "That was Lisbon", "{n} days ago" and a primary "Plan the next one". Hide the "right now" and "on your dates" wording.
- **Acceptance:** For a trip that ended yesterday, no "Underway" and a "Plan the next one" button.

### UFR2-I06 · UX FRICTION · OBSERVED: "Right now" names a category, not a move; each pick is a city-wide Maps search
- **Problem:**
  - Example: "NOW · MORNING Walk Lisbon's best neighborhoods" opens a Maps search for "best neighborhoods to walk Lisbon Portugal".
  - No place, no distance from him, no end time.
  - The research results already on the page (real places with sources) are not used here.
- **Jev (I-01-rightnow-day2):** answers "what now" **0.11**; clarity **1.97** (p(2 "clear activity, must research where")=0.97); next choice **tap_nearby 0.75**, which leads into I04. I agree.
- **Root cause:** `TripExtras.tsx:23-45` shows only the first card's title and link; the card links are built city-wide in `src/lib/designer/place.ts`.
- **Fix:**
  - Show "until 12:30".
  - From Right now, leave the city out of the Maps query so Google Maps searches near the user (the app sends no location), labeled "Maps search near you".
  - When research is cached, add the top sourced place for that slot, with its source and fetch time.
- **Acceptance:** The Right now link has no city in its query; the card shows the slot's end time; with seeded research, one sourced place appears.

### UFR2-I07 · EDGE CASE · OBSERVED: at 01:30 the night out is dropped; the card jumps to tomorrow morning
- **Evidence:** I-05.
- **Problem:** At 01:30 on day 3 the card shows "UP NEXT · MORNING Lisbon's food market" instead of day 2's late-night slot. On the last night it disappears at midnight. `slotForTime` already treats 00:00–04:00 as late night; `tripMoment` does not.
- **Jev:** JEV NOT EXECUTED. My judgment: minor, but real for a night owl.
- **Root cause:** `tripNow.ts:21-25` looks only at the calendar date.
- **Fix:** Before 04:00, use the previous trip day and its late-night slot.
- **Acceptance:** `tripMoment` at 01:30 on day 3 returns day 2 with `current.kind==='late'`.

### UFR2-I08 · STATE FAILURE · OBSERVED: a city typed on `/now` isn't saved in the URL
- **Problem:** After "Porto" and "Show me", the ideas are Porto's but the URL is still `/now?city=Lisbon`. Reload or share goes back to Lisbon.
- **Root cause:** `src/components/now/NowForYou.tsx:60-63` keeps the city in component state only.
- **Fix:** Call `router.replace` with `?city=` on submit.
- **Acceptance:** Submit Porto and reload: "More ideas in Porto".

### UFR2-I09 · AMBIGUITY · OBSERVED: `/now` ignores the trip's taste when there is no mood board, and says "shaped by your board" without one
- **Problem:** The trip page shows live music from the trip's taste; `/now` shows none. Its footnote says "shaped by your board" while the page also says "Make your board…".
- **Root cause:** `NowForYou.tsx:49-50` (taste comes from the profile only), `:100` (the footnote), `:111` (the panel needs a profile taste).
- **Fix:** Fall back to the live trip's taste, and name the real source ("your trip" or "your board").
- **Acceptance:** No profile + a live trip with taste: the panel shows, and no board is mentioned.

### UFR2-I10 · POLISH · OBSERVED + CODE-REVIEW: "Now" switches at different times from the slot times shown, and from `/now`
- **Problem:**
  - "Now" moves to Lunch at 12:00, while the slot says 12:30. Seen: 11:58 Morning, 12:01 Lunch.
  - Morning starts at 8:00 against a displayed 9:00; late night at 21:30 against 22:30.
  - `/now` "For you" uses its own table (`slotForTime`): at 11:45 Right now says Morning but For you says Lunch; at 18:45 Après against Dinner (code review).
- **Root cause:** `tripNow.ts:10-12` vs `:38-46`; neither reads the slot's own time.
- **Fix:** Take the switch times from the slot's HH:MM and use one table for both.
- **Acceptance:** At 12:15, with lunch at 12:30, the card shows "Up next · Lunch", and For you agrees.

### UFR2-I11 · POLISH · OBSERVED: "More ideas" repeats what Right now already says
- **Problem:**
  - At 09:15, "More ideas in Lisbon" starts with "Walk Lisbon's best neighborhoods", the pick shown right above it.
  - At 21:45, the "Rock cover bands in Lisbon" idea and the "Rock cover band bar in Lisbon" button open the same Maps link.
- **Root cause:** `NowForYou.tsx:54-58` doesn't remove today's picks or repeated links.
- **Fix:** Exclude today's slot cards and remove duplicate links.
- **Acceptance:** No repeated link inside the For you section.

### UFR2-I12 · COST EXPOSURE (low) · OBSERVED request / INFERRED spend: opening the trip mid-trip runs paid research without a tap
- **Problem:**
  - Each time the trip page loads and the 6-hour browser cache has no entry for the exact key, the page sends `/api/designer/research`. The key includes `depart`, `nights` and `scene`, so editing dates or adding taste creates a new key.
  - Recorded (and blocked) body: `{"name":"Lisbon","region":"Portugal","scene":"Rock cover bands","from":"JFK","to":"LIS","depart":"2026-09-23","nights":5}`.
  - The spend is bounded: the server drops flights for past dates (`src/app/api/designer/research/route.ts:53`) and caches place research for 6 h, capped at $0.10 per run and $2 per day (`src/lib/research/destination.ts:30-35`). It is still spent on a page view, not on intent.
  - The panel title "Lisbon, right now" also competes with the "Right now in Lisbon" card.
- **Root cause:** `src/components/designer/DestinationResearch.tsx:173-183` (the key) and `:214-216` (loads on page load).
- **Fix:** Cache in the browser by place (flights separately), and when nothing is cached, show a "Look around {city}" button instead of loading on its own. Retitle the panel "What's good in {city}".
- **Acceptance:** With an empty cache, loading the trip page sends no request until the user taps.

## 5. Tables

**Dead ends**
| Where | What | Finding |
|---|---|---|
| `/now` bottom | "Find my next move" disabled, at y≈4014 | I04 |
| `/now` guide picker | the user's city (Lisbon) is missing | I04 |
| Last day, afternoon and evening | the card points to lunch; no airport step | I01 |

**Ambiguities**
| Copy | Why | Finding |
|---|---|---|
| "Live music tonight in Lisbon" (panel and card) | no data about tonight; Maps searches only | I03 |
| "no recommendations to show" right below ideas | contradicts the ideas | I04 |
| "DAY 1 OF 6 · YOU'RE HERE" during the flight | claims a place he isn't in | I02 |
| "Underway · ENJOY EVERY MINUTE" after the trip | claims the trip is live | I05 |
| "shaped by your board" with no board | names the wrong source | I09 |
| "Lisbon, right now" vs "Right now in Lisbon" | two meanings of "right now" | I12 |

**State-machine problems**
| State | Expected | Actual | Finding |
|---|---|---|---|
| Day 0, before arrival | traveling | treated as on the ground | I02 |
| Last day, after lunch | airport, then flight | stuck on lunch | I01 |
| 00:00–04:00 | the previous day's late night | next morning, or nothing on the last night | I07 |
| After the end date | trip over | "Underway" forever | I05 |
| City typed on `/now` | saved in the URL | lost on reload | I08 |
| Slot switch times | match the times shown | 30–60 min early; two different tables | I10 |

**Permission and privacy**
| Check | Result |
|---|---|
| Location on `/now` and Right now | never requested. PASS |
| What Right now sends | nothing; Maps links carry only the city name |
| What live music sends | `POST /api/designer/scene` with city, date and taste (genres, top artists, energy), as disclosed in `NowForYou.tsx:31-35` |
| What research sends | place, region, airports, dates and top scene go to the server (and on to Treg) when the page loads; see I12 |

## 6. Repair specs

**PROPOSED CONCEPT - NOT CURRENT APPLICATION: a "Right now" card that knows the phase of the trip (I01, I02, I05, I07)**
- `tripMoment` returns a phase: before, travel-out, on-ground, travel-home or after. Before 04:00 it still counts as the previous trip day's night.
- **travel-out** (day 0, until arrival): "TRAVEL DAY · JFK → Lisbon", with the flight note ("Route idea, not a fare") and the arrival note. No nearby button.
- **on-ground:** as now, plus "until 12:30", and Maps searches near the user.
- **travel-home** (last day, from the transfer time): "Now · Head to the airport — Transfer back to LIS", then "Fly home".
- **after:** "That was Lisbon" + "Plan the next one". No card.

**PROPOSED CONCEPT - NOT CURRENT APPLICATION: `/now` when venue search is off but a city is known (I03, I04, I09)**
- Order: Right now (if the trip is live) → "More in Lisbon for this late night" (no duplicates; labeled "Maps search near you") → "Live rock tonight", which without feeds carries the one-sentence not-connected note.
- Then one quiet line: "Venue-by-venue picks (distance, how busy) aren't connected yet."
- Then a "How NOW will work" disclosure holding the disabled form.
- No worldwide "On today", and no "three decisions" claim while the provider is off.

## Coverage
- **Browser runs:** 21 in total.
  - 12 day/time scenarios on the trip page.
  - 3 NOW journeys (trip page → `/now`, reload, city change, Back).
  - 4 `/now` deep links.
  - 1 clock-rollover, ★-pick and reload run.
  - 1 globe run (plain wheel, ctrl, meta, ctrl flick).
- **Test cases:** 24 (T01–T24): 13 pass, 2 partial, 9 fail.
- **Jev:** 6 calls, 16 questions, all run (`artifacts/jev/I-01…I-06`).
- **Screenshots:** `artifacts/I-01…I-13`.
- **Code review only:** the 11:45 and 18:45 half of I10, and the spend limits in I12.
- **Untested:** a real touch pinch on the globe; configured NOW/BestTime; configured Ticketmaster/SeatGeek; a phone left on New York time while in Lisbon.
