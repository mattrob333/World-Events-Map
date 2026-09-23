# UserFlow Red Team — Persona C findings (on-the-ground traveler, phone-first)

> Written by the persona C tester agent; saved to disk by the orchestrator from its returned report (subagent file writes were blocked by the harness).

Build `main @ fb99093`, `http://localhost:3127` (real mode; NOW provider, budget store, Supabase and partners unconfigured). Test date 2026-09-23, which is Monaco Yacht Show day 1 (23–26 Sep 2026 in the curated calendar). Playwright Chromium, mainly 390x844 isMobile/hasTouch, spot-checked at 1440x900. Scripts in `scratchpad/rt-C/*.mjs`. **Jev executed** (jev-1.13.0, 9 calls, all HTTP 200); every number below is copied from `artifacts/jev/*.json`. **treg:** EXTERNAL VALIDATION NOT EXECUTED. No app code, config or data was modified.

**Severity counts (14 findings):** DEAD END 2 · LOGIC FAILURE 1 · MISSING STEP 1 · POOR FEEDBACK 1 · AMBIGUITY 3 · EDGE CASE 1 · UX FRICTION 3 · POLISH 2

## 1. Persona
| Field | Value |
|---|---|
| Type | Anonymous, first-time user, already in Monte-Carlo on a phone. Location granted (43.7384, 7.4246); also tested with location denied |
| Knowledge | Nothing about the internals, or about fixture vs live data |
| Permissions | Anonymous; membership unconfigured |
| JTBD | (1) Decide what to do tonight via NOW. (2) Pursue an ACCESS offer (yacht, chalet, table) and know what happens next |
| Entry points | Bottom nav MORE → Now; home "ALREADY THERE?"; ACCESS tab; Monaco Yacht Show dossier; deep links |
| Expected end | NOW picks, or an honest unavailable state plus a useful alternative. An inquiry that is really sent, or an honest preview with a concrete next step |

## 2. Flow maps
- **F1, NOW (unconfigured): EXECUTED - FAIL (dead end).** `TRAVELER -> MORE -> Now -> hero + archive-photo intro (unavailable note at y≈1002 on an 844px screen) -> intent/vibe/constraints respond to taps -> "Find my next move" (y≈2153) disabled, no reason -> exits go to / -> home "ALREADY THERE?" -> /now (loop)`. Granted and denied location give the same UI: no location button, 0 `getCurrentPosition` calls on `/now`. Configured mode: CODE-REVIEW ONLY; `/api/now` returns 503 `NOW_PROVIDER_NOT_CONFIGURED` (curl).
- **F2, ACCESS: EXECUTED - FAIL (honest dead end).** `ACCESS -> Yacht filter -> "REQUEST DETAILS" (button nested in a link) -> URL ?offer=opp-monaco-harbor, page scrolls to top, first viewport identical to landing (offer at y=1464 mobile, y=866 of 900 desktop) -> "Preview inquiry" -> "Inquiry preview noted on this page. No message was sent…"`. No non-GET requests; localStorage stays empty. Refresh brings the button back; Forward loses the note.
- **F3, dossier → ACCESS: EXECUTED - PARTIAL.** Dossier CTA goes to generic `/access`, which opens with Aspen offers. Back returns to the dossier correctly. No "tonight" link in the dossier.
- **F4, mobile navigation: EXECUTED - PARTIAL.** Bottom nav and MORE sheet (Now, Trips, Profile) work. Header "Now" link hidden below 640px. Palette opens; backdrop tap closes it. No horizontal overflow on `/`, `/now`, `/access`, `/destinations/monte-carlo` at 390px.
- **F5, deep links: EXECUTED - PARTIAL.** Valid offer link renders the offer below the fold; `?offer=nope` and the uppercase id fall back silently; `/now?anything` renders normally and ignores the query.
- **F6, failures: PASS/PARTIAL.** Forcing `/api/place-media` to 500 gives honest copy ("Public imagery is unavailable for Monte-Carlo right now…"). Travel-wire aborted but not mounted on the surfaces tested → UNTESTED visually. NOW → ACCESS → Back resets NOW choices (low impact). Duplicate taps on "Preview inquiry": PASS (nothing sent).

## 3. Test cases
| ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| T01 | happy/first-time NOW | picks or honest alternative | honest note, only exit loops | FAIL | C-03, C-04, UFR-C01 |
| T02 | permission granted | location only on tap | 0 geolocation calls | PASS privacy / FAIL utility | deep.mjs |
| T03 | permission denied | choose-city fallback | same UI; no city picker on NOW; home list has 11 cities, none Monaco | FAIL | fly.mjs, browser-position.ts:29-41 |
| T04 | inert form | disabled or marked inert | fully interactive; Go disabled silently | FAIL | C-05 |
| T05 | open offer | offer in view | scrolls to top; offer 1464px down | FAIL | C-09 |
| T06 | submit inquiry | sent, or preview + next step | "noted", no next step | FAIL | C-11 |
| T07 | duplicate | no duplicates | 0 writes | PASS | access1.mjs |
| T08 | refresh | preserved or explained | note lost | FAIL (minor) | access1.mjs |
| T09 | back/forward | consistent | forward loses note | PARTIAL | access1.mjs |
| T10 | valid deep link, cold | offer in view | scrollY 0, offer at y=1464 | PARTIAL | deep.mjs |
| T11 | bogus/stale deep link | not-found notice | silent | FAIL | C-12 |
| T12 | `/now?anything` | renders | renders | PASS | deep.mjs |
| T13 | empty filters | none empty, or honest copy | 4 of 9 chips always empty; says "no other…" | FAIL | C-07 |
| T14 | fixture honesty | no provider claims | "confirmed by the provider" | FAIL | UFR-C05 |
| T15 | ACCESS disclosure | fixture labelled | labelled (hero, banner, 3 steps) | PASS | C-06 |
| T16 | dossier context | Monaco-scoped | generic; Aspen first | FAIL | C-17 |
| T17 | home hero while in Monaco | "you're here" path | "Fly to Monte-Carlo" next to "0 km · Already in the area" | FAIL | C-18 |
| T18 | MORE / Profile / search | reachable | reachable | PASS | C-02, C-13 |
| T19 | horizontal overflow | none | none | PASS | overflow checks |
| T20 | place-media 500 | honest | honest | PASS | C-16 |
| T21 | change mind | choices kept | reset | EDGE (low) | rot.mjs |
| T22 | search "live" label | no "live" on curated data | "Monaco · live" | FAIL | C-13 |
| T23 | desktop | better | NOW note above fold; ACCESS offer at y=866/900 | PARTIAL | C-20, C-21 |

## 4. Findings

### UFR-C01 — NOW's unavailable state is honest but a circular dead end — DEAD END · OBSERVED
**Problem:** the only exits go to `/`, and the home "ALREADY THERE?" card links back to `/now`. No city/destination alternative, no link to the Monte-Carlo edit ("A table with a harbor line", "Port Hercules dawn"), no link to ACCESS. **Jev UFR-C01:** next_step_usefulness **0.02** ("Useless or circular", p=0.99, conf 0.98); likely_next_action **leave** (0.36; explore_calendar 0.34; fill_form 0.27; conf 0.14); honesty **1.8** ("Honest but easy to miss", p=0.78). Analyst: agree. **Root cause:** `NowExperience.tsx:178-183` and `:261-262` hard-code `/` as the exit; `LivingDashboard.tsx:55` shows the NOW card unconditionally; when unconfigured the location step is removed (`NowExperience.tsx:186-200`); `browser-position.ts:29-41` has no Monaco entry. **Fix:** when unconfigured, turn "Where you are" into a city/destination picker (tap-only location mapped to nearest curated destination); link to the destination edit and to ACCESS filtered by destination; hide or relabel the home card. **Acceptance:** with provider unset and location in Monaco, a `/destinations/monte-carlo` link is visible within the first 844px of `/now`, and no `/now` exit loops back to `/now`.

### UFR-C02 — Unavailable note below the fold on phones; inert form — AMBIGUITY · OBSERVED
Note at y≈1002; controls stay interactive; Go (y≈2153) disabled with no reason. **Jev UFR-C02 (in UFR-C01 call set):** understands_unavailable_in_first_viewport **0.11**; form_is_misleading **0.85**. Analyst: agree; desktop is fine. **Root cause:** `now.module.css:565-567` (`.resultsIntro{order:-1}` at ≤1060px); `NowExperience.tsx:214-244` never disables the controls. **Fix:** move the notice into the intro card; disable or collapse inputs; reason under Go. **Acceptance:** at 390x844 the notice's y < 844 and intent buttons are disabled/aria-disabled.

### UFR-C03 — "Request details" silently scrolls to the top — POOR FEEDBACK · OBSERVED (mobile + desktop)
After the tap the viewport looks unchanged; offer at y=1464 (mobile), y=866/900 (desktop). **Jev UFR-C03:** notices_selection **0.13**; perceived_outcome **reset** (0.79, conf 0.71); label_predicts **0.37**. Analyst: agree; the label also over-promises that a request is sent. **Root cause:** `OpportunityCardView.tsx:33-37` plain `Link` scrolls to top; `AccessFeed.tsx:77-99` renders hero, disclosure and path before the selected offer; nothing scrolls to/focuses it. **Fix:** render the selected offer first, or `scrollIntoView` + focus `#selected-offer-title`; rename CTA "View offer". **Acceptance:** after the tap the title is in the viewport and focused; same on a cold deep link.

### UFR-C04 — The ACCESS inquiry does nothing and offers no next step — DEAD END · OBSERVED (real inquiry path CODE-REVIEW ONLY)
"Preview inquiry" shows no draft (no dates, party, message); nothing persisted; refresh resets. The real inquiry insert (`Community.tsx:680-720`) is unreachable from `/access`. **Jev UFR-C04:** knows_next_step **0.06**; believes_sent **0.12**; completion **0.38** ("Dead end", p=0.63); preview_value **0.05**. Analyst: agree — honesty works but no outcome. Two parallel offer/inquiry systems (`/access` fixtures vs `/community` Supabase) is architecture drift for a high-capability reviewer. **Root cause:** `AccessFeed.tsx:148-158` (with `:66`) only toggles local state. **Fix:** show the draft (editable fields marked "not sent") + explicit next-step block; route to the real inquiry flow when configured. **Acceptance:** after preview the page shows draft content, "nothing was sent", and a non-"see all" next-step link; with platform configured, a published offer reaches the `inquiries` insert. External validation: EXTERNAL VALIDATION NOT EXECUTED; browser confirmed 0 writes.

### UFR-C05 — A sample fixture claims "Details last confirmed by the provider" — LOGIC FAILURE (provider truth) · OBSERVED
Courchevel "Bellecôte chalet week" from fictional "Three Valleys Desk" shows the line; contradicts README ("never invents… partner availability in real mode"). **Jev UFR-C05:** footnote_honesty **0.15** ("False claim", p=0.87, conf 0.85); believes_provider_confirmed **0.33**; believes_real_provider **0.45**. Analyst: agree, false claim. **Root cause:** `fixtures.ts:77` sets `provider_updated`; copy in `types.ts:45-48`, rendered by `OpportunityCardView.tsx:39` and `AccessFeed.tsx:151`. **Fix:** fixture-only `sample` state ("No provider has confirmed these details") + "Sample" chip on each card. **Acceptance:** a test asserts no fixture renders "confirmed by the provider".

### UFR-C06 — Dossier "Find access & stays" loses Monaco context; no "tonight" link — MISSING STEP · OBSERVED
CTA → generic `/access` opening with 3 Aspen offers; Monaco offer is 4th. Dossier says "LEAD TIME Today" but has no NOW link. **Jev UFR-C06:** expected_context **0.86**; context_loss **2.81** ("Total", p=0.82); missing_now_link **0.83**. Analyst: "significant" not "total" — reachable by scrolling. **Root cause:** `EventDossier.tsx:186` hard-codes `/access`; `AccessFeed.tsx:68-70` calls `listOpportunities()` without a destination though `fixtures.ts:85-88` supports one. **Fix:** link `/access?destination=…` or the matching offer, pre-filter; show "What to do tonight" when the event is today and the user is within 50 km. **Acceptance:** from the Monaco dossier, the Monaco offer is the first card.

### UFR-C07 — Filter chips for always-empty categories, with wrong copy — UX FRICTION · OBSERVED
Counts: All 5, Stay 2, Aviation 1, Ground 1, Yacht 1; 0 for Event access, Dining, Local experience, Travel advisor. Empty state says "No **other**…" even with nothing selected. **Jev (UFR-C07 in C-set):** empty_chips **0.86**. **Root cause:** `AccessFeed.tsx:19-21`, `:140`. **Fix:** derive chips from data or disable zero-count chips; fix copy. **Acceptance:** no enabled chip returns zero cards.

### UFR-C08 — Monaco's only offer "Harbor morning, race week" has no dates and shows during Yacht Show week — AMBIGUITY · OBSERVED
**Jev UFR-C08:** which_week **yacht_show_now** (0.78; grand_prix 0.17); relevant_this_week **0.30**. Analyst: the author likely meant the Grand Prix — that disagreement is the finding. **Root cause:** `fixtures.ts:53-66` has no `windowLabel`/`eventId`. **Fix:** add date window + event, or "Dates on request". **Acceptance:** every card shows a date window or "Dates on request".

### UFR-C09 — Stale/bogus `?offer=` link falls back silently — EDGE CASE · OBSERVED
No "no longer available" message; id lookup case-sensitive. **Jev UFR-C09:** understands_missing **0.11**; likely_behaviour **search_list** (0.74). **Root cause:** `AccessFeed.tsx:67`, `:99` no else branch. **Fix:** `role=status` notice. **Acceptance:** `/access?offer=nope` shows it.

### UFR-C10 — Home hero says "Fly to Monte-Carlo" to a user in Monte-Carlo — UX FRICTION · OBSERVED (C-18: "Using device location", route card "0 km · Already in the area")
**Jev UFR-C10:** cta_makes_sense **0.09**; best_primary **tonight** (0.87, conf 0.82). **Root cause:** `WorldIntro.tsx:328-330` ignores `route-estimate.ts:18-19`, which already knows the user is in the area. **Fix:** when `airHours===0`, CTA "You're here: tonight's scene" (or the destination edit while NOW is unconfigured). **Acceptance:** with location in Monaco the hero CTA does not say "Fly to Monte-Carlo".

### UFR-C11 — NOW is two taps deep on phones and absent from same-city surfaces — UX FRICTION · OBSERVED
**Jev (C-set):** first_tap **more** (0.79; search 0.20); discoverable **0.14**. Analyst: Jev's two answers are in tension; reachable in 2 taps → friction, not blocker. **Root cause:** `AppShell.tsx:101` (`hidden sm:inline`), `:18-31`; `EventDossier.tsx:176-192`, `DestinationPage.tsx` have no `/now` link. **Fix:** contextual NOW entry points (see C06, C10).

### UFR-C12 — Search labels a curated destination "Monaco · live" — AMBIGUITY (low) · OBSERVED (C-13)
**Root cause:** `search/catalog.ts:78` prints raw pulse status; `pulse/fromEvents.ts:94` returns `'live'` whenever an event is in its date window. **Fix:** map to "in season now". Jev UFR-C12 file saved; analyst judgment primary.

### UFR-C13 — `<button>` nested in `<a>` on every ACCESS card — POLISH (a11y)
`OpportunityCardView.tsx:33-37`. **Acceptance:** `querySelectorAll('a button').length === 0`.

### UFR-C14 — At 390px the destination tab row hides "Stay / Access" with no scroll cue — POLISH
`DestinationPage.tsx:271`. **Fix:** edge fade or wrap.

## 5. Inventories
- **Dead ends:** C01 (NOW loop); C04 (inquiry preview).
- **Ambiguities:** C02 (is NOW working?); C03 (reset vs details); C08 (which "race week"); C12 (what "live" means).
- **State problems:** preview flag is page-local (lost on refresh/forward); URL changes to the offer but viewport doesn't move; with Yacht filter on, the selected offer is excluded so the list reads "No other…"; no not-found state for bad offer ids; NOW exposes its full input flow ending in a disabled submit.
- **Permission/privacy:** `/now` 0 geolocation calls (PASS). Home calls `getCurrentPosition` on load without a tap; rounded to 0.1° and not persisted (`useViewerLocation.ts:67-95`) — by design, flagged for the privacy reviewer rather than filed. `/access` no writes (PASS). `/api/now` fails closed 503 (PASS).

## 6. Visual repair specs (PROPOSED CONCEPT - NOT CURRENT APPLICATION)
- **C01 + C02, NOW unconfigured:** top — honest notice "NOW can't pick venues tonight". Then "Where are you?" [Use my location] [Choose city]. Then "You're near Monte-Carlo": PRIMARY "See the Monte-Carlo edit ↗", then "ACCESS in Monte-Carlo ↗", then "Today: Monaco Yacht Show ↗". Last, collapsed "Preview how NOW will work" with inputs disabled.
- **C03 + C04, ACCESS:** "View offer" scrolls to and focuses the card; card has SAMPLE chip and "Dates on request". Below: "Draft your inquiry (not sent)" with Dates, Party, Note. PRIMARY "Preview inquiry" → shows draft text + "Nothing was sent. Partners aren't connected in this preview. With membership, replies appear in Requests," + link back to the Monte-Carlo edit.

## 7. Evidence
- Screenshots (`artifacts/`): C-02-more-menu, C-03-now-unconfigured-top, C-04-now-unconfigured-full, C-05-now-disabled-go, C-06-access-mobile-top, C-07-access-dining-empty, C-08-access-yacht-card, C-09-after-request-details-viewport, C-10-selected-offer, C-11-inquiry-preview-noted, C-12-access-bogus-offer, C-13-search-monaco-mobile, C-15-monaco-dest-access, C-15-monaco-dest-inspiration, C-16-event-dossier-mobile-apifail, C-17-dossier-access-cta, C-18-home-fly-to-monaco-while-in-monaco, C-20-now-desktop, C-21-access-desktop-after-request-details
- Jev: `artifacts/jev/UFR-C01, C03, C04, C05, C06, C08, C09, C10, C12.json`
- Console: no page errors; only injected place-media 500s, aborted RSC prefetches, WebGL/preload warnings.
- Untested: NOW with a configured provider; signed-in Travel Mode branch; real `/community` inquiry flow; tablet; travel-wire failure UI.
