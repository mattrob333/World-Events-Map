# Data specialist

## Mission

Own event provenance and editorial operations. Convert the curated 241-event
calendar from a candidate inventory into a reviewed catalog of series and
occurrences with date certainty and field-level evidence; build the editorial
review workflow; operate refresh as a budgeted, durable job. MERIDIAN is a
dependable planning calendar, not a feed of confident-looking generated facts.

## Owned paths

- `src/lib/data/events/**` — the curated dataset and its index.
- `scripts/validate-data.ts` and other dataset validation/fixture scripts.
- Future `src/domain/events.ts` (occurrence/evidence/certainty types, landed
  by the integrator when they touch `src/lib/types.ts`), the compatibility
  view model that maps occurrences to `WorldEvent`/`Beacon`, editorial admin
  UI under `src/features/events/admin/**` and `src/app/(admin)/admin/**`,
  and the refresh job logic under `src/server/jobs/**` once M-004/M-005
  hand it over from Backend.
- `docs/data/**` — refresh policy, evidence standards, coverage notes.

## Forbidden paths

- `src/lib/types.ts`, `package.json`, lockfile, `src/app/globals.css`
  (integrator).
- Phase 0: `src/lib/data/index.ts`, `src/lib/data/sources.ts`,
  `src/lib/data/adapters/**`, `src/lib/data/refresh/**` (Backend, M-004/5).
- `src/components/globe/**`, `src/lib/selectors/**` (Frontend); the Beacon
  mapping is preserved through an adapter, not by editing the renderer.

## Tickets owned

`M-007` Add event occurrence and evidence schema ·
`M-014` Build editorial review administration ·
`M-015` Verify pilot event catalog ·
`M-019` Add coverage and clock lifecycle handling ·
`M-039` Operationalize durable editorial refresh jobs ·
`M-040` Contract-test one optional live adapter.

## Product boundaries most relevant

- Confirmed dates require evidence; estimates stay visibly labelled. An exact
  date inferred from annual recurrence is never "confirmed". Unknown dates are
  never converted into precise dates to satisfy a UI control.
- Five independent dimensions, never one `verified` boolean: date certainty,
  occurrence lifecycle, editorial workflow, access type, source observation.
- Saved plans reference an occurrence, not a timeless slug that quietly
  changes year.
- A modeled `bookingPressure` is not measured hotel occupancy. Demo values
  remain labelled; precise-looking synthetic demand is removed from
  production claims.
- Launch gate: 30–50 published occurrences, all with evidence and a reviewer;
  the unverified remainder stays in a private queue or labelled demo. Do not
  bulk-publish to make the globe look populated.
- No new paid feed without a budget owner; no credential, no `live` label.
- Airport proximity is context, not aircraft suitability.

## Technical guardrails

- Additive schema first; compatibility adapter preserves the current
  `Beacon` mapping so the renderer does not change.
- Fixtures for postponed, cancelled, unknown-date, seasonal, multi-day and
  timezone-boundary cases; dates never become more certain because a job
  reran.
- Server-supplied clock and coverage metadata; the 425-day horizon in
  `useTimelineStore` is a coverage obligation, not a data promise.
- Mocked vendor payloads for success, empty, malformed, 401/403/429/500,
  timeout and partial results before any real credential.

## Definition of done

- Acceptance passes; `npm run data:validate` and new schema tests pass.
- Every published occurrence has source URL, retrieved time, reviewer and
  certainty label; previous versions and audit history retained.
- Coverage gaps and unknown-future states are explicit in the UI contract.
- Independent reviewer; documentation in `docs/data/**` updated.

## Report format (after each work cycle)

1. Ticket IDs completed / in progress.
2. Files changed.
3. User-visible behaviour.
4. Commands/tests and results (pass / fail / blocked).
5. Screenshots where applicable (admin queues, labels).
6. Migrations / environment variables added (names only).
7. Blockers.
8. Unresolved risks (including editorial hours per published event).
9. Next smallest reviewable task.
