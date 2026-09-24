# Source library v2 (2026-09-24)

Machine-readable file: `source-library-v2.json`. It supersedes `source-library-2026-09-24.json`, which stays in place as the v1 record.

## Totals

| | Count |
|---|---|
| Live sources | **713** |
| Carried over from v1 (all re-fetched today, metrics refreshed) | 140 of 141 |
| New, verified live today | **573** |
| Dropped (57 from v1, MAPS from v1, and 553 new candidates) | 611 |
| Signal-only (forums, Reddit, Google News queries) | 45 |
| Non-English | 27 |
| General/local news feeds that need a keyword prefilter | 113 |

- By trust tier: A 93, B 269, C 351.
- By kind: magazine 297, newspaper 177, blog 125, trade 64, forum 26, official 20, newsletter 2, podcast 2.
- MAPS moved from v1 to `dropped`. Its newest item was 30.1 days old, just over the 30-day rule. The 4 v1 feeds that were blocked or rate-limited on the first pass (SnowBrains, two Reddit feeds, one Google News query) passed a slower sequential retry.

## How each feed was verified

Each feed was fetched live with curl: 20 s timeout, `--compressed`, and a normal UA. If a feed returned 401/402/403/406/429/202, it was tried once more with the project's own `dope.travel-feed-check/1.0` UA. No proxies, cookies or header tricks were used. Feeds were parsed with feedparser. A feed was kept only if all of these held:

- it returned HTTP 200
- it parsed as valid RSS or Atom
- its items carry dates
- its newest item is less than 30 days old
- its sample titles were checked and are on-topic

Wrong-section feeds and duplicates went to `dropped`. Examples: the SCMP feed ID resolves to Big Tech news, the India Today feed ID resolves to business news, and the Eater "travel" and Atlas Obscura "gastro" tags return the main feeds, which are already in the library. Full method is in the JSON `method` field.

## Per trip type

"Displayable" leaves out signal-only sources.

| Trip type | All | Displayable | Trust A/B (displayable) | Trust A |
|---|---|---|---|---|
| city | 176 | 173 | 99 | 15 |
| culture | 127 | 123 | 79 | 32 |
| food | 124 | 123 | 73 | 13 |
| nightlife | 82 | 81 | 42 | 2 |
| outdoors | 79 | 75 | 59 | 21 |
| luxury | 68 | 61 | 40 | 19 |
| business | 66 | 62 | 35 | 7 |
| adventure | 62 | 56 | 37 | 13 |
| beach | 59 | 56 | 24 | 0 |
| music | 57 | 55 | 34 | 6 |
| ski | 53 | 48 | 36 | 6 |
| sports | 49 | 48 | 31 | 9 |
| festivals | 33 | 31 | 19 | 2 |
| family | 29 | 28 | 7 | 1 |
| points | 29 | 27 | 14 | 3 |
| wellness | 23 | 17 | 9 | 5 |
| deals | 20 | 18 | 8 | 1 |
| road-trip | 19 | 18 | 8 | 2 |
| surf | 18 | 17 | 10 | 0 |
| cruise | 18 | 16 | 2 | 0 |

Every trip type has at least 5 feeds.

## Weak spots

- **Cruise.** Only 2 A/B displayable feeds (Cruise Industry News, Seatrade). Cruise Critic news and boards return 403. Most of the rest are fan or news blogs such as Cruise Hive and Cruise Radio.
- **Surf.** No A-trust feed. Surfline and Coastalwatch return 403, the WSL feed is 404, Surfer's Journal has an empty feed, and Surfing World is 404. Coverage rests on Stab, Surfer, The Inertia, Carve, Tracks, Swellnet and Wavelength.
- **Family.** Almost all Disney or theme-park blogs. General family-travel publishers are stale or blocked: Family Traveller (connection failure), Trekaroo (67 days stale), Mommy Points (unreachable).
- **Deals.** Secret Flying returns 403, and Going, Jack's Flight Club and Airfare Watchdog have no feed. Deal feeds are commercial and should go to review, not auto-publish.
- **Road-trip.** Mostly RV trade and blogs. Only In Your State and Expedition Portal return 403, Overland Journal is 404, and Roadtrippers has an empty feed.
- **Wellness.** Mostly medical or psychedelic policy feeds carried from v1. Spa and retreat trade (Spa Business, Well+Good, Spa Executive) returns HTML, not a feed.
- **Festivals.** The dedicated festival sites are blocked or have no feed: Festicket, Music Festival Wizard, eFestivals, Resident Advisor, UK Festival Guides and the Edinburgh Fringe. Coverage comes from music media (Consequence, NME, DJ Mag, Billboard touring, IQ, Access All Areas) instead.
- **Time Out has no RSS anywhere.** Every city path returns 404, so city coverage comes from Secret Media (21 cities live), Concrete Playground, Eater (16 cities) and alt-weeklies. Eater Dallas, Nashville, Carolinas, Twin Cities, Detroit, Denver and Phoenix are stale.
- **Big names that block bots.**
  - Dotdash Meredith sites return HTTP 402: Food & Wine, Serious Eats, Liquor.com, Travel + Leisure, Southern Living, Treehugger.
  - Other 403s: Golf Digest, ATP, Executive Traveller, PhocusWire, National Parks Traveler, GearJunkie, Fodor's, Travel Weekly.
  - No feed (404): The Infatuation, Thrillist, Michelin Guide, Nat Geo Travel, Lonely Planet.
- **Regions.** Asia outside Japan is thin: Thailand 3, South Korea 3, Hong Kong 1, China 1. Africa (11) and the Middle East (9) lean on general news that needs a keyword prefilter. So does most of Latin America and the Caribbean. The travel-specific exceptions are Caribbean Journal, Riviera Maya News, México Desconocido, Travesías, Tourism Update and Getaway.
- **Forums.** FlyerTalk, TripAdvisor, TGR, Fodor's and iRV2 return 403. Thorn Tree and DIS Boards serve HTML instead of a feed. Community signal comes from 18 Reddit subreddits plus Cruise Critic Boards, SkiTalk, WDWMagic, Backpacking Light, Travel Stack Exchange, Tildes, Lemmy and Mastodon. All are `signal_only: true`.
- **Reddit, contrary to the brief.** Reddit did *not* return 403 here. Sequential fetches with 6–10 s spacing returned HTTP 200 for 18 subreddits (3 from v1, 15 new). Burst fetches got 429. r/churning (still 429) and r/F1Travel (403) are in `dropped`. Reddit's terms still limit it to signal-only use.
- **Volume.** Displayable feeds add up to about 46.5k items a week, most of it from high-volume general news. Per-source daily caps and topic prefiltering are needed before any model-scoring step.
