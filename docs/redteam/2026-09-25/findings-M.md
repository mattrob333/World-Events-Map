# Findings, persona M: setting a vibe by voice

Build `main` @ `b14f948`, `next start` :3127, 2026-09-25. Phone 390×844 first, then desktop. `noPaidResearch` on every context. Screenshots `artifacts/M-01` … `M-12`. (Saved by the orchestrator from the tester's returned text; condensed.)

**Harness notes.** `__NO_SPEECH` alone doesn't simulate an unsupported browser in headless Chromium (native `webkitSpeechRecognition` exists); clear it in an init script. The shared fake's `stop()` sends no final result; real Chrome does. A Chrome-faithful fake (`rt3/M/chromestop.js`) exposes UFR3-M02.

## 1. Persona, job, entry, end state
No profile yet, prefers talking. Open Set your vibe, talk, see it understood, fix a mistake, build, save, and see the site recognize them (header "Vibe", prompt gone, reopen defaults to "A trip").

## 2. Flow maps
- F1 voice happy path (phone): **PARTIAL.** After Build, lands at the top of the ramble form; board off-screen, not saved (M01). Food dropped (M03).
- F2 desktop: **PARTIAL** (same).
- F3 header sun from /trips, /now, then Build: **PASS.**
- F4 typing path: **PASS.**
- F5 denied mic: **PASS** (copy nit M11).
- F6 unsupported browser: **PASS** (footnote nit M11).
- F7 Pause / I'm done mid-sentence: **FAIL** (M02).
- F8 ✕ and Esc mid-talk: **PASS**; browser Back: **FAIL** (M04).
- F9 Build without saving, go home: **FAIL** (M01, M06).

## 3. Key results
PASS: prompt opens stage; intro fits above dock; interim vs final styling; checklist ticks; recap edit updates facts; Keep talking appends without duplication; save → header "Vibe" and prompt hidden; reopen → "A trip"; empty and short input handled; long speech autoscrolls; tabs disabled while talking; ✕/Esc abort recognition; body scroll lock released; open from other pages works; no console errors.
FAIL: food examples not captured; pause mid-sentence duplicates/drops words; Build lands on the form with the board unsaved; Back leaves the stage listening; 4,000-char silent cut; focus trap/restore; chatty live region.

## 4. Findings
- **UFR3-M01 DEAD END (OBSERVED):** after Build my vibe, `/moodboard` opens at the top of the input form; the board is below the fold and "Save my board" ~3,300 px down on phone. Without Save, profiles = 0. Root: `SunModal.tsx:243-249`, `MoodboardStudio.tsx:342-350, 570`. Fix: scroll to and focus the board; save automatically or show a sticky save.
- **UFR3-M02 LOGIC FAILURE (OBSERVED with Chrome-faithful fake):** `stop()` commits synchronously; Chrome's post-stop final result then re-appends the session (duplicate words), or interim words are lost. Root: `useLiveTranscript.ts:51-59, 115-120`. Fix: commit only in `onend`; late final replaces the session; promote interim if no final.
- **UFR3-M03 LOGIC FAILURE (OBSERVED):** "omakase", "taco trucks", "tasting menus" tick "How you eat" but never reach recap or board. `profile.ts:131-137` FOOD map vs `vibeChecklist.ts`. Fix: extend FOOD; tick the chip from parsed food.
- **UFR3-M04 STATE FAILURE (OBSERVED):** browser Back while talking leaves the stage open, mic listening, body scroll locked. `SunModal.tsx:145-155`. Fix: close on pathname change.
- **UFR3-M05 HONESTY / PRIVACY (OBSERVED + CODE-REVIEW):** badge "Sorted on this device" although the transcript was POSTed to `/api/designer/profile`; footnote doesn't name the AI processors when keys are on; raw ramble persists in localStorage (`draftRamble`). Root: `profile/route.ts:34`, `MoodboardStudio.tsx:486,514`, `SunModal.tsx:473`, `store.ts:238`.
- **UFR3-M06 STATE FAILURE (OBSERVED):** build-without-save leaves "no profile" state; reopening starts empty.
- **UFR3-M07 A11Y (OBSERVED):** stage has no focus trap or restore; page behind not inert. (Same as UFR3-P03.)
- **UFR3-M08 A11Y (OBSERVED DOM):** `aria-live` wraps the whole transcript including interim. (Same as UFR3-P07.)
- **UFR3-M09 A11Y / POLISH (OBSERVED):** tabs have no tabpanel.
- **UFR3-M10 EDGE CASE (OBSERVED):** typed text silently cut at 4,000 chars; moodboard allows 6,000 (`MAX_RAMBLE_CHARS`).
- **UFR3-M11 POLISH / HONESTY (OBSERVED):** denied-mic note says "type it below" but the box is above; unsupported-browser footnote still mentions Chrome speech; short-input note persists after editing; textarea focus ring clipped.
- **UFR3-M12 EDGE CASE (CODE-REVIEW):** an aborted recognizer's late `onend` can restart the old instance. Fix: ignore events from a stale recognizer.

## 5. Top 5
1. M01/M06 show and save the board after Build.
2. M02 pause/done duplicate or drop words.
3. M05 "Sorted on this device" untrue; footnote omits processors; ramble persists.
4. M04 Back leaves the mic listening.
5. M03 suggested foods never captured.
