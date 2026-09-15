# Phase 0 — M-001 Baseline

**Commit:** `17663a454dc3e2e7c9e82b0f5203129cb4186921` (branch `claude/world-events-travel-globe-ykgfs7`, two commits past the audited `6cab1fd`: the scrubber-collapse/layout fix and the pronoun removal).
**Recorded:** 2026-09-15T15:24Z. **Environment:** Linux container, Node v22.22.2, npm 10.9.7, fresh `npm ci` from the committed lockfile.
**Evidence limits:** browser captures are headless Chromium 1194 with SwiftShader software GL, not real devices or GPUs. No real-device, screen-reader, or performance measurement was taken. Nothing below claims a test that was not run.

## Commands (fresh checkout, declared Node)

Full transcript: `baseline-commands.log`.

| Command | Result | Notes |
|---|---|---|
| `npm ci` | pass | Lockfile installs cleanly. |
| `npm run typecheck` | pass | 0 errors. |
| `npm run data:validate` | pass | 241 events; 12 pre-existing warnings (remote jet ports for Antarctica/Ruaha/Mana Pools/Baja/Palmwag; five multi-month season entries). All benign, previously reviewed. |
| `npm run build` | pass | Next 16.2.12 / Turbopack. Routes: `/`, `/_not-found`, `/icon.svg`, `/api/events`, `/api/signals`, `/api/sources`. |
| `npm run lint` | **fail** | `next lint` was removed in Next 16; the command now parses `lint` as a directory and exits 1 with `Invalid project directory provided, no such directory: .../lint`. Confirms A06. No ESLint is installed and no lint config exists. |
| unit / browser tests | **blocked** | No test runner is configured (`test` script absent, no vitest/jest/playwright config). Confirms A12. |

## Browser captures

| Capture | File | Console | Observations |
|---|---|---|---|
| Desktop 1440×900 | `baseline-desktop-1440.png` | 0 errors, 1 warning (`THREE.Clock` deprecation) | Globe renders; scrubber, rail, filters, dossier, hover readout all function. This is the behaviour to preserve. |
| Phone 390×844 (mobile emulation) | `baseline-mobile-390.png` | 0 errors, 1 warning | **Desktop shell shrunk, not a phone layout** (confirms A09). Top-bar date runs off the right edge; the focus date header overprints the `TODAY` / `WINDOW` controls; the filter chip row overflows; the rail floats over the legend; no list-first mode or bottom navigation. `document.scrollWidth` equals viewport width, so the overflow is element-level clipping rather than page scroll — it hides rather than scrolls. |
| Desktop, WebGL disabled | `baseline-no-webgl-1440.png` | 4 errors (`WebGLRenderer: A WebGL context could not be created`) | **The designed "unsupported" fallback is unreachable.** three r185 logs the failure rather than throwing at construction, so `GlobeErrorBoundary` never catches, `ready` never flips, and the "Charting — Assembling the world" loading overlay persists indefinitely. The rail, filters and scrubber remain usable underneath, so discovery is *possible* without WebGL today — but nothing tells the visitor the globe has failed, and there is no list-first affordance. New finding, not in the audit: **P0-F1**. |

## Findings verified against source (beyond re-reading the audit)

- **A01 confirmed, and the route's own comment is wrong.** `src/app/api/signals/route.ts` says `MAX_IDS` means it "refuses to be a fan-out amplifier." The call path is `refreshSignals(known, { force })` → `getSignalPatches(options)` → `collectSignalPatches(EVENTS)` over all 241 events, with ID filtering applied *afterwards*. The cap bounds the response, not the vendor workload. `?force=1` is public and unauthenticated. With no vendor keys set this is harmless today; it is a cost and availability hazard the moment a key exists.
- **A06 confirmed** (above).
- **A03 / A04 confirmed by construction:** the social store persists user deltas to `localStorage`, regenerates 80 members / 2,557 interest signals / 128 threads from a seeded simulation, and moves a group to `chartered` when an aircraft is *selected*. All of this is prototype behaviour that must be fenced as demo before any real account exists.
- **A10 confirmed:** the root key handler in `src/app/page.tsx` preventDefaults Space and arrows unless the target is an input/textarea/select/contentEditable; buttons are not excluded and `defaultPrevented` is not respected. (UI primitives partially mitigate this with a local key guard.)
- **A11 confirmed:** `useTimelineStore` computes `today` and a 425-day horizon at module evaluation.

## Contracts to preserve (the globe/scrubber experience)

Recorded here; detailed in `CONTRACTS.md` (M-006).

- `Beacon` shape in `src/lib/types.ts` is the renderer's only input; the renderer holds no event data.
- `useTimelineStore` (`focus`, `spanDays`, `rangeStart/End`, `setFocus`, `nudge`, `scrubbing`, `playing`) and its rAF playback.
- `useGlobeStore` (`select`, `hover`, `flyTo`, `consumeFlight`, `autoRotate`, `ready`).
- Selector exports in `src/lib/selectors/index.ts` (`useBeacons`, `useScoredEvents`, `useEventById`, `useHeatByDay`, …) and the rule that buzz is evaluated at the scrubber's focus date.
- Rail ⇄ globe ⇄ dossier selection and hover synchronization; keyboard map (Space play, ←/→ day, Shift+←/→ week, T collapse scrubber, Esc close).
- Design tokens in `globals.css` (void, ink, brass, heat ramp) and the measured `--chrome-h` layout offset.

## Tooling gaps entering Phase 0

No linter, no unit test runner, no browser test runner, no CI. `npm run gate` currently equals typecheck + data validation + build.
