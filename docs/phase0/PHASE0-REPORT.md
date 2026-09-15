# Phase 0 report — Foundation and risk containment

**Branch:** `claude/world-events-travel-globe-ykgfs7` (from `main` = audited `6cab1fd`). **Head at report time:** see `backlog.json` `meta.currentHead`.
**Gate:** G0 — safe foundation. **Status:** all six Phase 0 tickets done; awaiting acceptance before Phase 1.

This report follows the plan's required output: tickets completed, files changed, user-visible behaviour, commands and results actually run, screenshots, environment variables added, blockers, unresolved risks, and the next smallest reviewable task. No test is claimed that was not run; every result below is from a command executed on this branch.

## Tickets completed

| Ticket | Commit | Summary |
|---|---|---|
| M-001 Reproducible baseline | `2c3c509` | Fresh `npm ci` baseline at `17663a4`; typecheck/validate/build pass, `next lint` fails (A06); desktop, phone and no-WebGL captures; findings verified against source. `BASELINE.md`. |
| M-002 Lint and quality gate | `aa72ed0` | ESLint 9 flat config (`eslint-config-next@16`), Vitest 5 with a real test, gate = lint + typecheck + data:validate + test + build. 24 errors → 0, no rule disabled. `LINT-BASELINE.md`. |
| M-003 Demo boundary | `77ea393` | `NEXT_PUBLIC_MERIDIAN_DEMO` flag (off in production by default); single `getDemoWorld()` gate; every simulated read routed through it; persistent masthead label; user drafts preserved; A04 wording. 26 tests. |
| M-004 Refresh containment | `b528161` | Public `/api/signals` read-only, ignores `force`; `POST /api/admin/refresh` behind a bearer token (503 when unconfigured); subset refresh honours the subset; deliberate sweep is a separate function. |
| M-005 Server/client boundary | `b528161` | `src/lib/data/index.ts` client-safe; `src/lib/data/server.ts` + `sources.ts` + all credential-reading adapters begin with `import 'server-only'`; static boundary test; client-bundle inspection clean. `BUNDLE-INSPECTION.md`. |
| M-006 Flow/route/contract map | `2c3c509` | `CONTRACTS.md` (preserve list quoted from source, route map, seven action flows, ownership matrix, demo boundary definition, 11 plan-vs-source discrepancies), `backlog.json` (50 tickets, 92 dependency edges, no cycles), `agents/` (7 briefs + integrator). |

Supporting commits: `d9a0deb`, `97290c4`, `9f36a21` (backlog status, evidence).

## Files changed (by area)

- **Tooling:** `package.json`, `package-lock.json`, `eslint.config.mjs`, `vitest.config.mts`, `.env.example`.
- **Data/API (M-004/005):** `src/lib/data/{index,server,sources}.ts`, six adapters, `src/app/api/{signals,events,sources}/route.ts`, new `src/app/api/admin/refresh/route.ts`, tests under `src/lib/data/__tests__` and `src/app/api/__tests__`.
- **Demo boundary (M-003):** new `src/lib/flags.ts`, `src/lib/demo/`, 8 files in `src/lib/social/`, 14 in `src/components/social/`, `TopBar.tsx`, one line in `EventRail.tsx`, tests under `src/lib/demo/__tests__` and `src/lib/social/__tests__`.
- **Lint fixes (M-002):** four one-line unused-symbol removals (`golf.ts`, `tokens.ts`, `geojson.ts`, `ScrollArea.tsx`).
- **Docs:** `docs/phase0/*`, `agents/*`, `backlog.json`.

Not touched, by design: `src/lib/types.ts`, `src/app/globals.css`, `src/app/page.tsx`, the globe renderer, the timeline, the selectors, the dataset.

## User-visible behaviour

- Production builds show **no simulated members, interest, groups, or messages** unless `NEXT_PUBLIC_MERIDIAN_DEMO=1`. Real mode shows honest empty states ("No member activity yet", "No cabin yet"), beacons carry `peerCount` 0, and rankings no longer include peer lift.
- Demo mode carries a persistent brass label in the masthead: "Demo — simulated members and activity", plus "Simulated for review" on simulated records.
- "Chartered" is displayed nowhere. Aircraft selection reads "Aircraft preference set"; costs read "Estimate per seat" with "Planning estimate. Not a quote or a booking." beside the figure.
- Public `/api/signals?force=1` still returns 200 (deep links keep working) but never fetches vendors.
- Globe, scrubber, rail, dossier, hover, keyboard map: unchanged (contracts in `CONTRACTS.md` §1).

## Commands run and results (final gate at `9f36a21`)

```
npm run gate
  eslint .            0 errors, 35 warnings (all listed with justification in LINT-BASELINE.md)
  tsc --noEmit        exit 0
  data:validate       ALL CHECKS PASSED (12 pre-existing benign warnings)
  vitest run          10 files, 76 tests passed
  next build          Compiled successfully
GATE exit 0
```

Bundle inspection on that build: 13 client chunks; positive control `monaco-grand-prix` present in 1; `PREDICTHQ_TOKEN`, `TICKETMASTER_API_KEY`, `X_BEARER_TOKEN`, `SERPAPI_KEY`, `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `REFRESH_ADMIN_TOKEN`, `collectSignalPatches`, `sweepAllSignals`, `timingSafeEqual`, `serpapi.com` all 0.

Browser probes (headless Chromium + SwiftShader, not real devices): `demo-on-*.png` and `demo-off-*.png` — demo on: `data-demo="true"`, label rendered, 2605 signals, 29 overlapping members on Oktoberfest; demo off: `data-demo="false"`, "No member activity yet", 0 overlapping, no join action. Zero console errors in both.

## Environment variables added (no values)

`NEXT_PUBLIC_MERIDIAN_DEMO` (public, build-time; blank = demo on outside production) · `REFRESH_ADMIN_TOKEN` (server-only; blank disables `/api/admin/refresh` with 503). No migrations; no database exists yet.

## Blockers

None.

## Unresolved risks (carried into the backlog)

1. **P0-F1 — no-WebGL fallback unreachable.** three.js logs the context failure instead of throwing, so the loading overlay persists forever; discovery works underneath but nothing tells the visitor. Small fix; belongs with M-012 (list-first / no-WebGL path) or as an immediate S patch.
2. **A02 is stronger than the audit says:** `/api/signals` and `/api/events` have no client consumer at all (CONTRACTS.md §6). M-008.
3. **A07 lossy cache keys** affect `useHeatByDay` as well as `useBuzzMap`; M-009 must cover both.
4. **A10** partly mitigated by `ui/keys.ts`; the window handler still ignores `defaultPrevented` and unwrapped buttons. M-018.
5. **35 lint warnings** await integrator decisions: 24 React-Compiler analysis rules on deliberate imperative globe/timeline code; 7 unused symbols in `src/lib/social` (mechanical, tree was locked during M-002); `postcss.config.mjs` anonymous default export.
6. **Global refresh spend ceiling** across server instances needs durable state — deferred to M-039 and documented in code; the in-process guard is not that.
7. `npm audit`: 3 pre-existing advisories in `next@16.2.12`'s bundled deps; not actioned in Phase 0.
8. **Tooling:** ESLint pinned to 9.x because `eslint-config-next@16`'s transitive `typescript-eslint` does not support 10 yet.
9. Browser evidence is headless software-GL; no real-device, screen-reader, or performance measurement has been taken (Phase 1/4 tickets).

## Next smallest reviewable task

**P0-F1 fix (S):** detect WebGL context creation failure in `Globe.tsx` (three does not throw) and render the existing "unsupported" fallback — one component, one browser test using `--disable-3d-apis`. Then **M-007** (occurrence + evidence schema, additive, compatibility view-model preserving `Beacon`), which unblocks M-008, M-013, M-014 and M-015.

Per the plan, Phase 1 begins only after Phase 0 is accepted.
