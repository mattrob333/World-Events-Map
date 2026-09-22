# MERIDIAN P0 Research Notes — Source Access

**Checked:** 2026-09-22 (America/New_York)  
**Deliverable:** `docs/data/SOURCE-ACCESS-MATRIX.md`  
**Constraint:** Official public docs only; no restricted-endpoint scraping; no invented pricing; no secrets.

---

## Method

- WebSearch + WebFetch / curl against vendor portals.
- Prefer: developer.ticketmaster.com, docs.predicthq.com / predicthq.com/legal, docs.x.com / developer.x.com, serpapi.com, developers.amadeus.com, besttime.app, typesafe.ai / api.typesafe.ai.
- Ambiguous or unpublished fields marked **unknown / not published / needs legal review**.
- Accounts/keys **not** created in this task.

---

## Evidence URL index (official)

### Ticketmaster
- Terms: https://developer.ticketmaster.com/support/terms-of-use/
- Partner terms: https://developer.ticketmaster.com/support/terms-of-use/partner/
- Getting started / rate limits: https://developer.ticketmaster.com/products-and-docs/apis/getting-started/
- Discovery API v2: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
- FAQ: https://developer.ticketmaster.com/support/faq/

### PredictHQ
- Terms of Service: https://www.predicthq.com/legal/terms
- Docs home: https://docs.predicthq.com/
- API quickstart: https://docs.predicthq.com/getting-started/api-quickstart
- Rate limits: https://docs.predicthq.com/api/overview/rate-limits
- Attribution: https://docs.predicthq.com/api/overview/attribution
- Pricing (demo-oriented): https://www.predicthq.com/pricing

### X
- Overview: https://docs.x.com/overview
- Pay-per-use pricing: https://docs.x.com/x-api/getting-started/pricing
- Developer Agreement: https://docs.x.com/developer-terms/agreement
- Developer Policy: https://docs.x.com/developer-terms/policy
- Restricted use cases: https://docs.x.com/developer-terms/restricted-use-cases
- Developer portal / purchase: https://developer.x.com/ · https://console.x.com

### SerpAPI / Google Trends
- Google Trends engine: https://serpapi.com/google-trends-api
- Pricing: https://serpapi.com/pricing
- Legal / ToS: https://serpapi.com/legal

### Amadeus
- Portal announcement (self-service decommissioned 2026-07-17): https://developers.amadeus.com/
- Legacy pricing guide: https://amadeus4dev.github.io/developer-guides/pricing/
- Legacy FAQ: https://amadeus4dev.github.io/developer-guides/faq/

### BestTime
- Home: https://besttime.app/
- Pricing: https://besttime.app/subscription/pricing
- Terms: https://besttime.app/terms

### TypeSafe / Jev
- Master Customer Agreement: https://typesafe.ai/legal/mca
- Launch / pricing blog (2026-09-15): https://typesafe.ai/blog/introducing-system-one-models-and-jev
- Console: https://console.typesafe.ai
- Endpoint (from public quickstarts): `POST https://api.typesafe.ai/v1/systemone`

---

## Key findings (compressed)

1. **BestTime** is the clearest **GO** for a travel-ideas UI that shows busy-time insights without reselling raw foot-traffic data.
2. **Amadeus Self-Service** is **BLOCKED** as of 2026-07-17 per official portal copy; Enterprise negotiation required.
3. **PredictHQ** commercial use needs paid Starter/Premium; default ToS bans cache/store, many derivatives, and **AI Tool** use without Order Form — high friction for MERIDIAN’s judgment pipeline.
4. **Ticketmaster** Discovery is free with 5k/day limits but General ToU restricts deriving revenue; affiliate/Partner path likely for monetized product; cache only “reasonable periods.”
5. **X** is pay-per-use with published unit prices; display allowed with compliance; hydrated redistribution tightly capped — fine for internal momentum → derived ideas if Display Requirements followed.
6. **SerpAPI** pricing and commercial Service use are clear; **Google Trends content** license for end-product display remains a legal open question.
7. **TypeSafe/Jev** MCA allows embedding in Customer Applications and assigns Output to Customer; early-access waitlist + credits; published $0.042/MTok input.

---

## Open questions

| # | Question | Owner |
|---|----------|--------|
| Q1 | Does Ticketmaster consider a monetized “travel ideas” product that *links* to Ticketmaster events as “deriving revenues from the API” under §11, or is Impact affiliate sufficient? | Legal / Matt |
| Q2 | Where is the current Ticketmaster branding guide? (branding path 404’d on 2026-09-22) | Product / TM support |
| Q3 | PredictHQ: exact Starter pricing for MERIDIAN city/category set; which Permitted Use Extensions are mandatory for AI-derived ideas? | EA + PredictHQ sales |
| Q4 | PredictHQ plan flag: is attribution (“Events by PredictHQ”) required on our plan? | After signup |
| Q5 | X: will MERIDIAN’s disclosed use case stay on pay-per-use, or will Policy push Enterprise? | Matt after developer application |
| Q6 | X Display Requirements HTML specifics for non-embedded derived summaries (scores only, no Post UI)? | Legal |
| Q7 | Does Google’s ToS allow commercial use of Trends *values* obtained via SerpApi in a consumer travel app? | Legal |
| Q8 | Amadeus Enterprise: timeline, minimum commit, flight+hotel SKU, caching of offers? | EA / Amadeus sales |
| Q9 | BestTime: any unpublished rate/concurrency limits beyond credits? | BestTime support if needed |
| Q10 | TypeSafe: waitlist ETA; Usage Limits on early-access Orders; DPA needs? | Matt / TypeSafe |
| Q11 | Cross-source: can PredictHQ (or Ticketmaster) data be included in TypeSafe `state` without violating upstream AI/cache clauses? | Legal — **gate before wiring** |
| Q12 | Repo: are any `.env` keys already provisioned in secrets managers? (LIVE-SETUP says not provisioned; not re-verified here) | Matt / infra |

---

## Next actions (Source Rights / EA)

Per **Decision lock 2026-09-22**: HOLD commercial Amadeus / PredictHQ / Ticketmaster. Do **not** start sales or paid Order Forms for those three. Escalate to EA only when a key or payment blocks the next demo.

1. **Do not** create paid commercial paths for Amadeus, PredictHQ, or Ticketmaster while the lock holds.
2. When demo needs require it, Source Rights may create **free/dev** signups with project email for: BestTime, SerpAPI free tier, TypeSafe waitlist/early-access, and X developer app (no credits purchase until spend is needed for the next demo).
3. Prefer **honest fixtures** / `unconfigured` for Ticketmaster, PredictHQ, and Amadeus adapters until the lock is lifted.
4. Escalate to EA **only if** BestTime, TypeSafe, SerpAPI, or X free quota cannot ship the next demo without a key or payment.
5. Legal memos for Google Trends via SerpApi / Ticketmaster §11 / PredictHQ AI injection remain useful later but are **not** active commercial escalations under this lock.
6. Cross-check World-Events-Map adapters against this matrix before production wiring of any live vendor.
7. Re-check Amadeus portal and Ticketmaster branding URLs quarterly (informational; not a sales trigger).

---

## Status counts (from matrix)

- **GO:** 1 (BestTime)
- **CONDITIONAL:** 5 (Ticketmaster, PredictHQ, X, SerpAPI/Trends, TypeSafe)
- **BLOCKED:** 1 (Amadeus Self-Service)
- **RESEARCH:** 0

### Top escalations (active under Decision lock)

**HOLD — do not escalate commercially:** Amadeus Enterprise · PredictHQ paid/Order Form · Ticketmaster affiliate/Partner sales.

Escalate to EA only when a key/payment blocks the next demo:

1. BestTime key (or paid tier) if required for a live NOW / busy-time demo  
2. TypeSafe / Jev early-access or credits if a live judgment demo is required  
3. SerpAPI and/or X credits only if Trends/social momentum is in the next demo and free quota is insufficient

### Commercially blocked / high-friction for derived travel ideas (under lock)
- **HOLD + blocked self-service:** Amadeus — fixtures / `unconfigured` only  
- **HOLD commercial:** PredictHQ and Ticketmaster — fixtures / `unconfigured`; no paid Order Forms or affiliate sales push  
- **BUILD (free/conditional):** BestTime (GO), X, SerpAPI/Trends, TypeSafe — honest fixtures until keys needed for demo

---

*Notes end — 2026-09-22*


---

## Decision lock (2026-09-22) — Matt via EA

HOLD commercial paths for Amadeus, PredictHQ, Ticketmaster (no sales / paid Order Forms).
BUILD on BestTime (GO) + free/conditional sources with honest fixtures.
Escalate to EA only when a key/payment blocks the next demo.
SOURCE-ACCESS-MATRIX updated accordingly.
