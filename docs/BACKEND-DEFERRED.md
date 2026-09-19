# Backend plumbing deferred from the UX sprint

This sprint built frontend contracts and fixture-backed flows. The following remains explicitly out of scope until a high-capability review and real credentials exist.

## Not in this branch

- PR #8 profile migrations (005–007) and connection RLS
- Remote profile image proxying
- Live member directory / public profile RPC
- Inspiration persistence (votes and boards are local preview / fixtures)
- Save / Watch / I'd go server persistence (device-local only)
- Push or email notifications for Watch
- Weather vendor (calendar-season provider only)
- YouTube / Instagram official APIs
- Avinode or any live aviation inventory
- Hotel booking inventory or confirmed holds
- Analytics vendor (console / no-op adapter)
- Real-time Circle chat replacement
- Complex itinerary engine

## Contracts ready for later wiring

| Contract | Path | Honest current source |
|---|---|---|
| DestinationPulse | `src/lib/pulse` | Curated events + modeled buzz |
| InspirationItem | `src/lib/inspiration` | Editorial fixtures |
| OpportunityCard | `src/lib/access` | Inquiry-first fixtures |
| Product events | `src/lib/analytics` | Dev console adapter |
| Intent verbs | `src/lib/intent` | localStorage |
| WeatherContextProvider | `src/lib/pulse/season.ts` | Seasonal calendar, not live weather |

Live Circles, offers, inquiries and NOW continue to use the existing Supabase / provider paths. New UX surfaces must not pretend those backends already cover destinations, inspiration, or traveler identity.
