# MERIDIAN Wiki

This directory is the in-repo product and engineering wiki. It is versioned with the code so agents and developers can change documentation in the same pull request as implementation.

## Product

- [Product direction](../PRODUCT.md)
- [System architecture](../ARCHITECTURE.md)
- [Affinity Graph](AFFINITY-GRAPH.md)
- [NOW decision engine](../NOW-ENGINE.md)

## Operations

- [Production readiness](../PRODUCTION-READINESS.md)
- [Live data setup](../LIVE-SETUP.md)
- [Partner setup](../partner-setup.md)
- [Developer log](../DEVLOG.md)

## Working vocabulary

**PULSE**: event and destination intelligence.

**CIRCLES**: social grouping around trip context.

**ACCESS**: partner opportunities for transport, stays, access and experiences.

**NOW**: the local day-of decision engine that combines current venue facts, hard traveler constraints and contextual judgment into a small decision set.

**Travel Mode**: a contextual identity used for matching and recommendation, such as Family Ski, Solo Weekend or Work Layover.

**Constellation**: the interactive 3D exploration surface over member interests and circles.

**Affinity**: an explainable score describing how strongly a member's active Travel Mode overlaps another member, mode or Circle.

**Opportunity**: an actionable but not necessarily confirmed travel option, such as an empty leg, provider stay or local venue candidate.

**Best Match / Most Alive / Wildcard**: the three decision roles returned by NOW after hard filters remove impossible choices.
