# Feedback events

Not implemented. This list is the vocabulary Stage 8 and later ranking may store. Explicit choices override anything inferred.

| Event | Meaning when it exists |
|---|---|
| `opened` | The member opened an idea |
| `saved` | The member saved it |
| `watched` | The member asked to watch it |
| `dismissed` | The member closed it without a reason |
| `not_interested` | The member said this kind of idea is unwanted |
| `too_expensive` | The member said it costs too much |
| `too_far` | The member said the trip is too far |
| `already_been` | The member said they have already done it |
| `start_circle` | The member started a Circle from the idea |
| `invite_sent` | An invite was sent |
| `flight_searched` | A flight search handoff happened |
| `stay_searched` | A stay search handoff happened |
| `book_clicked` | A book or request control was used. This is not a booking confirmation |
| `maps_opened` | A map link was opened |
| `went` | The member said they went |
| `loved` | The member said they loved it |

No table, API, or analytics call writes these events today. Do not backfill them from demo peer counts.
