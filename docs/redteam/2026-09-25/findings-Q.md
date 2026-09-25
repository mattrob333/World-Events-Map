# Findings, persona Q: hostile or careless outsider, plus honesty auditor

Build `main` @ `b14f948`, `next start` :3127, 2026-09-25. Discovery only. Every context called `noPaidResearch`, routed research to the Lisbon fixture or a hostile copy (`rt3/Q/research-evil.json`), and aborted every non-localhost request (0 attempted). No Treg or Jev call. Screenshots `artifacts/Q-01…Q-05, Q-07…Q-10`. (Saved by the orchestrator from the tester's returned text; condensed.)

## 1. Persona, job, entry, end state
Abuse the new endpoints and inputs (`route-trip`, `basket`, `cron/*`, Vibe stage, location picker, palette, designer URL params, research names and links), then check every claim against behavior and traffic. Expected: generic errors, cross-origin refused, limiter unspoofable, cron closed, no injection, no unsafe hrefs, every claim true.

## 2. Flow maps
1. route-trip hostile requests → 403/415/400/413, generic. **PASS.**
2. basket hostile candidates → cleaned / capped. **PARTIAL** (bidi and zero-width survive, Q10).
3. Spoofed IP headers → no new limiter identity. **PASS.**
4. Cron without auth → refused. **PASS** (503 reveals configuration, Q12).
5. Vibe transcript with markup → inert. **PASS** (footnote untrue, Q03).
6. "I don't know yet…", "Best beaches right now…", "Surprise me…" → planner opens with the phrase as the place. **FAIL** (Q01).
7. "Somewhere to ski in January" → December picks, no rules disclosure. **PARTIAL** (Q02).
8. Lisbon look around → rank → deck → fit → OpenTable. **PARTIAL** (no injection; deck covered Q05; "You said Art" on a barbershop Q06; profile sent Q04; "Reserve" is a search Q07; hostile hrefs render Q10).
9. Designer `?place=` markup / `javascript:` / RLO / long region. **PASS** (rejected).
10. Location picker / ⌘K markup. **PASS.**
11. No research on page view (cluster A retest). **PASS.**
12. Share/reply links (cluster B). **CODE-REVIEW + unit tests** (17/17 pass).
13. Jev "Standout" bands. **UNTESTED** (no key).

## 3. Key results
PASS: origin/fetch-site checks, content type, garbage JSON, size caps, spoofed IP headers, markup stripped server-side, candidate caps, cron refuses, no research on page load, designer params rejected, markup inert everywhere, OpenTable URL encoding, calendar plan-by labelling.
FAIL: phrases as places (QT15–17); rules fallback not disclosed (QT18); month ignored (QT19); trip footnote vs traffic (QT20); basket sends names, kids' ages, music without disclosure (QT21); Keep covered (QT22–23); "You said Art" (QT24); "Reserve" wording (QT26); hostile hrefs rendered (QT27); bidi names (QT10); no affiliate disclosure (QT30, latent).

## 4. Findings
- **UFR3-Q01 LOGIC FAILURE (OBSERVED):** rules path accepts almost any short phrase as a place ("I don't know yet", "Best beaches right now", "Surprise me", "Where should we go", "Plan my honeymoon", "recommend a beach", "We need a break", "Take me skiing"); `placeFound` beats RECOMMEND. Root `vibe.ts:22-30`, `planPlace.ts`, `tripRouter.ts:90-91`, `vibeChecklist.ts:36`. (Same cluster as UFR3-N01.)
- **UFR3-Q02 HONESTY (OBSERVED):** `decidedBy:"rules"` dropped by the stage; "ski in January" returns Dec 19/26 weeks; checklist ticks "Where" for "Surprise me in November" and "Not doing" for "I don't know yet".
- **UFR3-Q03 PRIVACY / HONESTY (OBSERVED):** trip footnote "The trip is planned on this device" while the transcript is POSTed to `/api/designer/route-trip` (and to Jev when keyed); speech sentence shown in typed mode.
- **UFR3-Q04 PRIVACY (OBSERVED):** basket request sends profile summary, likes including music, and crew names with kids' ages, with no disclosure. Fix: roles and age bands, food/interest likes only, visible line.
- **UFR3-Q05 BLOCKER (OBSERVED):** deck card covers Keep/Pass/Done. (Same as UFR3-O01/P01.)
- **UFR3-Q06 HONESTY (OBSERVED):** `becauseLine` substring match: "You said Art" on "Martinho da Arcada · Barbershop"; "You said" for derived likes. `tripFit.ts:69-73`.
- **UFR3-Q07 HONESTY (OBSERVED):** "Reserve on OpenTable" is a search; honest note only in a tooltip; shown for a food hall and a breakfast café. (Same as UFR3-O10/O14.)
- **UFR3-Q08 COST EXPOSURE (CODE-REVIEW):** route-trip and basket skip the daily `jev` budget and write a receipt on every allowed request, even when Jev is unconfigured.
- **UFR3-Q09 EDGE CASE / HONESTY (OBSERVED):** shared limiter bucket off Vercel; basket says "Fit check is busy" when Jev isn't configured at all.
- **UFR3-Q10 SECURITY (low) (OBSERVED with hostile fixture):** client renders research `url`s without re-checking (`data:`, off-allowlist https); names keep U+202E/U+200B (reversed text, also in OpenTable term); long unbroken names overflow.
- **UFR3-Q11 COST EXPOSURE (low) (INFERRED):** a garbage place from Q01 reaches paid research.
- **UFR3-Q12 SECURITY (low) (OBSERVED):** unauthenticated cron requests learn whether CRON_SECRET is configured (503 vs 401).
- **UFR3-Q13 HONESTY (latent) (CODE-REVIEW):** affiliate-ready links with no commission disclosure.
- **UFR3-Q14 STATE FAILURE (CODE-REVIEW):** Start over wipes keeps silently. (Same as UFR3-O13.)
- **UFR3-Q15 POLISH (OBSERVED):** 🏄 for every activity; "Type instead like a caveman" can read as mocking.

## 5. Retest of 09-24 P0 clusters
- **Cluster A:** mostly fixed (no auto-fire, origin checks, unspoofable limiter, cache-miss-only limiter, reserve-then-settle budget, enum cache keys). **Still open:** daily budget is per-instance memory; a durable reserve/settle is needed before Production. Jev budget gap moved to the new routes (Q08).
- **Cluster B:** fixed in code (null-prototype maps, `isSafeId`, exact-host allowlist, control-character stripping, organizer marker); `tripShare.test.ts` 17/17. Merge-sheet diff, stale-reply detection and Undo not re-verified.

## 6. Top 5
1. Q05 deck buttons covered.
2. Q01 (+Q02, Q11) phrases become places; rules not disclosed; month ignored.
3. Q03 + Q04 privacy copy vs traffic.
4. Q08 Jev routes skip the daily budget and write receipts.
5. Q06, Q07, Q13 honesty bundle.
