# Heat: only what's hot makes the screen

Status: design, 2026-09-25. It combines an architecture pass and a data-source audit (both run 2026-09-25, sources cited below). Nothing here is built yet except where "Phase 1" says so.

## The idea

Every place, event and venue we suggest carries a **Heat** score that proves it is being talked about right now. It shows like a stock ticker: a tiny sparkline, a green arrow, and one big number with its source ("Wikipedia views +342% w/w · 12.8k/day"). A dashboard shows only what **made the cut**, hottest first, and can be filtered to a single country ("Japan" shows only Japan).

Heat is separate from the existing **buzz** score (`src/lib/buzz`, `HeatLevel` in `types.ts`). Buzz is the editorial prior ("worth attending"). Heat is measured movement. The two carry different labels in the UI.

## What we can honestly measure (audit, 2026-09-25)

| Source | Gives | Absolute? | Access | Verdict |
|---|---|---|---|---|
| Our news intake (`meridian_feed_items`) | Mentions per place per day, source tier | Yes (counts) | Ours | **Now**, main signal |
| Wikimedia Pageviews | Daily views per article, per language wiki, history back to 2015, human-only filter | **Yes** | Free; send a User-Agent with contact; about 200 requests/min | **Now** |
| GDELT DOC 2.0 | Share of global news coverage, every 15 min, 3 months; by publisher country | No (a share) | Free; about 1 request / 5 s | **Now**, sparkline and cross-check |
| Ticketmaster | Which events exist (relevance sort, no numbers) | — | Free key, 5k/day | Soon: existence, not heat |
| SeatGeek | Event `score`, performer `popularity` (opaque, no history) | No | Free client id | Soon: we snapshot it ourselves |
| YouTube Data v3 | Recent videos + view counts | Yes (views) | Free key, about 100 searches/day | Soon, sparingly |
| Google Trends API | Scaled search interest by country | No (index) | Alpha, by application only | Apply now; **never** use pytrends |
| X API | Post counts per query over 7 days | Yes | Pay per use, about $0.005 per counts request | Later, with a hard spend cap |
| BestTime | Live busyness compared with usual | — | Paid ($29/mo minimum) | Later: a "busier than usual" badge |
| TikTok | Research API is academic only; Creative Center has no API | — | Not available to us | **Avoid** |
| Instagram Graph | 30 hashtags / 7 days, no history | — | Business account + review | **Avoid** |
| Spotify popularity | Removed Feb 2026 for new apps | — | — | **Avoid** |
| Google Places ratings as a trend | Storing ratings breaks Google's terms | — | — | **Avoid** for Heat |

Honesty rules that follow from the audit:
- **Only Wikipedia views and our own mention counts are absolute.** Only they may carry a big raw number ("+1.2M").
- **Google Trends and GDELT are relative.** They carry percentages or "index", never counts.
- **Nothing we can reach measures searches.** No ticker may say "searches".
- **Wikipedia's top-per-country lists include tragedies.** Use them only to score subjects we already have, never to discover new ones.
- **Country filters are approximate.** A language wiki is not a country, and GDELT's `sourcecountry` is where the publisher is, not where the event happens. Labels must say which languages were counted.

## Entities and mappings

- **HeatSubject** = `{ id, kind: event | place | venue | topic, name, countryCode, placeKey?, eventId? }`. Ids are stable: `event:<id>`, `place:<Place.key>`, `venue:<provider>:<id>`, `topic:<slug>`.
- **Query mappings are resolved once, offline, and reviewed.** They are never resolved per request:
  - Wikipedia titles are found through Wikidata and its sitelinks (ja/fr/de/it/es).
  - Search terms carry a disambiguator ("Nice France").
  - Ambiguous names from `vibe/extract.ts` (Nice, Bath, Split, Como, Lech) must resolve to an entity in the right country, or they wait for review.
  - Only `verified` mappings are collected.
- **Voice-canvas spots have only a URL,** so they stay unscored until they resolve to a provider venue.

## Scoring (pure, `src/lib/heat/score.ts`, `now` injected)

Per source, per subject:
- `recent` is the sum of the last 7 days, with days weighted `0.5^(age/3)`.
- `base` is the median of the three prior 7-day windows, which resists one-off spikes.
- **Smoothed growth:** `g = (recent + α)/(base + α)`. α is a per-source prior (Wikipedia 2,000 views a week, news 3 mentions a week), so 4 → 40 views never reads as "+900%".
- `z = log(g)`, clipped to ±log 10.
- **Volume:** `v = logNorm(recent, FLOOR, SAT)`. Growth only counts when `recent ≥ FLOOR`.
- **Per-source heat:** `h = 0.6·sigmoid(2z) + 0.4·v`.

Combined across sources:
- `heat = Σ w·h / Σ w`, over sources that are present. Default weights: Wikipedia 0.35, news 0.25, YouTube 0.2, tickets 0.1, Trends 0.1.
- A missing source drops out of both sums and lowers `confidence`.
- Events are multiplied by their date proximity (from buzz), so something 11 months away doesn't qualify.

**Made the cut** means all three: `heat ≥ 0.55`, `confidence ≥ 0.4`, and at least one absolute source above its floor. The list is capped at 60 per country. The threshold constants are pinned by a golden-fixture test.

**Taste on the device:** the client re-orders by `0.7·heat + 0.3·fit`, using `vibe/concierge.ts`. The profile never reaches the heat path, and taste reorders but never promotes anything that didn't make the cut.

**Jev stays off the hot path.** It is used for three things:
1. offline disambiguation of mappings (a `noul` question, with a receipt);
2. the existing feed screening;
3. optionally `vibe-fit@1` on the voice shortlist, 8 items or fewer, within a budget.

## Display contract (`src/lib/heat/types.ts`)

```ts
type HeatTicker = {
  subjectId: string; name: string; countryCode: string; kind: 'event' | 'place' | 'venue' | 'topic';
  heat: number;                                   // 0..1
  confidence: 'high' | 'medium' | 'low';
  headline: { source: string; sourceLabel: string; value: number; window: '7d'; deltaPct: number | null; absolute: boolean };
  spark: { day: string; value: number | null }[]; // 28 points; null = not observed (a gap, not a zero)
  direction: 'up' | 'down' | 'flat';              // flat when |Δ| < 10% or low confidence
  sources: { id: string; label: string; status: 'ok' | 'missing' | 'building' | 'unconfigured' }[];
  asOf: string;                                   // latest observed day
};
```

Every number names its source.
- **Rounding:** deltas are rounded to 2 significant figures and capped at "+999%".
- **Relative sources** say "index".
- **Missing data:** sources show as a grey "unavailable" chip, and sparkline gaps are drawn as breaks, not dips.
- **Low confidence:** no green arrow.
- **Fixtures:** never shown in production.

## Storage, pipeline and API

- **Migration 008** (HIGH_CAPABILITY_ONLY):
  - Tables:
    - `heat_subjects`
    - `heat_subject_queries` (status proposed / verified / rejected)
    - `heat_observations` (subject, source, day, value, unit, absolute)
    - `heat_source_runs` (ok, partial, failed, skipped_budget, unconfigured), so that "source down" is never shown as zero
    - `heat_snapshots` (latest only)
    - a run lease
  - All tables are service-role only, following the 007 pattern, with a PGlite RLS test.
  - Keep 400 days of history for year-over-year comparison.
- **Cron:** `/api/cron/heat?source=` checks `CRON_SECRET`, takes a lease, backfills 30 days, and uses a budget pool per paid source. Paid sources wait until the durable `reserve/settle` budget exists.
- **API:** `GET /api/heat?country=JP&kind=event&limit=20` validates its inputs and is cached at the edge for 1h with stale-while-revalidate for a day. `GET /api/heat/[subjectId]` returns one subject.
- **Consumers:** the home shortlist (gate and sort by heat), destination pages, Vibe Match (heat as its own labeled component), and the voice canvas.

## Build plan

| Phase | Work | Class |
|---|---|---|
| 1 | Keyless slice. Wikipedia per-article series (it has its own history, so no storage is needed yet) plus our news counts, computed on request and cached at the edge. A curated, reviewed subject → Wikipedia title map for the calendar. `score.ts` with golden tests. The `HeatTicker` component. The ticker shown on the home shortlist, with a "What's hot" rail and a country filter. | REVIEW_REQUIRED (ranking, public API); ticker CHEAP_OK |
| 2 | Migration 008, cron collection, snapshots, GDELT sparkline | HIGH_CAPABILITY_ONLY (migration), REVIEW_REQUIRED |
| 3 | Durable budget RPC; YouTube, SeatGeek and Ticketmaster adapters | HIGH_CAPABILITY_ONLY, REVIEW_REQUIRED |
| 4 | X counts (spend cap), BestTime busier-than-usual, Google Trends if approved; Jev vibe-fit on the shortlist | HIGH_CAPABILITY_ONLY for contracts |

Risks:
- **Sparse data:** niche resorts sit below the floors. That's intended: they aren't hot.
- **Name ambiguity:** handled by Wikidata plus a country check.
- **Multilingual undercount:** each label names its languages.
- **Spikes from bad news:** filtered by the median baseline and the news noise filter.
- **Cost:** paid sources stay off until the durable cap exists.
- **Crons:** hourly runs need the Vercel Pro plan.

Sources: [Wikimedia rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits), [Google Trends API](https://developers.google.com/search/apis/trends), [Ticketmaster Discovery](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/), [SeatGeek](https://seatgeek.github.io/), [YouTube search.list](https://developers.google.com/youtube/v3/docs/search/list), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [X pricing](https://docs.x.com/x-api/getting-started/pricing), [TikTok Research API](https://developers.tiktok.com/products/research-api/), [Instagram hashtag media](https://developers.facebook.com/docs/instagram-api/reference/hashtag/recent-media), [Spotify Feb 2026 changes](https://developer.spotify.com/documentation/web-api/references/changes/february-2026).
