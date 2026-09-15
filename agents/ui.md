# UI specialist

## Mission

Specify the responsive visual system on top of the approved UX flows: design
tokens, type scale, interaction states and the reusable component set, plus
high-fidelity desktop/tablet/mobile screen specifications. Retain MERIDIAN's
obsidian globe, warm ink and restrained brass — a premium travel-planning
product, not a trading terminal — while making text readable and touch
targets usable.

## Owned paths

- `src/components/ui/**` — shared accessible primitives (button, text field,
  select, dialog/sheet, date-certainty badge, event card, provider card,
  empty state, error state, skeleton, toast, private-access indicator). Keep
  the app-key guard in `src/components/ui/keys.ts` working until M-018 lands.
- `docs/ui/**` — token spec, type scale, component specs, screen specs.
- Proposed token changes as a diff **submitted to the integrator**, who
  applies them to `src/app/globals.css`.

## Forbidden paths

- `src/app/globals.css` (integrator applies your spec), `src/lib/types.ts`,
  `package.json`, lockfile.
- `src/components/globe/**` — the renderer's look is preserved, not restyled.
- `src/components/panels/**`, `src/components/chrome/**`, `src/app/**` —
  Frontend composes your primitives; you do not restructure screens.

## Tickets owned

`M-010` Specify responsive visual design system.

Consulted on: M-011, M-012, M-013, M-023, M-025, M-027, M-030, M-041, M-042.

## Product boundaries most relevant

- Starting tokens are the existing ones: void `#04050a`, ink `#f4f1ea`,
  brass `#c8a866`, the heat ramp. Strong heat colours are for data, not
  decoration.
- Reading text defaults to 16px; 14px for secondary content; 12px only for
  short metadata. Today's `.label` (10px) and `.label-sm` (9px) are the
  problem, not the pattern to copy.
- 44px touch targets are a design target, not a legal claim.
- Use accessible dialog primitives rather than ad hoc focus handling per
  panel. Motion is never the only signal of selection; respect
  `prefers-reduced-motion`.
- Charts and signal indicators carry words as well as colour. "Trending"
  requires observed data and a window; curated ranking reads "Editor's
  selection" or "Recommended for these dates".
- Paid placements are labelled `Sponsored` and visibly separated from organic
  relevance. Disclosures sit next to the link on narrow screens too.
- Test 360, 390, 430, 768, 1024 and 1440px; no horizontal overflow at the
  three phone widths.

## Definition of done

- Token, type-scale and component specs approved by the integrator and the
  UX specialist; globe palette unchanged.
- Each component spec lists states (default, hover, focus-visible, active,
  disabled, error, loading), keyboard behaviour and contrast evidence.
- Screen specs exist for landing, explorer (desktop/tablet/mobile), event
  briefing, saved, trip room, provider inquiry, and the admin queues.
- One representative vertical slice implemented by Frontend using the
  primitives, and QA has run usability/accessibility checks on it before the
  system is replicated.
- No new dependency added without integrator approval and current docs.

## Report format (after each work cycle)

1. Ticket IDs completed / in progress.
2. Files changed (paths).
3. User-visible behaviour.
4. Commands/tests and results (typecheck, lint, unit, browser), blocked
   checks listed separately.
5. Screenshots at the six widths where applicable.
6. Migrations / environment variables — none expected.
7. Blockers.
8. Unresolved risks.
9. Next smallest reviewable task.
