<!-- Saved by the orchestrator from the tester's returned report: the harness blocked the subagent's own file write. -->

# Findings, persona J: first-time explorer, regression sweep

Tester: persona J (UserFlow red team, second pass) · 2026-09-24 · discovery pass, no application code changed.
Build under test: the running servers, not restarted (production `next start` on :3127, demo `next dev` on :3128). Branch HEAD at writing: `75b5e41`.
Browser: Playwright Chromium (swiftshader). Desktop 1440×900; phone 390×844 (isMobile, hasTouch, DPR 2); spot check at tablet 820×1180 with touch. A fresh context for each identity. Console errors, page errors, failed requests and 5xx were captured on every run. A route guard aborted any request to `/api/designer/research` and fired **0 times**. No paid research was triggered. The Lisbon trip was seeded from `store.json`/`research.json` only.
Scripts: `scratchpad/rt-J/*.mjs`. Machine results: `scratchpad/rt-J/p1-*.json`, `p2-audit.json`, `p2-focus.json`. Jev: `artifacts/jev/J-0*.json`.

## 1. Persona
| | |
|---|---|
| Context | Anonymous first-time visitor. Desktop, then the same person on a phone. No account, no product vocabulary. City: New York. |
| Knowledge | Knows nothing about Circles, ACCESS, NOW or the lens. Reads headlines and the biggest button. |
| Permissions | Anonymous. Location not granted (denial simulated for A04). Demo build only for member and invite checks. |
| Job to be done | Find a place worth going to, understand why and how far, and keep it so it can be found again. |
| Entry point | `/` and the deep links from the previous audit. |
| Expected end state | A shortlisted place with reasons and an indicative distance, saved on this device and findable again from the nav. No implied live inventory, booking or personalization. |

## 2. Flow maps
1. **Discover → why and how far (phone and desktop). EXECUTED - PASS.**
   - USER → `/` → choose "New York" → Fall × Culture & food → "Munich · Oktoberfest · Fly there on the globe".
   - Story panel: 2 "worth the trip" reasons, "NEW YORK → MUNICH · 6,490 km · ~8h 30m in the air" and "indicative, not a flight schedule".
   - "Open Munich ↗" → `/destinations/munich?event=oktoberfest-munich`, showing "FROM NEW YORK · INDICATIVE ≈6,490 km".
   - The URL keeps season, interest and journey. 0 page errors, 0 non-GET requests.
2. **Keep it. EXECUTED - PARTIAL (J04).**
   - Save sits at y≈2497 of 5417 on the phone. "Save this event" → "Saved ✓".
   - The `/?event=` panel shows "Saved on this device ✓" and the palette shows a "SAVED ON THIS DEVICE" group.
   - Phone: More → Trips. The saved row is at y≈2244 (desktop 1528): "Oktoberfest · Save ↗" → `/?event=oktoberfest-munich`.
3. **Next step. EXECUTED - FAIL (J03).**
   - Destination primary "Start a trip ↗" → `/circles?destination=munich&event=…`.
   - Its primary "Continue in Community to start a real Circle ↗" → `/community?event=…` → "Membership is not connected yet."
4. **NOW on the phone. EXECUTED - FAIL (J01, J02).**
   - More → Now → For you → "Nashville" → Show me → 3 Maps searches "shaped by your board".
   - About 1.5 screens lower: "NOW can't pick venues tonight … no recommendations to show".
5. **Family ski on the phone. EXECUTED - PARTIAL (J05).**
   - `/trips?event=aspen-christmas-week#family-ski` → Circle-link story → the unavailable note at y=1140 → Copy brief at y≈2507.
   - The brief is copied (textarea and clipboard) with "Nothing was saved on dope.travel".
6. **Demo invite (:3128). EXECUTED - PASS for the function, FAIL for the phone layout (J06).**
   - `/?event=mara-river-crossing&group=grp-mara-river-crossing-2` → strip → "Take a seat — 3 left" → "Leave" shown, `group=` stripped.
7. **Redesign sweep. EXECUTED - PARTIAL (J07, J10–J13).** 10 routes × 2 viewports with DOM queries, plus Tab ×30 per route on desktop.

## 3. Part 1: retest of the 2026-09-23 RETEST rows
| Row | Result | Evidence and detail |
|---|---|---|
| A01 | PASS | "Aspen", "ski", "qwzxv", `<img onerror>`, blank; desktop and phone; 0 page errors, shell intact (10/10). `p1-home.json` |
| A02 | PASS | "Search all of dope.travel for "qwzxv"" at y=528 (desktop) / 942 (phone); the palette input holds "qwzxv". `J-01-A02-palette-phone.png` |
| A03 | PASS | The destination save shows "Saved on this device ✓" in the globe panel on desktop and phone. `J-06-A03-panel-*.png` |
| A04 | PASS | "Viewing Atlanta, Georgia · device location is blocked, still using this city"; button "Location blocked · pick a city"; the city survives a reload. The denial was simulated with a code-1 error because headless Chromium leaves the real prompt pending for more than 12 s (see J09). `J-02-A04-denied-*.png` |
| A05 | PASS | 0 geolocation calls before a tap. |
| A06 / B05 | PASS | `?season=winter&interest=ski&journey=aspen-christmas-week`; reload keeps it; Back goes to `?season=winter&interest=ski`; desktop and phone. |
| A08 / C12 | PASS | Fresh palette has no Saved group and no "· live". A query shows "EDITORIAL IDEAS". "SAVED ON THIS DEVICE" appears only after a save. `J-04-A08-*.png` |
| A09 / B11 | PASS | "Open Aspen" at y=531 (desktop) / 738 (phone); `elementFromPoint` hits it. `J-03-A09-journey-*.png` |
| A10 (extra) | PASS | "≈2,090 km · ~3h in the air" from Atlanta on `/destinations/aspen`. |
| A14 | PASS | ASPEN → aspen; an unknown slug shows "That destination is not on the calendar." (HTTP 200, streamed). `J-05-A14-notfound.png` |
| B01 | PARTIAL | Desktop PASS: note at y=154, brief copied. **Phone FAIL:** note at y=1140 and Copy at y≈2507, below the Circle-link promise (→ J05). Not proven a regression. `J-07-B01-trips-hash-phone.png`, `J-08-B01-copied-*.png` |
| B02 | PASS | "Choose a first day from today onward." `J-09-B02-pastdates-*.png` |
| B03 | PASS | The draft "Aspen, Vail" survives a reload. |
| B04 | PASS | Prefilled "Aspen", 2026-12-19 → 2027-01-03. |
| B06 | PASS | No number beside Ski season and no arrows; "Modeled … not live inventory" (Aspen, St. Moritz). |
| C01 | **REGRESSION (phone)** | The heading is at y=787–840, under the tab bar (top 779); on 09-23 it was at y=473. Desktop PASS (y=757). 3 destination links, 0 loops back to /now (→ J01). `J-10-C01-now-phone.png` |
| C02 | PASS | Fieldset disabled, "Find my next move" disabled, 0 geolocation calls. |
| C03 | PASS | Selected title at y=90 (phone) / 82 (desktop). `J-11-C03-selected-*.png` |
| C04 | PASS | Shows the draft, "Nothing was sent and nothing is held", and "Keep planning Aspen ↗" / "See the occasion ↗". `J-12-C04-preview-*.png` |
| C05 | PASS | 5/5 cards labelled Sample; no "confirmed by the provider". |
| C07 | PASS | Filter counts: All 5, Stay 2, Aviation 1, Ground 1, Yacht 1. |
| C09 | PASS | "That sample is no longer listed." |
| C13 | PASS | 0 nested interactive elements on 13 routes. |
| D01 (demo) | PARTIAL | Strip shown, joining works, `group=` stripped, and an unknown cabin shows "not on this device … Nothing was joined." The phone layout is broken (→ J06). `J-23-D01-invite-seats-*.png`, `J-20-D01-demo-desk.png` |
| D02 (demo) | PASS | The profile sheet opens: "Marius Oyelaran — member record · SIMULATED FOR REVIEW". `J-25-D02-profile-*.png` |
| D03 | PASS | "Saved on this device only … nothing here personalizes dope.travel yet." |
| D04 | PASS | "needs member sign-in, which is not available on this preview yet. Nothing was joined." `J-31-D04-circle-link-*.png` |
| D05 | PASS | `aria-pressed=true` with a saffron rim; `?step=2` survives a reload; Back goes to step 1. `J-30-D05-welcome-selected-*.png` |
| D06 (demo) | PASS | "Demo · simulated" in the header at y=18. |
| E01 | PASS | "Nothing has been submitted or saved." The model is explained; no lens banner. |
| E03 | PASS | "Nothing has been checked yet, so this is not a list of zero offers." |

Summary: 31 rows. PASS 28 · PARTIAL 2 · REGRESSION 1. No previously fixed logic regressed. The failures are layout and ordering effects of the redesign and the new NOW "For you" block.

## 4. Part 2: redesign sweep
Routes: `/`, `/access`, `/destinations/aspen`, `/trips`, `/circles`, `/people`, `/now`, `/welcome`, `/moodboard`, `/trips/designer` (seeded Lisbon), each at 1440 and 390.

| Check | Result |
|---|---|
| Overflow at 390 px | PASS: `scrollWidth` 390 on all routes; 0 unclipped elements. Tablet 820: PASS. |
| Text under 11 px | PASS: 0 on 20 route/viewport pairs. |
| Disclaimer contrast | PASS in prod: minimum 5.29:1 (ink-subtle) across 116 nodes; none use ink-faint. Text over photos was not measured. The demo invite date line is an exception (ink-faint, 11 px; J06). |
| One gradient per first viewport | PASS: 0 or 1 `--gradient-cta` element on each route, but it is spent on dead ends (J03). |
| Focus rings (Tab ×30, desktop) | PASS: all stops visible and not covered. The home search ring sits on the wrapper via `:focus-within`, verified. `J-40-focus-home-search.png` |
| Touch targets ≥ 44 px | FAIL. Phone count of non-inline targets under 44 px with no extended hit area: `/` 69, `/access` 15, `/destinations/aspen` 10, `/trips` 5, `/circles` 5, `/people` 5, `/now` 5, `/welcome` 3, `/moodboard` 5, `/trips/designer` 459 (J07). |
| Sticky and fixed elements | Header 57 px sticky and tab bar fixed at top 779; the last content on every route clears the bar. The destination sticky "Plan …" pill covers facts (J11) and the demo strip overlaps the bar (J06). |
| Active states | `aria-current` is missing on `/now` (desktop) and on More (phone); two More items are lit on `/trips/designer` (J10). |
| Lens banner | On all routes except `/welcome` and `/partners`; about 110 px on the phone; Begin and Skip are 36 px (J13). |
| Selected vs button | The pressed saffron treatment and `aria-pressed` are used correctly. Exception: designer "New trip" sits in the toggle row (J12). |
| Tappable but not | 0 elements with `cursor:pointer` outside an interactive ancestor. |
| Errors | 0 console errors, page errors or 5xx in prod. |

## 5. Test cases
| ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| J-T01 | happy (phone) | Why and how far are clear | 2 reasons, "6,490 km · ~8h 30m", indicative note | PASS | `J-52-core-story-phone.png` |
| J-T02 | happy (desktop) | Same | Same | PASS | `J-52-core-story-desk.png` |
| J-T03 | keep | Saved state consistent | Destination, panel, palette and Trips all agree | PASS | `J-56-*` |
| J-T04 | back / return | Find the save quickly | Trips is under More; the save is 2.7 screens down | PARTIAL | J04 |
| J-T05 | next step | Primary CTA gives an outcome | 2 primary taps to "not connected" | FAIL | `J-57-core-circles-from-start-trip-phone.png` |
| J-T06 | failure (NOW) | Honest state in the first viewport | Under the tab bar; ideas shown above it | FAIL | `J-10-C01-now-phone.png`, `J-60-now-foryou-nashville-phone.png` |
| J-T07 | permission denied | City kept | Kept | PASS | `J-02-A04-denied-phone.png` |
| J-T08 | permission pending | "Finding" state | Label unchanged for over 12 s | PARTIAL | J09 |
| J-T09 | refresh / deep link | State restored | Restored | PASS | `p1-home.json` |
| J-T10 | unusual input | Inert | Inert, 0 errors | PASS | `p1-home.json` |
| J-T11 | empty result | Wider search offered | Palette opens with the query | PASS | `J-01-*` |
| J-T12 | mobile (demo invite) | Readable, no overlap | 38 px column, overlaps the tab bar | FAIL | `J-23-*-phone.png` |
| J-T13 | mobile (targets) | ≥ 44 px | 36/40 px targets | FAIL | `p2-audit.json` |
| J-T14 | keyboard | Visible focus | 300/300 stops visible | PASS | `p2-focus.json` |
| J-T15 | change mind (New trip) | Distinct and confirmed | Confirmed, but looks like a filter | PARTIAL | `J-45-designer-phone.png` |
| J-T16 | mobile destination first screen | Date and distance readable | Sticky pill covers "WHEN TO GO" | FAIL | `J-53-core-destination-phone.png` |

## 6. Findings

### UFR2-J01: NOW's "not connected" state is below the phone fold (REGRESSION of UFR-C01)
- **Severity:** VISUAL REGRESSION · **Evidence:** OBSERVED · **Location:** `/now` at 390×844.
- **Problem:** "For you" now renders above the unavailable notice. The notice heading sits at y=787–840, under the tab bar (top 779); it was at y=473.
- **User impact:** The first screen only promises "gives you three decisions".
- **Expected:** the notice is readable within the first 779 px.
- **Actual:** it is hidden under the tab bar.
- **Jev:** see J02.
- **Root cause:** `src/components/now/NowExperience.tsx:178-179`, from `51953d3`.
- **Recommended change:** when `!providerConfigured`, render `<NowUnavailable/>`, or a one-line version of it, above `<NowForYou/>`.
- **Acceptance test:** at 390×844 the heading's bottom is above 779 px without scrolling.

### UFR2-J02: NOW "For you" makes a personalization claim with no board, and contradicts itself
- **Severity:** AMBIGUITY (honesty) · **Evidence:** OBSERVED.
- **Problem:** "MORNING · FOR YOU / Right now in Nashville" shows 3 generic Maps searches. The footer says "Each idea opens a live Maps search near Nashville, shaped by your board" although no board exists. The next line says "Make your board…". Lower on the page: "there are no recommendations to show". Typing a city sent 0 network requests.
- **Jev `J-01-now-foryou`:**
  - Contradiction: 0.72.
  - Believes the ideas are personalized: 0.25.
  - Honesty: 1/3 "Mixed" (p0 .25, p1 .59, p2 .08, p3 .08).
  - Tester agrees.
- **Root cause:** `src/components/now/NowForYou.tsx:86` (fixed copy) and `:57`; ordering in `NowExperience.tsx:178-179`.
- **Recommended change:** say "your board" only when a profile exists; otherwise label the ideas "General Maps searches, not picks". Reword the unavailable notice to "can't pick specific venues yet".
- **Acceptance test:** with no profile, the footer does not contain "your board".

### UFR2-J03: The destination's single glowing CTA leads to a membership dead end
- **Severity:** DEAD END · **Evidence:** OBSERVED.
- **Location:** `/destinations/munich` "Start a trip ↗" (the only `.btn-primary`), plus the sticky "Plan Oktoberfest" and "Plan around Oktoberfest ↗". All go to `/circles?…`.
- **Problem:** On Circles, the `.btn-primary` "Continue in Community to start a real Circle ↗" leads to "Membership is not connected yet." This path offers no brief or save fallback, and it breaks design rule 9. Save, the action that works, is about 3 phone screens down.
- **Jev:**
  - `J-03-start-trip`: expectation trip_plan 0.76 (group_room 0.17); reaches an outcome 0.05; prominence appropriate 0.01/3 (p0 = 1.00).
  - `J-05-story-why-far`: the most likely next action is "Start a Circle here" at 0.51, against "Open Munich" at 0.46.
  - Tester agrees.
- **Root cause:** `src/components/destination/DestinationPage.tsx:181-185` (`planningHref` → `/circles` for non-ski events), `:215`, `:444-451`; `src/components/trip-room/TripRoom.tsx:57` (primary with no config check).
- **Recommended change:** when unconfigured, make "Save this event" the primary and demote "Start a trip" to a ghost link with "Group trips need membership (not in this preview)". In TripRoom, show a ghost or disabled button with the reason.
- **Owner decision:** routing to `/trips/designer` would work, but it triggers paid Treg research per new place, so it needs a spend gate.
- **Acceptance test:** in an unconfigured build, the only first-viewport `.btn-primary` on a destination performs an action that succeeds, and Circles has no primary linking to `/community`.

### UFR2-J04: Keeping works, finding it again is weak
- **Severity:** UX FRICTION · **Evidence:** OBSERVED.
- **Problem:**
  - The phone tabs are World, Circles, People, Access and More; Trips is only under More.
  - `/trips` leads with "A place becomes a plan" and a glowing "Start a family ski trip", then sample rooms.
  - "Saved places" is at y≈2244 on the phone (2.7 screens) and y≈1528 on desktop.
  - The saved row reads "Oktoberfest ··· Save ↗", with no city or date.
- **Jev `J-04-keep-refind`:**
  - Finds it within 30 s: 0.44.
  - Keep quality: 0.91/3 (p0 .31, p1 .49).
  - Reads "Save ↗" as "open" 0.69, as "save again" 0.20.
  - Tester agrees.
- **Root cause:** `src/components/shell/AppShell.tsx:24-29`; `src/components/trips/TripsPage.tsx:241`, `:353-389`, `:402` (`INTENT_LABEL` gives "Save").
- **Recommended change:** when anything is saved, put "Your trail" first and don't use the gradient on the ski CTA. Label the row "Munich · 19 Sep – 4 Oct · Saved". Consider a Trips tab (owner call; the design panel already recommends it).
- **Acceptance test:** after one save, the saved title appears within the first 779 px of `/trips` on the phone.

### UFR2-J05: The phone family-ski page promises a Circle link before saying it's unavailable
- **Severity:** AMBIGUITY · **Evidence:** OBSERVED.
- **Problem:** After the hash scroll, the page shows "Create a Circle, send its link…" and "02 Share the Circle link". The unavailable note is at y=1140 and Copy at y≈2507. Desktop is fine (y=154). Also, `/trips#family-ski` without params renders no section, so the hash does nothing.
- **Jev `J-02-ski-promise`:**
  - Expects a Circle link: 0.72.
  - Notices it's unavailable before filling in the form: 0.46.
  - Clarity: 0.57/3 (p0 "Misleading" .56).
  - Tester agrees.
- **Root cause:** `src/components/trips/TripsPage.tsx:251-270` (intro renders before the card), `:275`, `:69`.
- **Recommended change:** when `!client`, replace the steps with copy-brief steps, or put the note first on narrow screens.
- **Acceptance test:** at 390×844 after the hash scroll, the note is in the first viewport and there is no Circle-link promise.

### UFR2-J06: Demo invite strip is crushed and overlaps the tab bar and dossier
- **Severity:** VISUAL REGRESSION · **Evidence:** OBSERVED (:3128).
- **Problem:**
  - Phone: the strip spans y=578–820, over the tab bar (top 779) and over the dossier's buttons.
  - The host text column is 38 px wide and wraps one word per line.
  - "Take a seat" is not styled as the primary; "Not this time" is 36 px tall.
  - The date line is ink-faint `rgb(107,106,99)` at 11 px.
  - Desktop: the strip covers the dossier's Street View note.
  - On 09-23 it was retested as "visible on top".
- **Jev `J-06-demo-invite`:** understands the host 0.68; accept clarity 1.89/3. The tester partly disagrees: Jev can't see the overlap or the clipped last line.
- **Root cause:** `src/components/social/ShareTrip.tsx:240` (`fixed bottom-6`, old `glass-deep`), `:256-263` (`justify-between` with `shrink-0` buttons), `:250` (`text-ink-faint`).
- **Recommended change:** stack the buttons below `sm`, lift the strip above the tab bar with `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`, use `surface-raised` and `btn-primary`, and use ink-subtle for the date line.
- **Acceptance test:** strip bottom ≤ 779, text column ≥ 200 px.

### UFR2-J07: Touch targets under 44 px (design rule 8)
- **Severity:** VISUAL REGRESSION (a11y) · **Evidence:** OBSERVED (DOM).
- **Problem:**
  - `.chip` is 36 px, and an `elementFromPoint` probe at ±21 px misses, so there is no extended hit area.
  - `.btn-sm` is 36 px, including the lens "Begin".
  - Phone header: "Profile" 65×36, search 40×40; lens "Skip" 49×36.
  - Home card "Explore the place ↗" is 109×32, with a 17 px Wikimedia credit link directly below it.
  - Designer: 90 👍 and 90 👎 buttons at 40×36, 58 ★ at 40×36, and "Move to…" selects at 36 px.
  - Touch tablet at 820: the desktop nav links are 29 px tall.
- **Root cause:** `src/app/globals.css:384` (`.chip`), `:336` (`.btn-sm`); `src/components/shell/AppShell.tsx:123`, `:139`, `:148`, `:165`.
- **Recommended change:** give `.chip` and `.btn-sm` a `::before` hit area (`inset:-4px 0`), use `min-h-11` for header and tablet nav links, and space the credit link away from "Explore the place".
- **Acceptance test:** re-run `rt-J/p2-audit.mjs`; there are no non-inline targets under 44 px without an extended hit area.

### UFR2-J08: "Where to stay" label on a bar note
- **Severity:** LOGIC FAILURE (minor) · **Evidence:** OBSERVED.
- **Problem:** On `/destinations/munich`, the card "02 WHERE TO STAY" is "Käfer's gallery stays open past the tents".
- **Root cause:** `src/components/destination/DestinationPage.tsx:125`: `/stay/` matches "stays open".
- **Recommended change:** use word boundaries and check bar and restaurant terms first.
- **Acceptance test:** add a unit case for "stays open".

### UFR2-J09: No progress state for a pending location prompt when a city is chosen
- **Severity:** POOR FEEDBACK · **Evidence:** OBSERVED.
- **Problem:** The button stays disabled with the label "Use device location" for over 12 s.
- **Root cause:** `src/components/discovery/DiscoveryExperience.tsx:331-336` checks `source==='chosen'` before `status==='locating'`.
- **Recommended change:** check `locating` first.

### UFR2-J10: Nav active-state gaps
- **Severity:** POLISH (a11y) · **Evidence:** OBSERVED.
- **Problem:**
  - The desktop Now link has no `aria-current`.
  - Phone More lights up but exposes no current state.
  - On `/trips/designer`, both "Trips" and "Trip designer" are lit in More.
  - The desktop header has no entry for Mood board or Trip designer.
- **Root cause:** `src/components/shell/AppShell.tsx:136-143`, `:243-248` (prefix match).
- **Acceptance test:** exactly one `aria-current=page` per route and viewport, and one lit More item.

### UFR2-J11: The sticky "Plan …" pill covers the destination facts on the phone's first screen
- **Severity:** UX FRICTION · **Evidence:** OBSERVED.
- **Problem:** At y=704–748 the pill covers the "WHEN TO GO 19 Sep…" value. The "FROM NEW YORK · INDICATIVE" distance is under it and the tab bar. While scrolling it passes over "Modeled demand" labels. The 90%-opaque header also lets body text show through.
- **Root cause:** `src/components/destination/DestinationPage.tsx:444`; `src/components/shell/AppShell.tsx:102`.
- **Recommended change:** show the pill only after the facts block has scrolled past (IntersectionObserver) and make the header opaque.
- **Acceptance test:** at scroll 0 the pill does not intersect the facts block.

### UFR2-J12: Designer "New trip" sits among the filter toggles
- **Severity:** POLISH · **Evidence:** OBSERVED.
- **Problem:** The button clears the trip and is guarded by `confirm()`, but it is styled like the "All / Loved / Matt: to vote" pills.
- **Root cause:** `src/components/designer/TripCanvas.tsx:156-158`.
- **Recommended change:** move it to an overflow menu or show it as a text link with an icon.

### UFR2-J13: The lens banner competes with every first screen
- **Severity:** UX FRICTION · **Evidence:** OBSERVED (layout) / INFERRED (confusion).
- **Problem:** On the phone it takes about 110 px on every page, with Begin and Skip at 36 px. On `/moodboard` it sits above a second "tell us about you" flow, so there are two profile concepts. It still personalizes nothing (UFR-A07, deferred).
- **Root cause:** `src/components/shell/AppShell.tsx:92`, `:160-173`.
- **Recommended change:** show it only on `/` or on repeat visits, and hide it on `/moodboard`.

## 7. Tables

**Dead ends**
| ID | Location | Entry | Recovery |
|---|---|---|---|
| J03 | `/community?event=…` | Destination "Start a trip" → "Continue in Community" | Back only |
| J01 | `/now` (phone) | More → Now | Exits exist but sit under the tab bar |

**Ambiguities**
| ID | Location | Ambiguity | Risk |
|---|---|---|---|
| J02 | NOW For you | "shaped by your board" with no board; ideas vs "no recommendations" | Medium |
| J05 | Family ski (phone) | Circle-link promise before the "not available" note | Medium |
| J04 | Trips saved row | "Save ↗" verb on an already-saved item | Low |
| J08 | Destination edit | Bar note labelled "Where to stay" | Low |
| J13 | Lens vs mood board | Two onboarding and profile concepts | Low |

**State-machine problems**
| ID | State | Problem |
|---|---|---|
| J09 | viewer chosen + locating | The label ignores `locating` |
| J10 | nav current | Two current items in More; none on `/now` (desktop) or on More |

**Permission / privacy**
| Check | Result |
|---|---|
| Geolocation before a tap | 0 calls |
| NOW For you | 0 requests after typing a city |
| Core flow | 0 non-GET requests |
| Paid research | 0 guarded calls |
| Demo invite | `group=` is stripped after reading; an unknown cabin shows "Nothing was joined" |

No new privacy or permission failures were found in scope.

## 8. Repair concepts

**PROPOSED CONCEPT - NOT CURRENT APPLICATION: destination next step (J03 + J04 + J11), phone**
- Hero title and a one-line reason why, then one primary pill "Keep Munich". After saving it becomes "Kept ✓ · see in Trips".
- A ghost pill "Get a feel for it ↓".
- A facts strip directly under the hero: "Oktoberfest · 19 Sep – 4 Oct · ≈6,490 km from New York (indicative)".
- No sticky pill until that strip has scrolled out of view.
- Group trips appear only as a text link: "Plan with friends (needs membership; not in this preview)".
- `/trips` shows "Your trail" first whenever it has items.

**PROPOSED CONCEPT - NOT CURRENT APPLICATION: NOW when unconfigured (J01 + J02), phone**
- A "NOT CONNECTED" chip beside the eyebrow.
- Hero copy: "When live venue search is connected, NOW gives you three decisions. Today it can suggest general Maps searches."
- The city box, with results titled "General ideas for Nashville (Maps searches, not picks)". No "shaped by your board" without a board.
- The curated "On today" list directly after.

## 9. Coverage
- **Part 1:** 31 rows run in a browser: 28 PASS, 2 PARTIAL, 1 REGRESSION. Not retestable here: E02, E06, E08/E09 (they need configured partners).
- **Part 2:** 20 DOM audits, 300 focus stops, and a tablet check on 3 routes.
- **Part 3:** the core job run end to end on phone and desktop; 16 test cases; 7 flow maps.
- **Jev:** 6 calls, all HTTP 200 (`jev-1.13.0`): J-01-now-foryou, J-02-ski-promise, J-03-start-trip, J-04-keep-refind, J-05-story-why-far, J-06-demo-invite.
- **Findings:** 13 (VISUAL REGRESSION 3, DEAD END 1, AMBIGUITY 2, UX FRICTION 3, LOGIC 1, POOR FEEDBACK 1, POLISH 2).
- **What held up:**
  - Discovery state lives in the URL.
  - Distance is honestly labelled as indicative (Jev: why 2.89/3, how far 2.44/3).
  - Saved state agrees on 4 surfaces.
  - One gradient per first screen.
  - No text under 11 px.
  - Disclaimers are readable (≥ 5.29:1).
  - Focus rings are visible.
  - No overflow at 390 px.
  - No page errors.
