# Retest after fixes (Phase 15)

Retested 2026-09-23 on branch `claude/review-recent-work-5li9lw` against a fresh production build (`next start`, providers unconfigured, as in the original audit) and a demo-mode dev server (`NEXT_PUBLIC_MERIDIAN_DEMO=1`). Playwright Chromium, same viewports as the audit. The script is in the session scratchpad (`retest.mjs`, `retest-demo.mjs`); machine-readable results are in [`artifacts/retest-results.json`](artifacts/retest-results.json). `npm run gate` passes: lint 0 errors, typecheck, data validation, 373 tests, build.

Only the running application counts as evidence here; nothing below is inferred from code.

## Results

| Finding | Acceptance check (browser) | Result | After evidence |
|---|---|---|---|
| UFR-A01 (BLOCKER) | "Aspen", "ski", "qwzxv" in the home search → no page error, shell intact | PASS | `AFTER-UFR-A01-search.png` |
| UFR-A02 | Empty in-page search offers "Search all of MERIDIAN for …" and opens the palette with that query | PASS | — |
| UFR-A03 | Save on `/destinations/aspen` → globe panel for the same event shows "Saved on this device ✓" | PASS | `AFTER-UFR-A03-panel-saved.png` |
| UFR-A04 | Atlanta → Use device location → deny → still "Viewing Atlanta … still using this city"; survives reload | PASS | `AFTER-UFR-A04-city-kept.png` |
| UFR-A05 | Zero geolocation calls before any tap | PASS | — |
| UFR-A06 / B05 | Winter → card → URL carries `season`, `interest`, `journey`; reload keeps them; Back stays on MERIDIAN | PASS | — |
| UFR-A08 / C12 | Fresh palette: "Editorial ideas", no "Saved" group, no "· live" | PASS | `AFTER-UFR-A08-palette.png` |
| UFR-A09 / B11 | 1440×900: "Open Aspen" hit-testable without scrolling the panel | PASS | `AFTER-UFR-A09-open-aspen.png` |
| UFR-A14 | `/destinations/ASPEN` → `/destinations/aspen`; unknown slug renders the not-found page | PASS (HTTP stays 200: streamed not-found responses return 200 per the Next.js docs) | — |
| UFR-B01 (DEAD END) | Unconfigured planner: banner in first viewport, "Copy our trip brief" yields the brief, "Nothing was saved on MERIDIAN" | PASS | `AFTER-UFR-B01-copy-brief.png` |
| UFR-B02 | 2019 dates → inline "first day from today onward" | PASS | — |
| UFR-B03 | Draft survives reload | PASS | — |
| UFR-B04 | `?event=aspen-christmas-week` prefills resort "Aspen" and 2026-12-19 | PASS | — |
| UFR-B06 | No number beside "Ski season", no scarcity arrows | PASS | — |
| UFR-C01 (DEAD END) | 390×844 `/now`: "NOW can't pick venues tonight" at y=473, destination links present | PASS | `AFTER-UFR-C01-now-mobile.png` |
| UFR-C02 | NOW inputs are a disabled preview | PASS | — |
| UFR-C03 | "View sample" → selected title in viewport (y=79) | PASS | — |
| UFR-C04 (DEAD END) | Preview shows draft, "Nothing was sent and nothing is held", and a next step | PASS | `AFTER-UFR-C04-access-preview.png` |
| UFR-C05 / B07 / E04 | Every sample labelled; no "confirmed by the provider" | PASS | — |
| UFR-C07 | Only non-empty filter chips | PASS | — |
| UFR-C09 | `/access?offer=nope` → "no longer listed" | PASS | — |
| UFR-C13 | No `<button>` inside `<a>` | PASS | — |
| UFR-D01 (BLOCKER, demo) | Seeded invite link → "You were sent this" strip visible on top on phone and desktop; "Take a seat" joins; `group=` stripped | PASS | `AFTER-UFR-D01-invite-strip.png` |
| UFR-D01 (demo) | Link to a cabin from another browser → honest "not on this device" message | PASS | — |
| UFR-D02 (demo) | Member plate opens the profile sheet | PASS | `AFTER-UFR-D02-profile-sheet.png` |
| UFR-D03 | Onboarding shows "Saved on this device only", no personalization promise | PASS | — |
| UFR-D04 / B10 / E14 | Invite link without sign-in: no "Sign in below", honest alternative | PASS | — |
| UFR-D05 | Selected option `aria-pressed=true`; `?step=2` survives reload; Back → step 1 | PASS | — |
| UFR-D06 | "Demo · simulated" visible | PASS | — |
| UFR-E01 (DEAD END) | `/partners` explains the model, says nothing was submitted, no traveler-lens banner | PASS | — |
| UFR-E03 | Offers tab no longer claims zero offers when unconnected | PASS | — |

**Retest found one new defect in the fix itself**: the demo invitation strip first rendered off-screen (y = −167) because the member plate sat inside the header, whose `backdrop-filter` became the containing block for fixed-position children. Fixed in `ec596a8` by mounting `SocialRoot` at the shell root; retested PASS.

Four checks initially failed because of the test script, not the app (URL read before the router update, uppercase group labels, the brief living in a textarea, the streamed 404 status). Each was re-verified individually and the script corrected; the final run is 28/28 plus 7/7 demo checks.

## Not browser-retestable here

- **UFR-E02 (BLOCKER)**: partner offers in ACCESS need a configured Supabase with an approved provider and a published offer. Verified by code review and tests only: ACCESS now reads published offers through the shared `fetchPublishedOffers` path (RLS already allows anonymous reads of published offers from approved providers). **Needs a hosted acceptance test.**
- **UFR-E06**: `validateOffer` rejecting booking language is unit-tested; the provider name on live cards needs configured data to see.
- **UFR-E08/E09**: the unpublish notice, hidden delete and mapped errors need a configured partner account; the error mapper is unit-tested.
- **UFR-A10**: the destination distance appears after choosing a city on the home page (tab-local); not in the automated run.

## Deliberately not fixed (need an owner decision or a migration)

| Finding | Why deferred |
|---|---|
| UFR-E05, E07, E12, E13 | Inquiry threads or consented contact, a yacht/charter offer type, an inquiry state-machine guard, approval notifications — all need database migrations and RLS review (HIGH_CAPABILITY_ONLY) |
| Merge-review items | Manual research takedown lock (migration); public display of Treg social handles (product/privacy decision) |
| UFR-A07 personalization | Copy is now honest; actually applying the lens to discovery is a product decision |
| UFR-B08 | Ski destinations now route "Start a trip" to the planner; consolidating all five "start" CTAs is an IA decision |
| UFR-D08, D09, D10, host Invite button on cabin cards | Demo-only social UX; next pass |
| UFR-E10, E11 (globe offer ids), C11, C14, A13 (remaining jargon) | Lower-severity IA/polish |
