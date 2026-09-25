# UserFlow Red Team (third pass): tester brief, dope.travel

Build under test: `main` @ `b14f948`, production build (`next start`) at **http://localhost:3127**. Do not restart or rebuild the server.

Since the second pass ([2026-09-24](../2026-09-24/REPORT.md)), `main` became the live build and added:
- **Home:** a server-rendered hero with a lead photo that crossfades through a photo pool; a **Coming up** calendar under the toolbar (eight weeks, event bars, plan-by diamonds, collapsible, collapsed by default on phones); **why-now** lines on the hero card and the "Worth catching now" shortlist; a single **location picker** pill; the globe mounts only near view and pauses off-screen; header links prefetch on hover.
- **The Vibe stage:** the header sun ("Set your vibe", or "Vibe" once a profile exists) and a floating **Set your vibe** prompt open a full-screen stage. It has About me / A trip tabs, a talk-about checklist, and a big sun to tap. Browser speech-to-text streams the words, the checklist ticks, and "I'm done" gives an editable recap. Then "Build my vibe" builds a board on `/moodboard`, or "Build the trip" routes through `/api/designer/route-trip`: recommend destinations, open the planner for a named place, or ask a follow-up.
- **Trip canvas:** under the research tabs, **Pick your winners**. "Rank for my crew" calls `/api/designer/basket` and shows a swipe deck (drag, Keep/Pass, ← →). Keeps are saved per trip on the device. "Fit N into my days" runs the scheduler, with a pace choice (Easy/Balanced/Packed) and time blocks with reasons. Meals get a "Reserve on OpenTable" hand-off. Restaurant cards in the Eat and Yelp tabs have "Reserve on OpenTable".
- **Stays links:** Airbnb, Vrbo and Booking.com are affiliate-ready. No affiliate IDs are set here.
- **Server:** daily feed intake (`/api/cron/feeds`, CRON_SECRET), Jev contracts, with receipts in the database.

## Environment facts

- **No paid or AI keys are configured**: no Treg, no Jev (TypeSafe), no OpenAI voice, no Anthropic, no Supabase service key. Everything must degrade honestly: the router falls back to word rules, the basket to rating order, voice to browser speech-to-text. Verify that it says so.
- **Research costs money in production.** You MUST call `noPaidResearch(context)` from the launcher on every browser context. It serves a Lisbon fixture (`research-lisbon.json`) for `POST /api/designer/research`. Never let a real research request through.
- **Voice:** headless Chrome has no microphone. Inject `fake-speech.js` with `context.addInitScript({ path })`. It fakes browser speech recognition: set `window.__SPEECH_TEXT` to choose the sentence, `window.__SPEECH_DENY = true` to simulate a denied mic, or `window.__NO_SPEECH = true` to simulate an unsupported browser. These flags must be set in an init script that runs before `fake-speech.js`.

## Tooling

Scratch folder: `/tmp/claude-0/-home-user-World-Events-Map/c5c0a683-9122-5ba1-80a7-099257167990/scratchpad/rt3/` (fixtures, `launch.mjs`, `fake-speech.js`). Put your scripts in `rt3/<PERSONA>/` and import `{ launch, noPaidResearch, PHONE, DESKTOP, BASE, R }` from `../launch.mjs`. Playwright is imported inside `launch.mjs`. Use a fresh context per identity. Capture console errors, page errors, failed requests and HTTP 4xx/5xx. Test desktop 1440×900 and phone 390×844 unless your persona says otherwise. After taking a screenshot, look at it with Read before drawing visual conclusions.

A trip for Lisbon: open `/trips/designer?place=Lisbon&region=Portugal`, tap "use the example family", then "Design the itinerary". "Look around Lisbon" then loads the fixture.

## Rules

- **Discovery only.** Do not modify application code, config or data. Write only under `docs/redteam/2026-09-25/` and your `rt3/<PERSONA>/` folder.
- Screenshots: `docs/redteam/2026-09-25/artifacts/<PERSONA>-<NN>-<slug>.jpg`, saved as `type: 'jpeg', quality: 60`. At most 12 per persona, and only ones that prove something.
- Never fabricate results. Label each finding OBSERVED / INFERRED / UNKNOWN.
- Don't read `.env*` files or print secrets. Don't click through to third-party checkouts or submit third-party forms.
- Root-cause each failure to `src/…:line` and recommend the smallest fix. Don't fix it.
- Honesty is a core requirement: anything implying live data, bookings, availability or prices that don't exist is material. So is privacy: what gets sent, stored, or put in URLs.

## Output

Write `docs/redteam/2026-09-25/findings-<PERSONA>.md` containing:
1. Persona, job to be done, entry point and expected end state.
2. Flow maps (`USER -> … -> SUCCESS`), each marked `EXECUTED - PASS/FAIL/PARTIAL`, `CODE-REVIEW ONLY` or `UNTESTED`.
3. A test-case table: ID | case | expected | observed | result | evidence.
4. Findings with ID `UFR3-<PERSONA><NN>`: severity (BLOCKER / LOGIC FAILURE / DEAD END / STATE FAILURE / PRIVACY / SECURITY / COST EXPOSURE / HONESTY / RECOVERY FAILURE / EDGE CASE / UX FRICTION / VISUAL REGRESSION / A11Y / POLISH), evidence label, problem, user impact, expected vs actual, root cause `file:line`, recommended fix, and acceptance test.
5. A prioritized top-5 list.

**ALSO return the full findings text in your final message.** A previous run's file writes were blocked, and the orchestrator will save it.
