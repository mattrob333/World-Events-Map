# dope.travel unified design: "Afterglow"

Agreed 2026-09-24 after a four-way critique panel (brand, interaction, systems, adversarial mobile). Critiques are summarized at the end. This is the single source of truth for how pages look; the tokens and shared classes live in `src/app/globals.css`.

## The idea in one paragraph

A travel magazine at golden hour. The room is a cool evening sky. Things you touch are soft, rounded objects that sit a little above it, with a lit top edge and a deep soft shadow underneath, and sink when pressed or selected. Big Fraunces headlines and real photography carry the premium feel (kept from MERIDIAN). The sun from the logo is the only saturated color, and it appears once per screen: normally on the single primary button.

## Hard rules (enforced in review)

1. **One gradient moment per screen.** The golden-hour gradient appears on the primary button or one hero moment, not both. No gradient text except the /brand tagline and the moodboard title.
2. **Three surfaces.** Page (`surface-0`), raised object (`.surface`, or `.surface-raised` for popovers and the one hero module), and sunken well (`.surface-well`, inputs and selected states). Not every section is a card: sections are open type on the page, and cards are for things you act on.
3. **One primary, one secondary, one text link.** `.btn .btn-primary` (gradient pill, dark ink), `.btn .btn-ghost` (raised pill, bone ink), and an underlined text link. No beige slabs, no green CTAs, no outline-only mono buttons.
4. **Selected is pressed, not filled.** `.chip-on` sinks into the surface with saffron ink and a saffron rim. Never the CTA gradient, never solid beige, so "selected" can't be mistaken for "tap me".
5. **Brand colors only.** Evening, Bone, Brass, Saffron, Tangerine, Flamingo, Dusk. No Tailwind orange-300 or pink-300 pastels, no cyan, no rainbow conic gradients. Data encodings (heat ramp, category colors, globe) are exempt and untouched.
6. **Readable type.** Nothing below 11px. Readable copy uses `ink-muted` (#a8a598) or brighter. `ink-faint` is decoration and disabled states only; disclaimers that carry product truth use `ink-subtle` (#8f8c80, 5:1) or brighter.
7. **Labels are sans.** Eyebrows are 11–12px sans, semibold, tracked caps, in brass. Mono is for data: times, prices, codes, counts.
8. **Touch targets ≥ 44px** (visual 36px chips keep a 44px hit area).
9. **Honesty survives the restyle.** "Sample", "Preview", "not connected" and source labels keep their wording and stay readable. Disabled flows never get the glowing primary button.

## Tokens (in `globals.css`)

- Surfaces: `surface-0` #04050a (page), `surface-1` #0c0f19 (wells), `surface-2` #131726 (cards), `surface-3` #1b2033 (raised), `surface-4` #242a40 (hover).
- Ink: bone #f4f1ea, `ink-soft` #c9c5b9, `ink-muted` #a8a598, `ink-subtle` #8f8c80, `ink-faint` #6b6a63 (decoration only).
- Radii: `--radius-chip` 999px, `--radius-control` 14px, `--radius-card` 22px, `--radius-sheet` 32px.
- Elevation: `--shadow-soft-1/2/3` (lit top rim, inner rim, deep soft drop), `--shadow-inset` (pressed/sunken), `--shadow-glow` (primary button only).
- Gradients: `--gradient-golden-hour` (brand, ends in Dusk), `--gradient-cta` (saffron → tangerine → flamingo; stops before Dusk for contrast), `--gradient-sunrise-wash` (hero backgrounds), `--gradient-surface` (sheen on raised objects).
- Focus: 2px saffron ring with a 2px page-colored gap.

## Shared classes

`.surface`, `.surface-raised`, `.surface-hero`, `.surface-well`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.chip`, `.chip-on`, `.field`, `.eyebrow`, `.tag`, `.notice` (the one "preview / sample / not connected" treatment). CSS modules that can't use the classes directly use the same tokens (`var(--radius-card)`, `var(--shadow-soft-1)`, `var(--gradient-cta)` …) rather than new hex values.

## Signature moves

- **The sunset pill:** the primary button, filled with the CTA gradient.
- **The horizon band:** the three stripes from the logo's sun. Used for the active nav marker and section dividers.
- **Soft objects on an evening sky:** raised rounded cards with a lit top edge; selected things sink.
- **Big Fraunces, quiet chrome:** headlines do the talking; labels are small sans in brass.

## Known follow-ups (not in this pass)

- Trip designer idea cards are emoji on pastel gradients. Replace them with real imagery (research photos or brand art) rather than restyling the emoji.
- Phone IA: the panel recommends five icon tabs (World · Trips · Now · Circles · You) with Trips and Now out of "More". This pass restyles the bar (icons, larger labels, active marker) but keeps the current destinations; changing the IA needs the owner's call.
- Disclaimer density: some pages repeat "sample"/"not connected" several times. Consolidating copy is a content pass.
- Add a stylelint rule banning new hex colors and one-off radii in CSS modules.

## Panel critique summary

- **Brand:** two products on one domain; even the "new" pages use off-palette Tailwind pastels and a cyan rainbow orb (tie-dye). The logo appears once and never becomes a motif. Photos have no treatment.
- **Interaction:** six primary button styles, three "selected" treatments, 9–10px labels (the phone nav is 9px), many targets under 44px, three different disclaimer boxes.
- **Systems:** 1,203 hex literals (876 distinct), 42 radii, 41 shadow recipes, 122 font sizes, 7 near-identical beige CTA rectangles. The palette was already mostly shared; the difference is form.
- **Adversary:** literal neumorphism loses affordance on near-black, glass over black goes muddy, a gradient on everything means nothing, a card for every section kills hierarchy, and dropping the big editorial headlines would lose what made the old home premium.
