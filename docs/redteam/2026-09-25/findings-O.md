# Findings, persona O: the family day-plan organizer (Lisbon)

Build: `main` @ `b14f948`, `next start` on :3127. Research came from the Lisbon fixture through `noPaidResearch(context)` on every context. Two modified copies were also routed: `rt3/O/fx-one.json` (one listing) and `rt3/O/fx-edge.json` (a 155-character name, `Joe's #1 Bar & Grill`, three top spots with no coordinates). No real research requests were made. Apart from the expected 4xx noise, no console errors, page errors or failed requests were captured.

## 1. Persona, job, entry, end state

- **Persona O:** a parent organizing a Lisbon trip for the example family: You (44), Wife, and two sons aged 8 and 12. Uses a desktop at 1440×900, then a phone at 390×844.
- **Job to be done:** look around Lisbon, rank the places for this crew, swipe keep or pass, fit the keeps into days, understand the schedule, and hand meals off to OpenTable.
- **Entry:** `/trips/designer?place=Lisbon&region=Portugal`, then "use the example family", then "Design the itinerary" (7 nights from 2026-11-24, from Atlanta), then "Look around Lisbon".
- **Expected end state:** a believable day-by-day plan for a family with kids, built from the keeps. Meals link to OpenTable searches with the right date, time and party size. Nothing implies a booking.

## 2. Flow maps

1. USER -> Look around Lisbon -> tabs -> Eat/Yelp card -> "Reserve on OpenTable" -> partner search URL -> SUCCESS. **EXECUTED - PASS** (the "we don't book" note is tooltip-only, O10).
2. USER -> Pick your winners -> Rank for my crew -> deck -> Keep/Pass buttons -> Done choosing -> SUCCESS. **EXECUTED - FAIL.** The card covers the count, Pass, Done choosing, Keep and the hint on desktop and phone (O01).
3. USER -> deck -> drag (mouse or touch) or ← → -> end of deck -> "N kept" -> SUCCESS. **EXECUTED - PARTIAL.** Gestures and keys work but are the only way through. Keys fire off-screen and inside the other swipe modal (O05). The card's source link is dead (O06).
4. USER -> keep some -> reload -> keeps restored -> Keep choosing -> SUCCESS. **EXECUTED - PARTIAL.** Keeps come back, but the deck restarts at card 1 in unranked order and the rating disclosure is gone (O07). Schedule and pace are not restored.
5. USER -> Fit N into my days -> pace -> schedule -> OpenTable links per block -> SUCCESS. **EXECUTED - PARTIAL.** Links use the block's date, time and party. The plan fills the arrival day, never flags the nightclub for the kids, and pace does nothing on the default trip (O02, O03, O04).
6. USER -> Start over / new trip -> keeps cleared or kept per trip. **EXECUTED - PASS with friction** (O13).
7. Edge fixtures (1 item, long name, no coordinates). **EXECUTED - PARTIAL** (O08, O09, O11).

## 3. Test cases

| ID | Case | Expected | Observed | Result |
|---|---|---|---|---|
| T01 | Research tabs with fixture | Tabs with counts | Top spots 5, Hidden gems 3, Eat 4, Nights out 3, Tripadvisor 1, Yelp 1 | PASS |
| T02 | OpenTable URL on Eat/Yelp | term=name+city, covers=party, dateTime=start 19:30 | `term=Cervejaria+Ramiro+Lisbon&covers=4&dateTime=2026-11-24T19%3A30` | PASS |
| T03 | Card layout with split link | Even cards | Eat cards 349px, Reserve its own pill | PASS |
| T04 | "Doesn't book" note | Visible | Only in `title` | PARTIAL (O10) |
| T05 | Rank with no Jev | Rating order, disclosed | Disclosed in count line, but hidden under the card | PARTIAL |
| T06 | Keep/Pass/Done, desktop | Clickable | `elementFromPoint` is the card; click times out | FAIL (O01) |
| T07 | Keep, phone tap | Keeps | Tap lands on the card | FAIL (O01) |
| T08 | Mouse drag | Snap / keep / pass | As expected | PASS |
| T09 | Touch swipe | Keep / pass | As expected | PASS |
| T10 | Vertical touch drag | Card resets | Left at `translateX(4px)` | PARTIAL (O12) |
| T11 | Source link in deck card | Opens Maps | Nothing | FAIL (O06) |
| T12 | ← → with body focus | Pass/keep | Works | PASS |
| T13 | ← → with basket off-screen | Ignored | 2 silent keeps | FAIL (O05) |
| T14 | ← in itinerary Swipe ♥ modal | Only modal | Both reacted | FAIL (O05) |
| T15 | Keep 0 -> Done | Fit disabled | "Nothing kept yet.", Fit 0 disabled | PASS |
| T16 | Keep all 17 | Summary | "17 kept." | PASS |
| T17 | Reload mid-deck | Keeps + position | Restarts at 1 of 17, unranked | PARTIAL (O07) |
| T18 | Research Refresh mid-deck | Stay in deck | Thrown to picked | FAIL (O07) |
| T19 | Reload after Fit | Schedule back | Lost | PARTIAL (O07) |
| T20 | Start over | Confirm | Instant wipe, re-calls basket | PARTIAL (O13) |
| T21 | New trip same place | Fresh basket | Fresh; old key orphaned | PASS |
| T22 | Pace at 7 and 5 nights | Different plans | Identical | FAIL (O04) |
| T23 | Pace at 2 nights | Differs | Differs | PASS |
| T24 | Days vs nights | Usable days | Arrival day planned from 09:00 (Sintra) | FAIL (O02) |
| T25 | Crossing midnight | Marked | "22:30–01:00" with no +1 | PARTIAL (O03) |
| T26 | Nightclub + kids | Flagged | Scheduled, no warning | FAIL (O03) |
| T27 | Typical hours honesty | Said | Said | PASS |
| T28 | Travel minutes | Plausible | Unknown legs shown as "20 min" | PARTIAL (O09) |
| T29 | OpenTable in schedule | Block date/time | Correct | PASS |
| T30 | Unscheduled reasons | Plain | Plain | PASS |
| T31 | Sintra placement | Own day, travel | Arrival day, 0 travel | FAIL (O02) |
| T32 | 1-item research | Explains | Basket silently absent | PARTIAL (O11) |
| T33 | No-coordinate items | Honest | 20-minute legs assumed | PARTIAL |
| T34 | 155-char name | City kept | OT term cut, city lost | FAIL (O08) |
| T35 | `Joe's #1 Bar & Grill` | Encoded | Encoded | PASS |
| T36 | Phone schedule | Readable | Readable | PASS |
| T37 | Itinerary Swipe ♥ deck | Unchanged | Done card and touch-action regressed | FAIL (O01) |

## 4. Findings

### UFR3-O01 BLOCKER (OBSERVED): the basket deck reuses `.deck`/`.deckCard`/`.deckDone` class names
`designer.module.css` defines them for `SwipeDeck` (≈1103–1127) and again for the basket (≈1616–1637); CSS Modules merge them. The basket card fills the deck box and covers the count, Pass / Done choosing / Keep and hint; SwipeDeck inherits `touch-action: pan-y`, a transform transition and a transparent pill "done" card. Fix: rename basket classes. Acceptance: at 390 and 1440, `elementFromPoint` at Keep is the Keep button and a click advances the count; SwipeDeck done card has its gradient and `touch-action: none`.

### UFR3-O02 LOGIC FAILURE (OBSERVED): the scheduler plans the arrival day as a full day
`PicksBasket` passes `days: trip.nights` from `startDate`; the itinerary's day 1 is travel. Sintra landed 09:00 on the arrival day with 0 travel (no lodging point; first leg 0). On 1 night, Belém -> Sintra -> Belém in one day. Fix: arrival day evening-only, lodging point at the city center so first legs count. Acceptance: no block before 17:00 on the start date; Sintra shows ≥60 min to get there.

### UFR3-O03 LOGIC FAILURE / HONESTY (OBSERVED): no family fit without Jev; midnight crossings unmarked
Lux Frágil (nightclub) scheduled 22:30–01:00 for a crew with kids 8 and 12; bars at 17:00. Crew string doubles ages ("Son (8) (8)"). Fix: when kids are in the crew, flag nightlife "Adults only?", rank last, hold it out of the schedule with that reason; render "(+1)" when end < start. Acceptance: example family, keep all: the nightclub is flagged / unscheduled; late blocks show (+1).

### UFR3-O04 LOGIC FAILURE (OBSERVED): pace has no effect on typical trips
Per-day cap is `min(pace, ceil(remaining/daysLeft))`, so picks spread evenly and pace only matters when keeps exceed pace × days. Fix: give pace a visible effect or say "Your picks fit at any pace". Acceptance: different results or the note.

### UFR3-O05 STATE FAILURE (OBSERVED): arrow keys fire from anywhere
Window listener ignores only input/textarea; fires when the basket is off-screen and inside the SwipeDeck dialog. Fix: skip when defaultPrevented, a modal is open, target is select/contenteditable/button, modifiers held, or the deck isn't in view.

### UFR3-O06 DEAD END (OBSERVED): source link inside the deck card does nothing
`setPointerCapture` on pointerdown retargets the click. Fix: don't start a drag from links/buttons.

### UFR3-O07 STATE FAILURE (OBSERVED): deck state doesn't survive reload / refresh
Restore puts raw research order, index 0, no `rankedBy`; the restore effect re-runs when `items` changes (Refresh ejects the user); schedule and pace are memory-only. Fix: persist ranked ids, rankedBy, index, kept, passed, pace; restore once per trip id.

### UFR3-O08 EDGE CASE (OBSERVED): OpenTable term drops the city for long names
`[name, where].join(' ').slice(0,120)`. Fix: trim the name at a word boundary to fit, then append the city.

### UFR3-O09 HONESTY (OBSERVED): unknown travel shown as "20 min to get here"
Fix: mark unknown legs and render "travel time unknown".

### UFR3-O10 HONESTY / A11Y (OBSERVED): "doesn't book" note is tooltip-only
Fix: a visible line near Eat/Yelp and the schedule, or relabel the link "Find a table on OpenTable".

### UFR3-O11 EDGE CASE (OBSERVED): 1 listing hides the basket silently
Fix: render the heading with an explanation.

### UFR3-O12 POLISH (OBSERVED): vertical drag leaves the card offset (no pointercancel)

### UFR3-O13 UX FRICTION / COST (OBSERVED): Start over wipes keeps with no confirm and re-ranks
Fix: confirm when keeps exist; reuse the last ranking; prune orphaned basket keys.

### UFR3-O14 POLISH / HONESTY (OBSERVED): no lunch; bakeries and food halls get "Reserve"
Fix: allow lunch placement; hide OpenTable for breakfast/bakery/food hall/market/café.

## 5. Top 5

1. O01: rename the duplicated deck classes.
2. O02: fit keeps into the real trip days; count the first leg.
3. O03: family-fit rule without Jev; mark midnight crossings.
4. O05 + O06: scope the arrow keys; make the card's link clickable.
5. O07: persist deck order, position, disclosure, pace and schedule.

Screenshots: `artifacts/O-01` … `O-08`.
