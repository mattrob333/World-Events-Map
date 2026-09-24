<!-- Saved by the orchestrator from the tester's returned report: the harness blocked the subagent's own file write. -->

# UserFlow Red Team (second pass): Persona G, "The invited friend" (cross-user handoff)

Target: branch `claude/review-recent-work-5li9lw`, `http://localhost:3127` (production build; the `next start` process was started at 05:49 UTC, so its in-memory research cache was empty when testing began). Browser: Playwright Chromium (swiftshader). Organizer: desktop 1440x900. Friends: phone 390x844 (`isMobile`, `hasTouch`, iPhone UA), each a fresh context with empty localStorage unless stated. Scripts: `scratchpad/rt-G/s1.mjs` (happy path), `s2.mjs` (privacy/HTML names), `s3.mjs` (clobber, reopen, impersonation, two friends, stale replay, wrong trip), `s4.mjs` (re-added friend, crafted/spoofed replies, own link, broken links); seed variants `rt-G/mktrip2.ts`, `store2.json`, `store-own.json`. Raw outputs: `rt-G/s*.out.json`, `rt-G/s*.log.json`.

**Jev:** EXECUTED (jev-1.13.0, 6 calls: `artifacts/jev/UFR2-G-J1.json` … `UFR2-G-J6.json`).
**Paid-call budget:** No research request reached the server. Every `POST /api/designer/research` was caught in the browser context by `context.route` and answered with the seeded `research.json`. I never pressed Refresh. 10 requests were caught: 8 from friend phones (every friend context that reached the canvas) and 2 from organizer contexts that had no seeded cache on purpose.
**Console:** no console errors, page errors or failed requests (other than `_rsc`/Wikimedia noise) in any run.
No application code, config or data was modified.

**Findings (12):** PERMISSION FAILURE 1 · MISSING STEP 1 · PRIVACY 1 · COST EXPOSURE 1 · STATE FAILURE 2 · RECOVERY FAILURE 1 · POOR FEEDBACK 2 · LOGIC FAILURE 1 · AMBIGUITY 1 · EDGE CASE 1.

## 1. Persona

| Field | Value |
|---|---|
| User type | Two people. **Organizer** "Matt": owns the Lisbon trip draft on his laptop. **Friend** "Sam" (and later "Priya"): has never used dope.travel and opens a link on their phone. |
| Context | Matt pastes the invite link into a group chat. Friends tap it on their phones, vote, and send a "picks" link back through the same chat. Matt opens each picks link on his laptop. |
| Knowledge | Friend: none. They don't know the product, the vocabulary, or that the trip lives only in the link and on each device. Organizer: knows the designer. |
| Permissions | No accounts. Anyone who has a link can open it. Everything is stored in each device's localStorage. |
| JTBD (friend) | "Figure out who invited me and to what, say who I am, vote on what I'm into, and get my votes back to Matt." |
| JTBD (organizer) | "Collect everyone's picks into my plan, correctly attributed, without exposing more about my family than I intend." |
| Entry points | `/trips/designer` → "Invite people" (organizer). `/trips/join#t=…` (friend). `/trips/join#r=…` (organizer). |
| Expected end state | Matt's canvas shows each friend's loves and passes under that friend's name, with the right counts. No friend changes anyone else's votes. The friend's own data on their phone is not destroyed without a clear choice. The link reveals only what the UI says it reveals. |

## 2. Flow maps

- **F1: Organizer invites.** `EXECUTED - PASS`. USER (Matt, desktop, seeded Lisbon trip + cached research) -> `/trips/designer` -> canvas renders. No research request was made because the local cache hit. -> Matt loves 2 cards -> "Invite people" -> "Link copied. Paste it in the group chat." Textarea shows a 2,848-char `…/trips/join#t=z…` link -> SUCCESS. Evidence: G-01, G-02.
- **F2: Friend joins, votes, sends back (phone).** `EXECUTED - PARTIAL`. Friend (fresh phone) -> invite link -> "Matt wants you on this trip. Lisbon." with a "Who are you?" chip list (Matt, Sam) -> taps Sam -> "Join and vote →" -> `/trips/designer`. A research POST fires automatically [G04]. -> "Voting as Matt | Sam" (Sam on) -> 4 votes on cards + reload mid-vote (votes and identity kept: PASS) + 1 swipe-deck love -> scrolls about 25 screens to "YOU'RE ON MATT'S TRIP" [G02] -> "Send my picks back" -> "Link copied. Send it to Matt." Reply link is 283 chars -> SUCCESS, but only after the long scroll. Evidence: G-03…G-06.
- **F3: Organizer merges.** `EXECUTED - PASS` on the happy path. Matt opens `#r=` -> "Sam sent their picks. 5 votes." -> "Add their picks" -> "Sam's 5 picks are in." -> "See the group's faves →". The canvas shows "6 loves so far" (Matt 2 + Sam 4) and "Loved by Matt, Sam" on the shared card. The stored votes equal Sam's device exactly, attributed to `p2`. Opening the same reply again is idempotent. Evidence: G-07, G-08, `s1.out.json`.
- **F4: Adversarial handoffs.** `EXECUTED - FAIL`. These cases broke: impersonating the organizer [G01], a re-added friend [G05], stale replay [G06], clobbering the friend's own trip [G07], broken links [G08], and misleading counts [G09]. These passed: wrong-trip reply, no-trip device, oversized link, HTML names, two distinct friends.
- **F5: Privacy of the link.** `EXECUTED - FAIL` [G03]. I decoded the payload in Node and compared it with the in-app disclosure. Evidence: G-02, G-10, `s2.out.json`.

## 3. Test cases

| ID | Case | Expected | Observed | Result | Evidence |
|---|---|---|---|---|---|
| G-T01 | happy: invite link built | Link + honest status | "Link copied. Paste it in the group chat." + textarea, 2,848 chars | PASS | G-02 |
| G-T02 | first-time: friend orientation | Knows who/what/next | "Matt wants you on this trip. Lisbon." + dates + steps; Jev knows_inviter 0.80, knows_next_step 0.55 | PARTIAL | G-03, J1 |
| G-T03 | happy: friend votes (cards + swipe) | Votes saved as Sam | Saved under `p2` | PASS | s1.out |
| G-T04 | refresh: friend reloads mid-vote | Votes + identity kept | kept (`activeParticipant: p2`, `joinedFrom: Matt`) | PASS | s1.out |
| G-T05 | mobile: friend finds "Send my picks back" | Reachable from where you vote | Panel top at 20,840 px of 21,229 px page | FAIL | G-06, J2 [G02] |
| G-T06 | happy: organizer merges | Right person, right counts | Sam `p2`, 6 loves total, "Loved by Matt, Sam" | PASS | G-07, G-08 |
| G-T07 | duplicate: same reply opened twice | Idempotent | Identical votes after 2nd merge | PASS | s1.out |
| G-T08 | duplicate: invite reopened, same name | Keeps phone votes | kept | PASS | G-11, s3.out B |
| G-T09 | change mind: invite reopened, other name | Warn before dropping votes | Sam's phone votes silently dropped when picking Matt | FAIL (edge) | s3.out B |
| G-T10 | back/duplicate: added-yourself friend reopens invite | Recognised as Priya | Not listed; re-adding makes new id, votes lost, duplicate traveler | FAIL | G-16, s4.out [G05] |
| G-T11 | permission: friend picks organizer's name | Blocked or warned | Allowed; reply "Matt sent their picks" overwrote Matt's 2 loves with passes | FAIL | G-12, s3.out C/E [G01] |
| G-T12 | permission: crafted reply, name "Sam" on id `p1` | Name/id mismatch flagged | Page says "Sam sent their picks", merges onto Matt | FAIL | s4.out [G01] |
| G-T13 | unusual: friend device already has own trip | Clear warning; own trip safe or restorable | Confirm "Open this trip? It replaces the trip draft on this device." OK destroys it permanently; Cancel is a dead end | PARTIAL | s3.out A, J5 [G07] |
| G-T14 | permission: reply for a different trip | Refused | "These picks belong to a trip that isn't open on this device…", button disabled | PASS | G-15 |
| G-T15 | empty: reply before organizer has trip | Refused, honest | Same copy, button disabled | PASS | s3.out F |
| G-T16 | change mind: stale reply after newer one | Older ignored or warned | Older silently overwrote newer (love restored after pass) | FAIL | G-13, J4 [G06] |
| G-T17 | change mind: organizer changed plan (card gone) | Accurate count of what landed | "Sam's 3 picks are in" while only 2 applied | FAIL | s4.out [G09] |
| G-T18 | change mind: organizer pressed "New trip" | Replies explained | Old replies now "isn't open on this device. Open them on the phone where you planned the trip." (not true: it was this device) | PARTIAL | s4.out [G11] |
| G-T19 | two friends | Both merged, distinguishable | Merged; two "Priya" travelers with identical 🏂 and color | PARTIAL | G-14 [G05] |
| G-T20 | failure: truncated / garbled invite | Plain-language error | "Failed to execute 'atob' on 'Window': …" | FAIL | G-17, G-18 [G08] |
| G-T21 | failure: truncated reply | Plain-language error | "Failed to fetch It may have been cut off…" | FAIL | s4.out [G08] |
| G-T22 | unusual: empty fragment / no fragment / wrong prefix | Clear | "This link has no trip in it." / "That isn't a dope.travel trip link." | PASS | s4.out |
| G-T23 | unusual: oversized (>60,000 chars) | Rejected | "That link is too long or empty." | PASS | s4.out |
| G-T24 | unusual: 51,899-char deflate bomb (40 MB inflated) | Rejected quickly | Rejected after 5.2 s: "That trip is too large to open." | PARTIAL | s4.out [G12] |
| G-T25 | unusual: HTML/script in traveler name | Inert | Rendered as literal text; 0 `img[src=x]` nodes; no dialog | PASS | G-09, s2.out |
| G-T26 | unusual: Unicode/RTL/emoji organizer name | Renders | "Zoë 👩‍🚀 مريم wants you on this trip." | PASS | s4.out |
| G-T27 | privacy: link contents vs disclosure | Match | Also carries music-taste blurbs, interest tags, all votes | FAIL | G-10, J3 [G03] |
| G-T28 | cost: friend's research panel | No new paid call | Auto-POST on every friend phone (8/8), intercepted | FAIL | s*.log.json [G04] |
| G-T29 | deep link: organizer opens own invite | Straight to own trip | Must tap own name first, else "Tap your name, or add yourself." | FAIL (minor) | s4.out [G10] |

Coverage: 5 flows (4 executed with a FAIL or PARTIAL result, 1 PASS). 29 test cases (12 PASS, 5 PARTIAL, 12 FAIL). 6 Jev calls. 18 screenshots. 9 browser identities plus 3 organizer contexts.

## 4. Findings

### UFR2-G01: A friend can vote as anyone, including the organizer, and their picks overwrite that person's votes — PERMISSION FAILURE
- **Evidence:** OBSERVED (s3 C/E, s4 spoof; G-03, G-12).
- **Location:** `/trips/join` picker, the canvas "Voting as" toolbar on the guest copy, and the merge on `/trips/join#r=`.
- **Problem:** The join picker lists every traveler, including the organizer, and lists him first. On the guest copy the "Voting as" chips let the friend switch to Matt at any time. The reply link carries whatever participant id was active. `mergeReply` deletes that id's votes and replaces them wholesale. In the test, a friend joined as "Matt" and passed on the two cards Matt had loved. When Matt opened the link he saw "Matt sent their picks. 2 votes." with no warning, pressed "Add their picks", and lost both of his own loves: `custom:2 {p1: 1}` became `{p1: -1}`. A crafted reply with `id: p1, name: "Sam"` displayed "Sam sent their picks" and still overwrote Matt's vote. The headline uses the name from the link, not the organizer's own record.
- **User impact:** One mistaken tap, or one mischievous friend, silently rewrites the organizer's or another friend's choices. The organizer can't see the damage before it happens and can't undo it.
- **Expected vs actual:** Expected: a friend can only send picks as themselves, and a picks link that claims to be the organizer, or whose name doesn't match the id, is blocked or clearly flagged. Actual: accepted silently.
- **Jev:** `UFR2-G-J4` notices_problem **0.20**, would_tap_add **0.62**, can_recover **0.34**. `UFR2-G-J1` might_pick_wrong **0.23**. `UFR2-G-J2` toolbar_matt_chip **0.18**. My judgment: I agree. A roughly 1-in-5 per-friend chance of a wrong identity, combined with a 0.2 chance of noticing, makes this a real data-integrity problem, not a theoretical one.
- **Root cause:** `src/components/designer/JoinTrip.tsx:139-156` lists all participants with no organizer marker. `src/components/designer/TripCanvas.tsx:121-135` has an unrestricted voter switch on guest copies. `src/lib/designer/tripShare.ts:260-273` replaces by id without checking. `src/components/designer/JoinTrip.tsx:205` shows `reply.participant.name` rather than the local participant's name.
- **Recommended change:** (1) In the join picker, label the organizer ("Matt · organizer") and ask for confirmation before joining as him. (2) On a guest copy (`trip.joinedFrom !== undefined`), lock "Voting as" to the joined identity; "pass the phone" can stay behind an explicit "Someone else is voting" control. (3) In `MergeReply`, refuse or require an explicit "Replace MY votes?" when `reply.participant.id` equals the local organizer (`participants[0]` / own `activeParticipant`). Always show the local name for known ids and flag a name mismatch. Show a short diff ("changes 2 of Matt's loves to passes").
- **Acceptance test:** A reply whose participant id is the organizer's is not merged without a second, explicit confirmation. A reply with a known id and a different name shows the local name plus a mismatch warning. On a guest copy the voter can't silently switch to another traveler.

### UFR2-G02: "Send my picks back" is at the bottom of a 25-screen page, and the only hint names a button the friend doesn't have — MISSING STEP
- **Evidence:** OBSERVED (s4 layout measure; G-04, G-06).
- **Location:** `/trips/designer` on a guest copy, phone.
- **Problem:** On a 390x844 phone the page is 21,229 px tall. The "YOU'RE ON MATT'S TRIP" panel with "Send my picks back" starts at 20,840 px, after 6 days of card rows, the live-research panel and "Where you'll stay". Nothing near the top shows that the friend is a guest, how many picks they've made, or that a send-back step exists. The only guidance says: "tap “Invite people” below to let friends vote on their own phones and send their picks back". On a guest copy that button is labelled "Share the trip". Votes are never sent automatically.
- **User impact:** This is the friend's core job and the only way their votes reach the organizer. Many friends will vote and stop, believing Matt can already see their votes.
- **Expected vs actual:** Expected: a persistent guest affordance ("Voting as Sam · 5 picks · Send to Matt"). Actual: a single panel at the very end.
- **Jev:** `UFR2-G-J2` finds_send_back **0.21**, thinks_votes_already_sent **0.51**, understands_send_back **0.47**, completion score **1.17** (mode "likely fails", p 0.64). I agree. This is the single largest reason the handoff will fail in practice.
- **Root cause:** `src/components/designer/TripCanvas.tsx:264` renders `InvitePanel` last. The copy at `TripCanvas.tsx:163` isn't guest-aware. `src/components/designer/TripExtras.tsx:157-176` is the only send-back UI.
- **Recommended change:** On guest copies, show a sticky bottom bar (above the tab bar) with the vote count and "Send my picks to Matt". Make the help text at :163 guest-aware.
- **Acceptance test:** On a 390x844 guest copy, a "Send my picks" control is visible without scrolling after any vote. The help text never names "Invite people" on a guest copy.

### UFR2-G03: The invite link reveals the organizer's music taste, interests and everyone's votes, while the UI says "Music taste stays on your device" — PRIVACY
- **Evidence:** OBSERVED (decoded payload `s2.out.json`; friend phone G-10).
- **Location:** Invite link payload, and the disclosure in the "Bring the crew" panel.
- **Problem:** The disclosure reads: "Anyone with the link can see the plan and who's going (names, kids' ages, home city). Music taste stays on your device." `tripLink` removes only `trip.taste` and `joinedFrom`. Idea cards that are generated from taste keep their blurbs, and those blurbs ride in the link: "Hip-hop nights in Lisbon | Because you listen to hip hop, trap.", "Rock cover bands in Lisbon | 40% of your top songs are from before 2000, and rock is in your mix.", "Piano bars & sing-alongs…". The friend's phone shows "Because you listen to hip hop, trap." (G-10), which also reads as if it is about the friend. The link also carries each traveler's interest tags (Matt: food, music, nightlife) and everyone's existing loves and passes, and the disclosure mentions neither. The kid's exact age (7) is carried, which the disclosure does state.
- **User impact:** The owner's listening profile leaks to anyone the link is forwarded to, which contradicts an explicit promise.
- **Jev:** `UFR2-G-J3` disclosure_adequate score **1.07** (mode "materially incomplete", p 0.75), expects_taste_hidden **0.41**, surprised_by_blurb **0.78**. I agree with "materially incomplete". For the taste line, "misleading" is fair.
- **Root cause:** `src/lib/designer/tripShare.ts:208-213` strips only `taste`/`joinedFrom`. `tripShare.ts:102` keeps `blurb`. `src/lib/designer/place.ts:75-78` bakes taste into the card blurb (`scene.why` from `src/lib/designer/scene.ts:118-123`). The disclosure is at `src/components/designer/TripExtras.tsx:183`.
- **Recommended change:** In `tripLink`, replace taste-derived blurbs (cards from `scenePlaybook`) with neutral copy ("A night out for the group"), or compute `why` at render time from local taste only. Decide whether participant tags need to travel, and strip them if not. Change the disclosure to list names, kids' ages, home city, interests and everyone's votes so far. Remove "Music taste stays on your device" from guest copies, where it's wrong.
- **Acceptance test:** Unit test: `tripLink` for a trip built with `taste` decodes with no card text matching `/listen|top songs|classics/`. The disclosure text lists each category present in the payload.

### UFR2-G04: Every friend's phone auto-fires a research POST, and the server cache is in-memory, so each invitee can cost a paid Treg run — COST EXPOSURE
- **Evidence:** OBSERVED that the request fires: 8 of 8 friend contexts sent `POST /api/designer/research {"name":"Lisbon","region":"Portugal","from":"JFK","to":"LIS","depart":"2026-10-15","nights":5}` on first canvas load. I caught all of them; none reached the server. INFERRED that it would have been paid: the 3127 server started at 05:49, and the place cache is a per-process `Map`. UNKNOWN: an actual server-side hit or miss, which was deliberately not tested.
- **Location:** `DestinationResearch` on a guest copy.
- **Problem:** The friend's device has no `dope.research.v1:` cache, so the panel fetches immediately. The server cache (`placeCache`, 6 h TTL) lives in process memory. After a restart or deploy, or on each serverless instance, the first friend in any window pays roughly $0.055. The per-client cooldown (`consumeProviderCall`) is keyed per client, so N friends get N budgets. Guests also see "Refresh". The brief's claim that "Lisbon is cached" held only for the seeded organizer localStorage, not for the server.
- **User impact:** Paid spend scales with how many people the owner invites, not with how many trips he plans. Friends didn't ask for research.
- **Jev:** JEV NOT EXECUTED (cost question, not a perception question).
- **Root cause:** `src/components/designer/DestinationResearch.tsx:190-216` (auto `load(false)` on mount) and `src/lib/research/destination.ts:90-98` (in-memory `remember`). `src/app/api/designer/research/route.ts:52-54` applies the per-client limit.
- **Recommended change:** On guest copies (`trip.joinedFrom !== undefined`), don't auto-fetch. Show "Tap to load live research", or show nothing, and hide Refresh. Longer term, back the place cache with a shared store (KV) so any instance reuses a run.
- **Acceptance test:** Opening an invite on a device with empty storage makes zero `/api/designer/research` requests until the user taps an explicit control.

### UFR2-G05: A friend who added themselves and reopens the invite is a stranger again; their votes vanish and the organizer gets duplicate, identical travelers — STATE FAILURE
- **Evidence:** OBSERVED (s4 p1; s3 E; G-16, G-14).
- **Problem:** "Priya" joined through "Add yourself" (id `g-muf4ck5b`) and loved a card. She then tapped the invite in the chat again. The list shows only Matt and Sam. Re-adding "Priya" created `g-muf4cnb6`, and her rooftop love disappeared. There was no confirm, because the trip id matches. Separately, two different friends named Priya merge as two travelers with the same 🏂 emoji and color, so the organizer can't tell them apart (G-14).
- **User impact:** Friends lose their votes. The organizer's party count and voting UI get polluted with ghosts. The duplicates also skew the stays party size ("adults" count).
- **Jev:** JEV NOT EXECUTED (mechanics are unambiguous).
- **Root cause:** `src/components/designer/JoinTrip.tsx:98-105` mints a new id every time. `:110` skips the confirm for the same trip. `:117` keeps local votes only when the chosen id exists in the incoming link. `src/lib/designer/itinerary.ts:102-104` `participantStyle(index)` gives the same style to anyone added at the same index.
- **Recommended change:** When `sameTrip` and the local copy is a guest copy, preselect the local `activeParticipant` and include local-only participants in the list ("You're Priya on this phone"). On merge, flag a new participant whose name matches an existing one and offer to combine. Pick the next unused style.
- **Acceptance test:** Reopening the original invite on a phone where you added yourself shows you preselected and keeps your votes. Merging two same-name participants shows a disambiguation prompt.

### UFR2-G06: An older picks link silently overwrites newer picks — STATE FAILURE
- **Evidence:** OBSERVED (s3 E "priya-stale"; G-13).
- **Problem:** Priya sent picks (loved Rooftop), changed her mind, and sent again (passed). Matt merged the newer link, then tapped the older one still in the chat. The page gave the same prompt ("If they voted before, their new picks replace the old ones"), and the result was Rooftop loved again. Replies have no timestamp or sequence number.
- **Jev:** `UFR2-G-J4` stale_order **0.36**. I agree. The copy actively suggests the link is "new".
- **Root cause:** `src/lib/designer/tripShare.ts:19` (`TripReply` has no `at`), `:236-238`, and `:260-273` (wholesale replace).
- **Recommended change:** Add `at` (ISO) to replies and keep `lastMergedAt[participantId]` in the store. If the incoming link is older, say "This is an older picks link from Priya (sent 10:02; you added a newer one from 10:05)" and default to skipping it.
- **Acceptance test:** Merging reply A (t1) after reply B (t2 > t1) doesn't change votes without explicit confirmation.

### UFR2-G07: Joining on a phone that has its own trip permanently deletes it; the warning doesn't say what's lost and there's no undo — RECOVERY FAILURE
- **Evidence:** OBSERVED (s3 A: dialog text captured, own trip `trip-friendown1` and its votes gone after OK).
- **Problem:** The friend's phone held their own Tokyo trip with a partner's votes. Tapping "Join and vote" shows the native confirm "Open this trip? It replaces the trip draft on this device." OK deletes the trip. The app holds one trip, and there's no account, backup or restore. Cancel leaves the friend with no way to vote at all. The warning appears only after they picked a name.
- **Jev:** `UFR2-G-J5` understands_loss **0.37**, presses_ok **0.24**, regret **0.78**. I partly disagree on presses_ok. A friend who came to vote will usually press OK, because the invite page gives no alternative. Either way the outcome is poor: they lose their trip, or they can't vote.
- **Root cause:** `src/components/designer/JoinTrip.tsx:110`. `src/lib/designer/store.ts:78` (`importTrip` overwrites the single `trip` slot).
- **Recommended change:** Keep the replaced trip in a one-slot `previousTrip` with a "Restore my Tokyo trip" control on the designer. Name what will be replaced in the warning ("your Tokyo trip, 2 travelers, 1 vote"). Show the warning on the invite page before the name picker, not as a native dialog after it.
- **Acceptance test:** After joining an invite on a device with an existing trip, the previous trip can be restored with its votes intact.

### UFR2-G08: A truncated or garbled link shows a raw browser exception, and a cut-off picks link says "Failed to fetch" — POOR FEEDBACK
- **Evidence:** OBSERVED (G-17, G-18, s4 broken cases).
- **Problem:** A truncated or garbled invite reads: "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded. It may have been cut off…". A truncated reply reads "Failed to fetch It may have been cut off…" (no punctuation between the two sentences), which suggests a network failure. Long links are exactly what chat apps truncate.
- **Jev:** `UFR2-G-J6` knows_what_to_do **0.83**, thinks_network **0.29**. The trailing sentence saves the invite case. The "Failed to fetch" variant misleads about 3 in 10 people.
- **Root cause:** `src/lib/designer/tripShare.ts:36-38` (`atob` throws DOMException), `:41-44` and `:57-59` (a failed `DecompressionStream` surfaces as `TypeError: Failed to fetch` from `new Response(...)`). `src/components/designer/JoinTrip.tsx:44,67` prints `cause.message` verbatim.
- **Recommended change:** In `unpackPayload`, wrap decode and inflate and map any failure to "This link is incomplete. It was probably cut off when it was copied." Say "Ask Matt to send it again" when `from` is known. Don't show raw messages.
- **Acceptance test:** Invite and reply links truncated at 50% and at length−3 show no string containing `atob`, `Window` or `fetch`.

### UFR2-G09: The merge confirmation counts what the link contains, not what landed; passes count as "picks" — LOGIC FAILURE
- **Evidence:** OBSERVED (s4 crafted reply; s1).
- **Problem:** A reply with 3 votes, one of them for a card no longer in the plan, reports "Sam's 3 picks are in", but only 2 were applied. `mergeReply` drops votes for missing cards with a bare `continue`. In the happy path, "5 votes" / "5 picks are in" included 1 pass. Grammar: "1 votes", "Priya's 1 pick are in".
- **Root cause:** `src/components/designer/JoinTrip.tsx:190,196,205`; `src/lib/designer/tripShare.ts:286`.
- **Recommended change:** Have `mergeReply` return `{ loves, passes, dropped }`. Show "4 loves and 1 pass added. 1 pick was for an idea no longer in your plan." Fix pluralization.
- **Acceptance test:** A crafted reply with one unknown card reports exactly the number applied, plus a dropped count.

### UFR2-G10: The organizer opening his own invite is told "Matt wants you on this trip" and can't open it without picking his name — AMBIGUITY
- **Evidence:** OBSERVED (s4 `own_afterClickNoName`).
- **Problem:** On the organizer's device the button reads "This is your trip. Open it", but tapping it without choosing a chip shows "Tap your name, or add yourself." The headline still invites him to his own trip.
- **Root cause:** `src/components/designer/JoinTrip.tsx:106-115`: the `who` check runs before the same-trip organizer redirect. Headline at `:127`.
- **Recommended change:** Check `sameTrip && current.joinedFrom === undefined` first and redirect. Use the headline "This is your trip."
- **Acceptance test:** On the organizer's device, "This is your trip. Open it" navigates to `/trips/designer` with no chip selected.

### UFR2-G11: A reply for a trip that is gone gives a wrong instruction and no context — POOR FEEDBACK
- **Evidence:** OBSERVED (s3 F, s4 after "New trip"; G-15).
- **Problem:** The copy is the same in every case: "These picks belong to a trip that isn't open on this device. Open them on the phone where you planned the trip." It appears on the device where the trip *was* planned after "New trip", and when the trip was planned on a laptop. The reply carries no place or dates, so the page can't say which trip. Every outstanding reply becomes permanently unusable after "New trip", and the "New trip" confirm doesn't mention that.
- **Root cause:** `src/components/designer/JoinTrip.tsx:208-218`; `src/lib/designer/tripShare.ts:233` (reply carries only `tripId`).
- **Recommended change:** Include `place` and `startDate` in replies ("These are Sam's picks for Lisbon, Oct 15. That trip isn't on this device."). Drop "phone".
- **Acceptance test:** Opening a reply on a device without its trip names the place and dates.

### UFR2-G12: Size check runs after full decompression — EDGE CASE
- **Evidence:** OBSERVED (s4 `bomb`: a 51,899-char link inflating to about 40 MB took 5.2 s on phone emulation before "That trip is too large to open.").
- **Root cause:** `src/lib/designer/tripShare.ts:59-64` inflates fully, then checks `MAX_JSON_CHARS`.
- **Recommended change:** Read the `DecompressionStream` incrementally and abort past 400 KB.
- **Acceptance test:** The same link is rejected in under 300 ms.

## 5. Tables

**Dead ends**
| Where | Trigger | What the user sees | Finding |
|---|---|---|---|
| Invite page on a device with its own trip | Cancel on the replace confirm | Stays on the invite and can't vote without losing their trip | G07 |
| Reply page after "New trip" | Any old reply | Disabled "Add their picks", wrong "open on the phone" advice | G11 |
| Reply page on a new device | Organizer switched devices | Disabled button, no way to import | G11 |

**Ambiguities**
| Text | Why ambiguous | Finding |
|---|---|---|
| "Voting as Matt / Sam" on a guest copy | Reads like a filter; switches identity | G01 |
| "tap “Invite people” below…" on a guest copy | Button is "Share the trip" | G02 |
| "Matt sent their picks." shown to Matt | Doesn't flag self-impersonation | G01 |
| "Because you listen to hip hop, trap." on the friend's phone | Addresses the friend with the organizer's taste | G03 |
| "Sam's 5 picks are in" | Includes passes and dropped votes | G09 |
| "Matt wants you on this trip" shown to Matt | Organizer invited to his own trip | G10 |

**State-machine problems**
| State | Event | Actual | Expected | Finding |
|---|---|---|---|---|
| Guest (self-added) | Reopen original invite | New id, votes lost | Recognised, votes kept | G05 |
| Guest as Sam | Reopen invite, choose Matt | Sam's phone votes dropped silently | Warn | G-T09 |
| Organizer merged reply B | Open older reply A | A overwrites B | Detect stale | G06 |
| Friend with own trip | Join | Own trip deleted | Restorable | G07 |
| Organizer | Reply for removed card | Counted but dropped | Reported as dropped | G09 |

**Permission / privacy problems**
| Data or action | Who can | Should | Finding |
|---|---|---|---|
| Overwrite another traveler's votes | Anyone with the invite (via chip) or the trip id (crafted reply) | Only that traveler, or with organizer confirmation | G01 |
| Organizer's music taste (as card blurbs) | Anyone the invite reaches | Nobody (per UI promise) | G03 |
| Interest tags per traveler, all votes | Anyone the invite reaches | Disclosed, or stripped | G03 |
| Kid's exact age, hometown, names | Anyone the invite reaches | Disclosed (it is) | — (PASS) |
| Paid research run | Every invitee's phone, automatically | Organizer only / explicit | G04 |
| HTML in names | Anyone who crafts a link | Inert (it is) | — (PASS) |

## 6. Repair specs

**PROPOSED CONCEPT - NOT CURRENT APPLICATION: guest action bar (G02, part of G01)**
On a guest copy (`joinedFrom` set), on phones, pin a bar above the bottom tab bar: left, the avatar and "You're Sam on Matt's trip"; centre, "5 picks" (live); right, the primary "Send to Matt". Before the first vote the bar reads "Tap 👍 on what you're into". After sending, it reads "Sent. Vote more and send again anytime." Remove the "Voting as" chip row from guest copies and replace it with a small "Not Sam?" link that goes back to the invite picker with a warning. Change the help text to: "Your votes stay on this phone until you tap Send to Matt."

**PROPOSED CONCEPT - NOT CURRENT APPLICATION: safe merge sheet (G01, G06, G09)**
Replace the reply landing with a sheet: "Picks from **Sam** (on your trip as Sam 🌺) · Lisbon, Oct 15 · sent 10:05". Below it, a diff list: "+4 loves, +1 pass, 1 idea no longer in the plan". Warn in red when the sender id is the organizer ("This link would replace YOUR votes. Only add it if you sent it from another device."), when the name doesn't match the local traveler, or when the link is older than one already added. Primary: "Add Sam's picks". Secondary: "Not now". After adding, show "Undo" for 10 seconds, restoring the previous `votes` snapshot.
