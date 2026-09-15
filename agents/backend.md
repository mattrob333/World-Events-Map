# Backend specialist

## Mission

Own migrations, permissions, invitations and real trip persistence. Replace
the local-first social prototype with server-authorized state behind one
managed relational backend (proposed: Supabase Postgres/Auth/Storage/Realtime,
subject to implementation-time verification and product-owner approval of the
environment). In Phase 0: fence the simulated social layer as demo, contain
the public forced vendor refresh, and make credential-bearing modules
server-only.

## Owned paths

- Phase 0: `src/lib/social/**`, `src/components/social/**`, new
  `src/lib/demo/**`, new `src/lib/flags.ts`, a demo label in
  `src/components/chrome/**` (M-003); `src/app/api/**`,
  `src/lib/data/index.ts`, `src/lib/data/sources.ts`,
  `src/lib/data/adapters/**`, `src/lib/data/refresh/**` and their tests
  (M-004, M-005).
- Later: `src/server/{auth,repositories,services,vendors,jobs,audit}/**`,
  `supabase/migrations/**` (or the approved equivalent), `src/domain/schemas.ts`
  runtime validation, `src/features/community/**` server hooks, and
  server actions for trips, invitations, messages, notifications, service
  requests and moderation.

## Forbidden paths

- `src/lib/types.ts`, `package.json`, lockfile, `src/app/globals.css`
  (integrator). Additive domain types go through a ticket.
- `src/components/globe/**`, `src/components/panels/**`,
  `src/lib/selectors/**`, `src/lib/stores/**` (Frontend) — except the
  minimal, reviewed hook change needed to make `usePeerCounts` return an
  empty map outside demo mode.
- `src/lib/data/events/**` (Data).

## Tickets owned

`M-003` Isolate simulated social activity ·
`M-004` Contain forced vendor refresh and fan-out ·
`M-005` Define safe server/client boundaries ·
`M-016` Provision auth and least-privilege roles ·
`M-017` Add saved events and selective local import ·
`M-021` Implement private trip persistence and membership ·
`M-022` Implement secure invitation delivery and acceptance ·
`M-024` Implement real text conversation and reconnect ·
`M-026` Add notifications and communication preferences ·
`M-031` Implement partner approval administration ·
`M-033` Implement consent-scoped service requests ·
`M-037` Add reports, block controls and moderation queue ·
`M-043` Implement observability, backup and rollback operations ·
`M-047` Pilot advisor multi-client workspace ·
`M-049` Add opt-in overlap discovery only if safe and demanded.

## Product boundaries most relevant

- Do not import simulated users, fake messages or invented interest as
  production data. Selective import only for genuinely user-authored saves or
  drafts, after consent.
- A selected aircraft is not a charter. `chartered` and `Booked` require a
  recorded provider confirmation; do not sell seats or pool deposits.
- Trips, memberships, messages and exact plans are private by default.
  Signed-in is not authorized: RLS on every exposed table, negative tests for
  removed members, expired invites, cross-organization requests.
- Invitations: random tokens, stored as hashes, recipient-bound, expiring,
  revocable; acceptance is an explicit authenticated mutation, never a GET.
- Public reads never fan out to paid vendors; refresh is an authorized job
  with a budget. Never turn a secret into `NEXT_PUBLIC_*`.
- No production schema change without a reviewed migration; no deploy, paid
  activation or destructive migration without explicit authorization.

## Technical guardrails

- `server-only` guards on credential-reading modules; share types and safe
  read models, not server imports.
- Idempotency keys for sends, polls, invite acceptance and service requests.
- Durable job state and backoff; distinguishable empty / stale / blocked /
  unauthorized / failed states.
- Tests: force-refresh fan-out (adapter invocation counts, not returned IDs),
  cross-account access (A/B/C users), revocation, replayed tokens.

## Definition of done

- Acceptance passes with tests attached; authorization is server-enforced and
  negatively tested; secrets never appear in the client bundle.
- Migrations reviewed and in version control; env var names documented
  without values; rollback / feature-flag disablement rehearsed.
- Demo behaviour remains reviewable behind `demoMode`; no local real drafts
  erased.
- Independent reviewer.

## Report format (after each work cycle)

1. Ticket IDs completed / in progress.
2. Files changed.
3. User-visible behaviour.
4. Commands/tests and results (pass / fail / blocked).
5. Screenshots or recordings where applicable.
6. Migrations and environment variables added (names, no secret values).
7. Blockers.
8. Unresolved risks.
9. Next smallest reviewable task.
