# UserFlow Red Team Report, second pass: dope.travel

Discovery pass (no application code changed) · 2026-09-24 · branch `claude/review-recent-work-5li9lw` @ `386241b` (Afterglow redesign round 2)

Readable version: [report.html](report.html) (open it in a browser), also published at https://claude.ai/artifact/AzVqdkvN91gyKLujAxF7gb.

Per-persona detail, test tables and evidence: [findings-F](findings-F.md) · [findings-G](findings-G.md) · [findings-H](findings-H.md) · [findings-I](findings-I.md) · [findings-J](findings-J.md) · [findings-K](findings-K.md) · tester brief: [BRIEF.md](BRIEF.md) · previous audit: [2026-09-23](../2026-09-23/REPORT.md)

## 1. Executive summary

### Scope

Everything added since the first audit's fixes (`e26a201`): mood board and profile parsing, Spotify import, the trip designer for typed-in places, share/join links and "send my picks back", NOW on the trip, the MCP server and `/agents`, destination research through Treg, the dope.travel rebrand, the Afterglow redesign, and the globe scroll fix. Plus a full retest of the first audit's fixes.

| | Persona | Core job |
|---|---|---|
| F | The owner planning a real crew trip (phone) | Ramble → profile → plan a typed-in place → live research → stays → vote → invite the crew |
| G | The invited friend (cross-user handoff) | Open the invite, say who you are, vote, send picks back; organizer merges |
| H | "Bring your AI" (MCP) | Connect an agent, build a profile and a trip through tools |
| I | On the ground, tonight (mid-trip, phone) | "What do I do right now?", live music tonight, NOW |
| J | First-time explorer, regression sweep | Retest every 09-23 fix; redesign regressions; discover → why/how far → keep |
| K | Hostile or careless outsider | Cost exposure, same-origin boundary, share-link parsing, SSRF, secrets, headers |

### Environment

- `http://localhost:3127`: production build (`next start`) with `TREG_TOKEN` (paid) and `TYPESAFE_API_KEY` (Jev) configured; Anthropic, Spotify app, Ticketmaster/SeatGeek, BestTime and Supabase not configured. This matches what the owner's preview will be once `TREG_TOKEN` is added in Vercel.
- `http://localhost:3128`: `next dev` with `NEXT_PUBLIC_MERIDIAN_DEMO=1`, used only for member/invite checks.
- Playwright Chromium, phone 390×844 (touch) and desktop 1440×900; tablet spot checks.

### Jev and spend

- **Jev (TypeSafe): connected.** 41 judgment calls, all HTTP 200, model `jev-1.13.0`, saved under [`artifacts/jev/`](artifacts/jev/). Testers passed the actual visible text and recorded where they disagreed.
- **Treg (paid research):** about **$0.11** spent in total. One deliberate fresh run by persona F (Nashville, $0.0547) and one Lisbon run on a restarted server that couldn't be attributed (≈$0.055). Every other research request was blocked in the browser or refused by the rate limiter. This matters as a finding in itself: the research panel fires automatically on page load (see §3, cluster A).

### Results at a glance

- **Retest of the 09-23 fixes (persona J): 31 rows: 28 PASS, 2 PARTIAL, 1 REGRESSION.**
  - The regression is UFR-C01 on phone: NOW's "not connected" notice is now under the tab bar, because the new "For you" block renders above it.
  - The partials are phone layout issues: the family-ski brief ordering and the demo invite strip.
  - No previously fixed logic regressed.
- **84 findings** (F 16 · G 12 · H 18 · I 12 · J 13 · K 13). By severity: COST EXPOSURE 11 · SECURITY/PERMISSION/PRIVACY 11 · LOGIC FAILURE 11 · STATE FAILURE 6 · DEAD END 4 · AMBIGUITY 15 · POOR FEEDBACK 8 · RECOVERY FAILURE 2 · VISUAL REGRESSION 3 · EDGE CASE 5 · UX FRICTION 6 · POLISH 2. They collapse into ten root causes (§3).
- **Redesign held up:** 0 horizontal overflow at 390 px, 0 text under 11 px, disclaimer contrast ≥ 5.29:1 on 116 nodes, at most one gradient CTA per first viewport, visible focus rings on 300 tab stops, 0 page errors. **Failures:** 36 px chips and small buttons without a 44 px hit area, the sticky destination pill covering facts, the demo invite strip over the tab bar.

### The five things that matter most

1. **Paid research can be triggered by anyone, and its caps don't hold** (cluster A).
   - The research panel runs a paid Treg search on page load, on every device that opens a trip: invited friends, trips from AI links, dates changed mid-trip.
   - The $2/day cap is per server instance and in memory. It fails open under concurrency and when the cost header is missing (60 concurrent runs billed $3.90).
   - The per-IP limiter trusts client headers, and the same-origin check trusts request headers, so any script can drive it.
   - A crafted invite turns friends' browsers into a research botnet.
   - **Recommendation:** add `TREG_TOKEN` to the Vercel **Preview** environment only (it sits behind Vercel sign-in) until the P0 fixes below land. Don't add it to Production yet.
2. **Share links can be forged and can corrupt the organizer's plan** (cluster B).
   - A friend can pick the organizer's name, or craft a reply with his id, and silently erase his votes. Jev: organizer notices 0.15–0.20.
   - A crafted link pollutes `Object.prototype` and breaks joining in that tab.
   - Custom card links accept any https host, so a trip can carry "Sign in to dope.travel" pointing at `dope.travel.evil.example`.
3. **The share link reveals more than it says** (cluster C).
   - The UI says "Music taste stays on your device", but taste-derived card blurbs ("Because you listen to hip hop, trap.", "40% of your top songs are from before 2000") travel in the link, along with interest tags and adult ages.
   - Jev: disclosure "materially incomplete" (p 0.75).
4. **The mood board gets the owner wrong** (cluster D).
   - The parser invents two extra kids whenever "the kids" is mentioned again, so stays get searched for six people.
   - It drops name, age and hometown for ordinary phrasing, including the page's own placeholder ("I'm 44, from Atlanta").
   - Named artists are never captured. The agent path has no artists field either.
   - The board can't be corrected.
5. **"Right now" doesn't know what phase the trip is in** (cluster F).
   - Last day: it shows lunch at 21:00 and never the airport or flight (Jev harm 3.06/4).
   - Arrival day at JFK: it says "You're here, right now in Lisbon".
   - After the trip: it says "Underway · enjoy every minute" forever.
   - Around it: "Live music tonight" has no data about tonight, and NOW contradicts itself ("no recommendations to show" directly under recommendations).

### What held up (OBSERVED)

- **Discovery:** URL-backed state, honest "indicative" distances (Jev why 2.89/3, how far 2.44/3), saved state consistent across four surfaces.
- **Research panel:**
  - Every tab shows its source and fetch time.
  - Photos matched what they were labeled as.
  - "Hidden gems" is a stated rule.
  - The Events outage is stated honestly.
  - Stays links are sized correctly for the party.
- **Share and join:**
  - The happy-path merge attributes votes to the right person and is idempotent.
  - Wrong-trip and no-trip replies are refused.
  - HTML/script in names renders inert.
  - Oversized links are rejected.
- **MCP:**
  - The URL and transport on `/agents` are correct.
  - Validation is thorough (bad enums, Feb 30, sizes).
  - The plan_trip link opens as the traveler's own trip.
  - trip_ideas and read_playlist state "not configured" honestly.
- **Security:**
  - No secrets in client bundles or HTML.
  - The Spotify reader and TikTok oEmbed are pinned to their hosts (no SSRF).
  - Research image and link host allowlists hold.
  - Research validation rejects bad input with generic errors and 413 on oversize (including chunked bodies).
- **Globe scroll fix:** plain wheel scrolls the page; ctrl/⌘ + wheel zooms.

## 2. Coverage

| Persona | Flows (pass / partial / fail / other) | Test cases (pass / partial / fail) | Findings | Jev calls |
|---|---|---|---|---|
| F | 3 / 5 / 3 | 10 / 5 / 11 | 16 | 9 |
| G | 1 / 1 / 3 (4 executed with fail/partial) | 12 / 5 / 12 | 12 | 6 |
| H | 2 / 4 / 1 · 1 code-review · 1 untested | 17 / 8 / 8 | 18 | 5 |
| I | 1 / 4 / 2 · +globe PASS | 13 / 2 / 9 | 12 | 6 |
| J | 1 / 3 / 2 · + 31-row retest | 16 cases + 31 retest rows | 13 | 6 |
| K | HTTP probes, browser checks, module simulation | see findings-K | 13 | 1 |

Untested:
- A real Claude or ChatGPT connector against a public HTTPS deploy.
- Configured Ticketmaster/SeatGeek, BestTime, Spotify and Supabase.
- Whether Vercel strips client-supplied `X-Real-IP` / `X-Vercel-Forwarded-For`.
- Whether Treg always returns `x-treg-cost-micro`.
- A real touch pinch on the globe.

## 3. Findings by root cause

### A. Paid research runs on page views, and its guards don't hold (COST EXPOSURE, HIGH_CAPABILITY_ONLY)

- **Findings:** G04, F05, H04, I12, K09 (auto-fire and botnet); K01 (budget in memory, fails open); K02, F10, F11 (limiter spoofable, counts cache hits, shared "anonymous" bucket); K03 (same-origin check trusts request headers); K04, F05 (cache busted by free-text `scene`/`food` and flight dates); K05, H14 (Jev and event-feed calls have no durable cap).
- **Root causes:**
  - `DestinationResearch.tsx:190-216` loads on mount.
  - `destination.ts:83-98,135,168,268`: in-memory cache and budget, and a key that includes the scene.
  - `guard.ts:19-24,76-82`: origin and client key built from request headers.
  - `research/route.ts:55`: the limiter runs before the cache.
- **Fix:**
  - Research only on an explicit tap when nothing is cached (always on guest copies and handoff trips).
  - A durable, atomic, fail-closed daily budget: reuse `src/lib/now/providerBudget.ts`, reserve each call's ceiling, and charge the ceiling when the cost is unknown.
  - Key the limiter on platform-set headers only, and spend it only on cache misses.
  - Check the origin against a configured site URL.
  - Cache place parts without the scene (nightlife separately); map food/scene to a small enum.
  - Round flight dates.
  - Put Jev routes through the same budget.

### B. Share and reply links are trusted too much (SECURITY / PERMISSION FAILURE, HIGH_CAPABILITY_ONLY)

- **Findings:** G01, F06, K07 (vote as or forge the organizer; merge replaces by id); K06 (`__proto__` ids pollute `Object.prototype`, and join silently stops working); K08 (any-https card links, bidi and zero-width names); G05 (a re-added friend loses votes, duplicate identical travelers); G06 (a stale reply overwrites a newer one); G07 (joining deletes the friend's own trip with no undo); G08 (raw `atob` / "Failed to fetch" errors); G09 (merge counts wrong); G10 (organizer opening his own invite); G11 (reply for a missing trip gives wrong advice); G12 (size check after full inflate).
- **Root causes:**
  - `tripShare.ts:26,73,77-88,144,249,260-290`.
  - `JoinTrip.tsx:98-156,186-220`.
  - `TripCanvas.tsx:121-135`.
  - `store.ts:78`.
- **Fix:**
  - Null-prototype maps, and reject `__proto__`/`constructor`/`prototype` ids.
  - Allowlist card link hosts to the ones the app generates; strip Unicode control and format characters from names.
  - Mark the organizer in the link and never offer him to guests.
  - Lock "Voting as" on guest copies.
  - Merge sheet with a diff, organizer-id refusal, name-mismatch warning, timestamps (`at`) with stale detection, and Undo.
  - Keep a one-slot `previousTrip` for restore.
  - Map decode failures to "This link was cut off".
  - Stream-inflate with an early abort.

### C. Share link privacy (PRIVACY)

- **Findings:** G03, F08 (taste blurbs, interest tags and adult ages travel in the link, contrary to the disclosure); H03 (the import page says "dope.travel never received this profile" after the agent sent it to `/api/mcp`); K13 (the raw ramble persists in localStorage, `clearAll` is never offered, the research cache is unbounded).
- **Fix:**
  - Neutralize taste-derived blurbs in `tripLink`.
  - Strip participant tags and adult ages.
  - Make the disclosure list exactly what travels.
  - Correct the import-page copy.
  - Add "Clear everything on this device" and prune the research cache.

### D. Profile understanding (LOGIC FAILURE)

- **Findings:** F01 (phantom kids, `profile.ts:242`); F02 (the hometown regex has no `i` flag at `profile.ts:219`, "I'm <Name>, <age>" is unsupported, no artists); H01 (no artists field in the MCP profile); F16 (board not editable; unsaved board lost on reload); F03 (the "Atlanta, Georgia" placeholder reads as filled); H07 (MCP import link can exceed 16k and skips list caps); H12 (taste dropped from agent trip handoffs).
- **Fix:**
  - Parser fixes, with unit tests on the exact phrasings above.
  - An artists field.
  - A "Did we get you right?" editable strip (identity + crew with ×).
  - Autosave the board draft.
  - Placeholder "Your home city (for fares)".
  - Re-normalize and length-check MCP imports.
  - Keep taste on self-handoffs.

### E. The guest's job isn't visible (MISSING STEP)

- **Findings:** G02 ("Send my picks back" is 25 phone screens down; the help text names a button guests don't have; Jev completion 1.17 "likely fails"); F07 (the invite never says whose trip it is, and the organizer is "You").
- **Fix:**
  - A sticky guest bar ("You're Sam on Matt's trip · 5 picks · Send to Matt").
  - Guest-aware help text.
  - Ask the organizer's name before the first invite.

### F. Trip-phase logic (LOGIC FAILURE)

- **Findings:** I01 (last day stuck on lunch; the transfer and flight never show); I02 (arrival day says "you're here"); I05 (after the trip: "Underway" forever); I07 (01:30 drops the night out); I10 (slot switch times don't match the shown times, and `/now` uses a different table); F13, H18 (city trips get ski "Après" slots, an overnight flight for a 1-hour hop, "Cocktails" as the family late-night pick).
- **Root causes:** `tripNow.ts:10-46`, `TripExtras.tsx:58-71`, `TripCanvas.tsx:20-25`, `itinerary.ts:149,195-199`, `catalog.ts:54,182`.
- **Fix:**
  - `tripMoment` returns a phase (before, travel-out, on-ground, travel-home, after), treats times before 04:00 as the previous night, and reads switch times from the slots.
  - Add Après only on ski trips.
  - Distance-aware flight cards and a drive option.

### G. Provider truth in copy (AMBIGUITY / DEAD END)

- **Findings:**
  - F04, H06: Spotify paste invited, then 503, then "put artists in your ramble", which the parser drops.
  - H05: `/agents` promises Ticketmaster/SeatGeek listings that aren't configured.
  - I03: "Live music tonight" has no data about tonight.
  - I04, J02: NOW shows ideas and then "no recommendations to show"; "shaped by your board" with no board; worldwide "On today".
  - J01: REGRESSION of C01, the not-connected notice is under the tab bar on phones.
  - F09: fares read as trip totals; "one adult" is below the fold.
  - F12: Tripadvisor and Instagram items outside the place; a 2020 photo shown as "1 h ago".
  - F15: Events outage footnote contradicts itself.
  - H08, H09: event tools silently drop teams, and "not connected right now" reads as an outage.
  - I09: NOW ignores the trip's taste.
- **Fix:**
  - One server-reported capability flag per provider, driving every string that promises live data.
  - NOW: notice first, with honest "Maps searches, not picks" labels and in-city "On today" only.
  - "per adult · round trip" on each fare card.
  - Locality filter on Tripadvisor and down-rank promos on Instagram.
  - Status-aware footnotes.

### H. Next steps that dead-end (DEAD END / UX FRICTION)

- **Findings:** J03 (the destination's only glowing CTA "Start a trip" → Circles → "Continue in Community" → "Membership is not connected yet"; Jev reaches an outcome 0.05); J04 (Trips hidden under More, saved places 2.7 screens down labeled "Save ↗"); J05 (the phone family-ski page promises a Circle link before saying it's unavailable); H02 (dead end after saving an imported profile); H16 (Profile nav goes to membership, while the profile lives on `/moodboard`); I08 (NOW city not kept in the URL); H11 (`/agents` has no copy button or per-app steps).
- **Fix:**
  - When membership isn't configured, make the destination primary "Keep {place}" (save).
  - "Your trail" first on `/trips`.
  - Consider a Trips tab: the design panel recommended it too, and it's the owner's call.
  - Next actions after import.
  - Point Profile at the on-device board.

### I. Redesign follow-through (VISUAL REGRESSION / POLISH)

- **Findings:** J07 (36 px chips and `.btn-sm` with no 44 px hit area; 238 designer vote buttons at 40×36; tablet nav 29 px); J11 (sticky "Plan …" pill covers the destination facts on a phone's first screen); J06 (demo invite strip over the tab bar, 38 px text column); J10 (active-state gaps: none on Now, two lit in More); J13 (the lens banner takes ~110 px on every phone page and competes with the mood board); J12 ("New trip" styled like a filter); F14 (18 s research load with static text below the fold); J08 ("Where to stay" regex matches "stays open").
- **Fix:**
  - `::before` hit areas on `.chip`/`.btn-sm`.
  - Sticky pill only after the facts scroll away; opaque header.
  - Demo strip above the tab bar with stacked buttons.
  - One `aria-current` per route.
  - Lens banner only on `/`.
  - A research-running chip in the hero with skeleton cards.

### J. Hardening (SECURITY low / EDGE CASE)

- **Findings:** K10 (no CSP, frame-ancestors or nosniff; `X-Powered-By` sent); K11, H13 (MCP 64 KB cap checks only `content-length`; no MCP rate limit; unbounded batch); K12 (`/agents` builds the MCP URL from the Host header); H17 (GET on `/api/mcp` returns 200 SSE); H15 (past dates and nonsense places accepted by MCP tools).
- **Fix:**
  - `headers()` with `frame-ancestors 'none'`, a baseline CSP and nosniff; `poweredByHeader: false`.
  - `maxRequestBodySize` on the MCP transport, an `mcp` limiter bucket and a batch cap.
  - Use `NEXT_PUBLIC_SITE_URL` for the MCP URL.
  - 405 on GET.
  - Reject past dates.

## 4. Proposed fix plan (ordered by risk)

Under AGENTS.md, clusters A and B (and the budget in K01) are HIGH_CAPABILITY_ONLY: abuse/cost protections and security boundaries. They need a senior review of the integrated diff before merge.

| Priority | Work | Findings | Class |
|---|---|---|---|
| **P0: before `TREG_TOKEN` goes on any public URL** | Research only on tap; durable fail-closed daily budget; trusted-header limiter spent only on misses; origin allowlist; scene-free cache key; Jev and event routes behind the budget | A (K01–K05, K09, G04, F05, H04, I12, F10, F11) | HIGH_CAPABILITY_ONLY |
| **P0** | Null-prototype maps and reserved-id rejection; card link host allowlist; strip control characters; organizer can't be claimed; safe merge (diff, timestamps, undo) | B (K06, K07, K08, G01, F06, G06) | HIGH_CAPABILITY_ONLY |
| P1 | Link privacy: neutral blurbs, strip tags and adult ages, accurate disclosure; import-page copy | C (G03, F08, H03) | REVIEW_REQUIRED |
| P1 | Parser fixes and an editable "Did we get you right?" strip; artists field | D (F01, F02, H01, F16, F03) | REVIEW_REQUIRED |
| P1 | Trip phases in `tripMoment`; Après only on ski trips; short-hop flights | F (I01, I02, I05, I07, I10, F13) | REVIEW_REQUIRED |
| P1 | Guest action bar; organizer name before inviting; join-without-losing-my-trip | E + B (G02, F07, G05, G07) | REVIEW_REQUIRED |
| P1 | Provider-truth copy from one capability flag; NOW order (fixes the C01 regression); per-adult fares; research locality filter | G (J01, J02, I03, I04, F04, H05, F09, F12) | REVIEW_REQUIRED |
| P2 | Destination primary = keep; Trips first-screen trail; Trips tab (owner call) | H (J03, J04, J05, H02, H16) | REVIEW_REQUIRED |
| P2 | 44 px hit areas, sticky pill, demo strip, active states, lens banner, research loading state | I | CHEAP_OK with spec |
| P2 | Security headers, MCP body/rate/batch limits, site-URL config, GET 405 | J | REVIEW_REQUIRED |

## 5. Retest plan

Each finding has an acceptance test in its persona file. After the fixes:
- Re-run `scratchpad/rt-J` (retest table and DOM audit).
- Re-run the G handoff scripts (impersonation, stale, prototype-pollution links).
- Re-run the K module simulation (50 concurrent fresh runs never exceed the cap; a missing cost header charges the ceiling).
- Re-run the I clock scenarios (arrival, last day, 01:30, after the trip).

Research spend during the retest should be $0: the fixed panel no longer loads on its own.
