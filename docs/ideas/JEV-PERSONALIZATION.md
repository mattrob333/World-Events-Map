# Jev personalization

Jev (TypeSafe System One) is a **structured judgment** step. It is not the crawler, the entity resolver, or the source of prices, attendance, or availability.

## What the repo does today

`TypeSafeJudgmentProvider` in `src/lib/opportunities/typesafe.ts`:

- Endpoint: `POST https://api.typesafe.ai/v1/systemone`
- Auth env name: `TYPESAFE_API_KEY`
- Model env name: `TYPESAFE_MODEL`
- Default model string in code: `jev-latest`

That default is **not** a pinned production model. This repository has no client for `/v1/models`, and this phase did not call the live API. TODO: a human reads the current model list and sets `TYPESAFE_MODEL` to an explicit id before production judgment is trusted.

NOW is the only caller. It sends a short list of venues that already survived hard filters (closed, too far, over the price level, weak rating, dwell longer than the window). If TypeSafe is missing or fails, NOW keeps the deterministic ranking and says so.

Choice probabilities must cover the candidate set and sum to about 1. A broken distribution is a failure, not a neutral score.

## What Jev must not do

- Ingest feeds or scrape pages
- Resolve entities
- Decide authorization, RLS, or who can see a Circle
- Confirm a booking or a price
- Override a hard filter
- Invent a missing fact because the evidence was thin
- Receive the full signal firehose

## Stage 7 plan

After the idea engine has about 5–10 drafts, and only those drafts, ask Jev typed questions. Proposed dimensions, not yet implemented:

| Dimension | Question the model may answer |
|---|---|
| User fit | Does this draft match the active Travel Mode and stated interests? |
| Timeliness | Is the window soon enough to matter, given the signal timestamps? |
| Evidence sufficiency | Do the attached signal ids support the claims? |
| Value | Only if a real price signal is attached. Otherwise skip |
| Social / party fit | Only from consented Circle or profile facts. Do not infer private traits |
| Novelty | Has a similar idea already been shown? |
| Notification worthiness | Is this worth an alert, or only a quiet feed card? |

Each answer stays a score and a reason. The reason shown to a member must cite signal ids, not a free-form claim.

Deterministic Stage 8 ranking still runs after Jev. Jev cannot raise an idea above a failed hard rule.

## Personalization context

When TravelerContext is built, it may include home city or airport, the active Travel Mode, weighted interests, party type, saved and watched destinations, a broad price comfort, preferred trip length, an optional max flight time, Circle membership, and explicit idea feedback.

It must not include inferred sensitive traits, and it must not include a precise live location. NOW already keeps precise location off the profile. The idea engine has to keep that rule.

## Cost

TypeSafe calls share the NOW durable budget of 120 paid calls per 10 minutes with BestTime. Idea-engine calls do not exist yet. When they do, they need their own budget check before the first request. TODO: confirm the TypeSafe price before that budget is set. Do not invent a dollar rate here.
