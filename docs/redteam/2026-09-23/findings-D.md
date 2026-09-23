# UserFlow Red Team — Persona D (group-trip host and invited guest)

> Written by the persona D tester agent; saved to disk by the orchestrator from its returned report (subagent file writes were blocked by the harness).

Date 2026-09-23 · repo `main @ fb99093` · discovery pass, nothing in the application changed.

- **Real mode:** `http://localhost:3127` (`next start`, providers unconfigured).
- **Demo mode:** `http://localhost:3128` (`next dev`, `NEXT_PUBLIC_MERIDIAN_DEMO=1`).
- **Browser:** Playwright 1.56 Chromium; scripts in `scratchpad/rt-D/` (`p1-*` real, `p2-*` demo); each identity in its own fresh context.
- **Jev by TypeSafe:** executed, `jev-1.13.0`; `artifacts/jev/UFR-D01..D08.json`, `UFR-D10.json`. Every number is copied from those files.
- **treg:** EXTERNAL VALIDATION NOT EXECUTED.

**Counts (14 findings):** BLOCKER 1 · DEAD END 2 · LOGIC FAILURE 1 · STATE FAILURE 2 · AMBIGUITY 3 · RECOVERY FAILURE 1 · UX FRICTION 2 · EDGE CASE 1 · POLISH 1.

## 1. Persona
| Field | Host | Guest |
|---|---|---|
| Context | Organising a group trip around the Monaco Grand Prix (04–06 Jun 2027) | Friend who received a link from the host |
| Knowledge | None of the internals | Less; arrives cold on a phone |
| Permissions | Unauthenticated; no account can be created on this deployment | Unauthenticated |
| JTBD | Set up a profile and start a trip circle with friends: onboarding → profile, interests, Travel Modes, privacy → create a circle for the event → post → invite | Understand what I was invited to and by whom, then join or decline |
| Entry point | Traveler-lens banner **Begin**; **Profile**; event panel "Start a Circle here →" / "Find a circle ↗" | Real `/community?circle=<uuid>`; demo `/?event=<id>&group=<id>` (format from `invite.ts:49` `buildTripLink`) |
| Expected end | Profile saved with privacy as chosen; circle exists; host sees guest's response | Guest in the host's circle (or declined) and host sees which |

## 2. Flow maps
**F1 — Real: onboarding from the banner** — EXECUTED - FAIL. `/people` banner → **Begin** → `/welcome` step 1/5 (banner hidden here); traveler-kind cards show no selected state; **Continue** works with nothing selected; region/airport → interests → mode name → Private/Discoverable (no selected state) → **Enter World** → `router.push('/')` always lands on the globe, no confirmation. Answers kept only in `localStorage meridian.onboarding.v1`, never read elsewhere. Refresh at step 3 → step 1; Back at step 2 → leaves for `/people`; after **Skip** no link back to `/welcome` anywhere.

**F2 — Real: Profile** — EXECUTED - FAIL (dead end). `/account` "Membership is not connected yet"; "Open Constellation" and "Explore travel circles" lead to pages saying the same; no sign-up, waitlist, or onboarding link.

**F3 — Real: start a circle** — EXECUTED - FAIL (dead end). `/?event=monaco-grand-prix` → "Start a Circle here →" → `/circles?destination=monte-carlo&event=…` (honest: no Circle created) → "Continue in Community to start a real Circle ↗" → `/community?event=…` → no create button, no sign-in.

**F4 — Real: guest opens a Circle invite** — EXECUTED - FAIL. `/community?circle=<uuid>` "Sign in below to open this Circle invitation…" with nothing to sign in with; invalid id → "This Circle link is invalid" (pass); `/circles/<uuid>` → sample-room "not on the preview board", links only to `/circles`.

**F5 — Demo: host** — EXECUTED - PARTIAL. Onboarding (Friends, "Côte d'Azur", Private) → event panel "PREVIEW: GROUPS FORMING" → "Start another cabin" → "Open the cabin" (double-click → one cabin, pass). Card "KTEB Cabin · You · Signature member · NEW YORK · KTEB". Conversation post works; HTML shown as text (pass). Zero invite/share/copy-link/ask controls; clicking a face or host name does nothing. Cabin survives reload on the same device.

**F6 — Demo: guest, then host checks back** — EXECUTED - FAIL. Separate 390×844 context opens hand-built `/?event=monaco-grand-prix&group=usr-monaco-grand-prix-muecdqtd` → no invitation strip, no "KTEB Cabin", no host message; `group` stays in URL (so `TripLinkReader` never ran) → guest sees two simulated cabins and joins "Friday Out, Monday Back" (wrong one) → host reloads, still "1/8". Handoff stops at step one.

**F7 — People and privacy defaults** — EXECUTED - PASS + code review. `/people` shows only three portraits labelled "not live members…"; `/people/does-not-exist` honest empty state; onboarding defaults to private; `Account.tsx:27` `visible=false`, `TravelModesEditor.tsx:31` `discoverable=false` (Supabase toggles CODE-REVIEW ONLY).

## 3. Test cases
| ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| T01 | First time: Begin | Opens onboarding, returns me where I was | `/welcome`; Enter World always → `/` | PARTIAL | D-01 |
| T02 | Pick an option | Chosen card marked | Same computed border on every card; no `aria-pressed` | FAIL | D-01 vs D-04, D-03 |
| T03 | Nothing selected | Blocked/warned | Continue advances | FAIL (minor) | log |
| T04 | Refresh at step 3 | Resume step 3 | Step 1; answers still stored | FAIL | D-02 |
| T05 | Browser Back at step 2 | Step 1 | Leaves for `/people` | FAIL | log |
| T06 | Completion | Applied + confirmed | No confirmation; unused | FAIL | UFR-D03 |
| T07 | Skip then return | Can re-enter | 0 links to `/welcome` across 6 pages | FAIL | log |
| T08 | `/account` without account | Way to get an account | None | FAIL | D-06 |
| T09 | Start a circle (real) | Form or honest alternative | Circular dead end | FAIL | D-05, D-06 |
| T10 | `/community?circle=<uuid>` | Sign-in or honest message | "Sign in below", nothing below | FAIL | D-07 |
| T11 | `/circles/<uuid>` | Route to real circle | Links to `/circles` only | PARTIAL | log |
| T12 | `/people/does-not-exist` | Not-found | "No editorial portrait with that handle." | PASS | log |
| T13 | Double-click cabin create | One cabin | One | PASS | log |
| T14 | HTML/emoji/500+ chars | Safe, wrapped, capped | Text; capped 200/600; long unbroken overflows (1267 vs 468) | PARTIAL | D-14, D-15 |
| T15 | 513-char home region | Capped | Accepted (no `maxLength`) | FAIL (minor) | log |
| T16 | Host invites | Invite control | None; faces inert | FAIL | D-12 |
| T17 | Guest opens invite | Invitation strip | Nothing | FAIL | D-20, D-21 |
| T18 | Host sees guest | 2/8 | 1/8 | FAIL | log |
| T19 | Host clicks Leave | Confirm/undo | Deleted instantly; message orphaned; host still "committed" | FAIL | D-16 |
| T20 | Reload after cabin | Persists | Persists (same device) | PASS | log |
| T21 | Phone group card | Title visible | Title 0px wide | FAIL | D-21 |
| T22 | Demo labelling | All simulated labelled | Cabins labelled; peer lift/overlap not | PARTIAL | D-11 |
| T23 | People opt-in/private default | No undisclosed people | Only labelled portraits | PASS | log |

## 4. Findings

### UFR-D01 — BLOCKER — The demo invite handoff does not exist
**Label:** OBSERVED (two contexts + source). **Location:** `src/components/social/CurrentMemberChip.tsx:29,82`; `MemberProfileSheet.tsx:1253-1266`; `ShareTrip.tsx:153-196`; `src/lib/social/useSocialStore.ts:467-491,803-806`. **Problem:** no host invite/share control — `ShareTrip`/`InviteDialog` are reachable only via `MemberProfileSheet`, which is never mounted. Following the app's own deep-link format, the guest sees nothing. The host's cabin exists only in the host's browser; a guest join never reaches the host. **Impact:** the core "bring your people" job fails even in demo. **Expected:** "You were sent this — KTEB Cabin … [Take a seat]". **Actual:** event panel only; `group=` stays in URL (`TripLinkReader` removes it on load, `ShareTrip.tsx:171-174`), so the reader never ran. **Jev UFR-D01:** guest_knows_invited **0.04**; guest_next_action **join_wrong_cabin** (0.9, conf 0.86); handoff_reach score **0.13** ("guest cannot even see the invitation" 0.94). Analyst agrees. **Root cause:** (a) `CurrentMemberChip` claims to be "in the masthead on every screen" but nothing imports it; `AppShell.tsx` never renders it, so `SocialRoot` never mounts. (b) user-created cabins persist only in that browser's localStorage (`partialize` `:803-806`); `InvitationStrip` silently hides when the group isn't found (`ShareTrip.tsx:194-196`). (c) both browsers are the same `YOU` identity (D09). **Fix:** mount `<SocialRoot/>` in `AppShell` when `isDemoMode()`; when a linked group is missing show "This cabin was created on another device. Demo cabins aren't shared between browsers."; label user cabins "Only on this device". **Acceptance:** seeded link (`grp-monaco-grand-prix-1`) shows "You were sent this" + "Take a seat" and `group=` is removed; another-browser cabin id shows the honest message.

### UFR-D02 — DEAD END — "Open X's profile" controls do nothing; nowhere to set profile, Travel Modes or privacy
**Label:** OBSERVED. **Location:** `GroupCard.tsx:217-251`, `PeerStack`; demo `/account` and `/constellation` still "Membership is not connected yet". Clicking a face sets `profileMemberId` but the sheet isn't mounted (open dialogs before/after: `['Monaco Grand Prix — briefing']`). `updateProfile`, `setPhoto`, invite allowance only reachable through that sheet. **Impact:** profile, interests, Travel Modes, "Travel Modes private" untestable in either mode. **Jev UFR-D02:** host_can_find_invite **0.08**; host_next_action **copy_browser_url** (0.64, conf 0.53) — that URL carries no group id. **Fix:** as D01; until then don't render these as buttons. **Acceptance:** avatar click opens a named dialog; editing own home/visibility survives reload.

### UFR-D03 — LOGIC FAILURE (honesty) — Onboarding collects answers and "Discoverable", then nothing uses them
**Label:** OBSERVED (browser localStorage dump; `/account` shows none) + source (grep for `useOnboardingStore`, `travelerKind`, `modeName`, `homeRegion` finds only `OnboardingFlow.tsx` and `AppShell.tsx:47-48`, which reads only `completed`). **Location:** `OnboardingFlow.tsx:16-37,45-54`; `src/lib/onboarding/store.ts:195-219`. **Problem:** copy promises "This just opens the product around you", "so World Heat has something to talk to", "Discoverable — A public portrait later"; `finish()` sets `completed`, goes to `/` silently, discards the origin page. **Impact:** a privacy choice looks saved but isn't. **Jev UFR-D03:** believes_discoverable **0.6**; believes_profile_saved **0.62**; completion score **0.02** ("Misleading" 0.98); knows_how_to_get_account **0.45** — analyst disagrees: no route to an account exists. **Root cause:** onboarding store is a standalone draft; nothing copies it into `profiles`/`travel_modes`. **Fix:** on completion "Saved on this device only. Sign in to publish."; reword World Heat/Discoverable copy; prefill `/account` after sign-in without auto-publishing; return to origin page. **Acceptance:** Discoverable shows "local, not published"; after sign-in `/account` is prefilled with visibility unchecked; finishing returns to origin.

### UFR-D04 — DEAD END — Real-mode circle creation and guest invite loop; "Sign in below" with nothing below
**Label:** OBSERVED. **Location:** `DiscoveryExperience.tsx:488-493` → `TripRoom.tsx:51-61` → `Community.tsx:352-510`; `PlatformShell.tsx:56-66`; `Community.tsx:359`. Every link ends at "Membership is not connected yet"; `circlePath && !user` shows "Sign in below" even when `client` is null. **Impact:** neither host nor guest can move forward; honest about nothing being live but circular. **Jev UFR-D04:** host_can_start **0.08**; host_expected_link_to_start **0.72**; guest_instruction_contradicted **0.96**; path_dead_end **0.9** (conf 0.85). **Fix:** check `client` at `:359` → "Circle invitations need member sign-in, which isn't available on this preview. Ask the host to share trip details another way."; when `!client` remove/de-link "Start a Circle here" and "Continue in Community…"; give `/account` one honest next step. **Acceptance:** no client → no "Sign in below"; no "start a … Circle" link leads to a page without a circle form.

### UFR-D05 — STATE FAILURE — Onboarding shows no selected state; refresh restarts; Back exits
**Label:** OBSERVED — selected and unselected cards have the same computed border `oklab(0.958…/0.07)` 1px; no `aria-pressed`. **Location:** `OnboardingFlow.tsx:71,147` add `border-brass`, but `globals.css:167-171` gives `.glass` a `border` shorthand in `@layer utilities` that overrides it; `:41` step in `useState`; `:165-171` no validation. **Impact:** Private/Discoverable choice can't be confirmed; refresh looks like lost work. **Jev UFR-D05:** can_tell_selected **0.06**; confident_privacy_choice **0.07**; understands_refresh_kept **0.12**; state_feedback score **0.12** ("Broken" 0.88). **Fix:** `role="radio"`/`aria-pressed` with a selected style `.glass` can't override (ring or `!border-brass`); step in URL (`?step=`); in-flow Back. **Acceptance:** click changes border/ring and sets `aria-pressed`; refresh at step 3 stays; Back from step 3 → step 2.

### UFR-D06 — AMBIGUITY (fake vs live, demo) — Simulated peers raise the score with no label
**Label:** OBSERVED. **Location:** `EventDossier.tsx:336-339` ("Peer interest lifted this score by…"), `:354-360` (sections labelled only "Preview:"), `src/lib/flags.ts:5` (`DEMO_LABEL` unused), footer `DiscoveryExperience.tsx:663`; peer lift feeds the ranked score (`scoring.ts:421,488`). **Impact:** stakeholders take simulated demand for real. **Jev UFR-D06:** peer_lift_read_as_real **0.61**; fifteen_members_real **0.44**; preview_understood_simulated **0.34**. **Fix:** persistent `DEMO_LABEL` chip in the header; rename sections "Simulated: …"; add "(simulated members)" to the peer-lift line. **Acceptance:** in demo the label is visible above the fold on every screen; the peer-lift line contains "simulated".

### UFR-D07 — AMBIGUITY — Internal jargon about "privacy findings" on People
**Label:** OBSERVED `People.tsx:21`: "Live public profiles stay behind PR #8 until the privacy findings are fixed." **Jev UFR-D07:** understands_pr8 **0.16**; trust_effect **worried** (1.0, conf 0.99); portraits_clearly_not_real **0.87**. **Fix:** "Public traveler profiles are not open yet. Profiles are private by default and discovery is opt-in." **Acceptance:** page contains no "PR #" and no "findings".

### UFR-D08 — RECOVERY FAILURE — Host "Leave" deletes the cabin instantly
**Label:** OBSERVED — user cabins 1 → 0; one message orphaned; host interest stays `committed`. **Location:** `GroupCard.tsx:315-317`; `useSocialStore.ts:531-539`. **Jev UFR-D08:** predicts_leave_deletes **0.27**; can_recover_misclick **0.06**. **Fix:** host control "Close cabin" with confirmation or undo toast; downgrade host interest on dissolve. **Acceptance:** Cancel keeps the cabin; Undo available ≥5 s.

### UFR-D09 — STATE FAILURE — Every browser is the same fixture member
**Label:** OBSERVED. **Location:** `members.ts:988-999`; `useSocialStore.ts:476` (cabin named after `homeJetPort`). Host entered Côte d'Azur and no airport, yet the cabin is "KTEB Cabin" and the host a New York "Signature member"; host and guest share id `me`; cabin can't be renamed. **Jev (UFR-D02 `identity_confusion`):** **0.81**. **Fix:** seed the current member from onboarding answers or label "Demo identity"; let host name the cabin. **Acceptance:** after onboarding without an airport, "KTEB" and "New York" appear nowhere.

### UFR-D10 — AMBIGUITY — Three unconnected kinds of "circle"; the cabin can't be found again
**Label:** OBSERVED. Demo cabins live in the event panel (localStorage); `/circles` "Trip rooms" are sample fixtures; `/community` "Travel circles" run on Supabase. With a cabin saved, `/circles`, `/trips`, `/community`, `/account` all lack "KTEB" and "Monaco Grand Prix". **Jev UFR-D10:** can_find_again **0.12**; understands_three **0.43**; expects_under_circles **0.36** (analyst would score higher — both nav "Circles" and the panel's "Find a circle ↗" point there). **Fix:** list device-local cabins on `/circles`; one name for the concept. **Acceptance:** a cabin created on the event panel appears on `/circles` with a link back to its event.

### UFR-D11 — UX FRICTION (mobile) — Cabin title collapses to 0px at 390px
**Label:** OBSERVED — `getBoundingClientRect().width` of "Friday Out, Monday Back" is 0. **Location:** `GroupCard.tsx:170-205` (`min-w-0 truncate` beside `shrink-0` badges). **Fix:** wrap/stack badges under `sm`. **Acceptance:** every title ≥120px wide at 390×844.

### UFR-D12 — EDGE CASE — Long unbroken text overflows; region field uncapped
**Label:** OBSERVED — scrollWidth 1267 vs clientWidth 468 (`GroupChat.tsx:455` `whitespace-pre-wrap` without `break-words`; premise `GroupCard.tsx:207-209` same); home region `OnboardingFlow.tsx:84-89` no `maxLength`. HTML (`<b>`, `<img onerror>`) stays inert — pass. **Fix:** `break-words`; `maxLength={120}`. **Acceptance:** a 500-char token has scrollWidth ≤ clientWidth.

### UFR-D13 — UX FRICTION — No way back into onboarding after Skip; Enter World discards origin
**Label:** OBSERVED — only link at `AppShell.tsx:120-134`; `OnboardingFlow.tsx:53` always pushes `/`. **Fix:** "Edit traveler lens" on `/account`; return to origin on completion. **Acceptance:** after Skip `/account` links to `/welcome`; finishing returns to origin.

### UFR-D14 — POLISH — `/circles/<uuid>` treats a real circle id as a missing sample
**Label:** OBSERVED `TripRoom.tsx:150-163`. **Fix:** when the id is a UUID link to `/community?circle=<id>`. **Acceptance:** page shows that link.

## 5. Inventories
**Dead ends:** `/community?event=` real (circular, no create) D04 · `/community?circle=` real ("Sign in below", nothing below) D04 · `/account` both modes (no route to an account) D02/D04 · demo avatars (inert buttons) D02 · demo guest link (no invitation) D01.

**Ambiguities:** selected onboarding option D05 · whether onboarding saved/published anything D03 · whether peers are real D06 · cabin vs Circle vs Trip room D10 · "PR #8" D07.

**State-machine problems:** onboarding step not in URL/store D05 · onboarding draft never read D03 · cabin deleted by Leave, interest stays, messages orphaned D08 · invitation never set, missing group hidden silently D01 · shared fixture identity D09.

**Permission problems:** visitor has no way to sign up yet told "Sign in below" — FAIL D04 · guest cannot see host's cabin — FAIL D01 · private by default / opt-in discovery — PASS (Supabase toggles code-review only).

## 6. Visual repair specs (PROPOSED CONCEPT - NOT CURRENT APPLICATION)
**A. Invitation arrival (D01)**
```
[DEMO — simulated members and activity]
YOU WERE SENT THIS
KTEB Cabin · Monaco Grand Prix · 04–06 Jun 2027
Hosted by <name> · 1/8 · forming
[Not this time]        [Take a seat — 7 left]
(if the cabin isn't on this device) "This cabin was created in another browser; demo cabins aren't shared." [OK]
```
Event panel stays underneath; one primary action; afterwards the strip reads "You are on it". Host card gets **Invite** beside **Leave**, opening the existing ShareTrip/InviteDialog ("Copy link", "Compose email — MERIDIAN sends nothing").

**B. Onboarding (D05, D03)**
```
‹ Back   5/5  How public should this be?
( ) Private — Only you.
(●) Discoverable — Not published yet: needs sign-in and your confirmation.   [ring + aria-pressed]
[Save on this device]  → toast "Saved on this device only. Sign in to publish." → returns to the page you came from
```

## Evidence appendix
- Screenshots (`.png`): D-01-welcome-step1, D-02-welcome-after-refresh, D-03-welcome-visibility, D-04-welcome-selected-solo-no-visible-state, D-05-real-start-circle-occasion, D-06-real-community-dead-end, D-07-real-circle-invite-sign-in-below-none, D-11-demo-groups-forming, D-12-demo-host-profile-click-nothing, D-14-demo-host-cabin-created, D-15-demo-host-chat-posted, D-16-demo-host-leave-dissolves-cabin, D-20-demo-guest-invite-link-mobile, D-21-demo-guest-groups-no-host-cabin.
- Jev: UFR-D01…D08, UFR-D10 (`.json`). D09 cites UFR-D02; D11–D14 are objective measurements (no Jev call).
- Console: no page errors, no app console errors; only aborted `_rsc` prefetches, WebGL/THREE warnings, and Wikimedia `ERR_CERT_AUTHORITY_INVALID` from the sandbox proxy.
- Limits: Supabase-backed profile, Travel Modes, visibility and Community paths are CODE-REVIEW ONLY. The demo invite link was built by hand in the app's own `buildTripLink` format because the UI offers no way to produce one.
