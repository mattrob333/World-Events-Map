# UserFlow Red Team — Persona B (family winter ski planner)

> Written by the persona B tester agent; saved to disk by the orchestrator from its returned report (subagent file writes were blocked by the harness). Note: Jev file labels do not always equal the finding ID (e.g. finding B09 cites Jev file `UFR-B05`); the label quoted is the file name in `artifacts/jev/`.

Target: MERIDIAN `main` @ fb99093, `http://localhost:3127` (production build, real mode, no Supabase or other providers configured — the documented preview state). Browser: Playwright 1.56 Chromium, desktop 1440x900 and phone 390x844. Scripts: `scratchpad/rt-B/s1.mjs`–`s16.mjs`. **Jev:** EXECUTED (jev-1.13.0, 9 calls; `artifacts/jev/UFR-B*.json`). **treg:** EXTERNAL VALIDATION NOT EXECUTED. No application code, config or data was modified.

**Findings (14):** DEAD END 1 · LOGIC FAILURE 3 · STATE FAILURE 2 · AMBIGUITY 4 · POOR FEEDBACK 1 · MISSING STEP 1 · UX FRICTION 1 · POLISH 1.

## 1. Persona
| Field | Value |
|---|---|
| User type | Unauthenticated first-time visitor, parent/organizer |
| Context | Plans a Christmas or February ski week for 2 adults + 2 kids; deciding Colorado Rockies vs Swiss Alps; plans with a second family |
| Knowledge | Knows ski travel; not MERIDIAN terms (Circle, membership service, Pulse, NOW) or Supabase |
| Permissions | None; no account can be created on this deployment |
| JTBD | "Pick a resort and week that works for my family, gather what I need to decide, and get it in front of the other family." |
| Entry point | `/` → Winter → Ski & snow |
| Expected end state | A shortlist and week, plus a brief the other family can open. If creation is disabled: told plainly nothing was saved, and given a portable brief |

Intended behaviour: `docs/FAMILY-SKI-FLOW.md`, `docs/MOUNTAIN-EXPLORER.md`, `docs/LIVING-WORLD-PREVIEW.md` ("On this preview, creation is disabled because Supabase membership is not connected").

## 2. Flow maps
- **F1 — Winter discovery → resort → mountain lens** — `EXECUTED - PASS (with friction)`. `/` → Winter → Snow Outlook + 6-card shortlist → "Fly there" (Aspen, then St. Moritz) → Mountain Lens. Hrefs `https://www.google.com/maps/@?api=1&map_action=map&center=39.1911,-106.8175&zoom=12&basemap=satellite|terrain` and `46.4908,9.8355` — official Maps URLs API form, labelled "approximate… not a verified lift entrance". On desktop "Open Aspen" is hidden inside an inner scroll [B11].
- **F2 — Ski destination page** — `EXECUTED - PARTIAL`. `/destinations/aspen`: hero, 3-photo gallery, Pulse signals [B06], Stay/Access sample offers [B07], map + mountain links, honest "awaiting setup" Research Pulse. "Start a trip" → `/circles?...` → "Continue in Community" → `/community` "Membership is not connected yet" [B08]. `/destinations/st-moritz` leads with the Cresta Run [B09].
- **F3 — Family ski starter** — `EXECUTED - FAIL`. "Start a family ski trip" → `/trips?season=winter&interest=ski#family-ski`. Submit disabled from page load [B01]; no child-ages field [B13]; invalid input gets no feedback [B02]; refresh loses everything [B03]; Back resets home mode [B05]; a shareable result is never reached.
- **F4 — Cross-user handoff** — sender `EXECUTED - FAIL` (no link can be generated); recipient `EXECUTED - PARTIAL` (`/community?circle=<uuid>` says "Sign in below" but shows no sign-in [B10]); configured approval/membership path `CODE-REVIEW ONLY` (`createFamilySkiCircle.ts`, `TripsPage.tsx:74-131`).
- **F5 — Mobile 390x844** — `EXECUTED - PARTIAL`. Mountain Lens and "Open Aspen" reachable; no horizontal overflow (scrollWidth 390). Form starts ~2 screens down and hits the same dead end. Heading renders "Aspenis calling." [B14].

## 3. Test cases
| ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| B-T01 | happy: Winter→Ski | Ski shortlist, honest snow | Aspen, Courchevel, Gstaad, St. Moritz, Niseko, Jackson Hole; "not a snow report"; 4 official report links | PASS | B-01 |
| B-T02 | happy: Aspen lens | Official, approximate | Maps URLs API, approximate caveat | PASS | B-02, B-21 |
| B-T03 | Swiss lens (St. Moritz) | Same | Same | PASS | B-03 |
| B-T04 | desktop story-panel CTA | Visible | Inner `overflow-y:auto` (517>391), CTA hidden, heading overlap | PARTIAL | B-02 |
| B-T05 | honesty: snow/lifts | None invented | None invented; legend disclaimer sr-only | PARTIAL | B-02 |
| B-T06 | Aspen destination | Hero, gallery, map, next step | Present; "SKI SEASON 45", "BOOKING PRESSURE 98 ↑" | PARTIAL | B-04 |
| B-T07 | deep link: St. Moritz NY week card | Family ski week page | Cresta Run page | FAIL | – |
| B-T08 | Stay/Access honesty | No implied live inventory | Named providers; "will pass your dates"; "last confirmed by the provider" | FAIL | B-05, B-08, B-10 |
| B-T09 | Preview inquiry | Honest no-send | "No message was sent to a provider" | PASS | B-09 |
| B-T10 | in-app path to starter | Planner shown | Planner shown | PASS | B-11 |
| B-T11 | permission: submit, membership unset | Clear state + fallback | Disabled, generic notice, no fallback | FAIL | B-12, B-13, B-23 |
| B-T12 | invalid input | Inline errors | None; 2019/2020 dates valid | FAIL | B-14 |
| B-T13 | refresh mid-form | Draft kept | All reset; storage empty | FAIL | s11 |
| B-T14 | Back to home | Mode kept | "Every season · Anything" | FAIL | s10 |
| B-T15 | switch region | Works | Works | PASS | s16 |
| B-T16 | non-Rockies/Swiss pick | Expressible | Not expressible | FAIL | – |
| B-T17 | `/trips` bare | Starter reachable | Hidden until hero click | PARTIAL | s16 |
| B-T18 | invite recipient | Knows next step | "Sign in below", nothing below | FAIL | B-17 |
| B-T19 | sample room | Labelled | Labelled; chat honest | PASS | B-15 |
| B-T20 | mobile path | Reachable, no overflow | Yes; long pre-form scroll; missing space | PARTIAL | B-19–B-23 |

## 4. Findings

### UFR-B01 — Family ski starter is a dead end with no portable brief — DEAD END · OBSERVED · `/trips?season=winter&interest=ski`
**Problem:** the page promises "Create a Circle, send its link to the other family". "Create the shared Circle" is disabled from page load; Enter/click do nothing. The only explanation is the generic `SignInCard` notice below the button ("Membership is not connected yet… Pulse and NOW can still work…"). On desktop arrival neither the disabled state nor the notice is in view (B-11). No copy/save/share/print. **Impact:** JTBD cannot be completed; work is lost; the parent is not told nothing was saved. **Jev UFR-B01:** knows_before_filling **0.77**; knows_what_was_saved **0.32**; can_reach_other_family **0.20**; notice_understandable **0.28**; likely_next_action **look_for_sign_in** (p 0.88); jtbd_support **0.74** on 0–4 (p0 0.33, p1 0.60). **Analyst:** disagree on two points — 0.77 assumes the disabled state is visible (it is below the fold on arrival); "explains a workaround" is too generous (none offered). **Root cause:** `TripsPage.tsx:220` disables submit when `!client`; `:222` renders `SignInCard` (`PlatformShell.tsx:56-66`); the brief only appears after a Circle is created (`TripsPage.tsx:230`; `familySki.ts:47-60`). **Fix:** when `!client`, a planner-specific banner above the form ("Shared trip rooms aren't available on this preview. Nothing you enter is saved."); primary action "Copy our trip brief" → validate → show and copy `buildPrivateSkiBrief`. **Acceptance:** Supabase unset, 1440x900: banner in first viewport; valid input → brief + "Copied"; invalid → validator message.

### UFR-B02 — Invalid values get no feedback; past dates never rejected — LOGIC FAILURE · OBSERVED + CODE
2020-01-10 → 2019-12-01, 0 adults, 999 kids, −$50: no error, no `aria-invalid`, no styling (B-14). Validator runs only on submit (unreachable); even then it accepts past dates and has no span limit. **Jev UFR-B02:** notices_date_error **0.22**; notices_party_error **0.06**; believes_brief_is_valid **0.63**. **Analyst:** agree; on a configured deployment a 2019 Circle would publish to all signed-in members. **Root cause:** `familySki.ts:62-70`; `TripsPage.tsx:199-200` (no `min`); `:94-98` submit-only validation. **Fix:** date `min`; `start >= today` + max span; validate on blur with `aria-invalid`. **Acceptance:** Vitest rejects `start:'2019-12-01'`; end-before-start shows inline error without submitting.

### UFR-B03 — Refresh wipes the brief — STATE FAILURE · OBSERVED
Reload returns defaults (compare, empty dates/origin, 2/2, slopeside, no budget); local/sessionStorage empty. **Jev (UFR-B02 file):** refresh_expectation **0.81**. **Root cause:** uncontrolled `defaultValue` inputs (`TripsPage.tsx:190-217`); remount on auth-key change (`:35-36`; INFERRED risk when configured). **Fix:** owner-keyed sessionStorage draft, cleared on sign-out. **Acceptance:** fill → reload → restored; sign out → cleared.

### UFR-B04 — Starter can't express shortlisted resorts; resort and week dropped — LOGIC FAILURE · OBSERVED
Shortlist ranks Courchevel (FR) first by "Modeled Heat 57/100" and lists Niseko, Jackson Hole, Kitzbühel; the form offers only Compare / Colorado Rockies / Swiss Alps; the link passes only season/interest. **Jev UFR-B04:** can_express_choice **0.32**; expects_carryover **0.71**; region_choice **compare** (0.99); ranking_understood **0.43**. **Analyst:** agree; the ranking also conflicts with FAMILY-SKI-FLOW's rule to rank only "within an explicit question". **Root cause:** `WorldIntro.tsx:370`; `familySki.ts:1,16-20`; `app/trips/page.tsx:3-5`. **Fix:** pass `event=<id>`, prefill dates/resort; widen regions or filter the family-ski shortlist; relabel "Modeled Heat". **Acceptance:** from Jackson Hole Presidents' Week, the form shows 2027-02-13 → 02-20 and the resort.

### UFR-B05 — Back from Trips loses Winter/Ski mode — STATE FAILURE · OBSERVED
**Root cause:** `DiscoveryExperience.tsx:76` keeps mode in `useState`, not the URL. **Fix:** mirror season/interest in the query string. **Acceptance:** after Back, Winter and Ski & snow remain `aria-pressed=true`.

### UFR-B06 — Modeled numbers read as snow and scarcity facts — AMBIGUITY (material honesty) · OBSERVED + CODE · `/destinations/aspen`
"SKI SEASON 45" is hard-coded 45/80 by event status; "BOOKING PRESSURE 98 ↑" + "pressure is modeled as tight" suggest near-sold-out lodging; "Cloud Nine… booked out weeks ahead" is an undated availability claim; "WHEN TO GO" reads as advice; "modeled" captions exist but are small. **Jev UFR-B06:** ski_season_45_meaning **days_or_percent_of_season** (0.59; snow score 0.29); believes_lodging_scarce **0.75**; labels_sufficient **0.67**; when_to_go_is_advice **0.59**. **Root cause:** `src/lib/pulse/fromEvents.ts:308-313` (80/45 value), `:300-306` (booking pressure with arrow). **Fix:** ski season as label only (no number); MODELED chip beside modeled values; drop arrows; rename "When to go" → "Next listed occasion". **Acceptance:** no number next to "Ski season".

### UFR-B07 — Sample lodging offers use named providers and "confirmed by provider" copy — AMBIGUITY (material honesty) · OBSERVED (B-05, B-08, B-10)
Cards name "High Country Houses", "Ridge Line Aviation", "Roaring Fork Meet", "Three Valleys Desk" and say "MERIDIAN will pass your dates to the provider"; the Courchevel fixture says "Details last confirmed by the provider". A tab banner and `/access` step 02 ("No provider is contacted") contradict this. Whether names match real businesses: UNKNOWN (EXTERNAL VALIDATION NOT EXECUTED). **Jev UFR-B07:** believes_real_provider **0.84**; copy_contradiction **0.38**; confirmed_by_provider_implies_real **0.49**. **Root cause:** `src/lib/access/fixtures.ts:20`, `:77` (`availability:'provider_updated'` on a fixture); `src/lib/access/types.ts:47`. **Fix:** SAMPLE chip per card; conditional copy; no `provider_updated` on fixtures (unit test). **Acceptance:** no fixture renders "confirmed by the provider".

### UFR-B08 — Five "start" CTAs lead to three places; none completes — AMBIGUITY · OBSERVED
"Start a family ski trip" → `/trips`; "Start a Circle here", "Start a trip", sticky "PLAN ASPEN…" → `/circles?...` → `/community` (membership not connected); "Start a trip plan" → bare `/trips` where the planner is hidden; destination pages never link to the ski starter. **Jev UFR-B08:** clear_which_to_use **0.24**; same_thing **0.46**; any_path_completes **0.11**. **Root cause:** `DestinationPage.tsx:172-174`; `ResearchPulse.tsx:73`; `app/trips/page.tsx:5`. **Fix:** for ski destinations "Start a trip" → `/trips?season=winter&interest=ski&event=<id>#family-ski`; `/trips` always shows the starter entry. **Acceptance:** from `/destinations/aspen`, "Start a trip" lands on the planner with Aspen context.

### UFR-B09 — St. Moritz page leads with the Cresta Run, not the family ski week — LOGIC FAILURE · OBSERVED
From the "St. Moritz New Year Week" card, the hero reads "Head-first at 130km/h…"; Next occasion = Cresta Run Season; all 3 edit cards are Cresta; "Start a trip" uses `event=cresta-run-season-st-moritz`. **Jev (file UFR-B05):** relevant_to_family_ski **0.18**; context_preserved **0.25**; start_trip_predictable **0.67**. **Analyst:** disagree with 0.67 — the target was spelled out in the state given to Jev, but a parent on the page does not see it. **Root cause:** `DestinationPage.tsx:169-171` picks the earliest event; `WorldIntro.tsx:127` links without the event. **Fix:** pass `?event=` from the card and prefer it. **Acceptance:** hero shows St. Moritz New Year Week.

### UFR-B10 — Invite recipient told "Sign in below", but no sign-in exists — POOR FEEDBACK (EDGE CASE) · OBSERVED (B-17)
**Jev UFR-B10:** knows_what_to_do **0.18**; contradiction **0.89**; knows_invite_is_real **0.12**; likely_next **search_for_sign_in** (0.79). **Root cause:** `src/components/community/Community.tsx:359` shows the notice even when `client` is null. **Fix:** when `!client`: "This invitation can't be opened right now because membership is offline. Ask your host to share the trip details another way." **Acceptance:** with Supabase unset, no "Sign in below" text.

### UFR-B11 — Desktop globe story panel hides "Open Aspen" in an unmarked inner scroll — UX FRICTION · OBSERVED 1440x900 (B-02, B-03)
scrollHeight 517 vs clientHeight 391; lens caption cut; CTA out of view; heading overlaps "THIS IS YOUR DESTINATION". Mobile fine (B-21). **Root cause:** `discovery.module.css:1423-1428`. **Fix:** sticky CTA footer or collapsed "why" list + fade affordance. **Acceptance:** "Open Aspen" hit-testable without scrolling.

### UFR-B12 — Visible winter legend omits the "not live snow" disclaimer — AMBIGUITY · OBSERVED
**Jev (file UFR-B09):** snowflake_means_snow **0.75**; positives in the same call: believes_live_snow_shown **0.22**, knows_where_to_check **0.88**, lens_expectation **0.83**. **Root cause:** `WinterGlobeLegend.tsx:15-27` (disclaimer is sr-only). **Fix:** visible "Ski events · not snow conditions".

### UFR-B13 — No children's ages or lesson needs in the brief — MISSING STEP
OBSERVED fields: region, start, end, origin, adults, children, anotherFamily, stay, nightlyBudget. Need INFERRED from FAMILY-SKI-FLOW step 5 (lessons, rentals, lift tickets, capacity). **Root cause:** `familySki.ts:4-14`; `TripsPage.tsx:203-206`. **Fix:** optional ages/lessons in the private brief only, never in `buildPublicSkiCircle` (`familySki.ts:29-45`) — add a unit test.

### UFR-B14 — Polish — OBSERVED
Mobile heading "Aspenis calling." (B-20); region nav text bleeds under the mobile header (B-20); sticky "PLAN ASPEN…" overlaps "Ajax Tavern ↗" (B-06); St. Moritz arc starts from the previous Aspen view (B-03).

## 5. Inventories
- **Dead ends:** `/trips` starter with membership unset (B01); `/circles` → `/community` "Continue… to start a real Circle" (B08); `/community?circle=` recipient (B10).
- **Ambiguities:** Pulse numbers (B06); Stay/Access fixtures (B07); five start CTAs (B08); snowflake legend (B12); "Modeled Heat" ranking (B04).
- **State-machine problems:** form → reload loses draft (B03); /trips → Back loses mode (B05); card → destination replaces chosen occasion (B09); shortlist → starter drops resort/week (B04); configured submit would accept past dates (B02, code-review).
- **Permission problems:** unauthenticated parent not told plainly rooms are unavailable (B01); invitee told to "sign in below" with nothing there (B10); public Circle dates visible to signed-in members — disclosed in UI, CODE-REVIEW ONLY.
- **Honesty passes (OBSERVED):** Snow Outlook; Mountain Lens official links; Research Pulse "No prices or seats to show yet"; sample room and People labels; Access preview inquiry ("No message was sent"). No live snow depth, lift status, price or availability is claimed anywhere in the tested paths.

## 6. Visual repair specs (PROPOSED CONCEPT - NOT CURRENT APPLICATION)
**VR-1 (B01):** card header "FAMILY SKI TRIP / FIRST DRAFT" with banner "Shared trip rooms aren't available on this preview. Nothing you enter is saved. You can copy your brief." in the first viewport. Fields: region; "Resorts we're looking at" (prefilled); dates (min=today); adults, children, children's ages; lodging; budget. Primary: [Copy our trip brief] → "✓ Brief copied. Nothing was saved on MERIDIAN." Secondary: disabled "Create a shared Circle — needs membership". Must remain: privacy note, research-awaiting box, no prices.

**VR-2 (B07):** card header "STAY · SAMPLE · AVAILABILITY BY REQUEST". Copy: "Example of a ski-in stay a partner could offer. In a connected service your dates would go to the provider." Action [Preview request]. Footer: "Preview only — no provider is contacted, nothing is held." No "confirmed by the provider" on fixtures.

## Evidence appendix
Screenshots (`artifacts/`, all `.png`, no B-18): B-01-winter-ski-shortlist, B-02-aspen-globe-mountain-lens, B-03-stmoritz-globe-mountain-lens, B-04-aspen-destination-hero, B-05-aspen-stay-access-tab, B-06-aspen-destination-map-mountain, B-07-aspen-start-a-trip-circles, B-08-access-offer-aspen-nell, B-09-access-preview-inquiry, B-10-access-courchevel-confirmed-by-provider, B-11-trips-family-ski-arrival, B-12-trips-form-disabled-submit, B-13-trips-filled-form-no-path, B-14-trips-invalid-input-no-feedback, B-15-sample-room-aspen, B-16-community-membership-not-connected, B-17-invite-link-recipient-view, B-19-mobile-winter-finder, B-20-mobile-aspen-globe-story, B-21-mobile-mountain-lens, B-22-mobile-trips-arrival, B-23-mobile-trips-submit-disabled.

Jev files: `artifacts/jev/UFR-B01, B02, B04, B05, B06, B07, B08, B09, B10.json`.

Console: no page errors; only WebGL/THREE and CSS-preload warnings and aborted `_rsc` prefetches. The OSM iframe rendered blank in headless Chromium (UNKNOWN — external embed).
