# MERIDIAN Architecture

## System shape

MERIDIAN is organized around three domain graphs and one recommendation layer.

```text
                    RECOMMENDATION LAYER
              context + constraints + judgment
                          |
        +-----------------+-----------------+
        |                                   |
   WORLD GRAPH        PEOPLE GRAPH     OPPORTUNITY GRAPH
 events / cities      members / modes    flights / stays
 buzz / venues        interests / circles access / venues
```

The graphs do not require a graph database on day one. PostgreSQL remains the source of truth and explicit relationship tables provide the graph semantics. A dedicated graph engine can be introduced later if traversal depth, graph analytics or scale justifies the operational complexity.

## Current stack

- Next.js 16
- React 19
- TypeScript
- React Three Fiber / Three.js / Drei
- Supabase Auth + Postgres
- Zustand for local UI state
- Vitest + PGlite for tests

## People Graph

### Profiles

`profiles` stores the durable member identity and remains private by default.

Important fields:

- display name
- home city
- home airport
- broad interests
- bio
- public discovery opt-in

### Travel modes

`travel_modes` stores contextual traveler identities.

A member may have many modes. Each mode has:

- name and description
- party type
- origin city / airport
- destination intent
- date window
- visibility
- weighted interests

Travel modes are deliberately separate from the base profile because context changes recommendation quality.

### Circles

Circles are trip-specific social clusters. They can carry:

- destination
- origin
- dates
- party type
- tags
- event reference

The affinity engine can compare a travel mode to a circle using the same normalized vector used for member matching.

## Affinity scoring

The first scoring engine is deterministic and inspectable.

Suggested weighted components:

- shared interests and their weights
- party type compatibility
- origin overlap
- destination overlap
- explicit trip-date overlap when available

The score should be explainable. A recommendation should be able to say why two entities matched:

```text
82 affinity
+ shared: skiing, family travel, food
+ same origin region
+ matching party type
+ both targeting Aspen
```

The first implementation intentionally avoids a black-box model. Learned ranking can be layered in later using outcome data.

## Constellation

Constellation is the 3D exploration surface over the People Graph.

It is not the primary execution UI.

The view should contain:

- member at the center
- selected travel mode as the active lens
- interests on the first ring
- matched members on the second ring
- circles on the third ring
- locations and opportunities as optional future layers

Filters alter the visible graph and affinity threshold. Selecting a node opens a normal card or detail surface for action.

## Opportunity Graph

External inventory and availability providers must sit behind provider interfaces.

Do not couple MERIDIAN's domain model directly to one vendor.

### Aviation provider contract

Conceptual interface:

```ts
interface AviationOpportunityProvider {
  search(input: AviationSearchInput): Promise<AviationOpportunity[]>;
  inquire(opportunityId: string, request: InquiryInput): Promise<InquiryReceipt>;
}
```

Possible adapters:

- Avinode
- approved broker feed
- direct operator feed
- internal/test fixture provider

An empty leg is an opportunity node, not a guaranteed seat. MERIDIAN can associate that opportunity with interested members, origins, destinations and circles without claiming a booking is confirmed.

### Venue provider contract

A venue facts provider returns observable or forecasted facts:

- open status
- distance
- category
- foot-traffic forecast
- live busyness when available
- dwell time
- rating/review metadata

BestTime is a likely adapter.

### Judgment provider contract

A structured judgment provider scores viable candidates against intent.

TypeSafe/Jev is a likely adapter.

The separation is important:

```text
BestTime-like source -> factual candidate set
MERIDIAN code       -> hard constraints
TypeSafe-like layer -> contextual judgment
MERIDIAN UI         -> 3 clear choices
```

## NOW request pipeline

```text
Current location + time
        |
Selected travel mode
        |
User intent: food / drinks / music / surprise
        |
Venue retrieval
        |
Hard filters
  open now
  travel radius
  return-by time
  category constraints
        |
Structured scoring
        |
Top choices
  Best Match
  Most Alive
  Wildcard
```

## Privacy model

The People Graph must not become an accidental location-surveillance system.

Rules:

1. Profiles are private by default.
2. Travel modes are private by default.
3. Discoverable travel modes require explicit opt-in.
4. Current precise location is never published as a member attribute.
5. Circle membership controls access to private chat and itinerary context.
6. Public discovery should expose only the fields required for matching and display.
7. Sensitive matching inputs should remain local/server-side when possible.

## Data ownership

Postgres remains the source of truth for member, circle and opportunity metadata.

Derived affinity scores should be treated as cacheable calculations, not identity facts. Recompute them as source data changes instead of turning a score into permanent profile metadata.

## When to introduce a graph database

Consider Neo4j or another graph engine only when one or more of these become true:

- multi-hop traversal is a core request path
- relationship count materially outgrows simple indexed joins
- graph algorithms such as communities, centrality or path finding become product-critical
- recommendation latency from PostgreSQL becomes unacceptable
- graph analytics needs a separate workload from transactional data

Until then, the operational simplicity of Postgres is worth preserving.
