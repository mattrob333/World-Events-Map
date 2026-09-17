# Affinity Graph

## Why it exists

Travel compatibility is situational.

A member can want family-friendly ski travel in February, a solo social weekend in Paris in April and a short nightlife recommendation during a work layover next month. A single permanent profile score cannot represent those contexts honestly.

MERIDIAN therefore matches through **Travel Modes**.

## Core entities

```text
Member
  |
  +-- Travel Mode
  |      +-- weighted interests
  |      +-- party type
  |      +-- origin
  |      +-- destination intent
  |      +-- dates
  |
  +-- Saved Events
  +-- Circle Memberships

Circle
  +-- event
  +-- destination
  +-- departure city
  +-- party type
  +-- tags
  +-- dates
```

## Visibility

Profile visibility and Travel Mode visibility are separate.

A member may choose to make a profile visible while keeping a specific mode private. This matters because trip intent can reveal more than a general biography.

Default behavior:

- profile: private
- travel mode: private
- circle chat: accepted members only
- precise current location: never a graph-discovery attribute

## Scoring

The first engine uses a deterministic score between 0 and 100.

Primary factors:

- weighted interest overlap
- matching party type
- matching origin
- matching destination intent
- overlapping date window

The graph should preserve reasons alongside scores.

Example:

```text
Affinity 84
shared interests: skiing, family travel, food
party type: family
origin: Atlanta
trip target: Aspen
```

## Constellation layout

The first 3D view uses concentric semantic rings instead of force simulation. This keeps movement deterministic and prevents the graph from becoming unreadable.

```text
radius 0      current member
radius 2-3    interests
radius 4-5    matched people
radius 6-7    circles
```

The active Travel Mode changes the data vector, which changes who and what appears.

## Execution vs exploration

Constellation is an exploration interface.

It should help a member notice relationships and clusters that a list would hide. Once a member selects a person or Circle, the product should switch back to normal cards, sheets and forms for action.

Do not force users to complete operational tasks inside a 3D graph.

## Future layers

Possible graph layers after the People Graph proves useful:

- destinations
- events
- partner opportunities
- flights and empty legs
- hotels and social accommodations
- real-time venue candidates

An Avinode empty leg could eventually be represented as an Opportunity node connected to an origin, destination, relevant event and interested Circle. It remains an inquiry opportunity until a provider confirms inventory and commercial terms.

## Outcome learning

The long-term ranking system should learn from observed outcomes:

- joined circle
- ignored recommendation
- saved event
- invited a friend
- sent provider inquiry
- actually went
- returned to similar venues
- repeated travel with the same people

Those outcomes should tune ranking, but they should not silently rewrite explicit member preferences.
