# MERIDIAN NOW Engine

## Purpose

NOW answers a different question from PULSE.

PULSE asks where attention is moving across the world. NOW asks what a traveler should do in the next few hours after they have already arrived.

The product rule is deliberately strict: NOW returns a small decision set, not a directory.

- **Best Match**: strongest overall fit for the current context.
- **Most Alive**: strongest local energy signal among the viable candidates.
- **Wildcard**: a strong but less obvious option that preserves category diversity.

## Pipeline

```text
current location
    +
intent / vibe / time / party / price
    +
optional Travel Mode
        |
        v
VenueFactsProvider
        |
        v
hard deterministic filters
        |
        v
MERIDIAN baseline ranking
        |
        +----> optional JudgmentProvider
        |               |
        |               v
        +------ blended contextual ranking
                        |
                        v
       Best Match / Most Alive / Wildcard
```

## Facts and judgment stay separate

The system intentionally distinguishes observable facts from contextual judgment.

### Venue facts

The first adapter is `BestTimeVenueProvider`.

It uses BestTime's venue filter endpoint with the current location, radius, broad venue types and current local hour. The adapter maps provider-specific fields into MERIDIAN's provider-neutral `VenueCandidate` model.

MERIDIAN does not label expected traffic as live traffic. Historical/current-hour forecast data is stored as `expectedBusyness`; `liveBusyness` is only populated if a provider actually returns a live measurement.

### Hard filters

Code removes candidates that are impossible or violate explicit constraints before any judgment model is called.

Current hard filters:

- explicitly closed venue
- outside requested radius
- above maximum price level
- below minimum rating when a rating exists
- usual dwell time longer than the traveler's available window

A model does not get to override these constraints.

### Deterministic baseline

Every viable venue gets an inspectable baseline based on:

- activity-intent fit
- requested energy fit
- venue quality
- distance
- review/social-proof depth

This means NOW still works if the structured judgment layer is unavailable.

### Structured judgment

The first adapter is `TypeSafeJudgmentProvider` using Jev/System One.

The adapter asks several atomic Choice questions against the same candidate set rather than one vague "pick the best venue" question. Current dimensions are:

- activity fit
- requested social energy
- trip context/interests

Candidate probability distributions are converted into a relative judgment score, then blended with the deterministic baseline. The model cannot erase factual constraints.

If TypeSafe is not configured or temporarily fails, the request degrades to deterministic MERIDIAN ranking and the response carries a warning.

## Privacy

NOW requires precise location to be useful, but precise current location is not part of the People Graph.

Rules:

1. Browser location is requested only after the traveler taps **Use my location**.
2. Latitude/longitude is sent to the NOW API for the current decision.
3. MERIDIAN does not persist that coordinate to the profile or Travel Mode tables.
4. External venue providers necessarily receive enough geographic context to answer the venue query.
5. The response is `Cache-Control: no-store` at the MERIDIAN HTTP boundary.
6. Server-side provider credentials are never exposed through `NEXT_PUBLIC_` variables.

## Provider configuration

Server-only environment variables:

```text
BESTTIME_API_KEY_PRIVATE=
TYPESAFE_API_KEY=
TYPESAFE_MODEL=jev-latest
```

BestTime is required for the first live NOW implementation. TypeSafe is optional because MERIDIAN has a deterministic fallback.

## Caching and cost control

Venue retrieval is cached in-memory for five minutes using rounded location, radius and intent as the key. This reduces duplicate provider calls during repeated decisions on a warm server instance without pretending the cache is globally durable.

Future production hardening should move provider-call accounting and rate limits into durable infrastructure if traffic justifies it.

## Travel Mode context

Signed-in members can select one of their own Travel Modes. NOW passes the selected mode name and interests to the judgment layer.

This is the same contextual identity model used by Constellation. A `Work Layover` request should produce a different answer than `Family Weekend` even when both requests originate from the same person in the same city.

## Next improvements

1. Add actual live-busyness refresh only when the user explicitly asks for a higher-confidence live read, so paid provider calls are intentional.
2. Learn from outcome events such as opened-in-maps, went, skipped, saved and repeated.
3. Add travel-time estimates so `availableMinutes` accounts for getting there and back, not only venue dwell time.
4. Add city/neighborhood search for travelers who do not want to share device location.
5. Add social presence carefully, with explicit opt-in and coarse location rather than exposing member coordinates.
6. Add reservation and ticket links only when a provider can represent their status honestly.
