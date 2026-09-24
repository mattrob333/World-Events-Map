# dope.travel, agent-first: plan

Owner brief (2026-09-24): make the site agentic and seamless. No forms: anywhere the site needs a decision or a fact from you, you talk to it. A living sun orb (the "o" from the logo, rising over shimmering water) opens in a small modal and listens; a subtle "Type instead like a caveman" link is the fallback. The site should know where you left off and open it. A background agent keeps it fresh daily: new imagery of people having fun (labelled with the city), and eclectic, Vice-style travel stories. Multiple travel profiles (family, solo, crew). The MCP server stays the door for bringing your own AI.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Voice model | **OpenAI Realtime, `gpt-realtime-2.1`**, speech-to-speech over WebRTC | Verified on this account 2026-09-24 (`/v1/realtime/client_secrets` returns an `ek_` key for `gpt-realtime-2.1`). True voice-to-voice with function calling and barge-in. The Claude API has no native speech-to-speech; `OPENAI_API_KEY` is already connected. |
| Where the voice agent's tools run | **In the browser**, over the WebRTC data channel | Almost every action is a change to on-device state (trip draft, profile, votes, navigation). No trip data needs to go to a server. The server only mints short-lived keys. |
| Background "freshness" agent | **Claude Managed Agents, scheduled deployment** (daily), with web search, writing through a small authenticated ingest tool | Anthropic runs the loop and the schedule; no cron plumbing for the agent itself. Falls back to the existing Vercel cron + research pipeline (Exa + Treg + Jev) if Managed Agents isn't set up. |
| Bring-your-own agent | **The existing MCP server** (`/api/mcp`, docs on `/agents`) | Already built and hardened; works with Claude, ChatGPT and any MCP client. |
| Where profiles live | On the device now (multiple profiles, one active); synced when Supabase accounts exist | No accounts today; don't block the feature on auth. |

## 1. The Sun (voice concierge)

- **One component, everywhere:** `<SunButton intent="…">` opens `<SunModal>`. Pages pass an *intent* and a *tool set*: the trip designer ("where, when, who"), the mood board ("tell us about you"), NOW ("where are you, what do you feel like"), join ("who are you"), votes ("love it / pass").
- **The orb:** a canvas sun rising over water. A gradient disc in the golden-hour colors cut by horizon bands like the logo, reflected in the water below with a slow shimmer. It breathes gently at rest, swells with the traveler's voice (mic level), and ripples when the agent speaks (remote audio level). Honors reduced motion.
- **Session:** the browser posts its WebRTC offer to `POST /api/voice/session`, which is same-origin, rate limited and daily capped.
  - The server opens the call with OpenAI using the server key and the page's instructions and tool allowlist, then returns the answer.
  - It hangs the call up server-side at the time cap.
  - The browser executes function calls locally.
  - Note: the browser can still send `session.update` on its own call, so the allowlist sets the starting config but isn't a hard boundary. Cost is bounded by the time cap, the limiter and the daily cap.
- **Tools (client-side):** `set_trip_basics` (place, region, dates, nights, hometown), `set_crew` (people, kids' ages), `update_profile` (name, hometown, teams, artists, food, travel style), `switch_profile`, `create_trip` (compose and open), `vote` (love or pass the card on screen), `look_around` (tap-equivalent for paid research), `navigate` (a route in the app), `open_now` (city, mood).
- **Fallback:** "Type instead like a caveman" swaps the orb for a text box that talks to the same agent over the data channel. With no key configured or the mic denied, it falls back to the existing on-device parser and forms, stated plainly.
- **Cost guard:** a daily session cap (`VOICE_DAILY_SESSIONS`) and a server-side hang-up at `VOICE_MAX_SECONDS`. The caps are per instance until the durable budget exists (review S5), so keep voice on Preview until then.

## 2. Pick up where you left off

On load, the shell reads the device state and offers the next step: an unfinished trip opens its designer at the right day; a trip underway opens "Right now"; a mood board with no trip offers "Plan a trip with {profile}". Home shows a one-line "Continue your Lisbon trip" bar above the hero.

## 3. Travel profiles

Profiles already save on the device (up to 12). Add an **active profile** ("Traveling as: Family · Solo · The crew"), a switcher in the header, and use it everywhere: the designer's crew and hometown, NOW's taste, voice context. Voice can create and switch profiles ("I'm going solo this time").

## 4. Fresh imagery that feels alive

- **Pool:** 20–50 real, licensed photos of people having a great time (festivals, rooftops, beach clubs, après, street parties), each with the city and a credit/license line. The honesty rule stays: real photos labelled with where they are; generated art is never passed off as a real place.
- **Sources:** Wikimedia Commons (CC-licensed, credits built in) now; add Pexels/Unsplash APIs if keys are provided (both license photos for this use with attribution).
- **Rotation:** the home hero picks from the pool per visit, weighted to unseen images (tracked on the device), preloading the next one.
- **Refresh:** the daily agent proposes replacements when an image has been shown enough times, and a curator check (Jev or Claude vision: "is this lively, is it the place, is anyone identifiable in a way that needs consent") screens them before they enter the pool.
- **Needs:** durable storage for the pool (Supabase table or Vercel Blob). Until then the pool ships as a reviewed JSON file in the repo.

## 5. The Wire: Vice-style stories

- **Beats:** medical travel (clinics and treatments people go abroad for), psychedelic and ayahuasca retreats, exotic fishing and hunting, adults-only resorts, new sports and odd competitions, travel hacks, gear worth owning, and hot new destinations.
- **Pipeline:** the scheduled agent searches daily per beat and writes candidate stories: title, source link, a short excerpt, the publisher, the date, one image with credit. The existing screening (Jev: relevance, source quality, freshness) runs next, and publishing keeps the provider-truth rules: link out to the original, excerpt only, date shown.
- **Guardrails:** medical and psychedelic stories carry a plain "reporting, not advice" label and never link to booking or dosing. Hunting and fishing link to licensed outfitters only through the source article.
- **Needs:** Supabase with migration 005 applied, `EXA_API_KEY` (or Claude web search via the Managed Agent), `TYPESAFE_API_KEY` for screening (already set), and an `ANTHROPIC_API_KEY` for the Managed Agent.

## Build order

1. **Done.** The Sun: `SunOrb`, `SunModal` ("Type instead like a caveman"), the header Talk button, and `useRealtime`. Page tools cover the trip designer, mood board and NOW, plus `switch_profile` and `navigate`.
   - The server does the SDP exchange, so the browser never holds a key, and it hangs the call up at `VOICE_MAX_SECONDS` (default 240). This fixes review B1.
   - Voice is off unless `VOICE_ENABLED=1`.
2. **Done.** Active travel profiles: the "As: Family / Solo / Crew" switcher, used by the designer crew, NOW taste and the Sun's context.
3. **Done.** Pick up where you left off: the first front-door visit in a session opens the trip in progress; later visits show a Continue bar.
4. **Done.** Hero pool: 35 licensed Commons photos in 27 places (`src/lib/hero/pool.json`, `public/hero-pool/`, `scripts/hero-pool.mjs`).
   - Each visit gets a run with unseen photos first, crossfading slowly. Every photo is labelled with its place and credited.
5. **Scaffolded.** The Wire: beats and story rules in `src/lib/wire/beats.ts`; agent spec in `docs/agents/daily-scout.md`. *(Running it needs keys and storage: see Needs.)*
6. Durable pool refresh and story storage. *(needs Supabase)*

## What the owner needs to provide

- `OPENAI_API_KEY` **and `VOICE_ENABLED=1`** in the Vercel project (Preview first) for voice. Optional: `VOICE_MAX_SECONDS` (30–280, default 240), `VOICE_DAILY_SESSIONS` (default 60), `VOICE_REALTIME_MODEL`.
- For the daily agent and The Wire: `ANTHROPIC_API_KEY`, Supabase keys (with migrations applied), optionally `EXA_API_KEY`, `PEXELS_API_KEY` or `UNSPLASH_ACCESS_KEY`.
