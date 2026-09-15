# Phase 0 — M-005 client-bundle inspection

**Built commit:** `b528161` (M-004/M-005), in a detached `git worktree` from a fresh `npm ci`, so in-flight working-tree edits could not contaminate the result.
**Command:** `npx next build` → `✓ Compiled successfully`; then `grep -rl` over `.next/static/**/*.js` (13 client chunks).
**Recorded:** 2026-09-15.

## Credential variable names in client chunks (must be 0)

| Name | Client files containing it |
|---|---:|
| `PREDICTHQ_TOKEN` | 0 |
| `TICKETMASTER_API_KEY` | 0 |
| `X_BEARER_TOKEN` | 0 |
| `SERPAPI_KEY` | 0 |
| `AMADEUS_CLIENT_ID` | 0 |
| `AMADEUS_CLIENT_SECRET` | 0 |
| `REFRESH_ADMIN_TOKEN` | 0 |

## Server-module fingerprints in client chunks (must be 0)

`collectSignalPatches` 0 · `sweepAllSignals` 0 · `timingSafeEqual` 0 · `api.predicthq` 0 · `app.ticketmaster` 0 · `api.twitter.com|api.x.com` 0 · `serpapi.com` 0 · `amadeus.com` 0.

## Positive control

The control used in the first run (`getEventsByIds`) is only referenced from server modules, so its absence from client chunks was uninformative. The inspection was re-run on the final gate build at `9f36a21` with a known event id as the control: `monaco-grand-prix` is present in 1 client chunk (the grep sees client code), while all seven credential names and all server fingerprints (`collectSignalPatches`, `sweepAllSignals`, `timingSafeEqual`, `serpapi.com`) remain at 0 across 13 chunks.

## What this does and does not show

It shows that at this commit no credential *name* and no server-only module *code* is emitted into client JavaScript. It does not show runtime behaviour, and it is not a substitute for the static boundary test in `src/lib/data/__tests__/server-only-boundary.test.ts`, which is what prevents regression.
