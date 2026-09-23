# A trip worth starting together

The winter entry point should answer a family's decision in this order: **where can we ski, when is the right week, can both households stay together, and what would the whole trip cost from our origin?** The same flow should work for beach, desert, culture, and other seasons without forcing every traveler through a generic destination directory.

## Product path

1. **Choose a season and a feeling.** World discovery switches its curated cards and departure board to relevant places and dates. A place selection updates both the globe route and the event story beside it.
2. **Start a trip with a small brief.** Ask for origin, date window, adults and children, the other household, region options, lodging priorities, and a spending target. Keep the first step short; deeper preferences belong in the private room. A family ski starter compares the Rockies and the Alps without claiming either is cheaper until dated, like-for-like quotes exist.
3. **Bring in the other family.** Share a room link, require sign-in and the room's existing membership approval, then let everyone save places, add source links, react, and vote on week, mountain, and lodging tradeoffs. A link must never make private preferences publicly readable.
4. **Build a sourced trip brief.** Search dated official snow reports, forecasts, travel stories, videos, events, and supplier listings. Jev judges relevance, freshness, quality, and fit for the group's stated needs; code enforces source dates, destination identity, rights, and budget limits first. Show why an item was selected and let members open the original source. Member-specific research needs a private, rate-limited job and storage path; the existing public research sweep is not a private trip planner.
5. **Compare the whole trip.** Display the same travel window and group size for each destination, including flights from the origin, ground transfer, lodging capacity, lift tickets, lessons, rentals, and cancellation terms. Label each price with supplier, currency, quote time, and availability status. Never infer ski-in/ski-out or family capacity from a travel article.
6. **Stay ahead of changes.** Watches should rerun only at a controlled cadence and notify the room when a meaningful source-backed change occurs, such as a verified lodging option, event date, or snow report. The after-arrival handoff to NOW uses the group's intent for local decisions, while asking for a fresh location then.

## Evidence shown to travelers

Use three visibly different labels: **Official report** for resort-reported lift/snow status, **Forecast** for modeled future weather, and **Editorial** for curated occasions or social conversation. A social post can explain what a place feels like; it cannot certify snowfall, availability, or a bookable price. Show the report date and source next to every changing claim. Rank a ski area only within an explicit question such as family terrain, current snow, expected snow, or total trip value.

Official source checks already identified for the first winter shortlist: [Aspen Snowmass](https://www.aspensnowmass.com/four-mountains/aspen-mountain/snow-and-grooming-report), [Engadin/St. Moritz](https://www.engadin.ch/en/reports/snowsports-report), [Verbier](https://verbier4vallees.ch/en/useful-information/live-information-winter), and [Zermatt](https://zermatt.swiss/en/info/weather/snow-report). These are outbound references, not licensed data feeds. A production snow forecast provider needs a commercial-use contract; the [Open-Meteo free endpoint is noncommercial](https://open-meteo.com/en/pricing).

## Activation boundary

The public Exa/Treg/Jev research sweep, destination feed, and NOW venue engine have code paths but need a dedicated Supabase project with migrations, server-side credentials, provider access, and hosted acceptance checks. The current Vercel project `world-events-map-onq7` has none of the Supabase, Exa, Treg, TypeSafe, or BestTime variables. Preview deployments show the curated calendar and honest unconfigured states; [Vercel runs cron jobs only on production deployments](https://vercel.com/docs/cron-jobs/quickstart). The first private trip-research job, supplier price comparison, and change alerts are further product work after the shared room and public source sweep are connected.
