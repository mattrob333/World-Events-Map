# MERIDIAN Product Direction

## The product

MERIDIAN is a travel intelligence network built around context rather than transactions.

Most travel products optimize one isolated decision: book a room, buy a ticket, find a restaurant, reserve a car. MERIDIAN should connect the entire trip lifecycle:

**DISCOVER -> CONNECT -> PLAN -> TRAVEL -> NOW**

The product should become more useful after a traveler arrives, not less.

## The four surfaces

### PULSE

**Question:** Where is the world gathering?

PULSE combines the curated event calendar with search interest, social velocity, booking pressure, media attention and other live demand signals. It should surface movement before it becomes obvious.

The product is not a generic destination directory. It is a forward-looking map of where interesting people, money and attention are concentrating.

### CIRCLES

**Question:** Who should I experience this with?

A Circle is not a static social group. It is a temporary or persistent cluster around context:

- trip type
- origin
- destination
- dates
- interests
- party type
- travel style
- shared event intent

One person can belong to many overlapping circles because one person can travel in many modes.

Examples:

- Family ski travelers leaving the Southeast during school break
- Solo travelers in Paris this weekend who care about food and nightlife
- Formula 1 fans routing from South Florida to Monaco
- Pilots on overnight work trips with four to eight hours available

### ACCESS

**Question:** How do we make the trip happen?

ACCESS connects qualified trip intent to opportunities:

- aviation
- empty legs
- hotels and villas
- event access
- ground transport
- restaurants
- yachts and boats
- local experiences

The initial commercial model should remain inquiry-first. MERIDIAN should not imply inventory ownership or confirmation it does not have.

### NOW

**Question:** What should we do right now?

NOW is the local decision engine after arrival.

The first provider architecture should separate facts from judgment:

1. A location/time provider such as BestTime returns candidate venues and operational signals.
2. Deterministic code removes impossible options: closed, too far away, wrong category, outside the available time window.
3. A structured judgment layer such as TypeSafe/Jev scores the remaining candidates against the current travel mode and stated intent.
4. MERIDIAN returns a small number of clear choices rather than a directory.

The target output is closer to:

- Best Match
- Most Alive
- Wildcard

than to a list of 40 nearby businesses.

## Travel modes

A static profile is too blunt for travel matching.

A member should be able to create multiple **Travel Modes**. A travel mode is a context lens that changes matching and recommendations.

Possible modes:

- Family Adventure
- Family Ski
- Solo Weekend
- Couples Escape
- Work Layover
- F1 Trips
- Food and Nightlife

Each mode can include:

- party type
- weighted interests
- origin city and airport
- destination intent
- date window
- private/discoverable visibility

This means the product can treat the same person differently when the person is traveling with children, traveling alone or traveling for work.

## The hostel insight

A useful travel recommendation is sometimes valuable because of the social environment it creates, not because the underlying product is objectively superior.

A hostel can be the right recommendation for a solo traveler because it concentrates other solo travelers who are open to meeting people. The same accommodation would be a poor recommendation for a family or anniversary trip.

MERIDIAN should model that explicitly.

The question is not only:

**Is this place good?**

It is:

**Is this place good for the trip this person is trying to have?**

## The three graphs

### World Graph

Events, cities, venues, seasons, categories, buzz and live signals.

### People Graph

Members, travel modes, interests, locations, circles and relationships.

### Opportunity Graph

Flights, empty legs, stays, access, venues, transportation and partner opportunities.

The recommendation engine is the layer that reasons across all three.

## Product principles

1. **Context beats profile similarity.** Match the trip, not a permanent identity.
2. **Small answer sets beat directories.** Make decisions, do not dump search results.
3. **No fake liquidity.** Never invent members, availability, demand or live inventory.
4. **Privacy is a product feature.** Discovery must be opt-in and scoped.
5. **Graph visualization is for exploration.** Cards and lists remain the execution interface.
6. **External providers are adapters.** BestTime, TypeSafe, Avinode and future sources should be replaceable.
7. **Intent becomes marketplace demand.** Circles create qualified demand that partners can serve.
8. **Outcome data matters.** A recommendation should learn from went/did-not-go, saved, joined, invited, booked and repeated behavior.

## North-star experience

A member should be able to open MERIDIAN and move naturally through this sequence:

1. See an event or destination heating up.
2. Switch into the travel mode that fits this trip.
3. See people and circles with meaningful overlap.
4. Form or join a circle.
5. See relevant transport, stay and access opportunities.
6. Arrive and ask MERIDIAN what to do now.
7. Feed the outcome back into future recommendations.

That full loop is the product.
