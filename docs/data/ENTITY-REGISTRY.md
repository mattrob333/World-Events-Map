# Entity registry

Stub for Phase 1. Canonical ids are only listed where the code already has a stable key. Missing ids stay missing.

## Kinds

| Kind | Stable id today | Where it lives | Gap |
|---|---|---|---|
| destination | No | City and country strings on `WorldEvent` | TODO: a destination id. Do not invent one from a news headline or a geocode guess |
| event | Yes. `WorldEvent.id` slug | Curated calendar and approved provider events | Live vendors do not share this id. Adapters join on coordinates and dates |
| venue | No | `WorldEvent.venues` is a list of names. BestTime has its own `venue_id` on NOW candidates | TODO: do not merge a BestTime id onto a curated venue name without a reviewed match |
| airport | Partial. `nearestJetPort.code` | On each curated event | Not a global airport table. Code comments allow ICAO or IATA |
| route | No | Not modeled | TODO. Do not infer a route from a hotel search |
| provider | Partial. `WorldEvent.providerId` and `provider_orgs` | Supabase, migration 001 | Only for partner-submitted records |
| artist / team | No | Not modeled | TODO |
| resort | No | Not modeled | TODO. No ski-feed adapter |

## Resolution rules for this phase

1. A TravelSignal from a buzz adapter sets `entityType` to `event` and `entityId` to the curated event id that was queried.
2. `destinationId` is left empty until a destination registry exists.
3. The wire may show the catalog city name as a label. That label is not a new id.
4. If the catalog has no event for an id, the wire keeps the id and does not invent a city.
5. One source family cannot corroborate itself. Corroboration across families is later work (idea engine Stage 4) and is not claimed here.

## What not to do

- Do not geolocate a headline onto the nearest curated event.
- Do not treat a 25 km Ticketmaster or PredictHQ search as proof it is the same event.
- Do not publish a member's precise location as an entity.
