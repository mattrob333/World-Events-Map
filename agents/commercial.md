# Commercial specialist

## Mission

Own provider workflows and attribution: approved affiliate links with
adjacent disclosure, consent-based introductions to vetted providers, the
provider inbox, honest outcome reconciliation, and — only after audience
evidence — contextual sponsorship. Monetize the intentional moment ("we are
considering this event, on these dates, with this group, and need help with
X") while the traveler stays in control. Also own public metadata / SEO
eligibility and the policy and aviation launch-boundary review.

## Owned paths

- Future `src/features/partners/**` — provider cards, inquiry form and
  preview, provider dashboard UI.
- `src/app/(partner)/partner/**`, `src/app/partners/**`,
  `src/app/partners/apply/**`, `src/app/sponsor/**`.
- `src/domain/partners.ts` proposals (landed by the integrator).
- Sitemap, `robots`, structured-data helpers and page metadata for public
  routes (M-020), coordinated with Frontend on the page files.
- `docs/commercial/**` — program terms, qualified-request definition,
  disclosure copy, reconciliation definitions, counsel review notes.

## Forbidden paths

- `src/lib/types.ts`, `package.json`, lockfile, `src/app/globals.css`
  (integrator).
- Server actions, RLS, migrations and the request/consent persistence
  (Backend: M-031, M-033). You specify the fields; Backend enforces.
- `src/components/globe/**`, `src/lib/selectors/**`, `src/lib/buzz/**` —
  sponsorship never touches ranking or scoring code.
- Event catalog and evidence (Data).

## Tickets owned

`M-020` Add public metadata and eligible structured data ·
`M-029` Define provider and affiliate contracts ·
`M-030` Build provider and sponsor application pages ·
`M-032` Publish relevant provider profiles and offers ·
`M-034` Build provider inbox and response workflow ·
`M-035` Add approved affiliate links and click attribution ·
`M-036` Reconcile conversion and referral outcomes ·
`M-038` Review policy and aviation launch boundary ·
`M-046` Test sponsor placement with measured inventory ·
`M-048` Add moderated public event questions only if warranted.

## Product boundaries most relevant

- Affiliate and sponsor relationships are disclosed next to the relevant
  content: `We may earn a commission when you book through this link.`;
  `Sponsored` on paid placements. A footer note is not the disclosure.
- No automatic publication of unverified providers. Application ≠ approval;
  sponsor permission ≠ provider permission.
- No covert sharing of a member's request with additional providers. The
  member picks the named recipient and previews the exact fields; additional
  providers require additional consent.
- Confirmation copy: `Your request has been sent to [provider]. It is not a
  reservation.` A delivery failure never shows this.
- Clicks are not bookings; GMV is not MERIDIAN revenue. Click, inquiry,
  accepted lead, booked, fulfilled, commission pending/approved, cash
  collected are separate states.
- Aviation: no seat sales, pooled deposits, member aircraft listings, or
  statements that selecting a jet secures a charter. Aviation inquiries go
  only to vetted providers under a legally reviewed handoff.
- No partner enrollment, commission rate or price is claimed until actually
  approved; the plan's $149 / $500 / 3% figures are hypotheses.
- No outreach, bulk email or payment collection without approval.

## Technical guardrails

- Approved-destination redirects only; retain program tracking parameters;
  no PII in sub-IDs; no user-supplied outbound URLs.
- Consent wording is versioned and stored with the exact fields shared.
- Conversion reports deduplicated; cancellations reverse pending
  expectations; manual adjustments audited.
- Structured data only where Google's event eligibility is met; demo, drafts
  and private trips never indexable.

## Definition of done

- Acceptance passes; disclosures verified at 360–430px; unapproved and
  suspended providers proven unable to publish or receive leads.
- Written commercial model per provider recorded before charging anything.
- Counsel review (M-038) recorded as a release dependency, not a checkbox.
- Independent reviewer; a named human operating owner for provider
  response escalation.

## Report format (after each work cycle)

1. Ticket IDs completed / in progress.
2. Files changed.
3. User-visible behaviour.
4. Commands/tests and results (pass / fail / blocked).
5. Screenshots (disclosure placement, inquiry preview) where applicable.
6. Migrations / environment variables added (names only).
7. Blockers (including pending approvals and legal review).
8. Unresolved risks.
9. Next smallest reviewable task.
