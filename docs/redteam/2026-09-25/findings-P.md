# Findings, persona P: mobile, tablet, keyboard and screen reader

Build `main` @ `b14f948`, `next start` :3127, 2026-09-25. Phone 390×844, small phone 360×740, tablet 820×1180 (touch), desktop 1440×900 keyboard-only. `noPaidResearch` on every context. Screenshots `artifacts/P-*.jpg`. (Saved by the orchestrator from the tester's returned text; condensed.)

## 1. Persona, job, entry, end state
Phone-first traveler who also uses a hardware keyboard and a screen reader. Browse every route on any device, open the Vibe stage and search, set a location, build the Lisbon trip and use Pick your winners without a mouse. Nothing hidden, trapped or lost.

## 2. Flow maps
- F1 route sweep (11 routes × 4 devices): **PASS** (no overflow; worst CLS 0.079 desktop `/now`).
- F2 phone home footer: **FAIL** (vibe card covers it, P09).
- F3 keyboard header: **PASS**.
- F4 location picker Esc: **PARTIAL** (focus to body, P05).
- F5 palette: **FAIL** (P04).
- F6 Vibe stage keyboard: **FAIL** (no trap/restore, P03).
- F7 stage by voice on phone: **PASS** layout (live region noisy P07; Esc loses the talk P06).
- F8 Lisbon canvas deck: **FAIL** (card covers Keep/Pass/Done, P01; arrows from anywhere, P02).
- F9 reduced motion: **PASS**.
- F10 tablet keyboard: **FAIL** (focus under the tab bar, P08).

## 3. Key results
PASS: no overflow anywhere; CLS < 0.1 everywhere; no app console errors; dialogs and icon buttons named; images alt; reduced motion static; home idle live regions quiet; stage fits 360-wide phones; calendar toggle `aria-expanded`.
FAIL: deck buttons covered; arrow keys from tabs/selects; stage and palette focus trap/restore; picker Esc focus; Esc mid-talk loses the transcript; transcript live region floods (16 mutations / 3.5 s); focus under tab bar on tablet; home footer under the vibe card; `/agents` no h1; 404 has no home link.

## 4. Findings
- **UFR3-P01 BLOCKER (OBSERVED):** deck card covers Keep, Pass, Done and the "fit check unavailable" line on every device. CSS module class collision `designer.module.css:1103-1111` vs `:1616-1626`. (Same as UFR3-O01.)
- **UFR3-P02 LOGIC / A11Y (OBSERVED):** window arrow-key handler keeps/passes cards from focused research tabs and `<select>`. `PicksBasket.tsx:109-118`. (Same as UFR3-O05.)
- **UFR3-P03 A11Y (OBSERVED):** Vibe stage: no focus trap, page behind not inert, focus not returned to the sun. `SunModal.tsx:145-153`, `AppShell.tsx:296`.
- **UFR3-P04 A11Y (OBSERVED):** command palette: no trap, no restore, no listbox semantics or arrow keys, Close 36px tall. `CommandPalette.tsx:43-45, 97-114`.
- **UFR3-P05 A11Y (OBSERVED Esc / INFERRED pick):** location picker drops focus to body. `LocationPicker.tsx`.
- **UFR3-P06 RECOVERY FAILURE (OBSERVED):** Escape or ✕ while talking discards the transcript. `SunModal.tsx:146`.
- **UFR3-P07 A11Y (OBSERVED):** transcript wrapped in `aria-live="polite"` re-announces the growing text. `SunModal.tsx:392`.
- **UFR3-P08 A11Y (OBSERVED):** focused fields land under the fixed tab bar / vibe card on tablet and phone. Fix: `scroll-padding-bottom`.
- **UFR3-P09 VISUAL REGRESSION (OBSERVED):** at max scroll on a phone, "Partner with us" and the disclaimer sit under the vibe card. `AppShell.tsx:216`.
- **UFR3-P10 EDGE CASE (OBSERVED):** vertical scroll gesture leaves the deck card tilted (no pointercancel). (Same as UFR3-O12.)
- **UFR3-P11 A11Y (OBSERVED):** research and stage tabs use `role=tab` without the tab pattern.
- **UFR3-P12 UX FRICTION (OBSERVED):** tablet calendar bars 21px, globe toggles 24px, chips 36px.
- **UFR3-P13 POLISH (OBSERVED):** `/agents` has no h1; 404 page has no home link; calendar toggle lacks `aria-controls`; mobile More uses `role=menu` without menu keys; 11px deck hint.
- **UFR3-P14 POLISH (watch):** desktop `/now` CLS 0.079 once.

## 5. Top 5
1. P01 deck card covers the buttons.
2. P02 global arrow keys.
3. P03/P04 stage and palette focus trap and restore.
4. P08/P09 tab bar and vibe card hide focus and the footer.
5. P06/P07 Esc mid-talk loses words; transcript floods screen readers.
