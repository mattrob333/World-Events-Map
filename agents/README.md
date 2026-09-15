# MERIDIAN specialist briefs

Seven role briefs plus the integrator role, derived from the approved plan
(*MERIDIAN: Product Plan and Source Audit*, 2026-09-15; audited commit
`6cab1fd7b2346ed23fa4427423c93e1b927ec064`). The lead agent assigns tickets
from `backlog.json`; each specialist works only inside the paths its brief
owns. File ownership for Phase 0–1 is tabulated in
`docs/phase0/CONTRACTS.md` §4 and is the authority if a brief and that table
ever disagree.

| Brief | Role | Owns (summary) |
|---|---|---|
| `ux.md` | UX | Flows, route/state matrix, low-fi layouts, pilot research, `docs/**`, `backlog.json` |
| `ui.md` | UI | Tokens, type scale, component/screen specs, `src/components/ui/**` |
| `frontend.md` | Frontend | App shell, explorer, globe integration, selectors, view stores, trip-room UI, tooling |
| `backend.md` | Backend | Auth, migrations, RLS, trips, invitations, messages, server data facade, demo boundary |
| `data.md` | Data | Event catalog, occurrence/evidence schema, editorial admin, refresh jobs |
| `commercial.md` | Commercial | Provider/sponsor workflows, affiliate attribution, disclosures, SEO metadata |
| `qa.md` | QA | Baseline, regression/authorization/accessibility suites, release-gate evidence |

## The integrator

One integrator (the lead agent unless delegated by name) owns everything that
more than one specialist would otherwise fight over:

- `src/lib/types.ts` — the shared domain contract. Specialists propose
  additive fields in a ticket; the integrator lands them.
- `package.json` and `package-lock.json` — every dependency change. During
  Phase 0 the M-002 owner (Frontend) edits these under the integrator's
  explicit, reviewed delegation; that is the only exception.
- `src/app/globals.css` — the design tokens. The UI agent specifies; the
  integrator applies.
- Route conventions — the `src/app/**` route-group layout described in the
  plan (`(marketing)`, `(explorer)/explore`, `(public)/events/[occurrenceSlug]`,
  `(member)/…`, `(partner)/…`, `(admin)/…`, `api/`). A specialist may add a
  page inside an existing group; new groups and the `/` → `/explore` move
  are integrator changes.
- Merges. Every patch has an independent reviewer; the integrator merges and
  is the only one who resolves conflicts in the files above.

No competing rewrites of those files. No full globe rewrite. No production
deploy, paid vendor activation, outreach, payments or destructive migration
without explicit authorization from the product owner.

## Working rules common to every brief

1. Work only Phase 0 until G0 is accepted; then one vertical slice per gate.
2. Agree contracts and file ownership before working in parallel.
3. Report after each cycle in the format at the end of every brief.
4. Never claim a test that did not run. Blocked is a separate result from
   failed and passed.
5. For any missing credential, use contract fixtures in development and an
   honest disabled/unconfigured state in production. Never a fake success.
