# Persona K: security, abuse and cost

<!-- Saved by the orchestrator from the tester's returned report: the harness blocked the subagent's own file write. Evidence: artifacts/K-01…K-10, artifacts/jev/K-J01-forged-picks.json. -->

PERSONA K red-team report (security, abuse and cost). The harness refused to write docs/redteam/2026-09-24/findings-K.md ("Subagents should return findings as text"), so the full findings are below. Evidence files are in docs/redteam/2026-09-24/artifacts/K-01 through K-10 and jev/K-J01-forged-picks.json. Scripts are in scratchpad/rt-K/. No application code was changed.

## Paid-call accounting
- None of my curl probes reached Treg. Every one failed the boundary check or validation before consumeProviderCall ran (K-01).
- **One browser test (test D in links.mjs, 05:55 UTC) may have caused one paid Lisbon research run.** It joined a Lisbon trip and landed on /trips/designer. DestinationResearch POSTs /api/designer/research on mount whenever localStorage has no research entry; K-03 shows "Looking around Lisbon…". The server had restarted at 05:49, so its in-memory place cache was empty. The server log shows 2 runs (54,650 micro-USD ≈ $0.055 each) by 05:56:20. Personas F and H researched in the same minute and the log has no timestamps, so I can't attribute either run. **My share is at most one run, ≈$0.055.** Every later browser test seeded the research localStorage entry, observed 0 research POSTs, and the receipt count stayed at 22.
- Budget and limiter behavior was measured in a no-network module simulation. It runs the real guard.ts and destination.ts against a mocked Treg (K-10).

## Top findings

**UFR2-K01 — COST EXPOSURE (OBSERVED via simulation; INFERRED for prod): the $2/day research cap is per instance, in memory, and fails open.**
- Root cause is src/lib/research/destination.ts:
  - :83-88 keeps the daily total in module state.
  - :168 sets each run's budget from the remaining total when the run *starts*.
  - :135 does `day.spent += cost ?? 0`.
- 60 concurrent distinct places billed $3.90 against the $2 cap. The overshoot grows linearly with concurrency: up to about $0.10 × N per burst.
- If Treg omits `x-treg-cost-micro`, spend never accrues: 60 runs billed $3.90 and the cap was never enforced.
- Each serverless instance and each cold start gets a fresh $2.
- Fix: reuse the durable, atomic, fail-closed budget that NOW already uses (src/lib/now/providerBudget.ts). Reserve each call's ceiling before calling and charge the ceiling when the cost is unknown.
- Acceptance test: 50 concurrent fresh runs never spend more than the cap, and a missing cost header counts as the full ceiling.

**UFR2-K02 — COST EXPOSURE (OBSERVED): the per-IP limiter can be bypassed, or used to lock out everyone.**
- Root cause: `clientKey` at src/lib/designer/server/guard.ts:76-82 trusts the client-supplied `X-Vercel-Forwarded-For` and `X-Real-IP` headers.
- Rotating either header gave 100 of 100 research calls and 1000 of 1000 Jev calls allowed.
- With neither header (a `next start` setup like localhost:3127), all users share one "anonymous" bucket. An attacker can use up its 4 research calls per 10 minutes for everyone. The testers hit a real 429 this way.
- IPv6 rotation defeats per-IP limits even on Vercel.
- The research limiter (route.ts:55) also counts cache hits, so a legitimate user reopening trips gets "Research just ran a few times".
- Fix:
  - Trust only headers set by the platform, and only when running on that platform.
  - Key IPv6 clients by /64.
  - Consume the limiter only on a cache miss.
  - Treat the durable global cap from K01 as the real control.

**UFR2-K03 — COST EXPOSURE (OBSERVED): the same-origin check only works against browsers.**
- Root cause: `expectedOrigin` at guard.ts:19-24 is built from the request's own Host, X-Forwarded-Host and X-Forwarded-Proto headers.
- curl with `Origin: http://localhost:3127`, or with `Origin` and `Host` both set to evil.example, passes the boundary on every designer route (K-01, R4-R6).
- Cross-site browser requests are correctly blocked (R3, R7, R8).
- Consequence: any script can drive research and persona calls, so K01, K02 and K05 are the only real cost controls.
- Fix: compare Origin against a configured NEXT_PUBLIC_SITE_URL allowlist, not against request headers. Add a durable cap regardless.

**UFR2-K04 — COST EXPOSURE (OBSERVED in sim): the research cache is easy to bust.**
- Changing only `food` or `scene` on the same place gives a new cache key (destination.ts:268; free text at route.ts:43-44). Five Lisbon variants cost 5 fresh runs.
- Flights have their own $0.02 budget and a cache keyed by route and dates (destination.ts:245-247, 276). 30 date variants on a cached place made 30 paid calls.
- Real run cost is about $0.055; the ceiling is about $0.10 including flights.
- Worst case per identity, bounded by the limiter: about 24 runs/hour, i.e. $1.30/hour actual or $2.40/hour at ceiling. Only K01 bounds this per day, and K01 fails open.
- Fix:
  - Map food and scene to a small enum.
  - Round flight dates, or require the trip to exist.
  - Enforce the durable cap.

**UFR2-K05 — COST EXPOSURE (CODE-REVIEW): paid Jev calls on /api/designer/persona, scene and concerts have no daily or durable cap.**
- The only control is the spoofable 10-per-10-minutes limiter (persona/route.ts:22; guard.ts:73).
- TYPESAFE_API_KEY is configured on this deployment. With 1000 spoofed identities that is 60,000 calls/hour. Jev unit price is not in the repo.
- Fix: route these calls through the durable provider budget, as NOW already does.

**UFR2-K06 — SECURITY (OBSERVED in the browser): opening a share or picks link pollutes Object.prototype and silently breaks the app in that tab.**
- The ID regex `/^[a-z0-9:_-]{1,48}$/i` (tripShare.ts:26) accepts `__proto__`.
- `cleanVotes` (tripShare.ts:144) and `readReplyLink` (:249) then run `votes['__proto__'] ??= {}`, which assigns attacker keys onto Object.prototype.
- `#t=` votes `{"__proto__":{"rtkPolluted":{"p0":1}}}` left `({}).rtkPolluted` equal to `{"p0":1}` on page load, with no click (K-04).
- The `#r=` variant set `({}).rtkReply` to 1.
- After pollution, "Join and vote" does nothing: the trip is stored, but there is no navigation and no error. Header nav links also stop working until reload (K-06-join-stuck.txt, K-06 png).
- Values are limited to 1/-1 or `{id: ±1}`, and I found no XSS gadget. The React `disabled` prop was not affected.
- Fix: build these maps with `Object.create(null)` or a Map, and reject `__proto__`, `constructor` and `prototype` as ids.
- Acceptance test: after opening such a link, `({}).x` is undefined and join navigates.

**UFR2-K07 — PERMISSION FAILURE / integrity (OBSERVED in sim): anyone with the invite link can forge "picks" that erase any traveler's votes, including the organizer's.**
- `readReplyLink` and `mergeReply` (tripShare.ts:240-290) trust `participant.id` from the link and replace that traveler's votes wholesale.
- A forged reply carrying organizer Matt's id (p1) and the name "Sam" wiped Matt's votes. The UI would say "Sam's 0 picks are in" (K-09).
- MergeReply (JoinTrip.tsx:186-220) never names the traveler whose votes will be replaced.
- Jev K-J01:
  - Organizer notices before pressing: 0.15.
  - Harm score: 2.92 of 3 ("voting can't be trusted", p=0.93).
  - Disclosure adequate: 0.28.
- Fix:
  - Show "This replaces <existing name>'s picks" whenever the id is known and the name differs.
  - Refuse replies that use the organizer's own id.
  - Longer term, sign replies with a per-guest secret carried in the invite.

**UFR2-K08 — SECURITY / phishing (OBSERVED): shared-trip content is attacker-controlled and rendered as trusted.**
- Custom card links accept any https host (tripShare.ts:77-88). The designer rendered `https://dope.travel.evil.example/login` with the label "Sign in to dope.travel" (K-03, K-04).
- `str()` (tripShare.ts:73) keeps bidi and zero-width characters. `\u202eyaM` renders as "May", and "Maya\u200b" looks identical to "Maya".
- The `from` value and names are rendered as text only; there is no XSS and no dialogs fired.
- `javascript:`, `data:` and `http:` links are correctly dropped.
- Fix:
  - Allowlist card link hosts to the ones composeLocally actually generates (Google Maps, YouTube, Instagram and similar).
  - Strip Unicode Cc/Cf characters from names.
  - Show the link's hostname on the card.

**UFR2-K09 — COST EXPOSURE (INFERRED; auto-fire confirmed in K-03 and H-12): crafted join links turn victims' browsers into a research botnet.**
- Research auto-fires on the designer (DestinationResearch.tsx:213-215).
- A link for a unique place (crafted by hand, or free from MCP `dope_plan_trip`) makes each victim who joins spend one fresh run. The request comes from the victim's IP and is genuinely same-origin, so it defeats both K02 and K03.
- Careless sharing of an ordinary link is cheap, because `taste` is stripped and guests all hit the same cache key.
- Fix: require a user click for the first research on a trip that arrived by link. K01 is also needed.

**UFR2-K10 — SECURITY hardening (OBSERVED): no security headers.**
- There is no CSP, no X-Frame-Options or frame-ancestors, and no nosniff. `X-Powered-By: Next.js` is sent (K-08). next.config.ts has no `headers()`.
- The join and merge pages can be framed. Chrome's partitioned storage probably blunts clickjacking of the merge step (INFERRED).
- Fix: add `frame-ancestors 'none'`, a baseline CSP and nosniff; set `poweredByHeader: false`.

**UFR2-K11 — EDGE (OBSERVED): the MCP 64 KB body cap only checks the declared Content-Length.**
- A 300 KB chunked body was accepted (K-07 M6), because mcp/route.ts:16-18 checks only the header. The SDK's own default limit is 4 MB.
- Fix: pass `maxRequestBodySize: 64_000` to the transport.
- Other MCP checks:
  - MCP is open to anonymous clients; initialize and all 9 tools work.
  - No paid provider is reachable through it on this configuration (Ticketmaster, SeatGeek and Spotify are not configured).
  - Once those keys are added, MCP exposes them to anonymous clients behind only the K02 limiter.
  - The Host header does not leak into MCP trip links (PASS).

**UFR2-K12 — POLISH (OBSERVED): /agents builds the MCP URL from the Host header.**
- agents/page.tsx:23. Sending `Host: evil.example` makes the page show `https://evil.example/api/mcp`.
- The response is no-store, so cache poisoning is unlikely.
- Fix: use NEXT_PUBLIC_SITE_URL.

**UFR2-K13 — PRIVACY (CODE-REVIEW or OBSERVED as marked): personal data persisted on the device.**
- `meridian.designer.v1` persists profiles, the trip (names, kids' ages, hometown) and `draftRamble`, the raw spoken ramble (store.ts:117-126).
- `clearAll` exists but no component calls it; per-profile remove does exist.
- Each research cache entry is about 55 KB and is never pruned. Many trips could fill the storage quota.
- Hot-linked research images disclose the viewer's IP to Google, Instagram, TikTok, Yelp and Tripadvisor CDNs. `referrerPolicy=no-referrer` is set (good), but the panel doesn't say so.
- Share-link disclosure copy ("names, kids' ages, home city") is present and accurate (PASS). The link also carries every traveler's votes and `from`.

## Passed checks
- **Research validation (K-01):** HTML, oversize, 1-character and non-string names are rejected. A declared 5 KB body and a streamed 3 MB chunked body both get 413. GET gets 405. Error bodies are generic.
- **Spotify reader (spotifyApp.ts, spotifyRead.ts):** fetches only api.spotify.com with a regex-checked playlist id, and `next` links are pinned to the API host. I found no SSRF.
- **TikTok oEmbed:** fixed host, a URL built from validated author and id, 200 KB and 4 s limits.
- **Research image and link host allowlists:** OK. Google Events links may point to any https host, from provider data.
- **Share links:** a deflate bomb (40 MB from a 51 KB link) is rejected gracefully in about 3 s. Links over 60 KB and 200k-deep nesting are rejected.
- **Secrets:** no secret patterns in .next/static or page HTML (Treg, TypeSafe, Anthropic, Supabase service key, CRON secret, JWTs, internal IPs). Only NEXT_PUBLIC_* env names appear. Treg receipts log only the endpoint, call id and cost. The Spotify access token is not persisted.

## Unknowns
- Whether Vercel strips client-supplied `X-Real-IP` and `X-Vercel-Forwarded-For`.
- Whether Treg always returns `x-treg-cost-micro`.
- Jev's unit price.
- The attribution of research run A in the server log (see the paid-call accounting above).
