# Signal registry

Provider-neutral metrics MERIDIAN can emit from adapters that already exist. The code list is `src/lib/signals/registry.ts`. If this file and that module disagree, the module is what the wire uses.

Commercial rights are **not** recorded here. Those live only in `docs/data/SOURCE-ACCESS-MATRIX.md`. Until that file lifts the hold, `ticketmaster`, `predicthq`, and `amadeus` are not called. The rows for those three describe fixture shape only.

Wire honesty fixtures (fresh, stale, and preserved `sourcePublishedAt`) are specified in `docs/data/WIRE-HONESTY.md` §4.

Freshness for every row below is **600 seconds**, matching the public buzz-patch cache. After that, a stored reading is `stale`. It is not rewritten with a new timestamp.

`sourcePublishedAt` is set only when an adapter actually supplies a publication time. Today's buzz adapters do not. Fetch time stays in `observedAt`.

Confidence is a MERIDIAN judgment of how directly the number measures the label. It is not a vendor score.

## Adapter metrics

| Source | Family | Buzz field | Metric | Truth | What it is |
|---|---|---|---|---|---|
| `ticketmaster` | events | `bookingPressure` | `ticketed_demand_pressure` | modeled | Congestion and sell-through proxy |
| `ticketmaster` | events | `exclusivity` | `ticket_price_ceiling_hint` | modeled | Weak hint from nearby face values. The wire does not show a currency amount |
| `predicthq` | events | `searchInterest` | `demand_rank` | modeled | PredictHQ rank. Attendance is not mapped |
| `predicthq` | events | `bookingPressure` | `local_demand_rank` | modeled | Local rank scaled to 0–1 |
| `google-trends` | search | `searchInterest` | `search_interest_index` | observed | Relative index inside one Trends query |
| `google-trends` | search | `socialVelocity` | `search_index_slope` | modeled | Slope of that relative index |
| `x` | social | `socialMentions` | `mention_count` | observed | Recent post count |
| `x` | social | `socialVelocity` | `mention_window_velocity` | modeled | Change inside the recent count window |
| `amadeus` | lodging | `bookingPressure` | `upmarket_hotel_scarcity` | observed | Sampled 4–5 star availability proxy. Fixture shape only while the commercial hold lasts |

## Editorial baselines

These exist so a curated patch cannot be mistaken for a live source. The wire drops `truthStatus: editorial`.

| Metric | Buzz field |
|---|---|
| `editorial_social_mentions` | `socialMentions` |
| `editorial_social_velocity` | `socialVelocity` |
| `editorial_search_interest` | `searchInterest` |
| `editorial_media_mentions` | `mediaMentions` |
| `editorial_booking_pressure` | `bookingPressure` |
| `editorial_exclusivity` | `exclusivity` |

## Not signals yet

| Source | Why it is absent |
|---|---|
| BestTime | NOW venue facts. Forecast busyness is not copied onto the world wire |
| TypeSafe / Jev | Judgment output, not an observed world fact |
| X scene posts | Text for the dossier. Not a count, and not turned into heat |
| Folded `/api/signals` patch | Several vendors may have overwritten one field. The wire will not guess |

## Material-change bars

Used by the delta engine. A smaller move produces no card.

| Scale | Metrics | Bar |
|---|---|---|
| unit (0–1) | pressure, ranks scaled to 0–1, exclusivity hint | absolute change of 0.08 |
| index (0–100) | demand rank, search index | absolute change of 8 |
| count | mention count | absolute change of 25 and a 20% relative change |
| velocity (−1–1) | mention window, search slope | absolute change of 0.15 |

## Delta kinds

| Kind | Rule |
|---|---|
| `new` | No previous reading, and this one is still inside its freshness window |
| `rising` | Previous reading is still fresh, and the number cleared the bar upward |
| `falling` | Previous reading is still fresh, and the number cleared the bar downward |
| `changed materially` | The reading is fresh, the number did not clear the bar, and the truth status (or presence of a value) changed. The wire label is **Changed** |
| `stale` | The current reading is older than its freshness window, or the previous reading disappeared from the sweep |
| `recovered` | A new fresh reading arrived after the previous one had already aged out |

A jump across a freshness gap is `recovered`, not `rising`. One viral-style count from a single source is still one signal. It does not make a destination hot.
