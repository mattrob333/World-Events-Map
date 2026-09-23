# UserFlow Red Team findings — Persona E: travel provider / partner handoff

> Written by the persona E tester agent; saved to disk by the orchestrator verbatim from its returned report (subagent file writes were blocked by the harness).

Audit date 2026-09-23 · app code `fb99093` (HEAD `9ce8e68` adds only red-team docs) · discovery pass, no app code/config/data changed.

**Environment used:** `http://localhost:3127` (`next start`, real mode, Supabase/partner backend **unconfigured**). Verified via `curl` that demo `:3128` `/partners` and `/community?tab=offers` render the same disconnected state, so **no reachable environment can render the provider application form, offer studio, or traveler inquiry form**. Those were exercised by code review plus **real PostgreSQL execution** of `supabase/migrations/001_platform.sql` in embedded PGlite: project tests (`npx vitest run src/lib/platform/__tests__` → 3 files, 21 tests passed) and a read-only probe `scratchpad/rt-E/pglite-probe.mjs` (log `scratchpad/rt-E/out/pglite-probe.log`). PGlite results are labelled "OBSERVED (PostgreSQL)", not browser-tested.

**Jev:** jev-1.13.0, 8 calls, `artifacts/jev/UFR-E01..E08.json`. **treg:** EXTERNAL VALIDATION NOT EXECUTED (no external systems involved; no email/notification is ever sent).

## 1. Persona
| Field | Value |
|---|---|
| User type | Yacht charter broker (Monaco) / chalet operator (Courchevel); plus traveler counterpart |
| Context | Arrives via globe footer "Partner with us ↗" or `/access` footer "Are you a travel provider? Explore the partner studio ↗". Non-technical. |
| Knowledge | Knows product/pricing; not MERIDIAN's review model, "inquiry not booking" rule, or that `/access` and `/community` differ |
| Permissions | Intended: owner of one `provider_orgs` row; pending can draft, approved can publish/pause/reply; cannot self-approve. In this deployment: none (disconnected) |
| JTBD | Get offer in front of travelers; receive and answer inquiries; close business |
| Entry | `/` → footer "Partner with us ↗" → `/partners` |
| Expected end | App pending → approved; offer visible where travelers look; inquiry reaches provider; provider replies; traveler reads and can continue |

## 2. Flow maps
**F1 — Provider application (disconnected)** — `EXECUTED - FAIL` (dead end; honest)
`PROVIDER -> / -> "Partner with us ↗" -> /partners -> "The studio is being connected… No application or offer has been submitted." + "Explore the world" -> no next decision (0 inputs, 0 buttons, 0 mailto) -> reload same | Back -> / | "Traveler ACCESS" -> fixture samples -> SUCCESS unreachable`

**F1b — Configured application + studio** — `CODE-REVIEW ONLY` + PG constraints
`/partners -> email -> sign-in link -> "Introduce your business." -> Submit -> provider_orgs(pending) -> draft offer -> [admin SQL approves; no in-app signal] -> Refresh studio -> Publish -> visible only in /community?tab=offers + globe "Just released" (3)`

**F2 — Handoff provider→traveler→provider→traveler** — browser `EXECUTED - FAIL` (breaks at discovery); configured path `CODE-REVIEW ONLY` + `OBSERVED (PostgreSQL)`
`TRAVELER (separate ctx) -> nav ACCESS -> 5 samples only -> REQUEST DETAILS -> Preview inquiry -> "No message was sent to a provider" | /community?tab=offers -> "No published offers are available here yet" (never queried) -> BREAK.` Configured (PG): `inquiry insert -> provider sees message only (no identity), on manual refresh -> single response -> traveler sees after "Refresh replies" -> cannot reply/amend/withdraw -> END`

**F3 — Community (circles vs offers, deep links)** — `EXECUTED - PARTIAL`
**F4 — Honesty sweep** — `EXECUTED - PARTIAL` (live card CODE-REVIEW ONLY)
**F5 — Mobile 390×844** — `EXECUTED - PARTIAL` (no horizontal overflow on `/partners`, `/community?tab=offers`, `/access?offer=`; partner forms unrenderable → UNTESTED)

## 3. Test cases
| ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| E-T01 | first-time entry | Partner link discoverable | 1 footer link; no nav item | PASS (weak) | sweep2 log |
| E-T02 | happy apply (disconnected) | Honest, no fake success | "being connected… No application or offer has been submitted" | PASS honesty / FAIL JTBD | E-01 |
| E-T03 | missing/invalid email/URL/long | Validation | Form never renders. Code: required, `pattern="https://.*"`, maxLength; DB rejects http (P1); raw DB text would reach UI | UNTESTED browser / CODE-REVIEW | P1 |
| E-T04 | duplicate application | Idempotent | DB `duplicate key … provider_orgs_owner_id_key` (P4); UI hides form once org exists | CODE PASS | P4 |
| E-T05 | refresh/Back | Preserved or honest | Disconnected stable; Back→`/`; configured draft is React state only (INFERRED `page.tsx:67`) | PARTIAL | sweep2 |
| E-T06 | provider previews traveler view | Sees own offer | "Traveler ACCESS" → other providers' samples | FAIL | E-02 |
| E-T07 | traveler finds offer in ACCESS | Real offers | Fixtures only | FAIL | E-02 |
| E-T08 | traveler finds offer in community offers tab | Offers or honest unavailable | "No published offers… yet" while disconnected | FAIL | E-04, E-05 |
| E-T09 | sample inquiry | No false send | "No message was sent to a provider and no reservation was made."; resets on reload | PASS | E-03 |
| E-T10 | `/access?offer=does-not-exist` | Not-available notice | Silent list | FAIL minor | sweep2 |
| E-T11 | `/community?tab=offers&event=courchevel-peak-week` | Filtered, event named | Filter notice doesn't name event; same misleading empty | PARTIAL | E-04 |
| E-T12 | `/community?tab=requests` | Requests tab | Travel circles (`app/community/page.tsx:5`) | FAIL minor | sweep2 |
| E-T13 | `/community?circle=<uuid>` disconnected | Honest | "Sign in below…" but sign-in impossible | FAIL minor | sweep3 |
| E-T14 | `?circle=not-a-uuid` | Invalid notice | "This Circle link is invalid…" | PASS | sweep3 |
| E-T15 | duplicate inquiry | De-dup/warn | Two identical rows accepted (T3) | EDGE | PG |
| E-T16 | provider sees traveler contact | Can respond meaningfully | Profile returns 0 rows (P9); message only | FAIL design | PG |
| E-T17 | traveler follow-up/withdraw | Possible | 0 rows affected (T4/T5) | FAIL design | PG |
| E-T18 | edit published offer | Stays live or clearly unpublishes | Becomes draft, hidden from travelers (P13/T7); "for review" copy untrue | STATE FAILURE | PG |
| E-T19 | delete draft with inquiries | Clear refusal | Raw `…violates foreign key constraint "inquiries_offer_id_fkey"` (P14) | RECOVERY FAILURE | PG |
| E-T20 | reopen closed / overwrite reply | Guarded | Allowed; traveler sees status new + overwritten reply (P12/T6) | EDGE | PG |
| E-T21 | mobile `/partners` | Usable | No overflow; footer link reachable | PASS | sweep4 |
| E-T22 | mobile offers tab | Disconnected shown first | Misleading empty copy at y=722; "not connected" at y=891 (below 844 fold) | FAIL | E-05 |
| E-T23 | yacht taxonomy | Fitting category/kind | No yacht option; DB rejects `yacht` (P2/P5) | FAIL | E-02 |

Console: 0 page errors, 0 console errors on all routes; only benign RSC prefetch aborts (`/trips?_rsc`, `/circles?_rsc` ERR_ABORTED).

## 4. Findings

### UFR-E01 — Partner studio is an honest dead end with no path forward — DEAD END · OBSERVED (browser) · `/partners` · E-01
**Problem:** With the backend unconfigured the page shows only "The studio is being connected. Provider accounts, offers and inquiries require the member platform to be configured. No application or offer has been submitted." + "Explore the world". No form, email capture, contact, timeline, or explanation of the partner model; the site-wide traveler-lens banner also shows. **Impact:** every partner arriving via the only acquisition link leaves with nothing; lead lost. "Configured" is operator language. **Jev UFR-E01:** knows_nothing_submitted **0.80**; has_path_forward **0.08**; understands_offering **0.99/3** (mode "Vague impression only", p=0.69); likely_next_action **leave_site** (p=0.25, conf 0.06; traveler ACCESS 0.23, traveler-lens 0.22). Analyst: agree — honesty passes, orientation/way-forward fail. **Root cause:** `src/app/partners/page.tsx:232-240`. **Fix:** in the `!client` branch add a 4-step "How partnering works" (apply → review → publish inquiry-only offers → reply; no bookings/payments/holds) plus a configured contact or "Partner applications are not open in this preview"; suppress the traveler-lens banner on `/partners`. **Acceptance:** with Supabase unset, `/partners` shows the model, an honest contact or not-open state, never says "submitted", and no traveler-lens banner.

### UFR-E02 — Published offers never appear where travelers and the studio are sent; `/access` is fixture-only — BLOCKER · OBSERVED (browser + code) · E-02
**Problem:** Nav ACCESS (`AppShell.tsx:15,22`), studio "Traveler ACCESS" (`partners/page.tsx:199`) and dossier "Find access & stays ↗" (`EventDossier.tsx:186`) all lead to `/access`, which renders only `OPPORTUNITY_FIXTURES` (`AccessFeed.tsx:67-70`, `lib/access/fixtures.ts:85-92`). Real offers load only in `Community.tsx:147-154` and `LivePulse.tsx:27-34`, neither linked from nav. Two different models (`OpportunityCard` vs `PartnerOffer`). **Impact:** the core provider→traveler handoff fails by design; a provider checking their listing sees fictional competitors. **Jev UFR-E02:** traveler_finds_real_offers **access** (p=0.97, conf 0.95); handoff_integrity **0.30/4** ("Very unlikely", p=0.77); provider_expects_offer_here **0.46**. Analyst: agree on traveler/handoff; the provider 0.46 likely reflects the samples disclosure, but they still can't locate their own offer. **Fix (REVIEW_REQUIRED):** point the studio link to `/community?tab=offers`; when a client exists, render real offers in `AccessFeed` above samples and hide samples in real mode; link the offers tab from nav/ACCESS. **Acceptance:** approved provider publishes → anonymous context on `/access` sees title + provider name; the studio link lands on a page listing it.

### UFR-E03 — "No published offers… yet" when the service was never queried — POOR FEEDBACK / honesty · OBSERVED (browser desktop + mobile) · E-04, E-05
**Problem:** the offers empty state ignores `client` (`Community.tsx:571-579`) unlike circles (`:504-508`). On 390×844 the misleading copy is in the first screen (y=722); "Membership is not connected yet" is below the fold (y=891). **Impact:** travelers conclude there are no partners; providers think their publish failed. **Jev UFR-E03:** believes_checked_and_empty **0.75**; empty_copy_truthful **0.52**; circle_card_confuses **0.53**. Analyst: disagree with 0.52 — the copy asserts a state the system cannot know; it is untrue. **Fix:** when `!client`: "Partner offers will appear when the partner service is connected. Nothing has been checked yet." **Acceptance:** at 390×844 with no Supabase, no zero-offers claim and the disconnected message is in the first viewport.

### UFR-E04 — Availability copy implies provider confirmation that does not exist — AMBIGUITY / honesty · OBSERVED (browser sample; code live card) · E-03
**Problem:** (a) sample "Bellecôte chalet week" from fictional "Three Valleys Desk" shows "Details last confirmed by the provider. Still an inquiry until they reply." (`fixtures.ts:77` → `lib/access/types.ts:47`), no in-card sample label. (b) Live `provider_updated`: studio promises "Provider updated · subject to confirmation" (`partners/page.tsx:448-450`); travelers see "Availability supplied by provider" (`Community.tsx:590-592`, no qualifier/timestamp); globe "Provider updated" (`LivePulse.tsx:91-93`). **Jev UFR-E04:** believes_provider_confirmed_sample **0.57**; supplied_by_provider_reads_live **0.75**; honesty_rating **2.16/3** (conf 0.16; p 0.07/0.14/0.33/0.46). Analyst: partly disagree with the overall rating — the body copy is good, but a sample must never claim a provider action, and 0.57 believe it. **Fix:** distinct fixture copy ("Sample listing — no provider has confirmed these details") + in-card Sample chip; one live label everywhere: "Provider-updated details · subject to confirmation · updated <date>". **Acceptance:** no fixture renders "confirmed by the provider"; all three live surfaces show the identical dated label.

### UFR-E05 — Inquiry handoff is one-shot, un-notified, and anonymous to the provider — MISSING STEP · OBSERVED (PostgreSQL P8-P12, T4-T6 + code)
**Problem:** provider sees only the message — traveler profile returns 0 rows (P9); single `response` column, a second send overwrites (P12/T6); traveler cannot update/follow up/withdraw (T4/T5; no policy, `001_platform.sql:138-140`); no notifications — studio loads on mount/"Refresh studio" (`partners/page.tsx:70-122`), traveler "Refresh replies" (`Community.tsx:648-655`). Studio notice "The traveler can read it in their account." (`partners/page.tsx:621-623`) is wrong — `/account` (`Account.tsx`) has no requests; replies live at `/community` → Your requests. Traveler heading "Your conversations with partners." (`Community.tsx:613`) implies dialogue; the form warns about payment details but never asks how to be reached. **Jev UFR-E05:** handoff_completion **2.08/4** (mode "One-shot answer only", p=0.86, conf 0.88); provider_can_close_deal **0.18**; traveler_expects_dialogue **0.58**. Analyst: agree. **Fix:** CHEAP_OK — correct the studio notice location, rename heading to "Your partner requests", add "Include how the provider can reach you" to the form. Later HIGH_CAPABILITY — `inquiry_messages` table or opt-in share-contact flag + notifications. **Acceptance:** notice names Community → Your requests; form mentions contact details; a PGlite test covers the chosen follow-up behaviour.

### UFR-E06 — Live offer card hides the provider and shows unqualified free-text price — LOGIC FAILURE · OBSERVED (code + PG T1)
**Problem:** query joins `provider_orgs(name,status)` (`Community.tsx:149`) but the `Offer` type (`:47-58`) and card (`:581-605`) never render the name; `price_label` is any provider text ≤100 chars (`platform/types.ts:37`), shown verbatim (`Community.tsx:588`) with no qualifier; the studio placeholder "From €1,200 per night, including taxes" invites a firm price. **Jev UFR-E06** (state used a *constructed adversarial example* the field permits: "Confirmed €45,000 — book now for race week"): knows_who **0.11**; reads_as_confirmed_price **0.80**; card_honesty **0.04/3** ("Contradicts it", p=0.98). Analyst: the name omission is certain; the price risk depends on provider input but nothing contains it. **Fix:** "Verified partner: <name>" on card + "Your request goes to <name>" in panel; fixed qualifier under price ("Indicative · the provider confirms price and availability"); `validateOffer` rejects confirmed/book now/guaranteed/reserved. **Acceptance:** name rendered; `validateOffer` rejects "Confirmed €45,000 — book now"; qualifier always present.

### UFR-E07 — Taxonomy does not fit yacht charter and does not match traveler filters — AMBIGUITY · OBSERVED (code + PG P2/P5; E-02)
Specialties `hotel|chauffeur|aviation|organizer|advisor` (`partners/page.tsx:287-293`; DB `001_platform.sql:36`); kinds `stay|arrive|access|curated` (`page.tsx:368-371`; DB `:46`); traveler filters include `yacht`, `ground`, `dining`… (`lib/access/types.ts:1-10`); card shows raw enum ("access · Monaco", `Community.tsx:584`). **Jev UFR-E07:** specialty_pick **advisor** (p=0.79; organizer 0.12; abandon 0.08); offer_type_pick **access** (p=0.88); taxonomy_fit **1.58/3** ("Poor fit", p=0.43, conf 0.23). Analyst: agree. **Fix:** one shared kind vocabulary/mapping; add yacht/charter via a reviewed migration; render labels not enums. **Acceptance:** a yacht broker can pick "Yacht / boat" in both forms and it matches the ACCESS yacht filter.

### UFR-E08 — Editing a published offer silently unpublishes it; "for review" is untrue; delete shows raw FK error — STATE FAILURE · OBSERVED (PG P13/T7/P14 + code)
`saveOffer` always sets draft (`partners/page.tsx:162-171`); notice only "Offer saved as a draft. Preview it below before publishing."; helper says "returns it to draft for review" (`:465-466`) but no review exists; travelers' requests lose the offer title → "Your travel request" (`Community.tsx:628-629`). "Delete draft" (`page.tsx:548-563`) fails with raw `update or delete on table "offers" violates foreign key constraint "inquiries_offer_id_fkey"` (no cascade, `001_platform.sql:53`). **Jev UFR-E08:** realizes_unpublished **0.62**; expects_admin_review **0.39**; delete_error_recoverable **0.21**. Analyst: 0.62 is optimistic — the notice never says "hidden from travelers". **Fix:** notice "Saved. This offer is now hidden from travelers until you publish it again."; remove "for review"; add "Save and republish"; hide Delete when inquiries exist (use Pause); map 23503 to plain copy; read offer title via the inquiry rather than the published list. **Acceptance:** editing a published offer shows the hidden notice; a draft with inquiries has no Delete; the request keeps its title.

### UFR-E09 — Raw DB errors are the only studio feedback — RECOVERY FAILURE · INFERRED (code `partners/page.tsx:127-134` + PG messages observed)
`run()` shows `e.message` verbatim. Observed messages that would surface: `provider_orgs_website_check`, `duplicate key … provider_orgs_owner_id_key`, "An approved provider and future expiry are required", the FK error. **Fix:** map 23505/23514/23503/P0001 to human copy. **Acceptance:** mapper unit test.

### UFR-E10 — Community frames partner offers as circles — AMBIGUITY · OBSERVED (browser) · E-04/E-05
On `?tab=offers` the H1 stays "Find your next circle."; tab heading "A good reason to go." renders 15px vs the 28px empty-card heading (measured); aside still "One shared interest is all it takes… Start a small circle" (`Community.tsx:970-986`); nav CIRCLES → `/circles` is a different surface from the "Travel circles" tab. Jev (UFR-E03) circle_card_confuses **0.53**. **Fix:** tab-aware title/aside, one-line "circles = travelers; partner offers = reviewed businesses"; fix h2 size.

### UFR-E11 — Offer deep links are lossy — EDGE CASE · OBSERVED (browser + code)
`/access?offer=does-not-exist` silent list (`AccessFeed.tsx:67`); globe offer links carry no offer id (`LivePulse.tsx:80`); `/community` has no `?offer=`; `?tab=requests` ignored (`app/community/page.tsx:5`) — the link a future reply notification would need. **Fix:** accept `tab=requests`, not-available notice for unknown ids, add `?offer=`.

### UFR-E12 — Duplicate inquiries and reply overwrite unguarded — EDGE CASE · OBSERVED (PG T3/P12)
Identical inquiries accepted; closed → new allowed with reply overwritten; traveler sees "new" + overwritten text. **Fix:** enforce new→replied→closed in `guard_inquiry`; keep history.

### UFR-E13 — No in-app signal on approval; disabled Publish has no reason — STATE FAILURE (stale) · INFERRED (code `page.tsx:324-326, 537-546`; `partner-setup.md` step 4)
Approval is admin SQL; provider must press Refresh; pending copy has no timeline/contact. **Fix:** reason on the disabled Publish button + "what happens next" line.

### UFR-E14 — Circle invite link says "Sign in below" when sign-in is impossible — EDGE CASE · OBSERVED (browser)
`Community.tsx:359` lacks a `client` guard.

### UFR-E15 — Traveler-lens banner on the partner studio — POLISH · OBSERVED · E-01
Jev start_traveler_lens p=0.22 as the provider's next action. Suppress on `/partners`.

## 5. Inventories
**Dead ends:** `/partners` disconnected (E01); `/access` "Preview inquiry" with no route to real offers (E02); traveler after reply cannot respond (E05); delete draft with inquiries → raw FK (E08/E09).

**Ambiguities:** two offer catalogues (E02); "last confirmed by the provider" / "Availability supplied by provider" (E04); who is the provider / is the price a quote (E06); yacht taxonomy (E07); circles framing over offers (E10); "for review" (E08); "in their account" (E05).

**State-machine problems:**
| Object | Transition | Problem | Evidence |
|---|---|---|---|
| offer | published → draft on edit | Silent unpublish; request title lost | P13/T7 |
| offer | draft with inquiries → delete | FK raw error | P14 |
| inquiry | closed → new | Allowed; reply overwritten | P12/T6 |
| inquiry | traveler follow-up/withdraw | Missing | T4/T5 |
| provider_org | pending → approved | No signal | E13 |
| offers empty state | disconnected | Asserts unknown state | E03 |

**Permission problems:**
| Actor | Action | Current | Assessment |
|---|---|---|---|
| Provider | Read inquirer contact | Denied (P9) | Privacy-correct but no consented alternative (E05) |
| Traveler | Update own inquiry | Denied (T4/T5) | Missing capability (E05) |
| Provider | Self-approve | Denied (project test) | Correct |
| Third user | Read/impersonate inquiries | Denied (project test) | Correct |
| Provider | Reopen closed / overwrite reply | Allowed (P12) | Should be constrained (E12) |

## 6. Visual repair specs
**PROPOSED CONCEPT - NOT CURRENT APPLICATION — `/partners` disconnected (UFR-E01)**
```
[PARTNER STUDIO]                              [See how travelers see partner offers →]
Extraordinary places. The people who make them happen.
┌──────────────────────────────────────────────────────────┐
│ Partner applications are not open in this preview.       │
│ Nothing has been submitted or saved.                     │
│ How partnering works: 1 Apply  2 MERIDIAN reviews        │
│ 3 Publish inquiry-only offers  4 Reply to requests       │
│ No bookings, payments or inventory holds on MERIDIAN.    │
│ [Primary: Email partners@<configured>] (hidden if unset) │
└──────────────────────────────────────────────────────────┘
(no traveler-lens banner)
```
Keep: the "nothing submitted" honesty. Primary: configured contact or none.

**PROPOSED CONCEPT - NOT CURRENT APPLICATION — live partner offer card (UFR-E06/E04/E07)**
```
YACHT / BOAT · MONACO                       Verified partner: Riviera Yachts
Race week day charter
Six hours aboard a 40m motor yacht…
From €45,000 per day
Indicative · Riviera Yachts confirms price and availability when they reply
Provider-updated details · subject to confirmation · updated 20 Sep 2026 · ends 23 Oct 2026
[Primary: Ask Riviera Yachts]   This sends a request, not a booking.
```

## Evidence appendix
- Screenshots: `artifacts/E-01-partners-disconnected.png`, `E-02-access-yacht-filter.png`, `E-03-access-chalet-preview-inquiry.png`, `E-04-community-offers-event-disconnected.png`, `E-05-mobile-community-offers-first-screen.png`
- Jev: `artifacts/jev/UFR-E01..E08.json` (all HTTP 200, jev-1.13.0)
- Scratchpad `rt-E/`: `sweep1-4.mjs`, `pglite-probe.mjs`, `out/pglite-probe.log`, `out/*.txt`
- Tests: platform 21/21 passed
- UNTESTED in browser (require configured Supabase): application validation, studio, publish/pause, inquiry send/reply, mobile partner forms
