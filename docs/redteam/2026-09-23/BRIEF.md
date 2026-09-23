# UserFlow Red Team — tester brief (MERIDIAN, main @ fb99093)

The skill being executed: `/tmp/claude-0/-home-user-World-Events-Map/f9cc584c-8a78-5c7e-92d1-619d6ca897e8/scratchpad/redteam/userflow-red-team-skill/SKILL.md` (read it first, plus `templates/JEV-QUESTION-BANK.md`). This is the DISCOVERY PASS: do not modify any application code, config, or data files in the repo.

## Environments (already running, do not restart them)
- `http://localhost:3127` — production build (`next start`), NO provider env configured: Supabase, NOW venue provider, research pipeline, Treg/Exa/Jev, X posts are all unconfigured. This mirrors the protected Vercel preview's documented state. Real (non-demo) mode.
- `http://localhost:3128` — `next dev` with `NEXT_PUBLIC_MERIDIAN_DEMO=1` (simulated members and activity, clearly labelled demo). Use ONLY for member/social personas. First load of each route compiles, so allow up to 60s.

## Browser tooling
Playwright 1.56 is installed globally. In an `.mjs` script:
```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
```
Keep scripts in your own subfolder of the scratchpad: `/tmp/claude-0/-home-user-World-Events-Map/f9cc584c-8a78-5c7e-92d1-619d6ca897e8/scratchpad/rt-<persona>/`. Use a fresh browser context per persona/identity. Capture console errors, page errors, and failed network requests. Use `geolocation` + `permissions` context options to simulate granted/denied location. Test desktop 1440x900 and phone 390x844 (isMobile, hasTouch) where relevant. After taking a screenshot, LOOK at it with the Read tool before drawing visual conclusions.

## Evidence rules (non-negotiable)
- Save screenshots to `/home/user/World-Events-Map/docs/redteam/2026-09-23/artifacts/` named `<PERSONA>-<NN>-<slug>.png` (e.g. `A-03-shortlist-click.png`). Only screenshots that prove or explain something.
- Never fabricate screenshots, browser results, console output, Jev output, or user behaviour.
- **Jev by TypeSafe IS available** (update 2026-09-23, verified: HTTP 200, model jev-1.13.0). Use the helper `node /tmp/claude-0/-home-user-World-Events-Map/f9cc584c-8a78-5c7e-92d1-619d6ca897e8/scratchpad/jev.mjs <request.json> <label>`. `request.json` = `{ "state": {...}, "questions": {...} }`; question types are `noul` (yes/no → probability), `choice` (criteria map of options), `score` (ordered criteria array, 2–10 levels). See https://docs.typesafe.ai/api.md. `state` must describe the persona, JTBD, workflow state, and what is ACTUALLY visible (copy the real visible text / CTAs / disabled controls you extracted from the page — Jev cannot see screenshots). Label files `<FINDING-ID>` (e.g. `UFR-A03`). The helper saves request+response to `artifacts/jev/`. Quote the actual returned numbers in your findings with the label; never invent or round-trip them. Use Jev for material, non-obvious judgments only (orientation, action clarity, ambiguity, completion, honesty of live-vs-curated), batching several questions per call; keep to roughly 15 calls per persona. Compare Jev against your own observation and say where you disagree. Never print the API key or env vars. If a call fails, write `JEV NOT EXECUTED` for that judgment.
- treg is NOT available (no key in the environment): mark external checks `EXTERNAL VALIDATION NOT EXECUTED`.
- Label each finding OBSERVED / INFERRED / UNKNOWN. Never describe a flow as browser-tested unless you drove it in the browser.
- Do not read `.env*` files or print environment variables/secrets.
- Do not send data to external services beyond what the app itself does when you use it (the app may load Wikimedia/OSM images; that is fine). Do not click links that would submit forms to third parties.
- Root-cause: when you observe a failure, trace it into `src/` and cite `file:line`. Recommend the smallest sensible fix. Do not fix it.
- Product honesty is a core MERIDIAN requirement (AGENTS.md: "provider truth", "fake/live-data confusion"). Treat any UI that could make a user believe curated/fixture/illustrative data is live, or that a booking/quote/availability exists when it does not, as a material finding.

## Output
Write `/home/user/World-Events-Map/docs/redteam/2026-09-23/findings-<PERSONA>.md` containing:
1. Persona definition (context, knowledge, permissions, JTBD, entry point, expected end state).
2. Flow map(s) you tested in `USER -> ENTRY -> ACTION -> RESPONSE -> ... -> SUCCESS` form, each marked `EXECUTED - PASS/FAIL/PARTIAL`, `CODE-REVIEW ONLY`, or `UNTESTED`.
3. Test case table: Test ID | case (happy/first-time/back/refresh/deep link/duplicate/failure/empty/permission/unusual input/change mind/mobile) | expected | observed | result | evidence.
4. Findings, each: ID (`UFR-<PERSONA><NN>`), severity (BLOCKER / LOGIC FAILURE / DEAD END / STATE FAILURE / PERMISSION FAILURE / AMBIGUITY / MISSING STEP / REDUNDANT STEP / POOR FEEDBACK / RECOVERY FAILURE / EDGE CASE / UX FRICTION / POLISH), evidence label, location, problem, user impact, expected vs actual, Jev question(s) + `JEV NOT EXECUTED` + analyst judgment, root cause with file:line, recommended change, acceptance test.
5. Dead ends, ambiguities, state-machine problems, permission problems (tables).
6. For at most 2 of your most material visual/interaction findings: a short visual repair spec (what must remain, primary action, corrected state) — text wireframe only, labelled `PROPOSED CONCEPT - NOT CURRENT APPLICATION`.

Prioritise business-outcome, logic, state and honesty failures over cosmetic ones. Be thorough but finish within a reasonable time; depth on the persona's core job beats breadth.
