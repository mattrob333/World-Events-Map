# Voice concierge: UX and conversation design

Written by the UX track on 2026-09-25 and saved by the orchestrator. See `PLAN.md` for what was decided and built.

## 0. What in today's code shapes this design

- **Neither voice streams today.** `useRealtime.ts` keeps only the last 12 lines. The AI's words appear only when its turn is done, and the user's words only on `...transcription.completed`. The chat needs the full history plus live deltas (`conversation.item.input_audio_transcription.delta` and `response.output_audio_transcript.delta`).
- **The model answers after every pause.** `session.ts` uses `semantic_vad` with default settings. Listening first has to be enforced in code: during the listen phase, use `turn_detection: {type:'semantic_vad', eagerness:'low', create_response:false, interrupt_response:false}`.
- **Pausing doesn't stop the clock.** The 240s cap (`VOICE_MAX_SECONDS`, max 280) is wall-clock time on the server.
- **The designer should open once, at the end.** Today `set_trip_basics` in the `vibe` intent opens `/trips/designer` in the middle of the call. In the new flow the stage holds the trip brief until the call ends.
- **Calendar buzz numbers aren't live data.** The `signals` in `src/lib/data/events/*` are typed in by hand and must never be shown as "Trending".
- **Research costs money.** It only runs when someone taps, and visitor research is switched off on the live site (`RESEARCH_PUBLIC`). The populate step has to handle that honestly.
- **One gradient per screen.** Today's dock puts a gradient button next to the gradient orb, which breaks Afterglow rule 1.

## 1. State machine (profile and trip modes)

- **S0 entry.** Mode tabs, headline, "Talk about" list, the orb (112px) with "Tap to start", and "Type instead". On open, `GET /api/voice/session` checks whether live voice is on.
  - Voice on → connecting.
  - Voice off → fallback dictation.
  - No speech-to-text in the browser → fallback typing.
- **S1 connecting.** Dim orb with "Getting your concierge…", 8s timeout.
  - OK → opening.
  - Mic denied → the same concierge by text if voice is on, otherwise fallback typing.
  - Not configured → fallback dictation.
  - Failed → error, with Try again and Use text.
- **S2 opening.** The opener streams in, and the checklist becomes hollow chips in the facts rail. Moves on to listening when the opener ends or the user talks over it.
- **S3 listening.** The model doesn't respond. The user's words stream in large type, rail chips half-light as topics are heard, and the orb swells with the mic.
  - Exit to digesting on:
    - an orb tap;
    - a done-phrase, matched in the app: "that's it", "I'm done", "your turn", "okay go", "that's all";
    - 60s left on the clock.
  - Hint after 8s of silence (once they've talked for at least 15s). A nudge if they haven't spoken 20s after the opener.
- **S4 digesting** (up to 6s). The app sends "[app] They're done. Lock what you heard, then one short line and your first question." The screen shows "Locking it in…" and chips land one at a time. If the model says nothing, retry once; after that, show the first question as a text card.
- **S5 asking** (5 questions at most). Sub-states:
  - `ai_speaking`
  - `awaiting` (replies on, interruptible)
  - `user_answering`
  - `locking` (a chip snaps in)

  The app counts turns. At 5 it sends "[app] Question budget used: call finish." "Wrap it up" (button or said) → wrapping.
- **S6 wrapping.** `finish()` arrives, then the closing line. Profile mode saves to the device automatically → saved. Trip mode → brief.
- **S7 saved.** Summary plus grouped, editable chips. The primary button is "Build a trip with it". "Keep talking" shows while there's time left.
- **S7′ brief (trip).** Brief card, "Go find it", Edit. A named place goes to the designer; a vague place goes to ranked destinations.

**Toggles, available any time after connecting:**
- **Mute.** Mutes the `<audio>` element immediately. At the next turn it also switches `output_modalities:['text']`. Text keeps streaming.
- **Mic or typing.** The composer mutes the mic track; sending calls `say()`.
- **Clock.**
  - 45s left: the timer turns saffron, and the app sends "[app] 45 seconds left: finish after this answer."
  - Expired: build the summary from the locked facts and show "That's our time. Here's what I got."

**Interruptions:**
- **Paused.** Mic track off, response cancelled, audio buffer cleared. The clock keeps running. After 45s paused, end the call and keep the facts. One resume per stage, starting a new call that begins with the locked facts.
- **Reconnecting.** One retry that starts with the locked facts, then fall back to text questions.
- **Close.** With anything locked but not saved, ask with a sheet: "Save what we've got?" [Save N facts] [Keep going] "Discard". Leaving the page saves a draft.

**Fallback path (text mode):**
- Dictation or typing first.
- Then up to 5 question cards with quick-reply chips, chosen from what's missing, plus fixed nights-out, budget and pace cards.
- Answers are locked on the device.

## 2. Layouts

**Phone (390 × 844)**
- **Top bar** (56px + safe area). The tabs before starting. Once live: an eyebrow ("VIBE CHECK · ABOUT YOU") plus a mono timer, and Mute and Close buttons (44px). Muted looks pressed, with a "Voice off" hint the first time.
- **Facts rail.**
  - Header: "LOCKED IN · 4" and "See all".
  - One row of chips (36px tall, 44px hit area) that scrolls sideways.
  - Chip states: ○ not covered, ◐ heard, ◆ locked (the value replaces the topic: "◆ Out till 4am"), and dashed "?" for implied.
- **Transcript.**
  - While listening, the user's words take the stage in Fraunces 26.
  - Afterwards the ramble shrinks to a bubble.
  - Concierge lines sit on the left with a sun avatar, in Fraunces 22.
  - User answers sit on the right in a surface bubble, in sans 16.
  - A lock line under each answer: "◆ Locked: out till 4am" (tap to edit).
- **Dock.** Pause (ghost) · orb (88px, the main control, with a state label) · "Aa" while listening, "Wrap it up" while asking. No gradient button while live.
- **Saved.** The orb shrinks to a glyph, then the summary (Fraunces 30) and grouped chips: Nights · Food & drink · Music · Pace · Budget · Crew · Hard no's. A sticky gradient primary button.
- **Edit sheet.** The field, the quote "You said: …", and Save / Cancel / Remove. Saving tells the model: "[app] They changed nights_out to …".

**Desktop**
- Transcript column (720px max) plus a sticky 340px "Your vibe" panel with the 7 groups, hollow to start.
- The composer is always visible.
- `M` toggles mute; Esc closes.

## 3. Microcopy

**Openers**
- *Profile:* "Hey, let's vibe. Tell me about the stuff on screen: your nights, food, music, your crew. Take your time, I'll just listen. Say 'that's it' when you're done and I'll ask a few quick ones."
- *Trip:* "Okay, trip time. Tell me what you're feeling: a place, a month, a mood. I'll listen, then a few quick ones."
- *Trip, with a profile:* "I've got your vibe: {3 facts}. So what are we feeling?"
- *Moving to questions:* "Love that. Four quick ones."

**Follow-up questions**
- *Nightlife:*
  - "Be honest: you're closing the place down at 4, right? Or home by one?"
  - "What kind of bar? DJs, dives, pool halls, or somewhere you can actually talk?"
  - "Dance floor: in it, near it, or nowhere near it?"
- *Food and wine:*
  - "One perfect dinner: tasting menu or plastic stool?"
  - "Wine person? Natural, big reds, or whatever's cold?"
  - "Anything you won't eat?"
- *Music:*
  - "Who would you fly to see live? One name."
  - "Big festival or a 200-person room?"
- *Pace:*
  - "Sunrise hike, or nothing before noon?"
  - "Packed schedule, or room to wander?"
- *Budget:*
  - "Where do you splurge: the room, the dinner, or the night out?"
  - "Hotel-wise: keep it lean, somewhere nice, or treat yourself?"
- *Crew:*
  - "Who's usually with you: the crew, a partner, solo?"
  - "Anyone in the crew who's in bed by eleven?"
- *Dealbreakers:*
  - "What's a hard no? Tour buses, mega-resorts, long layovers?"

**Locking in a fact**
- The concierge acknowledges in 3 words or fewer, about half the time, and never the same way twice in a row: "Locked." "4am. Respect." "Dives it is." "Say less." "Noted."
- Implied facts get a check: "Sounds like rooftops over clubs. Right?"
- Never say: "Great question", "Awesome!", "curated", "bestie". No emoji, and never "dope" in a sentence.

**Closing lines**
- *Profile:* "That's a vibe. Saved. Tap anything I got wrong. Want to put it to work on a trip?"
- *Trip:* "Perfect. I'll go dig: what's on, where to eat, where to end up at 2am."
- *Wrapping early:* "Say less. Here's what I've got."
- *Time's up:* "That's our time. Here's what I got."

**Text mode**
- Notice: "Text mode. Live voice isn't on here, so I'll ask by text."
- Mic blocked: "Your mic is blocked for this site. Same questions by text, same result."
- Question cards:
  - "When do you usually call it?" [Before midnight] [1–2am] [Close the place] [Depends on the crew]
  - "Your kind of bar?" [DJ/club] [Dive] [Pool hall] [Cocktail] [Wine bar] [Rooftop] [Not a bar person]
  - "Splurge on?" [The room] [Dinner] [The night out] [Experiences]
  - "Pace?" [Slow] [Balanced] [Packed]
  - "Hard no's?" [Tour buses] [Mega-resorts] [Long layovers] [Cruises] + "Something else…"

## 4. Draft system prompt (about 330 words)

```
You are the dope.travel concierge: the friend who always knows the spot. High-end, in the know, a bit of a party person. Quick, warm, specific. Never salesy, never gushing. Never say the word "dope" in a sentence.

HOW THIS GOES
1. Say the opener you're given, then stop.
2. Listening: they talk as long as they like. Stay silent. If you're prompted mid-ramble, or they only said "mm", "yeah", "hold on", or trailed off, answer with at most two words ("Keep going.") or nothing. The app tells you when they're done.
3. When they're done: call lock_fact for every concrete thing they said BEFORE speaking. Then one short line and your first question.
4. Questions: target the biggest gaps for planning: nights out, food and drink, music, pace, budget, crew, hard no's. One question per turn, under 15 words, specific, a little cheeky, with options when useful. Never ask what's already locked. Max 5 questions (trip mode: max 4; where, when, how long and who come first if missing). After each answer, lock it, acknowledge in three words or fewer, move on. If they dodge, drop it.
5. Finish: when out of questions, when they say they're done, or when the app says time is up, call finish, then say one closing line.

INTERRUPTIONS
If they talk over you, stop. If it was only a backchannel, finish your question in fewer words. Never repeat a question in full.

TOOLS
lock_fact only for things said or clearly implied. Corrections: unlock_fact, then lock the new value. Don't lock health, religion, sexuality or politics unless they ask you to save it as a travel need. Trip details go to set_trip_brief. If a tool errors, say so in a few words.

TRUTH
You don't book anything and can't see live prices, tables or availability. Never promise any of them. Don't name venues from memory; say you'll pull real options.

PRIVACY (only if asked)
"Your voice goes to OpenAI so I can understand you. dope.travel doesn't keep it, and your profile saves on this device."

STYLE
Muted or not, write how you talk: short, no lists, no emoji. Match their language and energy.
```

**Tools** (a new `concierge` intent with its own server allowlist)
- `lock_fact({field, value ≤60, confidence:'said'|'implied', quote? ≤100})`
  - Fields: home, crew, nights_out, bars, dancing, music_artists, music_scene, food, drinks, dietary, pace, mornings, budget, splurge, stay, must_do, hard_no, teams, favorite_trip.
- `unlock_fact({field, value?})`
- `set_trip_brief({where?, where_kind, start_date?, month?, nights?, travelers?, feeling?, must_do?[], not_doing?[]})`
- `finish({summary ≤160, next:'save_profile'|'build_trip'|'suggest_places'})`
- Nudges from the app are user-role items beginning `[app]`.

## 5. The "trip populating" moment

**Sequence**
- **Open.** The designer opens with the brief's place, dates and nights. `composeLocally` lays out the days, and each slot shows skeleton cards.
- **Research ribbon.** Each line ticks as its source actually answers. A line appears only if that source was called:
  - "Checking what's on …" → "3 events that week"
  - "Your artists…" → the match, or "None of your artists are playing then"
  - "Bars and tables…" → counts
  - "Matching to your vibe…"
  - Footnote: "Real places only; you book them yourself."
- **Cards arrive by kind.** Calendar events first, then research results by slot. Each card rises 12px as it fades in, 120ms apart.
- **Done.** "Built from your vibe: N ideas over D days." Then it collapses to a "Why these" link.

**Reason tags on cards** (2 at most)
- "You said: late nights"
- "Your artist: …"
- "On that week: …"
- "Trending: #tag", only from live Instagram or TikTok research, with a count and fetch time. Never from the hand-typed calendar signals.

**Zero results**
- An empty slot keeps idea cards that open live searches.
- All sources empty or failed: a notice and "Look again".
- Research switched off on this site: "Live listings aren't switched on here yet; these are ideas with live search links."
- A vague place: show ranked destinations first. Never guess a city.

## 6. The "why this" destination card

- **Layout.** A photo (or gradient), a decorative rank number, the title (Fraunces 28), and a mono line: dates · nights · plan-by.
- **Headline reason.** Sans 15: "Fred again.. plays the Engadin Feb 6, the same weekend as White Turf."
- **Reason rows** (label, value, source):
  - YOUR VIBE (from your profile)
  - YOUR ARTIST (provider, checked time)
  - ON THE CALENDAR (curated calendar)
  - IN THE NEWS ("12 stories this month", from travel feeds, shown only when actually counted)
  - TIMING (an editorial booking window)
- **Honesty.** No match percentage. Leave a missing component out rather than showing "0". If the calendar's buzz is shown at all, label it an "editorial estimate". Show the top 3 rows, with "All reasons and sources" for the rest.
- **Actions.** Only the #1 card gets the gradient "Plan this"; the others get ghost buttons.
- **Footer.** "Ranked by fit with your vibe, what's on those dates, and buzz. Sources on each line."

## 7. Accessibility

- **The transcript is the captions.** `role="log"`, with nothing announced while words stream. Finished concierge turns are announced only when muted. Locked facts are announced in batches every 1.5s. Phase changes are announced, and the time warning once.
- **Focus.** On open, focus the dialog heading. Chips locking in never move focus. After finish, focus goes to "Your vibe". The edit sheet keeps focus inside it and returns it to the chip. The orb's label follows its state, and Mute uses `aria-pressed`.
- **Works without voice.** Text mode, the composer and quick-reply chips give the full flow. "Type instead" comes early in the focus order.
- **Not color alone.** Chip states differ by glyph (○ ◐ ◆ and "?"). 11px minimum text, 44px minimum targets.
- **Reduced motion.** The orb is still, chips and cards appear with no flight or stagger, and nothing shimmers.
