# UserFlow Red Team, third pass: report (2026-09-25)

Build under test: `main` @ `b14f948` (production build, no paid keys, research served from a Lisbon fixture). Six testers ran in parallel. Their findings are in `findings-L.md` … `findings-Q.md`, and the screenshots are in `artifacts/`.

| Persona | Focus | Findings |
|---|---|---|
| L | First visit to the home page | 13 |
| M | Setting your vibe by voice | 12 |
| N | Asking for a trip and planning it | 12 |
| O | Basket, deck, scheduler, OpenTable | 14 |
| P | Mobile, tablet, keyboard, screen reader | 14 |
| Q | Hostile input, honesty, 09-24 retest | 15 |

## What held up

- **No injection.** Markup and script were inert everywhere: the Vibe transcript, the location picker, search, designer URL parameters and basket names.
- **API guards.** Origin and fetch-site checks, content type, size caps and garbage JSON were all handled. The limiter can't be spoofed with forwarded-IP headers.
- **No research on page load** (09-24 cluster A). Research runs only when someone taps "Look around".
- **Share links** (09-24 cluster B) are hardened in code; `tripShare.test.ts` has 17 of 17 tests passing.
- **Layout.** Nothing scrolls sideways on any route or device. The first-visit layout shift is under 0.1. Reduced motion is respected.
- **Honesty.** The calendar labels its plan-by dates as editorial booking windows. Stays links carry the right dates and party. Invite links carry only what they say they do.

## Clusters and what was fixed

### A. The deck's Keep, Pass and Done buttons were covered (BLOCKER: O01, P01, Q05)
- **Problem:** the basket reused the `.deck`, `.deckCard` and `.deckDone` CSS module classes from the itinerary swipe deck. The card sat on top of its own buttons and hid the "ranked by rating" note, and the itinerary deck's styling was affected too.
- **Fixed:** the basket now uses its own `pick*` classes. Verified in a browser at 390 and 1440 wide: the Keep button is on top, a click moves the count on, and the rating note shows.

### B. The deck and its keyboard controls (O05–O07, O12, O13, P02, P10, Q14)
- **Arrow keys:** they now act only while the deck is on screen. They are ignored in inputs, selects, tabs, open dialogs and with modifier keys.
- **Links and drags:** the source link on a card is clickable again. A cancelled drag resets the card.
- **Saving:** the deck's order, position, keeps, passes, pace and phase are saved per trip and restored once. A research refresh no longer throws you out of the deck. Reloading after "Fit into my days" brings the schedule back.
- **Start over:** it asks before clearing keeps and reuses the last ranking instead of calling again.

### C. The day scheduler (O02–O04, O09, O11, O14)
- **Real trip days:** days are planned from the itinerary's full days, and arrival and departure days are left for travel. A one-night trip starts mid-afternoon.
- **Travel from the hotel area:** a stand-in for where you stay (the median of the listings) means the first stop of each day counts its travel. Sintra now shows 80 minutes.
- **Kids:** when kids are coming, clubs go to the back of the deck, carry an "Adults only?" chip and stay out of the day plan, with a note saying so. A block that runs past midnight shows "(+1)".
- **Pace:** if the picks come out the same at every pace, the page says so.
- **Honest times:** travel to a place with no location reads "Travel time unknown". A single listing explains why there's nothing to choose between. Activities use 🧭 instead of 🏄.

### D. Understanding trip requests (N01–N05, N07, N11, Q01, Q02, Q11)
- **Questions aren't places.** Requests that start with a question or an ask, like "where's the best surf town", "Surprise me" or "I don't know yet", are never read as place names, so spoken requests for a recommendation get recommendations.
- **Speech without commas.** A place is found at the start of an unpunctuated sentence ("Lisbon second week of October me and Sam…"), or at the end after answering a follow-up.
- **Dates carry over.** Dates and trip length that were said ("second week of October", "a week in February") are carried to the designer as `start` and `nights`. "Plan this" on an event carries the event's dates.
- **Months.** A month that was named filters recommendations to trips in that month.
- **Warm trips.** Words like "warm", "hot" and "sunny" mean a beach trip. The nightlife match no longer catches a ski event tagged `eagle-club`.
- **Rules disclosed.** When simple word rules made the decision, the stage says so. Recommendations are headed "Ideas from our calendar", show the year when it isn't this year, and old results are cleared on each new request.
- **Checklist honesty.** "Where" only ticks when a place was really found. "Not doing" doesn't tick for "I don't know yet". "How you eat" ticks only when the food was captured, and omakase, taco trucks, tasting menus and similar are now captured.

### E. The trip designer (N03, N06)
- It reads `start` and `nights` from the link.
- A new `?place=` that arrives while the designer is already open now takes effect. With a trip in progress, you get the Keep/Replace choice instead of silently losing the request.

### F. The Vibe stage (M01, M02, M04, M06–M11, P03, P06, P07, Q15)
- **Build my vibe:** it saves the board on this device and scrolls to it, so the header reads "Vibe" right away.
- **Pause:** pausing no longer duplicates or drops words. The session's words show as final immediately, the browser's last result replaces them rather than adding to them, and events from stale recognizers are ignored. Verified with a fake that mimics Chrome's final result after stop.
- **Closing:** leaving the page (Back or a link) closes the stage and stops the microphone. Escape or ✕ while talking stops and shows the recap. With words on screen, it asks before throwing them away.
- **Keyboard and screen readers:** focus is trapped inside the stage, the page behind is inert, and focus returns to whatever opened it. The transcript is no longer a live region; a quiet status says "N of 5 covered". Tabs are linked to their panel.
- **Copy:** "Type instead" replaces "Type instead like a caveman". The typing limit matches the mood board (6,000 characters). Notes clear when you edit, and they point at "the box" rather than "below".

### G. Privacy and honesty copy (M05, N09, Q03, Q04, Q06, Q07, Q13, O10)
- **Trip tab:** it now says dope.travel reads the text to work out the route and may ask a decision model. The speech-service sentence shows only if speech was used.
- **Profile tab:** it now says the board and what you said are saved on this device.
- **Mood board badge:** "Sorted on this device" (which wasn't true) is now "Sorted by simple rules".
- **Ranking:** "Rank for my crew" sends who's coming as "2 adults, kids aged 8 and 12" (no names), plus food and interest likes only (no music, teams or free text), with a visible line saying so.
- **"You said":** likes match as whole words ("Art" no longer matches a barbershop) and read "Matches your likes: …".
- **OpenTable:** "Reserve on OpenTable" is now "Find a table on OpenTable". There's a visible "doesn't book" line. Bakeries, cafés, food halls and breakfast get no table link, and the search term keeps the city when a name is long.
- **Affiliates:** a commission disclosure appears next to partner links once any affiliate ID is set.

### H. Cost and safety (Q08–Q10, Q12)
- **Jev cost:** without `TYPESAFE_API_KEY`, route-trip and basket skip Jev, its limiter and its receipts entirely, and say "isn't connected". With a key, they also charge the daily `jev` budget.
- **Research links:** research payloads (fresh or cached) are re-checked on the device. Only https links on provider hosts are kept, and direction-flipping and invisible characters are stripped from names. The basket strips them on the server as well.
- **Cron:** an unauthenticated request gets 401 whether or not `CRON_SECRET` is set, so outsiders can't tell which deployments run the scheduler.

### I. Home and shell (L01–L08, L10, P04, P05, P08, P09, P13)
- **Set your vibe prompt:** it sits bottom-right on desktop, clear of the hero's call to action. `#main` gets extra bottom padding while it shows, so the phone footer is reachable. Scroll padding keeps focused fields clear of the tab bar.
- **Calendar layout shift:** an inline script applies the stored open/closed choice before first paint. Measured CLS is 0.001 on desktop and 0.000 on phone.
- **Calendar counts:** they come from every event in view, and the calendar never says "Nothing on the calendar" above a drawn marker.
- **Hero card:** it follows `?journey=` and calendar picks ("YOUR SELECTED JOURNEY"). With a location, something on now or within two weeks inside 150 km is featured as "NEAR YOU". Phones show the event name and timing under the button.
- **Location picker:** Escape no longer clears the journey and returns focus to the pill. Picking a city also returns focus, the arrow keys move through the list, and the query resets. A dismissed permission prompt is no longer reported as "blocked".
- **Search palette:** focus is trapped and restored, the arrow keys move through results, the result count is announced, and Close is 44px tall.
- **Pages:** `/agents` has an h1, and there's a real 404 page with ways back.

## Still open (not fixed in this pass)

- **The research daily budget is per-instance memory** (09-24 cluster A). A durable reserve/settle store is still needed before a public launch. This needs a migration and a high-capability review.
- **N03, partly:** companions said aloud ("me and Sam") aren't carried to the designer; only the place and dates are.
- **N08:** a 7-night itinerary repeats generic cards ("Lisbon's food market" ×14), and vote buttons share labels.
- **N10:** a country (Japan) is planned as a city, with no prompt to pick a base city.
- **L09:** a deep-linked event's globe isn't centred on the event after scrolling to it.
- **L11:** the departure board uses its own timing words instead of `whyNow`.
- **L12:** short calendar bars truncate the event name, and scrolled phone rows lose their labels.
- **P11:** the research tabs don't implement the full tab pattern (arrow keys, `aria-controls`).
- **P12:** some touch targets are under 44px: calendar bars on tablets, globe toggles and filter chips.
- **P14:** desktop `/now` shifted once by 0.079.
- **O14, partly:** lunch is never scheduled.
- **O13, partly:** basket keys for abandoned trips aren't pruned.
- **M12:** covered by the stale-recognizer guard. No unit test yet, because the repo has no DOM test environment.

## Verification

- `npm run gate` passes.
- **New tests:**
  - partner search terms and table eligibility, and the affiliate disclosure;
  - basket plan window, lodging stand-in, crew summary and family order;
  - scheduler flagging travel it can't know;
  - whole-word likes;
  - router regressions: spoken questions, speech without commas, carried dates, month filter, warm trips;
  - client research safety;
  - cron 401.
- **Browser checks** against the rebuilt production server, with no paid keys:
  - the deck's buttons, keyboard handling and saving;
  - the payload without names, and the arrival day skipped;
  - the nightclub held back, and the schedule surviving a reload;
  - the router cases and the month filter;
  - Escape while talking, and pausing without duplicated words;
  - Build my vibe saving and scrolling to the board;
  - the hero call to action clear of the prompt, and the hero following `?journey=`;
  - Escape in the location picker;
  - calendar CLS on desktop and phone;
  - the phone footer clear of the prompt.

**Note on paid calls:** this container's environment has `TYPESAFE_API_KEY`, `TREG_TOKEN` and `OPENAI_API_KEY` set. The first browser verification run started the server with them, so a small number of Jev requests (about 8: route-trip and basket) went out before this was noticed. No Treg research request was made (research was served from the fixture). An OpenAI voice session was most likely not created either: the stage asks for the microphone before it asks for a session, and the headless browser has no microphone. That wasn't confirmed from logs. The server was then restarted without those keys for every later run.
