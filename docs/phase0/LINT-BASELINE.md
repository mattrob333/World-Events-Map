# Phase 0 — M-002 Lint Baseline

**Recorded:** 2026-09-15. **Base commit:** `17663a4` (working tree, before the M-002 lint fixes). **Environment:** Node v22.22.2, npm 10.9.7.

## Tooling added

| Package | Version | Role |
|---|---|---|
| `eslint` | 9.39.5 | Linter. Latest 9.x as specified by the ticket. Note: the registry marks the whole 9.x line as no longer supported (10.10.0 is current). `eslint-config-next@16.2.12` declares `eslint: >=9.0.0`, but its transitive `typescript-eslint@8.x` only supports ESLint 8/9, so moving to ESLint 10 is a follow-up decision for the integrator, not a drop-in. |
| `eslint-config-next` | 16.2.12 | Pinned to the installed Next version. Flat-config entries used: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` (both export `Linter.Config[]`, verified in `node_modules/eslint-config-next/dist/*.js`). |
| `vitest` | 5.0.1 | Current major. Engine range `^22.12.0` fits Node 22.22.2. Pulls `vite@8.3.0` as a peer. |

Config: `eslint.config.mjs` (flat), `vitest.config.ts` (`@/` → `src/`, Node environment). Scripts: `lint` = `eslint .`, `test` = `vitest run`, `gate` = lint → typecheck → data:validate → test → build.

Ignored by ESLint: `.next/`, `node_modules/`, `out/`, `build/`, `public/` (includes the `public/geo/*.geo.json` artefacts written by `scripts/build-geo.mjs`), `docs/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`.

## Baseline — before any fix

`npx eslint .` on the untouched tree, default `eslint-config-next` severities: **39 problems (24 errors, 15 warnings)** across 21 files.

| Severity | Rule | Count |
|---|---|---|
| error | `react-hooks/immutability` | 8 |
| error | `react-hooks/refs` | 8 |
| error | `react-hooks/set-state-in-effect` | 7 |
| error | `react-hooks/preserve-manual-memoization` | 1 |
| warning | `@typescript-eslint/no-unused-vars` | 11 |
| warning | `react-hooks/exhaustive-deps` | 3 |
| warning | `import/no-anonymous-default-export` | 1 |

Every error came from the four React Compiler analysis rules that `eslint-plugin-react-hooks@7` ships as errors in its `recommended` set. The React Compiler is **not** enabled in this project (`next.config.ts` has no `reactCompiler`; the only lockfile mention is Next's optional peer entry).

## After — current state

`npm run lint`: **0 errors, 35 warnings**, exit 0.

| Severity | Rule | Count | Change |
|---|---|---|---|
| warning | `react-hooks/immutability` | 8 | error → warning (project decision, below) |
| warning | `react-hooks/refs` | 8 | error → warning (project decision, below) |
| warning | `react-hooks/set-state-in-effect` | 7 | error → warning (project decision, below) |
| warning | `react-hooks/preserve-manual-memoization` | 1 | error → warning (project decision, below) |
| warning | `@typescript-eslint/no-unused-vars` | 7 | 11 → 7: four fixed in place; the remaining seven are in `src/lib/social/**`, which M-002 may not touch |
| warning | `react-hooks/exhaustive-deps` | 3 | unchanged (deliberate memoised-selector pattern) |
| warning | `import/no-anonymous-default-export` | 1 | unchanged (`postcss.config.mjs` is outside the M-002 edit list) |

### Mechanical fixes applied (`src/**`)

| File | Change |
|---|---|
| `src/lib/data/events/golf.ts:14` | Removed unused `KHOU` import. |
| `src/components/ui/tokens.ts:157` | Removed unused `const UTC` (dead since dates moved to hand-formatting; see the comment directly below it). |
| `src/lib/geo/geojson.ts:38` | Removed unused `angularDistanceRad` import. |
| `src/components/ui/ScrollArea.tsx:3,61` | Dropped the unused `_e` parameter from the `onScroll` callback and the now-unused `UIEvent` type import. Same handler, same deps. |

No `eslint-disable` comments were added anywhere. No rule was turned off.

## Project-level decisions — reported as warnings, not silenced

### 1. The four React Compiler rules are downgraded to `warn` in `eslint.config.mjs`

Reason: the compiler is not enabled, and each flagged site is an intentional imperative pattern in globe/timeline code that is part of the preserved contract (`BASELINE.md` § Contracts). Converting any of them is a behaviour-affecting restructure (moving Three.js objects into refs, replacing mount effects with `useSyncExternalStore`, moving latest-ref writes into layout effects), not a mechanical edit. The integrator should decide per site whether to (a) restructure, (b) keep the pattern and keep the warning, or (c) adopt the compiler and treat these as blockers. Every site:

**`react-hooks/immutability` (8)** — mutating a `useMemo`/`useThree` value inside `useFrame` or an effect.

| Site | What it is |
|---|---|
| `src/components/globe/BeaconField.tsx:400` | `useFrame` callback mutates `materials` (memoised `ShaderMaterial`s). |
| `src/components/globe/BeaconField.tsx:407` | `materials.ring.uniforms.uTime.value = t` — per-frame uniform update, the standard R3F idiom. |
| `src/components/globe/CameraRig.tsx:228` | Flight-request effect mutates the memoised orbit `state` object. |
| `src/components/globe/CameraRig.tsx:245` | `state.flight = null` in the reduced-motion instant-cut branch. |
| `src/components/globe/CameraRig.tsx:274` | `useFrame` callback mutates orbit `state` every frame (damping). |
| `src/components/globe/CameraRig.tsx:310` | `state.target.phi = clamp(...)` during a flight. |
| `src/components/globe/CameraRig.tsx:313` | `state.flight = null` when a flight completes. |
| `src/components/globe/CameraRig.tsx:342` | `gl.domElement.style.touchAction = 'none'` in an effect — DOM mutation is what effects are for; flagged only because `gl` comes from `useThree()`. |

**`react-hooks/refs` (8)** — reading or writing `ref.current` during render.

| Site | What it is |
|---|---|
| `src/components/globe/CameraRig.tsx:269` | `scrubbingRef.current = scrubbing` — "latest value" ref written during render so `useFrame` reads it without re-subscribing. Correct fix is a layout effect; one-commit timing change in the frame loop, needs the globe owner's sign-off. |
| `src/components/globe/CameraRig.tsx:272` | Same pattern for `autoRotateRef`. |
| `src/components/timeline/DensityRibbon.tsx:82` | `cache.current` read inside `useMemo` — a deliberate signature-keyed memo so the canvas repaints only when the numbers change (see comment at line 55). |
| `src/components/timeline/DensityRibbon.tsx:83` (×2) | Same: compares `prev.signature` and returns the cached model. |
| `src/components/timeline/DensityRibbon.tsx:84` | Same: `cache.current = next`. |
| `src/components/timeline/DensityRibbon.tsx:147` (×2) | The `[model, …]` dependency array — flagged because `model` may alias `cache.current`. Consequence of the site above, not a separate issue. |

**`react-hooks/set-state-in-effect` (7)** — synchronous `setState` inside an effect body.

| Site | What it is |
|---|---|
| `src/components/globe/BeaconField.tsx:282` | Grows instanced-mesh `capacity` when the beacon count exceeds it. Could become derive-during-render; touches GPU buffer sizing. |
| `src/components/globe/useGeoLayer.ts:75` | `setData(null)` / `setData(immediate)` when `url` changes — cache-hit fast path. Alternative is `useSyncExternalStore` over the module cache. |
| `src/components/globe/useReducedMotion.ts:21` | `setReduced(mq.matches)` after mount — SSR-safe `matchMedia` subscription. The idiomatic replacement is `useSyncExternalStore`, which changes the first-paint value. |
| `src/components/panels/EventRail.tsx:71` | `setScrollTop(0)` when the ranked set changes — the documented "reset to top on filter change" behaviour. |
| `src/components/panels/HoverReadout.tsx:67` | `setShownId(hoveredEventId)` — latches the id so the exit animation has content. |
| `src/components/social/ShareTrip.tsx:44` | `setLink` / `setCanShare` after mount — reads `navigator`/`origin`, which the server does not have (see comment at line 40). |
| `src/components/ui/Tooltip.tsx:49` | `setMounted(true)` after mount — SSR-safe portal gate. |

**`react-hooks/preserve-manual-memoization` (1)**

| Site | What it is |
|---|---|
| `src/components/social/GroupChat.tsx:219` | The compiler's inferred deps for `send` (`setDraft`) disagree with the manual list `[draft, groupId, sendMessage, toBottom]`. The manual list is what `exhaustive-deps` requires and is correct; this is a compiler bail-out notice, meaningless while the compiler is off. |

### 2. `react-hooks/exhaustive-deps` (3) — left at the default `warn`

| Site | Justification |
|---|---|
| `src/components/social/hooks.ts:27` | `useMemo` lists `drip` and `meId` as extra deps: `drip` is the social store's change tick that forces recomputation of an otherwise-referentially-stable selector. Deliberate. |
| `src/components/social/hooks.ts:34` | Same `drip` pattern. |
| `src/components/social/MemberProfileSheet.tsx:635` | Same `drip` pattern. |

Decision for the integrator: either document `drip` as the sanctioned invalidation key (and accept the warning, or fold the tick into the selector input so it is a "used" dependency), or replace the pattern.

### 3. `@typescript-eslint/no-unused-vars` (7) — in `src/lib/social/**`, out of M-002 scope

All mechanical; not fixed only because that tree is owned by another ticket.

| Site | Finding |
|---|---|
| `src/lib/social/chat.ts:331` | `t` defined but never used. |
| `src/lib/social/portrait.ts:596` | `scalePoints` defined but never used. |
| `src/lib/social/simulation.ts:32` | `EventCategory` imported but never used. |
| `src/lib/social/simulation.ts:277` | `c` defined but never used. |
| `src/lib/social/simulation.ts:278` | `c` defined but never used. |
| `src/lib/social/useSocialStore.ts:28` | `EventCategory` imported but never used. |
| `src/lib/social/useSocialStore.ts:271` | `_dropped` assigned but never used. If the team wants the `_`-prefix convention honoured, set `argsIgnorePattern`/`varsIgnorePattern: '^_'` on the rule — not done here so the decision is explicit. |

### 4. `import/no-anonymous-default-export` (1)

| Site | Justification |
|---|---|
| `postcss.config.mjs:1` | Anonymous `export default { plugins: … }`. Trivial to name, but the file is outside the M-002 edit list. |

## Other observations (not lint)

- `npm audit` reports 3 pre-existing advisories, all in `next@16.2.12` and its bundled `postcss`/`sharp` (fix requires `next@16.3.5`). Unrelated to this ticket; recorded for the integrator.
- Vitest prints a future-major warning that `vitest.config.ts` is ESM loaded as CJS (the package has no `"type": "module"`). Harmless on Vite 8; renaming to `vitest.config.mts` or adding `"type": "module"` would silence it. Not done because the ticket names `vitest.config.ts` and `"type": "module"` affects every script in the repo.
