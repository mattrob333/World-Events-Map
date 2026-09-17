<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MERIDIAN engineering rules

MERIDIAN is no longer a throwaway prototype. Preserve product truth, privacy and replaceable architecture before optimizing for demo speed.

## Read before material changes

For product or architecture work, read these first:

1. `README.md`
2. `docs/PRODUCT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DEVLOG.md`
5. the relevant page under `docs/wiki/`

For NOW changes also read `docs/NOW-ENGINE.md`.

## Non-negotiable product boundaries

- Never invent members, bookings, provider availability, live busyness, prices or external feed freshness in real mode.
- Keep modeled/forecast values labeled as modeled/forecast values. Do not relabel expected foot traffic as live traffic.
- Precise current location is request context, not a People Graph attribute. Do not persist it to profiles or Travel Modes without an explicit new privacy design.
- External services such as BestTime, TypeSafe/Jev, Avinode and future vendors must sit behind MERIDIAN provider interfaces. Do not leak vendor-specific shapes through the app domain model.
- Partner approval is not inventory confirmation. An opportunity is not a reservation.
- Charter math is an estimate until a real provider confirms it.

## Data and security

- All new account-backed data requires explicit ownership/visibility rules and PostgreSQL RLS tests.
- Database changes go through numbered Supabase migrations. Do not edit production state by assuming a migration has already run.
- Prefer transactional database functions when a user action spans multiple dependent writes.
- Never place private provider credentials in `NEXT_PUBLIC_` variables, client components, fixtures, screenshots or docs.
- Paid provider routes need validation, bounded input, timeouts, cost controls and failure behavior before merge.
- A provider failure must not silently become fabricated data.

## Code quality

Before declaring a feature ready:

```sh
npm run gate
```

The gate must pass lint, TypeScript, data validation, tests and production build. New persistence or ranking behavior needs tests at the layer where the invariant actually lives.

Prefer deterministic, inspectable ranking before adding model judgment. When model judgment is used, preserve the deterministic constraints and expose enough reasons to debug the outcome.

## Product UX

- Constellation is an exploration surface. Normal cards/forms remain the execution surface.
- NOW is a decision engine, not a directory. Return a small set of differentiated choices.
- Mobile behavior is first-class for NOW and travel-day workflows.
- Empty states must tell the truth. Do not seed fake social liquidity in production.

## Working practice

- Use feature branches and PRs for material work. Keep `main` releasable.
- Update `docs/DEVLOG.md` when a meaningful architecture or product decision changes.
- Update the README/wiki when adding a route, migration, provider or required environment variable.
- Resolve review findings before merge. If a finding exposes a missing invariant, fix it at the persistence/domain boundary rather than only hiding the symptom in UI code.
