# MERIDIAN Wiki

This directory is the in-repo product and engineering wiki. It is versioned with the code so agents and developers can change documentation in the same pull request as implementation.

## Product

- [Product direction](../PRODUCT.md)
- [System architecture](../ARCHITECTURE.md)
- [Affinity Graph](AFFINITY-GRAPH.md)
- [NOW decision engine](../NOW-ENGINE.md)
- GitHub issue #5: first-class traveler profiles
- GitHub issue #6: Circle anticipation / inspiration layer
- GitHub issue #7: cost-aware agent implementation workflow

## Operations

- [Live data setup](../LIVE-SETUP.md)
- [Partner setup](../partner-setup.md)
- [Developer log](../DEVLOG.md)
- [Production readiness](../PRODUCTION-READINESS.md)

## Working vocabulary

**PULSE**: event and destination intelligence.

**PROFILE / IDENTITY**: the canonical social representation of a member. A Profile describes the person; it does not silently expose private trip intent.

**CIRCLES**: social grouping around trip context.

**ANTICIPATION**: collaborative pre-trip research and excitement: videos, social links, articles, places, recommendations, votes and ideas that can later become itinerary/NOW context.

**ACCESS**: partner opportunities for transport, stays, access and experiences.

**NOW**: the local day-of decision engine that combines current venue facts, hard traveler constraints and contextual judgment into a small decision set.

**Travel Mode**: a contextual identity used for matching and recommendation, such as Family Ski, Solo Weekend or Work Layover.

**Constellation**: the interactive 3D exploration surface over member interests and circles.

**Affinity**: an explainable score describing how strongly a member's active Travel Mode overlaps another member, mode or Circle.

**Opportunity**: an actionable but not necessarily confirmed travel option, such as an empty leg, provider stay or local venue candidate.

**Best Match / Most Alive / Wildcard**: the decision roles returned by NOW after hard filters remove impossible choices. `Most Alive` is omitted when MERIDIAN lacks a defensible traffic signal.

## Product lifecycle

The working lifecycle is:

`PROFILE -> ANTICIPATION -> CIRCLE -> TRIP -> NOW -> MEMORIES`

The same People Graph should connect identity before a trip, collaboration while planning, day-of decisions while traveling, and memories after the trip without turning sensitive live location or private trip intent into public profile data.
