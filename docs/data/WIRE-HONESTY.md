# Wire honesty

The live wire repeats numbers a configured adapter already returned. It does not invent a crowd, a price, or social heat.

## 1. Times

`observedAt` is when MERIDIAN recorded the reading. `sourcePublishedAt` is when the source says the fact was published. The wire never copies one into the other. If the adapter did not provide a publication time, `sourcePublishedAt` stays empty.

## 2. Stale readings

A reading older than its freshness window is labeled stale. The card keeps the original `observedAt`. It is not restamped with the current time.

## 3. Commercial hold

`docs/data/SOURCE-ACCESS-MATRIX.md` is the rights source of truth. Ticketmaster, PredictHQ, and Amadeus stay unconfigured under that hold. The wire drops them even if a fixture or a leftover patch is passed in. Health for those three stays `unconfigured`, and the collectors do not call them.

## 4. Fixtures

Sanitized fixtures, not live responses:

| File | What it proves |
|---|---|
| `src/lib/signals/__fixtures__/wire-honesty.json` | Two **fresh** readings on the same curated event (X / social and Google Trends / search), plus one **stale** Google Trends reading. Each reading has a `sourcePublishedAt` that is different from its `observedAt` and from the wire's `asOf` time. Tests require those publication times to survive unchanged, and they require both fresh families to clear a material-change bar. `destinationId` is omitted — the entity registry has no destination id yet. |
| `src/lib/signals/__fixtures__/hold-sources.json` | Synthetic Ticketmaster, PredictHQ, and Amadeus patches. The wire must return no cards for them. |
| `src/lib/signals/__fixtures__/patches.ts` | Small numeric patches used to check metric mapping. Not live data. |

The two fresh observations sit inside the 10-minute window at `asOf`, so each family can rise (or count as new / changed). The stale fixture is hours older, so its card kind is `stale` while `sourcePublishedAt` stays `2026-09-22T11:05:00.000Z`. The stale Trends row is a separate older observation; it does not replace the fresh search family.
