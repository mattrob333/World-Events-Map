# Findings, persona L: first-time visitor on the home page

Build `main` @ `b14f948`, `next start` :3127, 2026-09-25. Desktop 1440×900 and phone 390×844. Discovery only. Screenshots `artifacts/L-01` … `L-12`. (Saved by the orchestrator from the tester's returned text; condensed.)

## 1. Persona, job, entry, end state
Anonymous first-timer, no profile, no location at first. Land on `/`, understand in seconds what dope.travel is and why go *now*, pick a place that's on or coming up, see why and how far, and reach a next step (plan it, or set your vibe).

## 2. Flow maps
1. `/` → hero card (HAPPENING NOW · Monaco Yacht Show · till Sep 26) → Fly to Monte-Carlo → globe. **EXECUTED - PARTIAL** (desktop CTA covered by the vibe prompt, L01; phone first screen has no what/why, L10).
2. Coming up bar/diamond → `?journey=` → scroll → globe flies. **EXECUTED - PASS** (hero card doesn't follow, L06).
3. Calendar Hide → reload → stays hidden. **EXECUTED - PARTIAL** (CLS 0.18 desktop / 0.28 phone, L02).
4. Location pill → typed city → status + hero distance. **EXECUTED - PASS** (Esc clears the journey, L05).
5. Device location granted → Near you → distance. **EXECUTED - PARTIAL** (hero ignores a nearby event, L04).
6. Device location denied → blocked copy → pick Paris. **EXECUTED - PASS** (dismissed prompt reads as blocked, L07).
7. Worth catching now → Fly there (globe not mounted) → mounts, flies. **EXECUTED - PASS.**
8. Winter filter → URL → re-scoped → reload keeps. **EXECUTED - PASS** (summary copy wrong, L03).
9. Set your vibe prompt → Let's go / Not now persists. **EXECUTED - PASS.**
10. `/?event=oktoberfest-munich` → briefing + globe. **EXECUTED - PARTIAL** (globe not centred after scroll, L09).
11. Back / Forward. **EXECUTED - PASS.**

## 3. Key test results
PASS: SSR hero and shortlist in HTML; featured event current; lead photo paints first, credit bottom-left; crossfade holds the old photo opaque (no collage); today highlighted; legend and "not live availability" line; phone collapsed by default with CLS 0 on first visit; phone calendar scrolls without page overflow; bar/diamond clicks fly the globe; picker keyboard open, no-match copy, outside click, typed city; denied location copy; location privacy (only the city name in sessionStorage; no coordinates in URLs or requests); filters in URL; Back/Forward; no app 4xx/5xx.
FAIL: calendar summary counts (L03); CLS with a stored calendar choice (L02); picker Esc (L05); vibe prompt covers hero CTA at 1440×900 (L01).

## 4. Findings

- **UFR3-L01 UX FRICTION (OBSERVED):** at 1440×900 the floating Set your vibe prompt (`AppShell.tsx` `lg:bottom-6 lg:left-6`) sits on "Fly to Monte-Carlo" and "See what is calling"; `elementFromPoint` returns `.vibe-prompt`. Fix: move it bottom-right on desktop. Acceptance: hero CTAs hit-test to themselves at 1440×900 and 1280×800.
- **UFR3-L02 VISUAL REGRESSION (OBSERVED):** a stored calendar choice that differs from the default shifts the page on reload (desktop closed: CLS 0.184; phone open: 0.281). `ComingUp.tsx:25-33`. Fix: apply the stored choice before first paint (inline head script sets an attribute on `<html>`, CSS reads it). Acceptance: CLS < 0.01 in both cases.
- **UFR3-L03 LOGIC / HONESTY (OBSERVED):** summary counts only drawn lanes ("3 on now" while 17 are on today); with Winter·Ski says "Nothing on the calendar for the next eight weeks" above a drawn plan-by diamond. `ComingUp.tsx:42-49`, `comingUp.ts:7-9`. Fix: count from events; never say "Nothing" when a lane is drawn.
- **UFR3-L04 LOGIC FAILURE (OBSERVED):** with device location at Munich, hero features Monte-Carlo 580 km away while Oktoberfest (5 km) is on now. `WorldIntro.tsx:174-201`. Fix: when an origin is set, prefer a nearby now/soon event, or add a "Near you" line.
- **UFR3-L05 STATE + A11Y (OBSERVED):** Esc in the location picker also clears `?journey=` (global Esc handler in `DiscoveryExperience.tsx:251-261`) and focus falls to `BODY` (`LocationPicker.tsx:309-311`). Fix: preventDefault/stopPropagation + focus the pill; global handler skips `defaultPrevented`.
- **UFR3-L06 STATE FAILURE (OBSERVED):** hero card doesn't follow a calendar click or `?journey=` deep link (local `activeJourney` in `WorldIntro.tsx`). Fix: pass the selected journey into WorldIntro.
- **UFR3-L07 EDGE CASE (OBSERVED headless / INFERRED Chrome):** a dismissed permission prompt reads "Location is blocked in your browser" and disables retry. `useViewerLocation.ts:109-111`, `LocationPicker.tsx:301,348`. Fix: only say blocked when `permissions.query` says denied.
- **UFR3-L08 A11Y / POLISH (OBSERVED):** ArrowDown doesn't enter the city list; query persists after close.
- **UFR3-L09 EDGE CASE (OBSERVED / cause UNKNOWN):** deep-linked event: globe not centred on Munich 3 s after scrolling to it. Candidates `GlobeStage.tsx`, `CameraRig.tsx:300-312`.
- **UFR3-L10 UX FRICTION (OBSERVED):** phone first screen has a "Fly to Monte-Carlo" CTA but the event name/timing/reason are below the fold. Fix: one line under the CTA with name · when.
- **UFR3-L11 POLISH / HONESTY (OBSERVED):** the departure board uses its own thresholds ("PLAN · 8 days ahead") vs `whyNow` ("Starts in 8 days"). Fix: board chips from `whyNow`.
- **UFR3-L12 POLISH (OBSERVED):** short calendar bars truncate the event name ("Monte-Ca…"); scrolled phone rows lose labels.
- **UFR3-L13 UNKNOWN (OBSERVED once):** `TypeError: Cannot read properties of null (reading 'toString')` under TZ Pacific/Kiritimati; did not reproduce in 4 reruns.

## 5. Top 5
1. L01 vibe prompt covers the hero CTA on desktop.
2. L02 CLS from the stored calendar choice.
3. L04 hero ignores the visitor's location.
4. L05 picker Esc wipes the journey and drops focus.
5. L03 calendar summary under-counts / contradicts itself.
