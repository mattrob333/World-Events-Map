# Persona H: "Bring your AI" (MCP)

Tester's report, saved by the orchestrator: the harness blocked the subagent's own file write. The content is the tester's returned findings, lightly formatted. Evidence: `artifacts/H-*` (transcripts `H-mcp-01`…`H-mcp-07`, `H-browser-run.json`, screenshots `H-01`…`H-12`) and Jev files `artifacts/jev/H-J1`…`H-J5`. Scripts: session scratchpad `rt-H/`.

Budget: Treg 0 calls (one automatic research request on a trip-link open was intercepted and aborted); Jev 5 calls, all HTTP 200; no other paid provider reached.

## 1. Persona

Maya, 34, Brooklyn, with her husband Dev and daughter Anika (6). She uses Claude or ChatGPT with connectors and has no dope.travel account. Entry: `/agents`. Expected end state: her AI saves a findable profile that carries her artists, and plans a Lisbon trip that opens as hers, keeps her taste, can be shared, and makes no false provider claims.

## 2. Flow maps

| Flow | Status |
|---|---|
| Human reads `/agents` → connects an MCP client to `/api/mcp` (Streamable HTTP, stateless) → `initialize`, `tools/list`, `prompts/list` | EXECUTED - PASS |
| Agent → `dope_profile_guide` → five-prompt ramble → `dope_save_profile` → import link → human opens it → Save → finds the profile | EXECUTED - PARTIAL (dead end after save, H02; honesty, H03) |
| Agent → `dope_save_profile` with a long ramble → link opens | EXECUTED - FAIL (over-length link, H07) |
| Agent → `dope_plan_trip` → link → fresh browser opens it as the traveler's own trip | EXECUTED - PARTIAL (taste dropped, H12; automatic paid research, H04) |
| Agent → `dope_find_events` / `dope_trip_ideas` / `dope_live_music_scene` with providers unconfigured | EXECUTED - PARTIAL (H08, H09) |
| Agent → `dope_find_stays`, `dope_curated_occasions`, `dope_read_playlist` | EXECUTED - PASS |
| Abuse: rate, body size, batch, GET | EXECUTED - FAIL (H13, H17) |
| Configured Ticketmaster/SeatGeek fan-out | CODE-REVIEW ONLY (H14) |
| Real Claude/ChatGPT connector against a public HTTPS deploy (and Vercel deployment protection) | UNTESTED |

## 3. Test cases

33 cases: 17 PASS, 8 PARTIAL, 8 FAIL. Per-case transcripts are in `artifacts/H-mcp-01`…`07` and `artifacts/H-browser-run.json`. All 9 tools, `prompts/list` and `prompts/get` were called; transport and abuse probes covered 14 cases.

## 4. Findings

| ID | Severity | Summary | Evidence | Root cause | Recommended change |
|---|---|---|---|---|---|
| UFR2-H01 | LOGIC FAILURE | An agent-built profile has no field for favorite artists (only genres, events, teams); artists otherwise come only from Spotify, which isn't configured, so "your artists on tour" never works from the agent path. Jev `artist_loss` 0.03. | OBSERVED | `src/lib/mcp/server.ts:78-112`, `src/lib/designer/profile.ts:41-62` | Add an `artists` field and have the music features read it. |
| UFR2-H02 | DEAD END | After "Save my profile" the import page shows only "Saved. Your profile is on this device." with no next action; saving clears the URL fragment the page reads from. Jev dead_end 0.66, next step 0.31. | OBSERVED, `H-05-import-after-save-desktop.png` | `src/components/designer/ProfileImport.tsx:19-20,31,70-71` | Decode the profile into state once; after saving show "Saved", "Plan a trip with it" and a Mood board link. |
| UFR2-H03 | PRIVACY | The import page says "dope.travel never received this profile", but the agent sent the full profile and ramble to `/api/mcp`. Jev 0.43/3 (P(false) 0.68). | OBSERVED | `ProfileImport.tsx:55` | Say "built this link without keeping a copy". |
| UFR2-H04 | COST EXPOSURE | Opening any `dope_plan_trip` link runs paid Treg research automatically for any place string (including "asdfghjkl qwerty"); the tool is annotated readOnly and not open-world. Limits are per instance only: 4 runs / 10 min per client (key falls back to `anonymous` off Vercel), $0.10 per run, $2 per day. | OBSERVED (request intercepted), `H-12` | `src/components/designer/DestinationResearch.tsx:214-216`, `src/lib/mcp/server.ts:396,409` | Research on handoff trips only on tap; set `openWorldHint`; add a durable daily cap. |
| UFR2-H05 | AMBIGUITY (provider truth) | `/agents` promises live events and playlist reading, and says "Events come from Ticketmaster and SeatGeek listings", though neither is configured. Jev 0.69. | OBSERVED | `src/app/agents/page.tsx:10-20,68-70` | Show which tools are live from server configuration. |
| UFR2-H06 | POOR FEEDBACK | "They can connect Spotify in the app" loops: Connect and paste each point to the other when Spotify isn't configured. Jev 0.94/3. | OBSERVED | MCP tool text + Spotify panel | Say plainly that Spotify isn't connected here; offer the public playlist paste only. |
| UFR2-H07 | LOGIC FAILURE | `dope_save_profile` can return a link over the 16,000-character limit (19,443 observed); the import page then blames copying. Merging the ramble skips list caps (music 21 items vs cap 10). | OBSERVED, `H-07` | `server.ts:114-125,224`, `src/lib/designer/share.ts:9,28` | Re-normalize the merged profile and check link length, or return isError. |
| UFR2-H08 | POOR FEEDBACK | `dope_find_events` silently drops teams when feeds are off; a teams-only call returns an empty "Search links:" header. Jev 0.42. | OBSERVED | `server.ts:253-255` | Return team search links or say teams need the event feed. |
| UFR2-H09 | AMBIGUITY | `dope_live_music_scene` never says listings aren't connected; "not connected right now" reads as a temporary outage. Jev 0.37. | OBSERVED | MCP scene tool text | Say "event listings aren't set up on this server". |
| UFR2-H10 | AMBIGUITY | The server tells agents to show the five-prompt opener word for word as soon as the traveler starts, even when they asked for a trip first; `/agents` promises it but doesn't mention the `dope_start` prompt. Jev opener_fits 1.65/3 (low confidence), expects auto-open 0.81. | OBSERVED | `server.ts` instructions; `agents/page.tsx` | Make the opener conditional on no profile; document `dope_start`. |
| UFR2-H11 | UX FRICTION | `/agents` has no copy button, no per-app steps, and no way to verify the connection. Jev can_connect 1.98/4. | OBSERVED, `H-01`, `H-02` | `agents/page.tsx` | Copy button, Claude/ChatGPT steps, a "test the connection" tool. |
| UFR2-H12 | STATE FAILURE | Music taste passed to `dope_plan_trip` is removed from the trip link; the traveler's trip opens with `hasTaste:false`. | OBSERVED | `src/lib/designer/tripShare.ts:209-213` | Keep taste when the link is a handoff to the traveler themself. |
| UFR2-H13 | SECURITY (low) | `/api/mcp` has no rate limit (150 calls in 1 s, all 200); a 2 MB chunked body bypassed the 64 KB check (reads only `content-length`); a batch of 100 plan_trip calls returned 1.1 MB in 0.4 s. | OBSERVED | `src/app/api/mcp/route.ts:16-19` | Count streamed body bytes; add an `mcp` rate-limit bucket; cap batch size. |
| UFR2-H14 | COST EXPOSURE | Once event feeds are configured, one find_events/trip_ideas call makes ~28 upstream requests but counts once against the 20-per-10-min budget. | CODE-REVIEW ONLY | `src/lib/designer/concerts.ts:253-283` | Charge the budget per upstream request or cap fan-out. |
| UFR2-H15 | EDGE CASE | Past dates (2020) and nonsense places are accepted by plan_trip and find_stays. | OBSERVED | MCP input schemas | Reject past start dates; soft-validate places. |
| UFR2-H16 | AMBIGUITY | Nav "Profile" goes to `/account` ("Membership is not connected yet") while the agent's profile lives at `/moodboard` under "Boards on this device". | OBSERVED | `src/components/shell/AppShell.tsx` | Point Profile at the on-device board until membership exists. |
| UFR2-H17 | EDGE CASE | GET returns 200 `text/event-stream` and closes immediately. | OBSERVED | `route.ts` | Return 405 for GET on a stateless server. |
| UFR2-H18 | POLISH | The plan outline prints "Après" slots on city trips and many empty "—" slots. | OBSERVED | MCP plan formatter | Omit empty and ski-only slots. |

## What held up (OBSERVED)

- `/agents` URL and transport are correct: Streamable HTTP, stateless, JSON; one prompt (`dope_start`), no resources.
- Validation is thorough: clear -32602 errors for bad enums, sizes, dates (including Feb 30), traveler counts and curated IDs; unknown tools return isError.
- XSS is inert on the import page; hostile strings are URL-encoded in Maps and stay links.
- trip_ideas and read_playlist state "not configured" honestly; stays are labeled as search links and occasions as curated.
- The plan_trip link opens as the traveler's own trip (organizer, "Invite people") on desktop and phone; reopening says "This is your trip. Open it".
- The saved profile appears at `/moodboard` under "Boards on this device". 0 px overflow at 390 px, no page errors.

## 5. Repair concepts (PROPOSED CONCEPT - NOT CURRENT APPLICATION)

1. **Import page after save:** honest copy ("Your AI built this link; we didn't keep a copy"), a two-state Save button (Save → Saved ✓), then "Plan a trip with it" (primary) and "Find it in Mood board" (text link).
2. **Handoff research:** on a trip opened from an agent link, the research panel shows "Look around {place}" (ghost button) and runs only on tap, unless a cached result already exists.
