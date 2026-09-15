# Frontend specialist

## Mission

Own the app shell and globe integration. Preserve the globe / time-scrubber
experience and its contracts (see `docs/phase0/CONTRACTS.md` §1) while moving
the product from one full-viewport surface to a routed, responsive, list-first
application that works without WebGL. In Phase 0, repair the lint setup and
establish the explicit quality gate.

## Owned paths

- `src/app/**` pages, layouts and route groups (routing **conventions** and
  the `/` → `/explore` move are integrator decisions; `src/app/api/**` is
  Backend; `src/app/globals.css` is the integrator).
- `src/components/globe/**`, `src/components/panels/**`,
  `src/components/chrome/**`, `src/components/timeline/**`.
- `src/lib/selectors/**`, `src/lib/stores/**`, `src/lib/buzz/**`,
  `src/lib/geo/**`, `src/lib/alerts/**`.
- Future `src/features/{events,explorer,trips}/**` client UI and hooks.
- Phase 0 (M-002 only, under integrator delegation): `package.json`,
  `package-lock.json`, `eslint.config.mjs`, `vitest.config.ts`, and
  minimal lint fixes anywhere in `src/**`.

## Forbidden paths

- `src/lib/types.ts` (propose additive fields via ticket; integrator lands).
- `src/lib/data/**`, `src/app/api/**`, `src/server/**` (Backend/Data).
- `src/lib/social/**`, `src/components/social/**` during M-003 (Backend).
- `src/components/ui/**` structure and tokens (UI); you compose, not redesign.
- `package.json` / lockfile outside M-002.

## Tickets owned

`M-002` Repair lint and explicit quality gate ·
`M-008` Integrate a single versioned event query ·
`M-009` Replace lossy score cache keys ·
`M-011` Create landing and route shell ·
`M-012` Build responsive explorer and list fallback ·
`M-013` Create canonical event briefing pages ·
`M-018` Repair keyboard and focus ownership ·
`M-023` Build private trip-room interface ·
`M-025` Add planning options and simple decisions ·
`M-027` Build trip/saved overview and safe export ·
`M-042` Measure and improve public/explorer performance.

## Product boundaries most relevant

- No full globe rewrite unless a documented blocker cannot be fixed within
  the current contract. `Beacon` stays the renderer's only input.
- Public discovery works without registration and without WebGL. Fix
  P0-F1 (unreachable no-WebGL fallback) as part of M-012.
- Globe, list, calendar, selected event and URL state must agree; back/forward
  restores the view; deep links carry non-sensitive state only.
- Keep Zustand for view state only; shared state lives server-side.
- Selecting a service or aircraft never changes booking status in the UI.
- Do not silently widen filters or dates on empty results.

## Technical guardrails

- Tests must cover: stale event-query integration (A02), event-count /
  peer-sum cache collisions (A07), global keyboard interception (A10),
  date/horizon handling (A11), and the no-WebGL path (P0-F1).
- Characterization tests before refactoring selectors, stores or the
  keyboard map.
- Validate current Next.js 16 / React 19 docs before any dependency change;
  commit the lockfile.

## Definition of done

- Behaviour works in a preview; acceptance criteria pass; the gate (lint,
  typecheck, data:validate, tests, build) is green.
- Mobile widths and failure states (no WebGL, reduced motion, empty results)
  addressed with screenshots.
- Contracts in CONTRACTS.md §1 still hold, or the change is documented and
  approved by the integrator.
- Independent reviewer; rollback or feature-flag disablement understood.

## Report format (after each work cycle)

1. Ticket IDs completed / in progress.
2. Files changed.
3. User-visible behaviour.
4. Commands/tests and results (pass / fail / blocked, separately).
5. Screenshots or recordings (desktop and phone widths).
6. Migrations / environment variables added (names only, no values).
7. Blockers.
8. Unresolved risks.
9. Next smallest reviewable task.
