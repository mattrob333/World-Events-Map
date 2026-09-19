# MERIDIAN Overnight Sprint Board

Integration branch: `cursor/meridian-ux-platform-17b4`  
Base: `main`  
Reviewer: orchestrator + high-capability subagent  
Gate: `npm run gate` must stay green

PR #8 is **not** in this branch. Profile work is frontend-only.

## Shared contracts (locked)

| Area | Path | Notes |
|---|---|---|
| DestinationPulse | `src/lib/pulse/` | Derived from curated events + modeled buzz. Never fabricated live metrics. |
| Inspiration | `src/lib/inspiration/` | Fixture board types + sample items |
| Intent verbs | `src/lib/intent/` | SAVE / WATCH / I'D GO / START CIRCLE / SHARE |
| Analytics | `src/lib/analytics/` | Typed events, console/no-op adapter |
| ACCESS cards | `src/lib/access/` | Inquiry-first opportunity fixtures |
| Travelers | `src/lib/travelers/` | Editorial portraits, generated avatars |
| Search index | `src/lib/search/` | Fixture + local catalog groups |
| App shell | `src/components/shell/` | WORLD CIRCLES PEOPLE TRIPS ACCESS + command |

Agents must import these. Do not invent parallel types.

## Tasks

| Task | Owner | Files | Status | Dependencies | Reviewer |
|---|---|---|---|---|---|
| UX audit + sprint board | Orchestrator | `docs/UX-AUDIT.md`, `docs/SPRINT-BOARD.md` | done | — | — |
| Contracts + fixtures + tests | Orchestrator | `src/lib/pulse/**`, `src/lib/inspiration/**`, `src/lib/intent/**`, `src/lib/analytics/**`, `src/lib/access/**`, `src/lib/travelers/**`, `src/lib/search/**`, `src/lib/onboarding/**` | done | audit | high-capability |
| App shell + command palette | Orchestrator | `src/components/shell/**`, `src/app/layout.tsx`, `src/components/community/PlatformShell.tsx` | done | tokens | high-capability |
| World Pulse destination handoff | Orchestrator | `src/components/discovery/DiscoveryExperience.tsx`, `src/components/panels/EventDossier.tsx` | done | pulse, shell | orchestrator |
| Destination page | Orchestrator | `src/app/destinations/**`, `src/components/destination/**` | done | pulse, intent, access, inspiration | orchestrator |
| Circle Trip Room | Orchestrator | `src/app/circles/**`, `src/components/trip-room/**` | done | inspiration, access, intent | orchestrator |
| People / profile frontend | Orchestrator | `src/app/people/**`, `src/components/people/**` | done | travelers, shell | high-capability (privacy) |
| ACCESS traveler feed | Orchestrator | `src/app/access/**`, `src/components/access/**` | done | access fixtures | orchestrator |
| Partner studio polish | Orchestrator | `src/app/partners/page.tsx`, `src/app/partners/studio.module.css` | done | tokens | orchestrator |
| Onboarding | Orchestrator | `src/app/welcome/**`, `src/components/onboarding/**` | done | onboarding types | orchestrator |
| Trips / saved | Orchestrator | `src/app/trips/**` | done | intent store | orchestrator |
| Responsive / a11y pass | QA | visual + keyboard | pending | all surfaces | orchestrator |
| Integration review | Senior reviewer | whole diff | pending | gate green | high-capability |
| `npm run gate` | Orchestrator | — | pending | all | — |

## Parallelization rules

- One integration branch. Small commits on isolated file sets.
- Do not edit another owner's large files.
- Do not add migrations, RLS, auth, or paid adapters.
- Fixture / editorial data must be labeled in the UI.
- Partner copy stays inquiry-first: never “booked”, “confirmed inventory”, or fake scarcity.

## Action vocabulary (locked)

Use these verbs everywhere. Do not invent synonyms in UI copy.

- **Save** — remember this
- **Watch** — tell me when this place/event meaningfully changes
- **I'd go** — stronger intent, later matching
- **Start a Circle** — create trip context
- **Share** — copy a link
- **Request details** — ACCESS inquiry (not a booking)

## Navigation (locked)

Primary: WORLD · CIRCLES · PEOPLE · TRIPS · ACCESS  
Utility: Search · NOW · Profile  
Mobile primary: WORLD · CIRCLES · PEOPLE · ACCESS · more (NOW / Trips / Profile)
