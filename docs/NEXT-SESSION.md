# Paste this into the next session

Continue the dope.travel work on branch `claude/review-recent-work-5li9lw`: check it out and pull first. Work and push only on that branch, and don't open a PR unless I ask.

Before doing anything, read these:
- `AGENTS.md`
- `docs/HANDOFF.md`, especially "Where we are (end of 2026-09-24 session)"
- `docs/AGENTIC-PLAN.md`

## State when the last session ended (commit fa397ff)
- **Built and pushed:**
  - The Sun voice concierge. It is off unless `VOICE_ENABLED=1`, the server hangs up calls at a time cap, and "Type instead like a caveman" is the text fallback.
  - Travel profiles with a header switcher.
  - Pick up where you left off.
  - A 35-photo hero pool.
  - The Wire beats scaffold.
  - Senior-review fixes and red-team retest fixes.
  - Mobile and tablet launch fixes.
  - The gate passes (621 tests).
- **Plan waiting for my approval:** https://claude.ai/artifact/Kz7L6DgjJ7wPpPSZgLNCrN. The repo copy is `docs/plans/2026-09-24-lets-vibe.html`, with agent notes in `docs/plans/2026-09-24-lets-vibe-agent-notes.md`.
  - The Stage: a full-page voice screen.
  - "Your Vibe" replaces the mood board.
  - A streaming trip canvas, with Jev as ranker.
  - A personalized homepage.
  - The source library.
  - 4 phases.
  - **Don't build it until I approve.**
- **Source library:** 141 verified feeds in `docs/research/source-library-2026-09-24.json`.
- **Red team report:** https://claude.ai/artifact/AzVqdkvN91gyKLujAxF7gb (repo: `docs/redteam/2026-09-24/`).

## First job in this session: Supabase and Vercel setup
1. I reconnected the Supabase connector to the org that holds project **dope.travel** (ref `lkexkbygtdsunicqkrgd`, Canada Central).
   - Confirm you can see that project with `list_projects`. If you can't, tell me and stop.
   - Apply `supabase/migrations/001`–`005` in order with me watching. This is HIGH_CAPABILITY work, so show me what you're about to run.
   - Then run `get_advisors` (security and performance) and fix or report what it finds.
2. I also reconnected Vercel.
   - If you can now read the env vars of project `world-events-map-onq7` (team `team_H2sn6BV8yWofPAJx0EympDGi`), set the Supabase variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key)
     - `SUPABASE_SERVICE_ROLE_KEY` (the secret key)
     - `CRON_SECRET`
     - `TYPESAFE_MODEL=jev-latest`
   - Put them on **Preview only** unless I say otherwise.
   - Never print secrets in chat. Tell me which variables you still need me to add by hand.
3. Redeploy the preview. Then run one authorized request to `/api/cron/research` and show me the publish/review/reject counts.

## Decisions I still owe you (ask me if you need them)
- Launch now with voice and live research off in Production, or wait for the durable budget (phase 4).
- Whether you may query Treg's free catalog for Hotels, Events and Ticketmaster coverage.
- The "streaming UI with Jev" video I meant.

## Standing rules
- Never print secrets or read `.env` files.
- No paid API calls beyond what I asked for.
- Never use the word "dope" in a sentence of copy.
- Never invent venues or prices.
- `npm run gate` must pass before every push.
- Commit trailers:
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: <this session's URL>`
- No model names in repo files.
- Don't claim Astra reviewed anything unless it did.
