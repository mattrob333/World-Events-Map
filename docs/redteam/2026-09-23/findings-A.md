# UserFlow Red Team — Persona A (first-time anonymous explorer)

> Written by the persona A tester agent; saved to disk by the orchestrator from its returned report (subagent file writes were blocked by the harness). Jev file labels are the file names in `artifacts/jev/`; UFR-A10.json also covers A12's lead_time_misread.
>
> **Orchestrator verification (UFR-A01):** independently reproduced in a fresh context — typing "Aspen" in the `/` toolbar search → page error `Cannot read properties of undefined (reading 'distanceKm')` and "This page couldn't load"; `src/app/error.tsx` and `global-error.tsx` confirmed absent. Evidence: `artifacts/VERIFY-UFR-A01-orchestrator.png`.

Target: MERIDIAN `main` @ fb99093, `http://localhost:3127` (production build, real mode, no providers configured). Browser: Playwright 1.56 Chromium (swiftshader WebGL), desktop 1440x900 (plus 1920x1080 / 1280x800 spot checks) and phone 390x844 (isMobile, hasTouch). Timezone America/New_York unless stated. Scripts: `scratchpad/rt-A/s1.mjs`–`s16.mjs`. **Jev:** EXECUTED (jev-1.13.0, 11 calls; `artifacts/jev/UFR-A01.json` … `UFR-A13.json`, `UFR-A-landing.json`). **treg:** EXTERNAL VALIDATION NOT EXECUTED. No application code, config or data was modified.

**Findings (16):** BLOCKER 1 · STATE FAILURE 3 · LOGIC FAILURE 2 · AMBIGUITY 4 · POOR FEEDBACK 2 · MISSING STEP 1 · UX FRICTION 1 · EDGE CASE 1 · POLISH 1.

Environment noise (not findings): Wikimedia `thumb.wikimedia.org` requests fail with `ERR_CERT_AUTHORITY_INVALID` through the sandbox proxy; `_rsc` prefetch aborts; THREE.Clock deprecation and swiftshader warnings.

## 1. Persona
| Field | Value |
|---|---|
| User type | Unauthenticated first-time visitor |
| Context | Affluent independent traveler; lands on `/` from a link; desktop first, later phone |
| Knowledge | None of MERIDIAN's vocabulary (PULSE, Scene, Wire, lens, beacon, dossier, Circle, Heat) |
| Permissions | Anonymous; no membership service on this deployment; may grant or deny geolocation |
| JTBD | "Find a place/event worth traveling to in my window, understand why it's worth it and how far it is from me, and keep it for later." |
| Entry point | `http://localhost:3127/` |
| Expected end state | A shortlisted place with reasons and an honest distance estimate from my city, saved somewhere I can find again after refresh or on return |

## 2. Flow maps
- **F1 — Landing orientation** — `EXECUTED - PARTIAL`. USER -> `/` -> geolocation prompt ~0.8 s after load with no click [A05] -> hero "The best stories start somewhere." + "Set your traveler lens" banner (Begin/Skip) + "Fly to Monte-Carlo" + "See what is calling" -> purpose mostly clear; banner and Fly CTA not. Jev `UFR-A-landing`: understands_purpose **0.70**, lens_banner_clear **0.16**, fly_cta_prediction **0.28**, first_action **choose_city** (p 0.84, conf 0.80).
- **F2 — Origin (city / device location)** — `EXECUTED - PARTIAL`. Choose "Atlanta, Georgia" -> "Viewing Atlanta, Georgia", pass card "FROM Atlanta → Monte-Carlo 7,630 km · ~10h in the air · Indicative straight-line distance and airtime; no live flight schedule." (PASS, honest estimate wording) -> survives reload (sessionStorage) (PASS) -> "Use device location" + deny -> contradictory state, city lost on reload [A04]. Denied from start -> "Use my location" click gives no feedback [A05]. Granted (Atlanta) -> "Using device location", "Your area → Monte-Carlo 7,630 km" (PASS).
- **F3 — Discovery → globe → destination → save → return** — `EXECUTED - PARTIAL`. Winter -> "Winter · Ski & snow · 6 places" -> "Fly there on the globe" (Aspen) -> arc, "Aspen is calling.", reasons, "YOUR AREA → ASPEN 2,090 km · ~3h in the air" -> "Open Aspen" hidden in an inner scroll [A09] -> `/destinations/aspen` (no distance [A10]) -> Save/Watch -> "Saved ✓ / Watching ✓ · Save and Watch stay on this device" (PASS) -> reload keeps (PASS) -> `/trips` "Saved places 1 · On your radar 1" (PASS) -> click saved item -> `/?event=aspen-christmas-week` panel "Event saving will be available when membership is connected." and "LEAD TIME Today" [A03, A12].
- **F4 — Search** — `EXECUTED - FAIL`. In-page field: "Monaco", "yacht", "a" work; "Aspen", "ski", "qwzxv" crash the page [A01]. ⌘K palette: "Aspen", "ski", "jazz", "beach" good results → `/destinations/aspen` (PASS); "romantic", "Atlanta", "qwzxv" → "Nothing matches. Try a city, a person, or an occasion." (PASS); fixture items under "SAVED" [A08].
- **F5 — Globe interaction** — `EXECUTED - PASS`. Hover marker → preview card; moving into card keeps it open; moving away hides it (~1 s measured incl. animation; 350 ms constant at `HoverReadout.tsx:13`, exact timing UNKNOWN); click opens side panel; region buttons fly camera.
- **F6 — Travel Wire / Research Pulse / Scene / ideas** — `EXECUTED - PARTIAL`. Research Pulse honest ("awaiting setup … No prices or seats to show yet."); Scene "EDITORIAL SAMPLE REPLAY", X panel "No recent X source check is available" (honest). Travel Wire names vendors on "commercial hold" [A13]. "For you" not personalised [A07].
- **F7 — Traveler lens (onboarding)** — `EXECUTED - FAIL` (completes; promise not kept) [A07]. Skip hides banner and persists (PASS).
- **F8 — Adversarial** — `EXECUTED - PARTIAL`: Back after card [A06], refresh mid-flow [A06], deep links, rapid clicks (PASS), filter change mid-flight (PASS), city → device → deny [A04].
- **F9 — Phone 390x844 core path** — `EXECUTED - PASS (with polish)`: Winter → card → spotlight route + "Open Aspen" reachable → destination → Save → More → Trips shows it. No horizontal overflow. "Aspenis calling." [A16].

## 3. Test cases
| Test ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| A-T01 | first-time landing | Clear purpose, first step | Mostly clear; geolocation prompt ~0.8 s without click; lens banner unexplained | PARTIAL | A-01, Jev UFR-A-landing |
| A-T02 | happy: choose city | Estimate labelled | "7,630 km · ~10h … Indicative … no live flight schedule." | PASS | s6 |
| A-T03 | permission granted | Origin used | "Using device location", 7,630 km | PASS | A-02 |
| A-T04 | denied, click Use my location | Feedback + recovery | No visible change | FAIL | A-16 |
| A-T05 | city → device → deny | Consistent | "Viewing Atlanta" + "Choose your city…"; city lost on reload | FAIL | A-17 |
| A-T06 | city (London) → device granted | Switch origin | Switches, select cleared | PASS | s6 |
| A-T07 | refresh with city | Kept | Kept (same tab); new tab loses (by design) | PASS | s6 |
| A-T08 | season × interest → card | Shortlist + flight | 6 ski places; flight, route, reasons | PASS | A-03, A-04 |
| A-T09 | desktop selected panel | CTA visible | "Open Aspen" 126 px below inner fold (517>391); heading overlap | PARTIAL | A-04, A-06 |
| A-T10 | destination page | Why + how far + keep | Why yes; how far absent; keep works | PARTIAL | A-07, A-08 |
| A-T11 | save persists | Findable | "Saved ✓" after reload; Trips "Saved places 1" | PASS | A-08, A-11 |
| A-T12 | re-entry from saved item | Consistent | "saving will be available when membership is connected"; "LEAD TIME Today" | FAIL | A-12 |
| A-T13 | in-page search "Aspen" | Results | "This page couldn't load" | FAIL | A-20, VERIFY-UFR-A01 |
| A-T14 | in-page search "qwzxv" | Empty state | Same crash | FAIL | s8b |
| A-T15 | ⌘K "Aspen"/"ski"/"beach" | Relevant | Relevant → `/destinations/aspen` | PASS | s8c |
| A-T16 | ⌘K nonsense | Empty state | "Nothing matches…" | PASS | s8c |
| A-T17 | ⌘K fresh user | No saved items | "SAVED" lists editorial fixtures | FAIL | A-40 |
| A-T18 | globe hover/select/regions | Work | Work | PASS | A-13, A-14 |
| A-T19 | Back after card | Previous view | Leaves MERIDIAN (`about:blank`) | FAIL | s7 |
| A-T20 | refresh mid-flow | Selection kept | Reset to "Every season · Anything" | FAIL | s7 |
| A-T21 | rapid clicks on 3 cards | Last wins | Last wins | PASS | s7 |
| A-T22 | filter change mid-flight | Cancel flight | Cancelled | PASS | A-19 |
| A-T23 | `/destinations/aspen` | Page | Renders | PASS | A-07 |
| A-T24 | `/destinations/not-a-place` | Honest not-found | "That destination is not on the calendar." (HTTP 200) | PASS | A-27 |
| A-T25 | `/destinations/ASPEN` | Resolve | Not found | FAIL (minor) | s10 |
| A-T26 | `/?event=not-an-event` | Notice | Silently ignored | FAIL (minor) | s10 |
| A-T27 | Wire/Pulse/Scene unconfigured | Honest, understandable | Honest; Wire copy vendor jargon | PARTIAL | A-24, A-25 |
| A-T28 | onboarding complete | Home reflects lens | Identical | FAIL | A-31 |
| A-T29 | dates mode after Winter | Combined | Winter/Ski dropped; globe still "WINTER ATLAS" | FAIL | A-39 |
| A-T30 | mobile core path | Completes | Completes; "Aspenis calling." | PASS | A-32, A-34, A-35 |
| A-T31 | "Start a Circle here" anonymous | Honest | "No Circle or booking has been created…" | PASS | A-38 |

## 4. Findings

### UFR-A01 — In-page search crashes the whole home page for any query with no event "today" — BLOCKER · OBSERVED (orchestrator-verified)
**Location:** `/` toolbar field "A place, a passion, a possibility…" (desktop and phone). **Problem:** "Aspen", "ski", "qwzxv" replace the app with "This page couldn't load · Reload to try again, or go back."; page error `Cannot read properties of undefined (reading 'distanceKm')`. Reproduced with location granted and denied (6/6 for these terms; "Monaco", "yacht", "a" don't crash). The "No scenes in this view" empty state is unreachable outside dates mode; dates mode doesn't crash (s15). **Impact:** the most natural discovery action destroys the page, header, nav and state; Aspen is featured on the same page. **Jev UFR-A01:** understands_cause **0.25**; job_blocked **2.3**/3 (p2 0.51, p3 0.40); next_action **reload_and_retry_same_search** (p 0.50; reload_and_browse 0.39). Analyst: agree — the likeliest recovery crashes again, so abandonment risk exceeds p3 0.40. **Root cause:** `src/components/discovery/DiscoveryExperience.tsx:155-158` — `nearbyScenes[0]?.event.id === spotlight?.id ? nearbyScenes[0].distanceKm : null`; with no scenes and no spotlight, `undefined === undefined` → `nearbyScenes[0].distanceKm` throws. Contributing: no `src/app/error.tsx`/`global-error.tsx`; outside dates mode the in-page search filters only today's events (`:105-116`, `isHappeningToday` `:113`). **Fix:** guard `spotlight && nearbyScenes[0]?.event.id === spotlight.id`; add `src/app/error.tsx` keeping the shell with "Back to World"; widen search scope (A02). **Acceptance:** type "Aspen", "ski", "qwzxv" on `/` (location granted and denied) → no page error, `#world-map` rendered, results or "No scenes in this view." + "Clear search".

### UFR-A02 — Two search boxes with different scopes; page search only covers "today" — AMBIGUITY · OBSERVED (scope) / INFERRED (post-fix)
Header ⌘K searches destinations, events, circles, access, people across the calendar; in-page field searches only today's events (`DiscoveryExperience.tsx:113`) unless in dates mode. Even with A01 fixed, "Aspen" → "No scenes in this view." on 23 Sep. **Root cause:** `DiscoveryExperience.tsx:105-116` + `useScoredEvents` filter (`src/lib/selectors/index.ts:250-252`). **Fix:** route the in-page field to `searchCatalog` (or open the palette with the text), or widen to the full calendar with dates. **Acceptance:** "Aspen" in either surface reaches `/destinations/aspen` within one step.

### UFR-A03 — Saved on this device, then told saving is unavailable — STATE FAILURE · OBSERVED
Destination page, Travel ideas and Scene save to a local store; the globe side panel for the same event uses a membership-backed button: "Event saving will be available when membership is connected.", no saved indicator even when arrived from Saved list. Saved list calls events "Saved places"; no pointer to where the item went (phone: Trips under "More"). **Jev UFR-A03:** believes_still_saved **0.35**; contradiction_perceived **0.80**; interpretation **saved_on_device_only** (p 0.54; save_was_lost 0.21; must_sign_up_to_keep 0.16). Analyst: agree. **Root cause:** `EventDossier.tsx:194` → `EventSaveButton` (`community/EventSaveButton.tsx:36-41`, Supabase `saved_events`); `DestinationPage.tsx:77-88`, `IdeasRail.tsx:63`, `ActivityStream.tsx:168` use `useIntentStore` (`src/lib/intent/store.ts`, localStorage `meridian.intent.v1`). Source-of-truth decision: HIGH_CAPABILITY_ONLY. **Fix:** when `!client` render the local Save/Watch in the panel; define one sync rule with membership; "View in Trips" after save. **Acceptance:** save on destination → panel from globe or Trips shows "Saved ✓ (this device)"; "will be available when membership is connected" never appears beside a saved item.

### UFR-A04 — City chosen, then device location denied: "Viewing Atlanta" yet "Choose your city"; choice lost on reload — STATE FAILURE · OBSERVED
After deny: "Viewing Atlanta, Georgia", dropdown "Atlanta, Georgia", but pass card "FROM YOUR VIEW … Choose your city for a route estimate"; stored city deleted before the request, so reload shows "Location unavailable · choose a city". Re-selecting the same value won't fire `change` (INFERRED). **Jev UFR-A04:** state_contradictory **0.52**; knows_how_to_restore_route **0.42**; next_action **click_location_again** (p 0.54; ignore_distance 0.36; reselect_atlanta 0.08). Analyst: partly disagree — the strings directly conflict; the likeliest action fails again. **Root cause:** `src/lib/location/useViewerLocation.ts:69` removes `meridian.viewing-city` before requesting; `:87-92` on failure sets only `status`, leaving `source:'chosen'`; `DiscoveryExperience.tsx:166-167` requires `status==='granted'` for an origin while `:271-272` shows "Viewing …" whenever `source==='chosen'`. Precise-location: HIGH_CAPABILITY_ONLY. **Fix:** keep the city until a device fix succeeds; on failure restore the chosen city + inline "Location blocked — still using Atlanta". **Acceptance:** Atlanta → device → deny → estimate still shown with notice; reload keeps Atlanta.

### UFR-A05 — Location requested on first paint; later click on a denied browser does nothing visible — POOR FEEDBACK · OBSERVED
`getCurrentPosition` called ~802 ms after load without a gesture (instrumented, 1 call). With permission blocked, status "Location unavailable · choose a city" (denied and unavailable merged); clicking "Use my location" changes nothing. **Jev UFR-A05:** click_had_effect **0.26**; knows_permission_is_blocked **0.26**; prompt_timing **0.2**/3 (p0 "clearly inappropriate" 0.83). Analyst: agree. **Root cause:** `useViewerLocation.ts:123` (`setTimeout(requestLocation, 0)` on mount); `DiscoveryExperience.tsx:273-277`, `:299-303`. HIGH_CAPABILITY_ONLY review. **Fix:** ask only on click; on `denied` show "Location is blocked in your browser settings — choose a city instead" and focus the select. **Acceptance:** fresh context: 0 geolocation calls before a click; denied click shows the message within 1 s.

### UFR-A06 — Selection and filters in memory only: Back leaves MERIDIAN, refresh resets — STATE FAILURE · OBSERVED
Summer → Puerto Ayora: `history.length` 2, Back → `about:blank`. Fall → Munich, reload → "Every season · Anything". URL never changes; not shareable. **Root cause:** `DiscoveryExperience.tsx:75-76` (`journeyEventId`, `tripMode` in `useState`); `travelFromCard` (`:196-211`), `changeTripMode` (`:182-194`) never write the URL; only `?event=` read (`:54`, `:232-247`). **Fix:** mirror season, interest, selected event in search params (`router.replace` for filters, `router.push` for journey); restore on load. **Acceptance:** Winter → Aspen → reload keeps both; Back returns to unselected Winter view.

### UFR-A07 — Traveler lens collected but never used; "For you" not personal — LOGIC FAILURE · OBSERVED
Copy promises "This just opens the product around you" / "Pick a few so World Heat has something to talk to". After Family + Skiing + Private → home identical ("Fly to Monte-Carlo", "Every season · Anything", "For you" = Galápagos, Maldives mantas, Masai Mara); home region not used as origin. **Jev UFR-A07:** expected_personalization **0.51**; promise_kept **0.17**; for_you_misleading **0.82**. Analyst: agree (would rate expectation higher). **Root cause:** `useOnboardingStore` read only in `AppShell.tsx:47-48` and `OnboardingFlow.tsx:42`; copy `OnboardingFlow.tsx:19,27`; "For you" at `src/lib/ideas-preview/recommend.ts:5`. **Fix:** smallest honest — change copy ("Saved for later — MERIDIAN does not personalize the preview yet"), rename "For you" → "Editor's mix"; better — seed `tripMode` from the lens and use `homeRegion` as suggested origin. **Acceptance:** after onboarding with Skiing, the finder opens on Winter · Ski & snow, or no screen claims personalization.

### UFR-A08 — Palette shows "SAVED" editorial fixtures to a user who saved nothing; destinations tagged "live" — AMBIGUITY (honesty) · OBSERVED
With `meridian.intent.v1` null, "Aspen" → SAVED: "Cloud Nine Alpine Bistro — restaurant · editorial board", "Four mountains, one town — article · editorial board"; empty query → "Monte-Carlo — Monaco · live". **Jev UFR-A08:** believes_saved_by_someone **0.41**; saved_group_honest **0.12**/3 (p0 "Misleading" 0.90); live_label_meaning **live_data_feed** (p 0.30; live_availability 0.29; unclear 0.25; event_happening_now 0.16; conf 0.07). Analyst: agree — only 0.16 read "live" correctly. **Root cause:** `src/lib/search/catalog.ts:132-141` (fixtures with `group: 'saved'`, label `:36`), `:78` exposes `pulse.status` from `src/lib/pulse/fromEvents.ts:94`. **Fix:** "Editorial ideas" group; "Saved" only for intent-store items; render status "on now / coming up / seasonal". **Acceptance:** fresh context never shows "Saved" until the user saves; no bare "live" for curated status.

### UFR-A09 — Desktop selected-journey panel hides "Open Aspen" in an inner scroll; first line collides with heading — UX FRICTION · OBSERVED (also UFR-B11)
Spotlight `overflow-y:auto` scrollHeight 517 vs clientHeight 391; "Open Aspen"/"Start a Circle here" ~126 px below its fold; heading bottom 175 px overlaps spotlight top 153 px. **Jev UFR-A09:** finds_next_step **0.34**; likely_next **scroll_panel_to_open_aspen** (p 0.97) — analyst disagrees: Jev was told the CTA exists, a real user isn't. **Root cause:** `discovery.module.css:1522-1526`, `:1423-1429`, `:186`, `:218-225`. **Fix:** CTA row directly under the title, or sticky at the bottom; offset spotlight by the heading's real height. **Acceptance:** 1440x900, "Open Aspen" visible without scrolling; no heading/spotlight overlap.

### UFR-A10 — "How far from me" disappears on the destination page — MISSING STEP · OBSERVED
Globe shows "YOUR AREA → ASPEN 2,090 km · ~3h in the air"; destination page and side panel show no origin/distance/airtime. **Jev UFR-A10:** distance_on_destination **0.18**; decision_support **0.57**/3 (p0 "Poor" 0.45, p1 "Partial" 0.54). Analyst: agree. **Root cause:** `DestinationPage.tsx:219-224` fact bar; origin lives only in `useViewerLocation` inside `DiscoveryExperience`. **Fix:** "From Atlanta ≈ 2,090 km · ~3h in the air (indicative)" via `estimateRoute` + stored chosen city, "Choose your city" when unknown; never persist device coordinates (`useViewerLocation.ts:54-57`). **Acceptance:** Atlanta → `/destinations/aspen` shows the indicative distance; no city → "Choose your city" link.

### UFR-A11 — Choosing dates silently drops the season/interest shortlist; globe still "WINTER ATLAS" — LOGIC FAILURE · OBSERVED
Winter → dates 15 Jan 2027 → finder disappears; list becomes "On your horizon: Venice Carnevale, Paris Haute Couture"; stats "35 events in window · 33 destinations · 241 matching occasions"; legend still "WINTER ATLAS · 6 SKI SCENES". **Jev UFR-A11:** expects_combined **0.51**; understands_filter_dropped **0.29**; stats_clear **0.25**. **Root cause:** `DiscoveryExperience.tsx:94-95` (`modeActive` requires `!planMode`), `:347`, `:370`, `:580-581`. REVIEW_REQUIRED. **Fix:** apply interest filtering inside the window (or chip "Winter · Ski — cleared by dates, restore?"); hide winter legend when not `modeActive`; label third stat "on the whole calendar". **Acceptance:** Winter → dates → ski occasions within window or a visible chip; legend matches list.

### UFR-A12 — "LEAD TIME Today" on a December event reopened on 23 Sep — AMBIGUITY · OBSERVED
Deep link sets the focus date to the event start (toolbar 12/19/2026), so lead time reads "Today · from the focused date". **Jev (UFR-A10 file, lead_time_misread):** **0.31**. Analyst: partly disagree — "from the focused date" is internal vocabulary; the true ~87-day lead is lost either way. **Root cause:** `DiscoveryExperience.tsx:243` (`setFocus(event.start)`); `EventDossier.tsx:204-207`. **Fix:** lead time from today; announce a moved calendar. **Acceptance:** on 2026-09-23 `/?event=aspen-christmas-week` shows ~87 days.

### UFR-A13 — Internal vocabulary and vendor names exposed — AMBIGUITY · OBSERVED
Masthead "20 | ◆ LEGENDARY" / "110 | ◆ MARQUEE"; "Modeled Heat 57/100"; Wire "Ticketmaster, PredictHQ, and Amadeus are on commercial hold and stay unconfigured."; `/trips` "Exa / Treg trip queries pending"; lens banner. **Jev UFR-A13:** numbers_understood **0.15**; wire_copy_comprehension **0.32**/2 (p0 "Confusing internal jargon" 0.70); believes_live_deals_exist **0.16**; overall_live_vs_curated_clarity **2.64**/3 (p3 0.71). Landing: lens_banner_clear **0.16**. Analyst: agree — honesty good, vocabulary not user-facing. **Root cause:** `EventDossier.tsx:147,150`; `src/lib/signals/wire.ts:169`; `TripsPage.tsx:182`; `AppShell.tsx:123`. **Fix:** "#20 in modeled demand" + tooltip; "Live travel signals are not connected on this preview."; "Articles & social sources pending"; "Tell us how you travel (1 min) — optional". **Acceptance:** no user-visible vendor names or "commercial hold"; no bare rank numbers.

### UFR-A14 — Invalid or case-variant deep links fail silently — EDGE CASE · OBSERVED
`/?event=not-an-event` silent; `/destinations/ASPEN`, `/destinations/aspen%20` → not found; `/destinations/not-a-place` honest but HTTP 200. **Root cause:** `DiscoveryExperience.tsx:238-239`; `DestinationPage.tsx:40-43`; no `notFound()`. **Fix:** normalise slugs; toast for unknown `?event`; `notFound()`. **Acceptance:** `/destinations/ASPEN` renders Aspen; unknown slug → 404; unknown `?event` → notice.

### UFR-A15 — Dossier handoffs lose context — POOR FEEDBACK · OBSERVED (links) / CODE-REVIEW
"Find access & stays ↗" → generic `/access`; "Find a circle ↗" drops `event` (spotlight "Start a Circle here" keeps it). **Root cause:** `EventDossier.tsx:186-191`. **Fix:** `/access?destination=<slug>`, `/circles?destination=<slug>&event=<id>`. **Acceptance:** from the Aspen panel both links land on Aspen-scoped views naming the event.

### UFR-A16 — Phone heading "Aspenis calling." — POLISH · OBSERVED (also UFR-B14)
**Root cause:** `discovery.module.css:919` hides the `<br>` in `.worldHeading h2` on narrow screens with no space in `DiscoveryExperience.tsx:397-399`. **Fix:** `{' '}` before `<br />`. **Acceptance:** 390x844 shows "Aspen is calling."

## 5. Inventories
**Dead ends:** `/` after in-page search → crash, no error boundary (A01) · Back after a card → `about:blank` (A06) · anonymous Circle handoff → membership not connected, honestly stated (A-38, not a defect).

**Ambiguities:** lens banner (A13, landing Jev 0.16) · "Fly to Monte-Carlo" (landing Jev 0.28) · two search fields (A02) · palette "SAVED" fixtures and "live" (A08) · "20 · LEGENDARY", "LEAD TIME Today" (A12, A13) · Wire "commercial hold" (A13).

**State-machine problems:**
| Transition | Expected | Actual | Finding |
|---|---|---|---|
| chosen city → device denied | stay on city | "Viewing Atlanta" + "Choose your city"; storage wiped | A04 |
| today mode + query with no today match | empty state | crash | A01 |
| card selected → Back / reload | restore | leave app / reset | A06 |
| mode active → dates mode | combine or explain | silently drops mode; winter legend persists | A11 |
| saved (local) → side panel | saved | "will be available when membership is connected" | A03 |
| onboarding completed | lens applied | no effect | A07 |

**Permission problems:** geolocation requested on load without gesture (A05) · denied gives no feedback, merged with "unavailable" (A05) · denied after city → contradictory, city lost (A04) · membership absent → save semantics differ by surface (A03).

## 6. Visual repair specs
**PROPOSED CONCEPT - NOT CURRENT APPLICATION — A09/A10 selected-journey panel (desktop)**
```
┌ YOUR SELECTED JOURNEY ─────────────────────────┐
│ Aspen is calling.                              │
│ Aspen Christmas & New Year Week · 19 Dec–3 Jan │
│ [ Open Aspen ↗ ]  [ ♡ Save ]   Start a Circle → │  ← primary row first, always visible
│ FROM Atlanta → ASPEN  ≈2,090 km · ~3h (indicative)│
│ WHY IT'S WORTH THE TRIP                        │
│ • Gondola from town onto Ajax                  │
│ • Four mountains on one pass                   │
│ Mountain lens: Satellite ↗ Terrain ↗ (approx.) │
│ Editorial details; verify with organizers.     │
└────────────────────────────────────────────────┘
```
Must remain: estimate disclaimer, approximate-area caveat, editorial disclosure. Primary: Open Aspen, Save beside it. Corrected: no inner scroll for actions; heading and panel never overlap.

**PROPOSED CONCEPT - NOT CURRENT APPLICATION — A03 unified save state in the side panel (membership absent)**
```
┌ Aspen Christmas & New Year Week ─────── [×] ┐
│ [ Open Aspen destination → ]                │
│ [ ◆ Saved on this device ]  [ Watch ]       │  ← same local intent store as destination page
│ Find it again in Trips → Saved places ↗     │
│ Account sync arrives with membership.       │  ← secondary note, never replaces the button
│ DATES 19 Dec 2026 – 3 Jan 2027 · LEAD 87 days│
└─────────────────────────────────────────────┘
```
Must remain: device-only disclosure, no implied account. Primary: Save/Saved toggle. Corrected: saved status identical across destination page, panel, ideas, scene and Trips.

## 7. Evidence appendix
Screenshots (`artifacts/`): A-01-landing-first-load, A-02-atlanta-granted-hero, A-03-winter-shortlist, A-04-card-flight-spotlight, A-06-spotlight-after-wheel, A-07-destination-aspen-top, A-08-destination-saved-watched, A-11-trips-after-save, A-12-saved-link-reopen, A-13-globe-hover-preview, A-14-marker-dossier, A-16-location-denied-after-click, A-17-city-then-denied-device, A-19-filter-change-midflight, A-20-inpage-search-aspen, A-24-scene-feed, A-25-travel-wire, A-27-bogus-destination, A-31-after-onboarding, A-32-phone-landing, A-34-phone-after-card-tap, A-35-phone-spotlight-route, A-38-circle-handoff-anon, A-39-dates-mode-drops-season, A-40-palette-fixture-saved-group; plus orchestrator `VERIFY-UFR-A01-orchestrator.png`.

Jev (`artifacts/jev/`): UFR-A01, A03, A04, A05, A07, A08, A09, A10 (also A12 lead_time_misread), A11, A13, A-landing — all HTTP 200, jev-1.13.0.

Key console evidence: `[pageerror] Cannot read properties of undefined (reading 'distanceKm')` (A01); geolocation `[1 call, first at 802 ms]` (A05); `history.length 2` → `about:blank` (A06); `localStorage['meridian.intent.v1'] === null` while the palette shows "SAVED" (A08).
