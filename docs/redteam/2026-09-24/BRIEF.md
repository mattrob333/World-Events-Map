# UserFlow Red Team (second pass): tester brief, dope.travel

Branch `claude/review-recent-work-5li9lw`. The first audit ([2026-09-23](../2026-09-23/REPORT.md)) covered the MERIDIAN discovery/ACCESS/Circles/partner flows at `fb99093`, and its fixes were retested ([RETEST](../2026-09-23/RETEST.md)). Since then, 21+ commits added: the voice/text **mood board** and bento profile, **Spotify** import (PKCE and public-playlist paste), the **trip designer** for any typed-in place (drag, swipe, vote, stays links), **share/join links** with votes in the URL fragment and "send my picks back" merging, **NOW** on the trip ("Right now", live music tonight, "For you"), the **MCP server** at `/api/mcp` with docs at `/agents`, **destination research** through Treg (Google Maps, Tripadvisor, Yelp, Instagram, TikTok, events, flights), the **dope.travel rebrand**, the **Afterglow redesign** across every page, and a globe scroll fix.

This is a DISCOVERY PASS. Do not modify application code, config, or data files. Write only under `docs/redteam/2026-09-24/` and your scratchpad folder.

## Environments

- `http://localhost:3127`: production build (`next start`). Configured keys in this environment: `TREG_TOKEN` (paid; Treg research), `TYPESAFE_API_KEY` (Jev). NOT configured: Anthropic designer AI, Spotify client, Ticketmaster/SeatGeek, BestTime, Supabase. This matches what the owner's preview will have once he adds `TREG_TOKEN` to Vercel.
- `http://localhost:3128`: `next dev` with `NEXT_PUBLIC_MERIDIAN_DEMO=1` (simulated members). Use ONLY for member/social checks. First load of a route compiles; allow 60 s.

Do not restart either server.

## Paid-call budget (hard rule)

`POST /api/designer/research` spends real money through Treg (about $0.055 per fresh place, cached 6 h per place per server). Across the whole audit, only persona F may trigger research, for at most **two distinct places** (e.g. Lisbon, which is already cached, and one new place). Everyone else must not press "Refresh" in the research panel or plan trips to new places that would trigger it; seed the cached Lisbon research instead (see below). Persona K may probe the research route's validation and rate limiting only with requests that fail validation or hit the cached Lisbon key; no new places. Never call Treg directly.

## Browser tooling

Playwright is installed at `/tmp/claude-0/-home-user-World-Events-Map/b30d50d5-6c34-5fb7-9e80-bac9e7b58232/scratchpad/node_modules`. Put your scripts in `scratchpad/rt-<persona>/` and import `playwright` from there (run node with cwd = scratchpad). Launch:

```js
chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-certificate-errors'], proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })
```

Use a fresh browser context per identity. Capture console errors, page errors and failed requests. Test desktop 1440×900 and phone 390×844 (`isMobile`, `hasTouch`). After taking a screenshot, LOOK at it with Read before drawing visual conclusions.

Seed data (optional, to reach a populated trip canvas without spending): in `context.addInitScript`, set `localStorage['meridian.designer.v1']` to the contents of `scratchpad/store.json` (a Lisbon trip, Oct 15–20 2026, two travelers, hometown New York), and `localStorage['dope.research.v1:' + JSON.stringify({ name: 'Lisbon', region: 'Portugal', from: 'JFK', to: 'LIS', depart: '2026-10-15', nights: 5 })]` to the contents of `scratchpad/research.json` (a real research result).

## Jev (TypeSafe) judgments

Jev is connected. Helper: `node scratchpad/redteam/jev.mjs <request.json> <LABEL>` where request.json = `{ "state": {...}, "questions": {...} }`. Question types:
- `noul`: `{ "type": "noul", "instructions": "..." }` → probability 0–1.
- `choice`: `{ "type": "choice", "instructions": "...", "criteria": { "key": "description", ... } }`.
- `score`: `{ "type": "score", "instructions": "...", "criteria": ["level 0", "level 1", ...] }` (2–10 ordered levels).

`state` must describe the persona, the job to be done, the workflow state and what is ACTUALLY visible (copy the real visible text, CTAs and disabled controls; Jev can't see screenshots). The helper saves request and response to `artifacts/jev/<LABEL>.json`. Quote the returned numbers exactly with the label. Use Jev for material, non-obvious judgments (orientation, action clarity, honesty of live vs curated, completion), batching questions; about 10 calls per persona. Say where you disagree with Jev. If a call fails, write `JEV NOT EXECUTED`.

## Evidence rules (non-negotiable)

- Screenshots go to `docs/redteam/2026-09-24/artifacts/<PERSONA>-<NN>-<slug>.png`, only ones that prove or explain something.
- Never fabricate screenshots, browser results, console output, Jev output or user behavior.
- Label each finding OBSERVED / INFERRED / UNKNOWN. Never call a flow browser-tested unless you drove it.
- Don't read `.env*` files or print environment variables or secrets.
- Don't send data to third parties beyond what the app itself does. Don't submit forms to third parties, don't connect Spotify, don't click through to Airbnb/Booking checkouts.
- Root-cause each failure into `src/` with `file:line` and recommend the smallest sensible fix. Don't fix it.
- Product honesty is a core requirement (AGENTS.md: provider truth, fake/live-data confusion). Anything that could make a user believe curated, sample or modeled data is live, or that a booking, fare or availability exists when it doesn't, is material.
- Privacy is material: what travels in share links (names, kids' ages, hometown), what's sent to servers, what's stored.

## Output

Write `docs/redteam/2026-09-24/findings-<PERSONA>.md`:
1. Persona definition (context, knowledge, permissions, job to be done, entry point, expected end state).
2. Flow maps as `USER -> ENTRY -> ACTION -> RESPONSE -> ... -> SUCCESS`, each marked `EXECUTED - PASS/FAIL/PARTIAL`, `CODE-REVIEW ONLY` or `UNTESTED`.
3. Test case table: ID | case (happy / first-time / back / refresh / deep link / duplicate / failure / empty / permission / unusual input / change mind / mobile) | expected | observed | result | evidence.
4. Findings: ID `UFR2-<PERSONA><NN>`, severity (BLOCKER / LOGIC FAILURE / DEAD END / STATE FAILURE / PERMISSION FAILURE / SECURITY / PRIVACY / COST EXPOSURE / AMBIGUITY / MISSING STEP / POOR FEEDBACK / RECOVERY FAILURE / EDGE CASE / UX FRICTION / VISUAL REGRESSION / POLISH), evidence label, location, problem, user impact, expected vs actual, Jev question(s) with numbers or `JEV NOT EXECUTED` plus your judgment, root cause `file:line`, recommended change, acceptance test.
5. Tables: dead ends, ambiguities, state-machine problems, permission/privacy problems.
6. For at most 2 of your most material visual/interaction findings: a short text-only repair spec labeled `PROPOSED CONCEPT - NOT CURRENT APPLICATION`.

Prioritize business outcome, logic, state, privacy, cost and honesty failures over cosmetics. Depth on the persona's core job beats breadth. Finish in reasonable time.
