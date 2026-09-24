# The daily scout (background agent)

Status: **specified, not running.** It needs keys and storage the site doesn't have yet (see "Needs").

## What it does, once a day

1. **The Wire.** For each beat in `src/lib/wire/beats.ts` (medical travel, psychedelic retreats, exotic fishing and hunting, adults-only, new sports, hacks, gear, hot right now), search the web for stories from the last 45 days. It then adds searches drawn from the traveler's saved interests (teams, artists, places).
   - Each candidate becomes a `WireStory`: title, source link, publisher, date, a short quoted excerpt, and an optional credited image.
   - Only stories with no `storyProblems()` are kept. The existing screen (Jev: relevance, source quality, freshness) then runs before anything is shown.
2. **Hero pool refresh.** Look for new licensed photos of people having a great time, somewhere named. Use Wikimedia Commons first; Pexels and Unsplash are used only when their keys are set. Candidates go to a review list, not straight into the pool. Each needs a curator check before it enters: is it lively, is it really that place, and does it avoid political or celebrity framing. A photo shown about 30 times since its last refresh is a candidate for retirement. Today the pool is `src/lib/hero/pool.json`, built by `scripts/hero-pool.mjs`.

## How it runs

- **Preferred: Claude Managed Agents, as a scheduled deployment** (daily, 06:00 UTC).
  - Anthropic runs the loop and the schedule.
  - Tools: web search and web fetch for research, and one custom tool, `submit_candidates`, that POSTs to an authenticated ingest route on this site.
  - Secrets live in a Managed Agents vault, never in the prompt.
- **Fallback:** a Vercel cron hitting a route that runs the existing research pipeline (`src/lib/research`: Exa + Jev), with the same story rules.
- **Bring your own agent:** the MCP server at `/api/mcp` (docs on `/agents`) stays the way any assistant sets up a traveler profile. The scout doesn't replace it.

## Guardrails

- Provider truth: link out to the original, quote an excerpt, show the date. Never rewrite a story as our own, and never invent venues, prices or availability.
- Medical and psychedelic stories carry "Reporting, not advice". They never link to booking, dosing or sales pages (enforced by `noLinks`).
- Hunting and fishing link to outfitters only through the source article.
- Cost: one run per day, a fixed search budget per beat, and the same daily caps pattern as `src/lib/designer/server/dailyBudget.ts`.

## Needs (owner)

- `ANTHROPIC_API_KEY` (Managed Agents), plus a Managed Agents vault holding the ingest secret.
- Supabase with the stories/pool tables (a new migration). This is HIGH_CAPABILITY work under AGENTS.md: migration and RLS review before it ships.
- Optional: `EXA_API_KEY`, `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`.
- `TYPESAFE_API_KEY` (already set) for the Jev screen.
