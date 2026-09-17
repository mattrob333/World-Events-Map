<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` - verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MERIDIAN engineering rules

MERIDIAN began as a vibe-coded prototype and is now being treated as a real product. Preserve product integrity, privacy boundaries, and provider truth even when a faster shortcut appears easier.

## Task classes

Before coding, classify the task.

### CHEAP_OK

Suitable for lower-cost implementation agents when the goal, files, and acceptance tests are explicit:

- CSS and responsive polish
- copy and documentation updates
- fixtures and test scaffolding
- repetitive form fields and display components
- mechanical renames or isolated refactors
- small components behind already-defined interfaces

Cheap agents do not get authority to reinterpret architecture or privacy rules.

### REVIEW_REQUIRED

Can be implemented by a lower-cost agent only when a stronger reviewer will inspect the integrated diff:

- ranking changes
- caching behavior
- public API routes
- state-management changes
- significant user-flow changes
- new third-party adapters using an established provider contract

### HIGH_CAPABILITY_ONLY

Do not delegate these to unsupervised grunt passes:

- database migrations
- RLS, authentication, authorization, or privacy boundaries
- security controls and abuse/cost protections
- payment, booking, inventory, or quote semantics
- provider contracts and source-of-truth decisions
- architecture or data-model changes
- precise-location handling
- production migrations or destructive changes

## Cheap-agent implementation contract

A bounded implementation task should be handed off in this form:

```text
TASK CLASS: CHEAP_OK
GOAL: <one mechanical outcome>
FILES YOU MAY CHANGE: <explicit list>
DO NOT CHANGE: architecture, migrations, RLS, provider contracts, auth, security boundaries
ACCEPTANCE TESTS:
- <test 1>
- <test 2>
- npm run gate must pass
OUTPUT:
- concise summary
- files changed
- tests added/changed
- any assumption you could not verify
```

## Review contract

Meaningful integrated work requires a high-capability release review after implementation. When Astra is available in the orchestration environment, Astra is the preferred senior release reviewer. Do not claim Astra reviewed a change unless that review actually ran.

The final reviewer should inspect the whole diff, not only snippets, and prioritize:

1. product requirement coverage
2. privacy, RLS, and authorization
3. provider truth and API-contract assumptions
4. data integrity and transactional behavior
5. race, concurrency, and cache behavior
6. abuse and cost exposure on paid APIs
7. mobile UX regressions
8. fake/live-data confusion
9. missing regression tests
10. architecture drift or needless duplication

Codex/GitHub code and security reviews remain a useful independent second opinion for meaningful PRs, especially public APIs, auth, location, external providers, and database work.

## Merge gate

Do not merge material work unless:

- `npm run gate` passes
- relevant PostgreSQL/PGlite migration/RLS tests pass
- blocking review findings are resolved
- provider failure states are honest and tested
- security/privacy changes have had a high-capability review
- any required external Astra review is either completed or explicitly documented as unavailable rather than implied
