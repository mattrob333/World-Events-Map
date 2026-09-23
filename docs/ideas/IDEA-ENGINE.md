# Idea engine

Plan for Stages 5–8. Stages 1–3 have a first code path. Stage 4 and everything after it are not built. This document is the contract for that later work so it does not drift into invented facts.

## What landed in this phase

| Stage | Name | Status |
|---|---|---|
| 1 | Ingest | Existing adapters still return `Partial<BuzzSignals>`. `signalsFromPatch` turns a **per-source** patch into `TravelSignal` rows |
| 2 | Resolve | Event id only, when the adapter was asked about a curated event. See `docs/data/ENTITY-REGISTRY.md` |
| 3 | Delta | `diffSweeps` emits `new`, `rising`, `falling`, `changed`, `stale`, `recovered` |
| 4 | Correlate | Not built. One signal is not a destination cluster |
| 5 | Candidate generation | Not built. Specified below |
| 6 | LLM synthesis | Not built. Specified below |
| 7 | Jev evaluation | Not built. See `docs/ideas/JEV-PERSONALIZATION.md` |
| 8 | Final ranking | Not built. Specified below |

The Live Travel Wire (`GET /api/travel-wire` and the strip on the world dashboard) only renders Stage 3 cards. It does not rank trips, estimate cost, or call a model.

## Stage 5 — candidate generation

When this is built, create a small set of raw candidates from **patterns of signals that already exist**. Do not add a new vendor to manufacture a pattern.

Allowed pattern sketches, and only when each leg is a real signal id:

- social mention move plus an event signal on the same curated event
- search-index move plus a demand-rank signal on the same curated event
- hotel-scarcity proxy plus an event that is already on the calendar
- a member's saved or watched destination plus a fresh signal on an event in that city, once destination ids exist

Not allowed until a source is actually integrated and listed in the access matrix:

- snow plus a ski resort
- beach weather
- a published airfare
- a live crowd count
- "three friends are watching" unless the product has a real, consented member signal

Target size later: about 20–40 raw candidates before any model call. That number is a cap, not a quota. Fewer honest candidates is the correct result.

## Stage 6 — LLM synthesis

A generative model may write the headline and thesis. It may not add a fact.

Inputs, when they exist:

- the signal cluster, with signal ids
- the active profile and Travel Mode
- ideas already shown
- explicit feedback

Output target: about 5–10 `TravelIdea` drafts. Every factual clause maps to a signal id. If a draft mentions a price, a crowd, or a social surge, and no signal id supports that clause, drop the draft.

The `TravelIdea` shape in the product brief (types such as `event_trip` and `deal_trip`, plus fit and evidence scores) is the target object. It is not a TypeScript module yet. Do not invent `estimatedTripCost` from the curated `estimatedSpend` field and call it a live quote. Curated spend is editorial.

## Stage 7 — Jev

Only after Stage 6 has a short list. Jev does not see the raw feed. Details and the open model pin are in `docs/ideas/JEV-PERSONALIZATION.md`.

## Stage 8 — deterministic ranking

Hard rules stay in code, after any model score:

- drop ideas whose dates are impossible
- drop muted categories
- drop duplicates
- drop stale evidence
- respect a known budget ceiling when the member actually set one
- keep the list diverse

Starting weights from the brief, tunable later, not implemented:

| Dimension | Weight |
|---|---|
| Personal fit | 30% |
| Evidence strength | 20% |
| Timeliness | 15% |
| Value / price opportunity | 10% |
| Social relevance | 10% |
| Trip friction | 10% |
| Novelty | 5% |

Value weight stays at zero effect until a real price signal exists. Do not fill it with the editorial price index.

Return 3–5 primary ideas only when the evidence clears the rules. Otherwise return fewer, with an honest empty state.

## Product loops this must extend

An idea, once it exists, can offer actions the app already has: open the destination on the globe, save, watch, start a Circle, and hand off to Access and NOW. Those screens stay the owners of membership, chat, requests, and after-arrival decisions. The idea engine does not replace them and does not confirm a booking.

## Feedback

The verbs to capture later are listed in `docs/ideas/FEEDBACK-EVENTS.md`. None of them are written by this phase.
