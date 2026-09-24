<!-- Saved by the orchestrator from the tester's returned report: the harness blocked the subagent's own file write. -->

# Findings: Persona F, "The owner planning a real crew trip"

Tester: persona F · 2026-09-24 · environment `http://localhost:3127` (production) · branch `claude/review-recent-work-5li9lw` · no application code changed. Scripts: `scratchpad/rt-F/s1…s9*.mjs` · browser log: [artifacts/F-run-log.txt](artifacts/F-run-log.txt) · Jev: `artifacts/jev/F-J01…F-J09.json`.

## Paid-call ledger

| When (UTC) | What | Treg calls | Cost |
|---|---|---|---|
| 05:56:03 | **Nashville, Tennessee**, Matt's trip (`scene: "Rock cover bands"`, ATL→BNA, Oct 9, 3 nights) | 11 receipts (3 Maps, Tripadvisor, Yelp, 2 Instagram, 2 TikTok, Events $0, Flights) | `spentUsd: 0.05465` |
| 05:57:49 | One press of Refresh | 0 (server cache hit, 371 ms) | $0 |
| 06:00:18 and 06:00:22 | Two guests opening the invite (Nashville, no `scene`) | 0: both got 429 RESEARCH_COOLDOWN | $0 |

Places I triggered: one (Nashville). Lisbon: not used.

**Note (OBSERVED):** the production log shows "Ready" at about 05:49. The Lisbon research in `scratchpad/research.json` is from 04:39, and the cache is in memory (`destination.ts:90`), so Lisbon was no longer cached. Before my first call, the log already held an unattributed fresh run of 11 paid receipts, flights included. The brief's "Lisbon costs nothing" assumption no longer holds. Because the cache key includes `scene` (F05), a Lisbon plan built from any board with music misses the cache anyway.

## 1. Persona

| | |
|---|---|
| Context | Matt, 44, Atlanta. Braves fan, wife Kelly, boys Jack (12) and Sam (8). Loves live rock and bar cover bands. Almost always on his phone. |
| Knowledge | Not technical; trusts a ramble to be understood |
| Permissions | Anonymous; device store only. Spotify, Anthropic, event feeds and BestTime unconfigured; Treg configured |
| Job to be done | Ramble → profile → plan a typed-in place → read live research → stays for his party → vote → crew votes by link |
| Entry | `/moodboard` on a phone (390×844) → `/trips/designer` → `/trips/join` → `/now` |
| Expected end | Accurate board; Nashville plan for his real family; honest research; stays for 2 adults and 2 kids; friends' votes merged without losing his own |

## 2. Flow maps

1. `MATT -> /moodboard -> tap mic -> "Microphone access was blocked…" -> types ramble -> Build -> "travels with wife and 4 kids", no name, hometown or artists -> Save` **EXECUTED - FAIL** (F01, F02)
2. `MATT -> Spotify -> "Sign-in isn't set up yet; paste a public playlist link instead." -> paste -> 503 -> "Spotify isn't hooked up… name your favorite artists … in your ramble above"` **EXECUTED - FAIL** (F04)
3. `MATT -> "Plan a trip with this board →" -> crew You, Son (12), Son (8), Kid, Kid, Kelly; "Traveling from" empty behind the placeholder "Atlanta, Georgia" -> removes 2 kids, types Nashville, Oct 9, 3 nights, Atlanta -> Design -> canvas in 279 ms` **EXECUTED - PARTIAL** (F01, F03)
4. `MATT -> "NASHVILLE, RIGHT NOW" -> "Looking around Nashville…" 18.0 s -> 10 tabs -> footnotes` **EXECUTED - PARTIAL** (F09–F12, F14, F15)
5. `MATT -> Refresh once -> 371 ms, "fetched 2 min ago" unchanged` **EXECUTED - FAIL** (F10)
6. `MATT -> 👍 on cards -> Swipe ♥ -> deck -> "Pass the phone. Who's next?"` **EXECUTED - PASS**
7. `MATT -> Where you'll stay -> Airbnb, Vrbo, Booking for 2 adults + 2 kids (12, 8), 2 bedrooms` **EXECUTED - PASS** (links read, not clicked through)
8. `MATT -> Invite people -> "Link copied…" -> DAVE opens -> "You're invited. Nashville." -> adds himself -> votes -> Send my picks back` **EXECUTED - PARTIAL** (F05, F07, F11)
9. `FRIEND picks "You" -> votes -> picks link -> MATT: "You sent their picks. 4 votes." -> Add -> Matt's own later vote erased` **EXECUTED - FAIL** (F06)
10. `MATT -> /now -> city Nashville -> "MORNING · FOR YOU": 4 Maps-search ideas + rock cover band playbook` **EXECUTED - PARTIAL** (honest, but generic apart from the music)
11. Desktop 1440×900: board, canvas, research, join **EXECUTED - PASS** (no overflow; photos match their labels)

## 3. Test cases

| ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| T01 | happy: ramble → board | 2 sons, wife, Atlanta, 44, artists | 4 kids; no name, age, hometown or artists | FAIL | F-05, F-34 |
| T02 | unusual: app placeholder text | hometown Atlanta | age 44, hometown none (API) | FAIL | run log |
| T03 | unusual: "I'm from Atlanta." | hometown | none | FAIL | run log |
| T04 | permission: mic denied | honest fallback | "Microphone access was blocked. Allow it in the browser, or type instead." | PASS | run log |
| T05 | failure: paste playlist, Spotify unconfigured | honest up front | invited to paste, then 503 | FAIL | F-03, F-04 |
| T06 | unusual: "liked" / non-link | clear message | "Spotify is not configured…" / format hint | PASS | run log |
| T07 | refresh /moodboard after build | board kept | unsaved board gone; draft kept | PARTIAL | run log |
| T08 | first-time: designer from board | travelers and hometown carried over | 6 travelers; hometown empty behind placeholder | FAIL | F-07 |
| T09 | happy: typed place | plan + research | 279 ms / 18.0 s | PASS | F-08, F-31 |
| T10 | sources and fetch times | shown | on every tab (Events down, no time) | PASS | F-11, F-16, F-19 |
| T11 | photos match labels | provider photos | all matched | PASS | F-31 |
| T12 | hidden gems defined | rule stated | "Rated 4.6+ with 30–1,500 Google reviews" | PASS | F-11 |
| T13 | Events outage | honest | honest line + contradictory footnote | PARTIAL | F-18 |
| T14 | fares for party of 4 | per-person clear | "$347"; "one adult" below the fold | FAIL | F-19 |
| T15 | items are in the place | Nashville only | Tennessee Aquarium; hotel promo | FAIL | F-16, F-12 |
| T16 | duplicate: Refresh | new data or "already fresh" | unchanged | FAIL | run log |
| T17 | mobile: research loading visible | yes | about 2 screens down, static for 18 s | PARTIAL | F-20, F-08 |
| T18 | vote + swipe | per-voter votes | works | PASS | F-21 |
| T19 | stays sized to party | 2 adults + 2 kids, ages | correct params | PASS | F-22 |
| T20 | invite | link + honest disclosure | link copied; interest tags undisclosed | PARTIAL | F-23 |
| T21 | deep link: guest join | knows whose trip | "You're invited."; "You" chip | PARTIAL | F-24 |
| T22 | guest claims "You" | blocked or warned | allowed; organizer votes wiped | FAIL | F-27 |
| T23 | guest research | loads or explains | 429 "…cards above still work" | FAIL | run log |
| T24 | change mind: remove traveler | removed | removed | PASS | run log |
| T25 | NOW "For you" | honest, profile-shaped | generic + rock playbook, honest | PARTIAL | F-33 |
| T26 | mobile overflow | none | 390 = 390 | PASS | run log |

26 cases: PASS 10 · FAIL 11 · PARTIAL 5.

## 4. Findings

### UFR2-F01: Parser invents two extra kids — LOGIC FAILURE — OBSERVED
- **Problem:** "Two boys, Jack is 12 and Sam is 8 … Kids are into baseball" produces "travels with wife and 4 kids" with crew chips Son 12, Son 8, Kid, Kid (F-05, F-34). The API reproduces it: "I have two boys, 8 and 12. The kids love roller coasters." gives 4 children.
- **Impact:** The designer seeds 6 travelers (F-07). Unless removed, stays search for 4 kids (unknown ages default to 8, `stays.ts:23`) and 3 bedrooms, and the invite lists phantom people. Family chips on the board have no ×.
- **Jev F-J01:** accurate 0.42 · notices the kids 0.32 · can_fix 1.62/3 · lower trust 0.64. **F-J03:** removes the phantoms 0.47. I agree.
- **Root cause:** `src/lib/designer/profile.ts:242` `const count = NUMBER_WORDS[countWord] ?? (plural ? Math.max(ages.length, 2) : 1);`. Bare plurals always add ≥2 children, with no dedupe. `MoodboardStudio.tsx:285-297` has no remove control on family chips.
- **Fix:** Treat a bare plural with no count and no ages as a reference once children exist. Add × to family chips.
- **Acceptance test:** Unit test: "Two boys, 8 and 12. The kids love coasters." gives exactly 2 children. Browser test: a family chip can be removed.

### UFR2-F02: Name, age and hometown lost for ordinary phrasing — LOGIC FAILURE — OBSERVED
- **Problem:** "I'm Matt, 44, from Atlanta." gives nothing. The app's own placeholder "I'm 44, from Atlanta…" gives no hometown. "I'm from Atlanta." gives no hometown. "Foo Fighters, Pearl Jam, Tom Petty" gives no music.
- **Impact:** The YOU tile is empty. "Traveling from" is blank, so flights are silently skipped. The organizer is named "You" (feeds F06, F07). Artists never reach the playbook.
- **Root cause:** `profile.ts:219` the RegExp lacks the `i` flag, so "I'm" never matches. `:221` accepts only "from X, Y". `parseName` `:210` accepts only "my name is…". `parseAge` `:201` needs "I'm 44". There is no artist dictionary.
- **Fix:** Add the `i` flag; accept a single-city "from X"; accept "I'm <Name>, <age>"; add editable identity fields on the board.
- **Acceptance test:** The placeholder and "I'm Matt, 44, from Atlanta." give name, age and hometown.

### UFR2-F03: "Traveling from" placeholder reads as filled — AMBIGUITY — OBSERVED + CODE
- **Problem:** The field is empty but shows "Atlanta, Georgia" in grey (F-07). Nothing says fares depend on it. If left empty, research runs without from/to (`DestinationResearch.tsx:182`), and the trip's hometown can't be edited later.
- **Jev F-J03:** thinks it's filled 0.67.
- **Root cause:** `TripDesigner.tsx:244`.
- **Fix:** Placeholder "Your home city (for fares)" plus a hint.
- **Acceptance test:** No city-like placeholder; the hint mentions fares.

### UFR2-F04: Spotify panel invites a paste that can't work, then a fallback that doesn't work — DEAD END — OBSERVED
- **Problem:** "Sign-in isn't set up yet; paste a public playlist link instead." The paste returns 503, then "Spotify isn't hooked up… name your favorite artists and genres in your ramble above." He already had (F02). Evidence: F-03, F-04.
- **Jev F-J02:** expects paste to work 0.66 · honesty 0.87/3 ("Misleading" 0.48) · fallback useful 0.20.
- **Root cause:** `SpotifyPanel.tsx:171` gates on the client ID only. `api/designer/playlist/route.ts:21` needs the server app credentials.
- **Fix:** Expose one "Spotify reading available" flag; disable the paste with an honest note when it's off.
- **Acceptance test:** When unconfigured, no copy invites a paste.

### UFR2-F05: Every invited friend's first open would re-bill research for the same place — COST EXPOSURE — OBSERVED request + INFERRED billing
- **Problem:** Organizer request `{"name":"Nashville","region":"Tennessee","scene":"Rock cover bands","from":"ATL",…}`. Guest request is the same without `scene`, because the link strips `taste`. The server cache key includes `scene`, so each guest's copy misses the cache and would start a fresh ~$0.055, 11-call run per 6 h window. Guests would also see a different "Nights out" list. The guests here were 429'd, so nothing was billed. The same design makes any cached place miss for boards with music.
- **Root cause:** `tripShare.ts:211` (`delete shared.taste`) → `DestinationResearch.tsx:175` → `destination.ts:268` (`placeKey` includes `fold(req.scene)`).
- **Fix:** Cache place parts without the scene, and cache the scene-steered nightlife query separately. Or carry the scene label, which isn't personal data, in the link.
- **Acceptance test:** Same place with and without `scene` makes at most one set of non-nightlife calls. A guest open within the TTL makes 0 new receipts.

### UFR2-F06: Guest can claim the organizer and erase his votes — STATE FAILURE — OBSERVED
- **Problem:** The join list offers "You" (the organizer). A friend who picked it sent picks. Matt saw "You sent their picks. 4 votes. … their new picks replace the old ones" (F-27). After "Add their picks" it said "You's 4 picks are in." Matt's own love for "Nashville with kids", made after the invite, went from `{"p0":1}` to `{}`.
- **Jev F-J06:** understands 0.22 · clarity 0.17/3 ("Confusing and destructive" 0.90). **F-J05:** friend taps "You" 0.51.
- **Root cause:** `tripShare.ts:264-273`: `mergeReply` deletes all votes by the claimed `participant.id`. `JoinTrip.tsx:139-156` offers every participant. `JoinTrip.tsx:196,205` gives no warning.
- **Fix:** Mark the organizer in the link and exclude them from the guest list. Warn or refuse when a reply claims the local organizer, and show vote-change counts before merging.
- **Acceptance test:** A reply claiming `p0` can't silently overwrite; the organizer is never offered to guests.

### UFR2-F07: The invite doesn't say whose trip it is — AMBIGUITY — OBSERVED
- **Problem:** "You're invited. Nashville." The first chip is "You" (F-24).
- **Jev F-J05:** knows whose trip 0.23.
- **Root cause:** `TripExtras.tsx:127-130` drops the name "You" (correctly), but nothing asks for a real name. `TripDesigner.tsx:29` defaults to `'You'`.
- **Fix:** Ask "What should your crew see you as?" before the first invite.
- **Acceptance test:** Join headline reads "Matt wants you on this trip."

### UFR2-F08: The share link carries data beyond its disclosure — PRIVACY (low–medium) — OBSERVED + CODE
- **Problem:** The disclosure says "(names, kids' ages, home city). Music taste stays on your device." The decoded payload also includes adults' interest tags (`["water","hearty","sports"]` for Matt and Kelly) and, per `cleanParticipant`, adult ages when known.
- **Jev F-J05:** Matt comfortable with this 0.31.
- **Root cause:** `tripShare.ts:209-213` strips only `taste`/`joinedFrom`. Copy is at `TripExtras.tsx:183`.
- **Fix:** Strip `tags` and adult `age` from shared participants, or disclose them.
- **Acceptance test:** Decoded payload has no `tags` and no adult `age`.

### UFR2-F09: Fares look like trip prices — AMBIGUITY — OBSERVED
- **Problem:** "$347 Southwest ATL → BNA nonstop" is the headline. "Round trip, one adult, economy… confirm before you book" sits below 4 tall cards, below the fold and behind the tab bar (F-19). The party is 4 people, about $1,390. "Typical $130–$240" sits beside fares that are all above it, unexplained.
- **Jev F-J04:** reads $347 as the family total 0.31 · understands indicative 0.52. I rate the risk higher than Jev.
- **Root cause:** `DestinationResearch.tsx:132` (price only); footnote at `:164`.
- **Fix:** "$347 per adult · round trip" on each card, a party estimate, and the qualifier above the cards.
- **Acceptance test:** "per adult" visible on every card at 390×844 without scrolling.

### UFR2-F10: Refresh doesn't refresh — POOR FEEDBACK — OBSERVED
- **Problem:** 371 ms, "fetched 2 min ago" unchanged, and one of the 4-per-10-minutes limiter tokens consumed.
- **Jev F-J04:** believes new data was fetched 0.53.
- **Root cause:** `DestinationResearch.tsx:229` skips only localStorage. `destination.ts:270` has no bypass. `research/route.ts:55` limits before the cache lookup.
- **Fix:** Show "Updated X ago" or "already up to date"; don't count cache hits.
- **Acceptance test:** Refresh within the TTL shows an "already fresh" message and no limiter decrement.

### UFR2-F11: Guest research error is misleading — RECOVERY FAILURE / EDGE CASE — OBSERVED
- **Problem:** "Research just ran a few times. Give it ten minutes. The idea cards above still work." There is no retry, the cards are below, and the guest ran nothing. The limiter counts cache hits and keys by IP, so a crew on one Wi-Fi shares 4 opens per 10 minutes. In this environment all testers share one identity, so this 429 was partly caused by other personas.
- **Jev F-J08:** understands 0.48 · blames himself 0.47.
- **Root cause:** `research/route.ts:55`; `guard.ts:73,76-81`; copy at `DestinationResearch.tsx:239,242` ("above").
- **Fix:** Don't limit cache hits; auto-retry with friendly copy; change "above" to "below".
- **Acceptance test:** 6 opens of a cached trip from one IP in 10 minutes all render research.

### UFR2-F12: "Pulled live" items that aren't about the place — AMBIGUITY (provider truth) — OBSERVED
- **Problem:** Tripadvisor for Nashville lists Tennessee Aquarium (Chattanooga, about 2 h away) (F-16). Instagram shows `@executiveinngoodlettsville` "Enjoy a comfortable stay at Executive Inn & Suites, Goodlettsville…" labeled "THE PARTHENON", a ticket giveaway, and a "Feb 2020" photo shown as "1 h ago" (F-12).
- **Jev F-J04:** assumes all are in Nashville 0.70.
- **Root cause:** `destinationSources.ts:183-206` (no locality check); `:265` (only `isAd`/`paidPartnership` filtered).
- **Fix:** Filter Tripadvisor by address or radius; down-rank lodging and brand promos, or label the tab "unvetted".
- **Acceptance test:** A Chattanooga fixture row is filtered for Nashville.

### UFR2-F13: City family trip gets ski Après, overnight flight and cocktails — LOGIC FAILURE — OBSERVED
- **Problem:** Every middle day has "Après" ("Rooftop at golden hour", "Spa hour"). Day 1 offers "Overnight flight" for a 1 h 10 m hop plus "Airport lounge warm-up", and no drive option (about 4 h). The Day 2 late-night pick is "Cocktails in Nashville" for a family with kids 8 and 12.
- **Jev F-J07:** fit 1.78/3 (I disagree; I'd rate about 1) · Après confusing 0.53.
- **Root cause:** `itinerary.ts:149` always adds `'apres'`. `catalog.ts:182` has no distance guard on the overnight flight. The `scoreCard` late-night penalty is skipped because music tags are present.
- **Fix:** Add `apres` only for ski trips; drop overnight flight and lounge for short hops; add a Drive card.
- **Acceptance test:** City trips have no Après; ATL→BNA has no overnight flight.

### UFR2-F14: 18 s static loading, below the fold — POOR FEEDBACK — OBSERVED
- **Problem:** The page scrolls to the top on create. The panel is about 1.9 viewports down, and shows one static line for 18.0 s (F-20, F-08).
- **Root cause:** `DestinationResearch.tsx:238`; placement at `TripCanvas.tsx:167`.
- **Fix:** A "Researching… ~15 s" chip in the hero, plus per-source ticks or skeleton cards.
- **Acceptance test:** Within 1 s at 390×844, something above the fold says research is running.

### UFR2-F15: Events outage footnote contradicts itself — POLISH — OBSERVED
- **Problem:** "The events feed is down…" sits over "Listings and ratings are theirs; check hours…" (F-18). The live-music panel separately says "Event feeds not connected".
- **Jev F-J04:** 1.84/3 ("Honest, no next step" 0.79).
- **Root cause:** `DestinationResearch.tsx:166-168` ignores `status`.
- **Fix:** Use a status-aware footnote and a Google events search link.
- **Acceptance test:** Unavailable sections show no listings copy.

### UFR2-F16: Board can't be corrected; unsaved board lost on reload — MISSING STEP — OBSERVED
- **Problem:** No way to edit name, hometown or family. The YOU tile is a large empty card (F-05; a redesign weak spot). A built but unsaved board vanishes on reload.
- **Root cause:** `MoodboardStudio.tsx:285-297`, `:45`.
- **Fix:** Editable identity and crew row; autosave the draft board.
- **Acceptance test:** A hometown edited on the board is prefilled in the designer.

## 5. Tables

**Dead ends:**

| Where | What the user sees | Why | Finding |
|---|---|---|---|
| Spotify | paste → 503 → "use ramble" | ramble drops artists | F04, F02 |
| Guest research | "…cards above" | no retry; wrong direction | F11 |
| Board | wrong facts | no edit | F16, F01 |

**Ambiguities:**

| Text | Misreading | Jev | Finding |
|---|---|---|---|
| "Atlanta, Georgia" placeholder | already filled | 0.67 | F03 |
| "$347" | family total | 0.31 (I rate higher) | F09 |
| Refresh | new data fetched | 0.53 | F10 |
| "You're invited." / "You" chip | whose trip / "me" | 0.23 / 0.51 | F07, F06 |
| Research items | all in Nashville | 0.70 | F12 |
| "Après" | ? | 0.53 | F13 |

**State-machine problems:**

| State | Transition | Problem | Finding |
|---|---|---|---|
| Organizer votes | merge reply claiming `p0` | silently replaced | F06 |
| Unsaved board | reload | lost | F16 |
| Research cache | same place, different scene | re-billed | F05 |
| Limiter | cache hit / Refresh | consumes quota, blocks guests | F10, F11 |
| Device trip | guest opens invite with own trip | replaced after `confirm()` | noted only |

**Permission/privacy problems:**

| Data | Where | Disclosed? | Finding |
|---|---|---|---|
| Names, kids' ages, hometown | link fragment | yes | — |
| Adult interest tags, adult ages | link fragment | no | F08 |
| Voter identity | picks link (self-asserted) | n/a | F06 |
| Ramble | `/api/designer/profile`; draft in localStorage | yes | — |

## 6. Repair specs

**PROPOSED CONCEPT - NOT CURRENT APPLICATION: "Did we get you right?" strip (F01, F02, F03, F16)**
After Build, show editable inline fields `You: [Matt] · [44] · from [Atlanta, GA]` and crew chips (Kelly, Jack 12, Sam 8) with × and "+ add". Tint any values inferred from plurals. The designer prefills from confirmed fields. On phone it wraps to two lines with 44 px targets.

**PROPOSED CONCEPT - NOT CURRENT APPLICATION: Guest identity and safe merge (F06, F07)**
Join headline: "**Matt** wants you on this trip." The organizer appears as a non-selectable "Matt · organizer" label. For a picks link claiming the organizer: "These picks claim to be yours. Replace your 5 votes with these 4?" with Cancel as the primary button. Otherwise: "Dave: 4 picks (2 new, 2 changed)" before Add.

## Coverage

- Flows: 11 (PASS 3 · PARTIAL 5 · FAIL 3); tablet not tested.
- Test cases: 26 (PASS 10 · FAIL 11 · PARTIAL 5).
- Findings: 16.
- Jev: 9 calls, HTTP 200, `jev-1.13.0`. F-J09 completion 1.94/3 ("Done with notable friction and some wrong data" 0.94); would return 0.51.
- Paid research: 1 run ($0.05465).
- Viewports: 390×844 primary; 1440×900 for board, canvas, research and join.
