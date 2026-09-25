# Findings, persona N: trip request to plan

Build `main` @ `b14f948`, `next start` :3127, 2026-09-25. `noPaidResearch` on every context; no console errors, page errors, failed requests or 4xx/5xx. Screenshots `artifacts/N-01` … `N-12`. (Saved by the orchestrator from the tester's returned text; condensed.)

## 1. Persona, job, entry, end state
A traveler who roughly knows what they want. Ask the Vibe stage (A trip) for a trip or a recommendation, get into the designer with their dates and crew, build an itinerary, share it. Expected: recommend (from the calendar, labelled), plan (designer with place, ideally dates and crew), or one sensible follow-up; honest note when simple rules decided.

## 2. Flow maps
1. Typed "what's the best ski spot right now?" → 3 calendar recs → See the place. **EXECUTED - PASS** (caveats N07, N11).
2. Same request spoken without "?" → designer with the sentence as the place. **EXECUTED - FAIL** (N01).
3. Spoken "Lisbon second week of October me and Sam no touristy fado" → "Where are you thinking?" → "Lisbon" → same question. **EXECUTED - FAIL** (N02).
4. Same with commas → designer Lisbon, Nov 24, no crew. **EXECUTED - PARTIAL** (N03).
5. Japan for a week in February → "Japan" as a City, Nov 24. **EXECUTED - PARTIAL** (N03, N10).
6. Plan this (Courchevel, event Dec 19) → first day Nov 24. **EXECUTED - PARTIAL** (N03).
7. "somewhere warm" → follow-up asking for a feeling → same question. **EXECUTED - FAIL** (N05).
8. Recs shown → new request → old recs stay. **EXECUTED - FAIL** (N04).
9. Designer → example family → canvas, votes, swipe, look around (fixture), rank fallback, stays links, reload. **EXECUTED - PASS** (quality N08).
10. Invite link → payload matches disclosure. **EXECUTED - PASS.**
11. Restart confirm → dismiss keeps trip. **EXECUTED - PASS.**
12. Existing trip + stage plan (client navigation) → old canvas, no prompt, request lost. **EXECUTED - FAIL** (N06). Hard reload shows the Replace prompt (PASS; never silently overwritten).
13. Denied mic in trip mode → typing. **EXECUTED - PASS.**
14. `decidedBy:"rules"` never shown. **EXECUTED - FAIL** (N07).

## 3. Key test results
PASS: typed "?" recommend; See the place; vote/★/Move/Swipe persist; "ranked by rating (fit check unavailable)"; stays links (dates, party, kids' ages, new tab, "Search links, not listings"); invite payload (names, kids' ages, home city, plan, votes only); restart confirm; hard-reload Replace prompt; denied mic; no past events in recs.
FAIL: spoken recommend → plan (N01); comma-less place (N02); dates/crew lost (N03); stale recs (N04); "warm" (N05); client-nav plan with existing trip (N06); decidedBy hidden (N07).

## 4. Findings
- **UFR3-N01 LOGIC FAILURE + COST EXPOSURE (OBSERVED):** without "?", "where's the best surf town", "best ski spot right now", "recommend a beach", "best food city" route to `plan` with the sentence as the place; "where should I go for my honeymoon in December" → place "where should I go". Designer then builds a trip and Look around would POST paid research for it. Root: `tripRouter.ts:90-91` (place beats RECOMMEND), `vibe.ts:27-30`, `planPlace.ts:16,23`. Fix: RECOMMEND first; reject question/recommend-led places.
- **UFR3-N02 DEAD END (OBSERVED):** the stage's example sentence, spoken, yields "Where are you thinking?"; answering "Lisbon" appends and loops. Root: `vibe.ts:22` TRIP_BREAK, 6-word cap `planPlace.ts:23`. Fix: try short leading windows; route the newest utterance alone after a follow-up.
- **UFR3-N03 DEAD END / FRICTION (OBSERVED):** dates, nights and crew dropped; designer defaults to today+60, 7 nights, empty crew; Plan this for a Dec 19 event opens Nov 24. Root: `route-trip/route.ts:59`, `SunModal.tsx:239,353`, `TripDesigner.tsx:67`. Fix: carry start/nights (and event start) in the URL; Setup reads them.
- **UFR3-N04 STATE FAILURE (OBSERVED):** `build()` never clears `recs`/`note`; stale cards sit above a new follow-up. `SunModal.tsx:204-235`.
- **UFR3-N05 LOGIC FAILURE (OBSERVED):** "somewhere warm" rejected; "…with good bars in November" returned Gstaad New Year (ski) because `club\w*` matched `eagle-club`; month ignored. Root: `tripRouter.ts:57,76-81`, `recommend.ts:13`.
- **UFR3-N06 DEAD END / STATE (OBSERVED, root INFERRED):** with a saved trip, a stage plan pushes `?place=Tokyo` client-side but the designer keeps the old canvas with no prompt; `TripDesigner.tsx:449-451` reads `placeParam` once.
- **UFR3-N07 HONESTY (OBSERVED):** `decidedBy:"rules"` never surfaced. `SunModal.tsx:214-240`.
- **UFR3-N08 FRICTION / A11Y (OBSERVED):** 7-day trip: 140 cards, 21 unique titles; duplicate vote aria-labels. `place.ts:63`, `itinerary.ts:350`.
- **UFR3-N09 PRIVACY / HONESTY (OBSERVED):** trip tab says "The trip is planned on this device" but the transcript is POSTed to `/api/designer/route-trip` (and to Jev when configured).
- **UFR3-N10 EDGE CASE (OBSERVED):** a country (Japan) is planned as a City; no base-city prompt.
- **UFR3-N11 POLISH / HONESTY (OBSERVED):** "right now" shows Dec events with no year; surf reason is "Blue Zones". `recommend.ts:37-52`.
- **UFR3-N12 POLISH (OBSERVED):** crew string doubles kids' ages. `PicksBasket.tsx:72`.
- Note (INFERRED): Airbnb stays link isn't passed through `withAffiliate` (by design: Airbnb has no program here).

## 5. Top 5
1. N01 spoken recommend requests become a trip to the sentence.
2. N02 comma-less example sentence loops.
3. N06 existing trip + stage plan silently dropped.
4. N03 dates/crew/event date discarded.
5. N04 + N07 stale recs; rules decision hidden.
