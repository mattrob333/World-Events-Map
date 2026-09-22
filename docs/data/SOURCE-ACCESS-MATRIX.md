# MERIDIAN — Priority 0 SOURCE-ACCESS-MATRIX

**Product:** MERIDIAN (travel intelligence / travel ideas from signals)  
**Scope:** Commercial API access rights — official public documentation only  
**Checked date:** 2026-09-22  
**Method:** WebSearch + WebFetch/curl of vendor developer portals, pricing pages, and terms. No restricted-endpoint scraping. No invented pricing or terms. No secrets in this file.

**Use-case assumption:** MERIDIAN displays *derived travel ideas / signals* to end users (not raw data marketplace redistribution), unless noted otherwise.

---

## Summary status table

| # | Source | Category | Status | One-line reason |
|---|--------|----------|--------|-----------------|
| 1 | Ticketmaster Discovery API | events | **CONDITIONAL** | Free public Discovery API exists; General ToU restricts deriving revenue / long caching; affiliate or partner path may be required for commercial product |
| 2 | PredictHQ | events | **CONDITIONAL** | Commercial use requires paid Starter/Premium; default ToS bars cache/store, derivatives, and AI tools unless Order Form extensions granted |
| 3 | X (Twitter) API | social | **CONDITIONAL** | Pay-per-use commercial access exists; display OK with Display Requirements; redistribution of hydrated content heavily restricted |
| 4 | Google Trends via SerpAPI | trends | **CONDITIONAL** | SerpAPI plans/pricing public; SerpApi ToS allow paid commercial use of *service*; Google Trends *content* rights still need legal review |
| 5 | Amadeus (flights/hotels self-service) | flights | **BLOCKED** | Official portal states self-service decommissioned 2026-07-17; Enterprise path only |
| 6 | BestTime | venues | **GO** | ToS explicitly allows commercial in-app display of API data as Derivative Work; forbids raw/standalone data resale |
| 7 | TypeSafe / Jev (`api.typesafe.ai`) | judgment | **CONDITIONAL** | MCA allows Customer Applications + Output assignment; early-access / waitlist / credits required |

**Counts:** GO **1** · CONDITIONAL **5** · BLOCKED **1** · RESEARCH **0**

### Top escalations for Matt / EA

1. **Amadeus Enterprise commercial negotiation** — self-service gone; need sales/Enterprise access for flight/hotel signals.  
2. **PredictHQ paid plan + Order Form** — Permitted Use Extensions for Storage / Data Analysis / Data Enrichment / AI Tool use; payment + legal signature.  
3. **Ticketmaster commercial / affiliate path** — General ToU §11 revenue restriction; confirm Discovery vs Partner/affiliate for monetized travel-ideas product; branding review for rate-limit increases.

---

## Repo inventory (stub)

**Repo:** https://github.com/mattrob333/World-Events-Map  

**Adapters on `main` (cross-check separately; do not treat as rights clearance):**

| Adapter path | Likely source |
|--------------|---------------|
| `src/lib/data/adapters/ticketmaster.ts` | Ticketmaster |
| `src/lib/data/adapters/predicthq.ts` | PredictHQ |
| `src/lib/data/adapters/amadeus.ts` | Amadeus |
| `src/lib/data/adapters/googleTrends.ts` | SerpAPI / Google Trends |
| `src/lib/data/adapters/x.ts` | X API |
| `src/lib/opportunities/besttime.ts` | BestTime |
| `src/lib/opportunities/typesafe.ts` | TypeSafe / Jev |

**Env vars in `.env.example` (names only):** `TICKETMASTER_API_KEY`, `PREDICTHQ_TOKEN`, `X_BEARER_TOKEN`, `X_POSTS_ENABLED`, `SERPAPI_KEY`, `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`, `BESTTIME_API_KEY_PRIVATE`, `TYPESAFE_API_KEY`, `TYPESAFE_MODEL=jev-latest`

**Notes from `LIVE-SETUP.md` (repo docs, not vendor ToS):** credentials not provisioned; Amadeus targets `api.amadeus.com` (prod); X usage-billed; cron refreshes 2 events/batch every 10 min.

**key obtained? / credential stored? / smoke test?** for all sources below: **unknown / unknown / no** — repo secrets not verified in this research task.

---

## 1. Ticketmaster Discovery / API

| Field | Value |
|-------|--------|
| **source** | Ticketmaster Discovery API (public / Open API tier) |
| **category** | events |
| **official API?** | **yes** — https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/ · getting started: https://developer.ticketmaster.com/products-and-docs/apis/getting-started/ |
| **authentication** | API key (`apikey` query param) |
| **account owner** | TBD (Matt) |
| **commercial-use status** | **restricted** — General Terms prohibit selling/leasing/sublicensing the API or *deriving revenues* from use/provision of the API “except as set forth below” (affiliate/partner exceptions referenced; Partner API is separately gated). Cite: https://developer.ticketmaster.com/support/terms-of-use/ |
| **pricing** | Public Discovery access: free with default quota (no published per-call price for Discovery). Higher limits case-by-case after ToS/branding/data-display review. Partner/affiliate commerce: contact Ticketmaster / Impact affiliate program. |
| **rate limits** | Default: **5000 calls/day** and **5 requests/second** (getting-started). FAQ also mentions **2 rps / 5000/day** for Public APIs — treat published numbers as **5000/day** and **2–5 rps**; escalate if FAQ vs getting-started conflict. |
| **display rights** | Event Content owned by organizers and/or Ticketmaster; license for app use subject to ToU. Must remove Event Content within **24 hours** if owner asks. Must not replicate Ticketmaster’s essential UX. Branding guide compliance required for rate-limit increases (branding URL previously linked from getting-started; page returned 404 at check — **needs legal/product review** of current branding assets). |
| **caching rights** | **Restricted** — shall not “Cache or store any Event Content other than for reasonable periods in order to provide the service you are providing.” |
| **retention rights** | Only “reasonable periods” for service provision; removal within 24h on owner request. Longer retention **unknown / needs legal review**. |
| **redistribution rights** | **Restricted / prohibited** as data resale — no sell/lease/sublicense of API or access; Partner Feed is partners-only. |
| **attribution requirements** | Branding guide compliance referenced for rate increases; specific footer/logo rules **not verified** from a live branding page on 2026-09-22 (404). Mark **needs legal review**. Privacy disclosures required in app footer/privacy policy. |
| **real-time / polling** | Polling Discovery search/detail endpoints. ToU: Ticketmaster may rate-limit/block apps making large call volumes *not primarily in response to direct user actions*. |
| **refresh cadence** | Recommended for travel-signal: **hourly–daily** event discovery per metro; prefer user-driven lookups for live detail; avoid aggressive background harvest (ToU + quota). Discovery Feed (partners) claims hourly refreshes — not available without partner approval. |
| **geographic coverage** | Global (getting-started: “Event coverage is global”; International Discovery consolidating into Discovery). |
| **fields needed for MERIDIAN** | Event name, dates/times, venue name/location, attractions, classifications/genre, price ranges (where present), Ticketmaster URL, images. |
| **key obtained?** | unknown |
| **credential stored?** | unknown |
| **smoke test?** | no |
| **contract/approval required?** | Likely **yes** for monetized product (affiliate Impact account and/or Partner agreement). Free Discovery signup available for prototyping — **do not create accounts in this task**; Source Rights may later use project email. |
| **blockers / escalate to EA/Matt** | Payment for affiliate/partner if required; legal review of §11 revenue restriction vs “derived travel ideas”; branding approval for higher quota; KYC/publisher onboarding via Impact for affiliate. |
| **evidence URLs** | https://developer.ticketmaster.com/support/terms-of-use/ · https://developer.ticketmaster.com/products-and-docs/apis/getting-started/ · https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/ · https://developer.ticketmaster.com/support/faq/ · https://developer.ticketmaster.com/support/terms-of-use/partner/ |
| **checked_date** | 2026-09-22 |

---

## 2. PredictHQ

| Field | Value |
|-------|--------|
| **source** | PredictHQ (Events / Features / Forecasts / Beam APIs) |
| **category** | events |
| **official API?** | **yes** — https://docs.predicthq.com/ · API quickstart https://docs.predicthq.com/getting-started/api-quickstart |
| **authentication** | Bearer API token (`Authorization: Bearer $API_TOKEN`) |
| **account owner** | TBD (Matt) |
| **commercial-use status** | **restricted** until paid plan — Trial/complimentary use limited to internal testing; Commercial Use forbidden until paid **Starter** or **Premium**. Cite: https://www.predicthq.com/legal/terms (§3.7(c), Glossary “Commercial Use”) |
| **pricing** | Plans: **14-Day Trial**, **Starter** (priced by Event Categories + Cities — numbers on signup/Website, not fully published as a fixed public grid), **Premium** (separately agreed). Public page is “Book demo” / compare features: https://www.predicthq.com/pricing → treat as **contact sales / book demo** for production numbers. |
| **rate limits** | Plan-specific **rps** (requests per second), organization-wide; exceed → HTTP **429**. Exact rps **not published** on docs page (plan-dependent). https://docs.predicthq.com/api/overview/rate-limits |
| **display rights** | API customers may “use, display, frame, transmit and make available” PredictHQ Data for own products/services under Permitted Use. **Must not** display on ticketing/reseller platforms. Attribution may be required (see below). |
| **caching rights** | **Default: prohibited** without written agreement — must not cache/store/download/retain PredictHQ Data unless agreed in writing. **Storage** Permitted Use Extension available via Order Form. |
| **retention rights** | On termination: permanently delete PredictHQ Data **and Derived Data**. With Storage extension: store for Approved Application display only. |
| **redistribution rights** | **Prohibited** without prior written consent — no sell/rent/lease/sublicense of API or data; no make available to third parties. |
| **attribution requirements** | If plan requires attribution: display **“Events by PredictHQ”** near data (optional link to predicthq.com). https://docs.predicthq.com/api/overview/attribution |
| **real-time / polling** | REST polling of Events/Features APIs; docs describe pipeline (Saved Locations → Beam → Features/Events). |
| **refresh cadence** | Recommended: **daily** Features/Events refresh per Saved Location for travel demand signals; follow PredictHQ “Standard integration” guidance (docs) once subscribed. Exact vendor-recommended cadence **not published** as a single number — mark **unknown** beyond product judgment. |
| **geographic coverage** | Global; marketed as 100M+ events, 19 categories (pricing/marketing page). City/category access gated by plan. |
| **fields needed for MERIDIAN** | Event title, category, start/end, geo, venue, rank/phq_attendance or impact features, predicted spend/impact (advanced), Beam analysis_id linkage for explainability. |
| **key obtained?** | unknown |
| **credential stored?** | unknown |
| **smoke test?** | no |
| **contract/approval required?** | **Yes** for commercial MERIDIAN — paid Starter/Premium + almost certainly **Order Form** for Storage / Data Analysis / Data Enrichment / **AI Tool** use (ToS §4.5(j) bans injecting PredictHQ Data into AI tools without Order Form authorization). |
| **blockers / escalate to EA/Matt** | Payment (Starter/Premium); legal signature on Order Form for AI + derived travel ideas; negotiate Permitted Use Extensions; confirm attribution plan flag. |
| **evidence URLs** | https://www.predicthq.com/legal/terms · https://docs.predicthq.com/ · https://docs.predicthq.com/getting-started/api-quickstart · https://docs.predicthq.com/api/overview/rate-limits · https://docs.predicthq.com/api/overview/attribution · https://www.predicthq.com/pricing |
| **checked_date** | 2026-09-22 |

**MERIDIAN note:** A product that feeds PredictHQ events into AI judgment layers (e.g. TypeSafe/Jev) is **explicitly restricted** under default ToS until Order Form grants AI Tool permission. Escalate before build.

---

## 3. X (Twitter) API

| Field | Value |
|-------|--------|
| **source** | X API v2 (pay-per-use) + Enterprise (high volume) |
| **category** | social |
| **official API?** | **yes** — https://docs.x.com/ · https://developer.x.com/ · pricing docs https://docs.x.com/x-api/getting-started/pricing |
| **authentication** | OAuth 1.0a / OAuth 2.0 / Bearer (app-only) depending on endpoint — see https://docs.x.com/fundamentals/authentication/overview.md |
| **account owner** | TBD (Matt) |
| **commercial-use status** | **allowed** under paid Licensed Material for commercial Services, subject to Developer Agreement + Policy. Non-commercial-designated access cannot make Commercial Use. Cite: https://docs.x.com/developer-terms/agreement (III.B) · Policy https://docs.x.com/developer-terms/policy |
| **pricing** | **Pay-per-usage** (no subscriptions). Published unit costs (docs, subject to change; console authoritative): Posts Read **$0.005**/resource; Users Read **$0.010**; Post Create **$0.015** (**$0.200** with URL); Trends **$0.010**/request; Owned Reads **$0.001**/resource when applicable. Cap: **3M Post reads / monthly billing cycle** on pay-per-use → Enterprise above that. Purchase: https://console.x.com · https://developer.x.com/#pricing |
| **rate limits** | Endpoint-specific Rate Limits (docs fundamentals). Exact tables not fully captured in this pass — **published per-endpoint**; do not invent. Circumvention prohibited (Agreement III.D). |
| **display rights** | License to copy a reasonable amount and display X Content to Users; modify only for formatting. Must follow **Display Requirements**. Keep displayed content current via API; remove if unavailable / within **24h** of removal request. Offline/broadcast rules apply. Sites with **>10M daily impressions** must contact X. |
| **caching rights** | Offline storage allowed only if kept compliant/current with X state; delete/modify when deleted/modified on X (asap / within 24h of request). Location data: may not aggregate/cache/store location except with the attached X Content. |
| **retention rights** | Subject to content-compliance deletion rules above. No training/fine-tuning foundation models on X Content (Agreement III.A(k)). |
| **redistribution rights** | **Heavily restricted** — generally redistribute only Post IDs / DM IDs / User IDs for rehydration. Limited hydrated redistribution: up to **50,000** hydrated public Post/User Objects per recipient per day, non-public; Post ID volume caps (e.g. **1.5M** Post IDs to a single entity / 30 days without written permission). Cite Policy “Content redistribution” + Restricted Use Cases. |
| **attribution requirements** | Use X Marks only to attribute X as source; Brand Guidelines; Display Requirements. |
| **real-time / polling** | REST polling + Activity/webhook options (webhook events billed). Recent search / posts endpoints for momentum signals. |
| **refresh cadence** | Recommended for travel-signal: **15–60 min** keyword/geo topic polls for destination momentum; minimize re-fetches (24h UTC dedup billing). Align with World-Events-Map note (usage-billed). |
| **geographic coverage** | Global platform; Trends endpoint available (billed). |
| **fields needed for MERIDIAN** | Post text/IDs, created_at, public metrics (likes/reposts/replies), geo/place if present, author public metrics, trend topics — used as **momentum signals**, not redistributed feeds. |
| **key obtained?** | unknown |
| **credential stored?** | unknown |
| **smoke test?** | no |
| **contract/approval required?** | Developer account application + accept Agreement; disclose use case. Payment method for credits. Enterprise if >3M post reads/mo or out-of-scope vs hobbyist/prototyping language in Policy. Phone verification noted in Agreement for Paid Services. |
| **blockers / escalate to EA/Matt** | Credit card / prepaid credits; developer use-case approval; legal review that “derived travel ideas” ≠ prohibited redistribution or off-X ad targeting; spend caps. |
| **evidence URLs** | https://docs.x.com/x-api/getting-started/pricing · https://docs.x.com/developer-terms/agreement · https://docs.x.com/developer-terms/policy · https://docs.x.com/developer-terms/restricted-use-cases · https://docs.x.com/overview · https://developer.x.com/ · https://console.x.com |
| **checked_date** | 2026-09-22 |

---

## 4. Google Trends via SerpAPI

| Field | Value |
|-------|--------|
| **source** | SerpApi Google Trends API (`engine=google_trends`) |
| **category** | trends |
| **official API?** | **yes (SerpApi)** — https://serpapi.com/google-trends-api · SerpApi is **not** Google’s official Trends API; it scrapes/parses Google Trends. |
| **authentication** | SerpApi API key (`api_key`) |
| **account owner** | TBD (Matt) |
| **commercial-use status** | **allowed** for use of SerpApi *Service* under SerpApi Terms (paid plans for production). Cite: https://serpapi.com/legal — prohibit illegal use; prohibit reselling *the Service* without permission. **Google’s terms governing Trends *content*** for commercial display/derivatives: **unknown / needs legal review** (not published via SerpApi as a Google license). |
| **pricing** | Published (USD/mo): Free **$0** / 250 searches / 50/hr; Starter **$25** / 1,000 / 200/hr; Developer **$75** / 5,000 / 1,000/hr; Production **$150** / 15,000 / 3,000/hr; Big Data **$275** / 30,000 / 6,000/hr; … up through Cloud 54M **$106,050**/mo. Enterprise: contact@serpapi.com. https://serpapi.com/pricing |
| **rate limits** | Per-plan **searches/month** + **throughput/hour** (table above). HTTP **429** when exhausted. Cached identical queries (1h TTL) are **free** and do not count. |
| **display rights** | SerpApi: no explicit display license for Google Trends UI reproduction in ToS excerpt reviewed — **needs legal review**. Practical product pattern: show **derived interest indices / destination scores**, not raw Google Trends pages. |
| **caching rights** | SerpApi caches responses **1 hour** server-side (free). Customer-side caching of results: **not explicitly detailed** in SerpApi ToS excerpt → **unknown / needs legal review** (esp. Google content). |
| **retention rights** | SerpApi retains search data **31 days** (ZeroTrace on enterprise Cloud plans skips storage). Customer retention of Trends payloads: **unknown** re Google. |
| **redistribution rights** | SerpApi: do not sell/resell/exploit Service without written permission. Redistributing Trends datasets: **unknown / needs legal review**. |
| **attribution requirements** | Not mandated in SerpApi ToS excerpt reviewed. Google branding/attribution for Trends: **unknown / needs legal review**. |
| **real-time / polling** | On-demand search; not a push feed. `no_cache=true` forces live fetch (costs a credit). |
| **refresh cadence** | Recommended for travel-signal: **daily** interest-over-time / related queries per destination keyword set; weekly geo breakdown. Stay within hourly throughput. |
| **geographic coverage** | Worldwide + `geo` / region params per SerpApi Google Trends docs (Google-supported locations list). |
| **fields needed for MERIDIAN** | Interest over time values, interest by region, related queries/topics — for destination **momentum**. |
| **key obtained?** | unknown |
| **credential stored?** | unknown |
| **smoke test?** | no |
| **contract/approval required?** | Self-serve SerpApi signup OK for Free/paid. Production+ includes U.S. Legal Shield (scraping/parsing liability up to $2M for *collection*, not end-use). **Legal review** still needed for Google Trends commercial end-use. |
| **blockers / escalate to EA/Matt** | Payment for Production+ plan; legal review of Google Trends content rights for travel-product display; optional DPA (privacy@serpapi.com). |
| **evidence URLs** | https://serpapi.com/google-trends-api · https://serpapi.com/pricing · https://serpapi.com/legal |
| **checked_date** | 2026-09-22 |

---

## 5. Amadeus (flights / hotels self-service)

| Field | Value |
|-------|--------|
| **source** | Amadeus for Developers — historically Self-Service Flight/Hotel APIs; now Enterprise portal |
| **category** | flights (also hotels) |
| **official API?** | **yes (Enterprise path)** — https://developers.amadeus.com/ announces: *“Amadeus for Developers self-service portal has been decommissioned on July 17th, this website is for Amadeus Enterprise API Portal only.”* Legacy guides: https://amadeus4dev.github.io/developer-guides/ |
| **authentication** | OAuth2 client credentials (historical Self-Service: `AMADEUS_CLIENT_ID` / `SECRET`) — Enterprise auth details via Amadeus onboarding (**not fully public**). |
| **account owner** | TBD (Matt) |
| **commercial-use status** | **Self-Service: effectively unavailable / blocked** as of decommission (2026-07-17). Historical Test ToU PDFs prohibited commercial use without explicit agreement. Production Self-Service previously allowed business models (FAQ) under production terms — **superseded by decommission**. Enterprise: **contact sales** / request access. |
| **pricing** | Historical Self-Service: free monthly quota then per-API PAYG (pricing page redirected/legacy). Current Enterprise: **contact sales / not published** on public self-serve grid. |
| **rate limits** | Historical Self-Service rate limits documented in legacy guides; current Enterprise limits **not published** publicly → **unknown**. |
| **display rights** | **unknown** under Enterprise agreement (not public). |
| **caching rights** | **unknown** (Enterprise). |
| **retention rights** | **unknown** (Enterprise). |
| **redistribution rights** | **unknown** (Enterprise); expect contract restrictions typical of GDS/travel APIs. |
| **attribution requirements** | **unknown** / needs Enterprise docs. |
| **real-time / polling** | Flight Offers Search / Hotel Search style request-response (historical). |
| **refresh cadence** | Recommended if restored: **on-demand** for idea cards + short TTL cache for prices (prices stale quickly); do not run until Enterprise rights clear. |
| **geographic coverage** | Global Amadeus inventory (historical Self-Service subset vs full Enterprise catalog). |
| **fields needed for MERIDIAN** | Flight offer prices/duration/airlines; hotel offers/prices/location — for travel-idea **price anchors**. |
| **key obtained?** | unknown |
| **credential stored?** | unknown |
| **smoke test?** | no |
| **contract/approval required?** | **Yes** — Enterprise access request; commercial negotiation; likely KYC/business verification. |
| **blockers / escalate to EA/Matt** | **BLOCKER:** Self-Service decommissioned. Escalate to Amadeus Enterprise sales; budget; legal review of Enterprise terms; alternative flight/hotel providers if timeline critical. |
| **evidence URLs** | https://developers.amadeus.com/ · https://amadeus4dev.github.io/developer-guides/pricing/ · https://amadeus4dev.github.io/developer-guides/faq/ · historical ToU PDFs under developers.amadeus.com `/PAS-EAS/api/v1/cms-gateway/sites/default/files/` (2018/2019 test ToU) |
| **checked_date** | 2026-09-22 |

---

## 6. BestTime (venue busy times)

| Field | Value |
|-------|--------|
| **source** | BestTime.app Foot Traffic / Popular Times API |
| **category** | venues |
| **official API?** | **yes** — https://besttime.app/ · pricing https://besttime.app/subscription/pricing · terms https://besttime.app/terms |
| **authentication** | API key (private key pattern in repo env name `BESTTIME_API_KEY_PRIVATE`) |
| **account owner** | TBD (Matt) |
| **commercial-use status** | **allowed** — ToS §5.3: permitted to use API data in commercial applications/products/services where presented to end-users as part of a functional UI (“Derivative Work”). Cite: https://besttime.app/terms |
| **pricing** | Published metered: **Basic** $0.06/credit (min **$29**/mo); **Pro** $0.009/credit + **$99**/mo (volume breaks $0.006 after 10K credits; $0.001 after 100K). Packages: Pro Package from **~$96–$129**/mo (page shows dual prices); Basic Package **~$299–$329**/mo; Enterprise custom. Credit costs vary by endpoint (filter/name/ID/live/search). https://besttime.app/subscription/pricing |
| **rate limits** | Credit-metered (not a published fixed rps on pricing page). Exact concurrency limits **not published** → unknown beyond credits. |
| **display rights** | **Allowed** in functional UI as Derivative Work. |
| **caching rights** | CDN caching listed as feature on Pro/packages; customer-side caching duration **not explicitly stated** in ToS → **unknown**; reuse `venue_id` Query to reduce credits (product docs pattern). |
| **retention rights** | Account content deleted within 30 days of cancel (account content). Venue forecast retention by customer: **not explicitly stated** → unknown. |
| **redistribution rights** | **Prohibited** without written permission — no redistribute/resell/sublicense raw or analyzed data as standalone product or data marketplace. Partnership licensing via support@besttime.app. |
| **attribution requirements** | Not mandated in ToS excerpt reviewed → **not published** / optional brand discretion. |
| **real-time / polling** | Forecasts (“New Forecast”) + Live data on Pro; Query by venue_id. |
| **refresh cadence** | Recommended for travel-signal: **daily** forecast refresh per watched venue; live only for high-priority venues (costs credits). |
| **geographic coverage** | Depends on third-party signal availability per venue; not guaranteed for every venue (ToS §6). |
| **fields needed for MERIDIAN** | Relative busy % (0–100), daypart forecasts, live busy when available, venue identity — for **crowd / timing** signals on travel ideas. |
| **key obtained?** | unknown |
| **credential stored?** | unknown |
| **smoke test?** | no |
| **contract/approval required?** | Self-serve paid plans available. Enterprise/white-label if needed. **Do not create accounts in this task.** |
| **blockers / escalate to EA/Matt** | Payment method for Basic/Pro; confirm product only shows derived busy insights in UI (fits ToS); contact sales only if raw redistribution or white-label needed. |
| **evidence URLs** | https://besttime.app/terms · https://besttime.app/subscription/pricing · https://besttime.app/ |
| **checked_date** | 2026-09-22 |

---

## 7. TypeSafe / Jev (`api.typesafe.ai`)

| Field | Value |
|-------|--------|
| **source** | TypeSafe AI — System One / Jev API |
| **category** | judgment |
| **official API?** | **yes** — `POST https://api.typesafe.ai/v1/systemone` · console https://console.typesafe.ai · MCA https://typesafe.ai/legal/mca · launch post https://typesafe.ai/blog/introducing-system-one-models-and-jev |
| **authentication** | Bearer API key (`Authorization: Bearer …` / `TYPESAFE_API_KEY`) |
| **account owner** | TBD (Matt) |
| **commercial-use status** | **allowed** under Master Customer Agreement for Customer Applications serving End Users (embed API). **Prohibited:** sell/lease as standalone Service; model distillation / competing model training; reverse engineering. Cite: https://typesafe.ai/legal/mca §§2.1–2.3 |
| **pricing** | Published launch pricing: input **$0.042 per million tokens**; output **free** (“too cheap to meter”). Credits purchased via Order/checkout; promotional credits possible. Exact credit packs beyond blog **contact sales / console**. |
| **rate limits** | Usage Limits per Order — **not published** as a public rps table → unknown / plan-specific. |
| **display rights** | Output assigned to Customer (MCA §4.2); Customer may use Output in Customer Applications. Display of raw probabilistic scores: product choice; TypeSafe disclaims Output accuracy. |
| **caching rights** | Not specifically restricted for Output in MCA excerpt; TypeSafe may delete Customer Data anytime post-term. Caching Output: **not prohibited** in reviewed MCA text → treat as **allowed for product** unless Order says otherwise; still **needs legal review** for edge cases. |
| **retention rights** | TypeSafe under no obligation to retain Customer Data after Term; may delete anytime. Customer-owned Output retention: Customer’s responsibility. |
| **redistribution rights** | Cannot offer Services as standalone; Output ownership with Customer implies product use OK — **not** a license to resell TypeSafe API access. |
| **attribution requirements** | Publicity restricted; TypeSafe may list Customer as customer unless opted out. No mandatory “powered by” for Output in MCA excerpt → **not published**. |
| **real-time / polling** | Synchronous `systemone` call (~70–500ms claimed); no streaming/batch/async job API per community quickstart aligned with TypeSafe docs. |
| **refresh cadence** | Recommended: **on score** when generating/updating a travel idea (event+trends+busy inputs → judgment scores); not a polling feed. |
| **geographic coverage** | N/A (model API; global). |
| **fields needed for MERIDIAN** | Structured Noul/Choice/Score answers: urgency, destination fit, crowd risk, price attractiveness, overall idea confidence — **judgment scores**. |
| **key obtained?** | unknown |
| **credential stored?** | unknown |
| **smoke test?** | no |
| **contract/approval required?** | Accept MCA via Order/checkout; **early access / waitlist** (launched 2026-09-15). Payment for credits. |
| **blockers / escalate to EA/Matt** | Waitlist access; payment for credits; ensure upstream data licenses (esp. PredictHQ) allow AI Tool injection before sending state to Jev. |
| **evidence URLs** | https://typesafe.ai/legal/mca · https://typesafe.ai/blog/introducing-system-one-models-and-jev · https://api.typesafe.ai (endpoint via docs/quickstarts) · https://console.typesafe.ai |
| **checked_date** | 2026-09-22 |

---

## Escalate checklist (Matt / EA)

| Priority | Item | Why |
|----------|------|-----|
| P0 | Amadeus Enterprise sales | Self-Service decommissioned 2026-07-17 — flights/hotels blocked |
| P0 | PredictHQ paid + Order Form (Storage/Analysis/Enrichment/**AI**) | Default ToS blocks cache, derivatives, AI — core to MERIDIAN |
| P0 | Ticketmaster commercial path (affiliate/Partner) | Revenue-derivation restriction on public Discovery ToU |
| P1 | X developer account + credit card + use-case disclosure | Pay-per-use; display/redistribution compliance |
| P1 | SerpAPI Production plan + Google Trends legal review | Service OK; Google content rights unclear |
| P1 | TypeSafe waitlist + credits; confirm upstream AI permissions | Early access; MCA OK for apps |
| P2 | BestTime Basic/Pro payment | Clearest GO; still needs payment |

---

## Sources commercially awkward / blocked for “derived travel ideas” (not raw redistribution)

| Source | Fit for derived ideas? | Notes |
|--------|------------------------|-------|
| **BestTime** | **Good fit** | Explicitly allows commercial UI Derivative Works; forbids standalone data resale. |
| **TypeSafe/Jev** | **Good fit** (access pending) | Output owned by Customer; embed in apps allowed. |
| **X** | **Conditional fit** | Analysis/display of reasonable X Content OK; do not redistribute hydrated feeds; no model training on X Content; comply with Display Requirements. |
| **SerpAPI Trends** | **Conditional fit** | SerpApi commercial service OK; Google Trends content license **unverified**. Prefer derived scores over Trends UI clones. |
| **Ticketmaster** | **Conditional / risk** | Monetized product may violate §11 without affiliate/partner exception; cache only briefly. |
| **PredictHQ** | **High friction** | Paid + Order Form required for commercial + AI/derivatives/storage — without that, **commercially blocked** for MERIDIAN’s AI-derived ideas pipeline. |
| **Amadeus Self-Service** | **Blocked** | Portal decommissioned; must use Enterprise or alternative. |

---

*End of Priority 0 SOURCE-ACCESS-MATRIX — 2026-09-22*
