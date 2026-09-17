# Partner platform setup

The new `/partners`, `/account`, and `/community` routes use Supabase Auth and Postgres. The existing local demo remains separate; no simulated members or offers are copied into the database.

## Configure

1. Create or select the intended Supabase project. Apply `supabase/migrations/001_platform.sql` through the reviewed migration workflow. The next live-signals migration is separate.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the app environment, then rebuild. These are public project credentials. Never put the service-role key in a public environment variable.
3. Enable email OTP/magic-link authentication. Set the site URL and allow the exact `/partners`, `/account`, and `/community` redirect URLs on your development and production origins. Configure production email delivery in Supabase.
4. Sign in through the studio; submit a provider application. A project administrator reviews the real business and runs the following parameterized equivalent in an administrative workflow: `update public.provider_orgs set status = 'approved' where id = '<reviewed-provider-id>';`. Provider accounts cannot approve themselves. To withdraw publication, change status to `suspended`; all public offers immediately disappear through RLS.
5. Exercise provider and traveler paths with distinct accounts before launch. Run `npx vitest run src/lib/platform/__tests__` for executable migration and RLS checks in an isolated embedded PostgreSQL (PGlite). The test creates mocked Supabase roles/auth.uid and three accounts. Also repeat the end-to-end workflow against the intended hosted environment.

## Current behavior

- Providers can apply, create/edit/delete drafts, publish approved offers, pause them, and reply to traveler inquiries. Editing an offer returns it to draft. Offers expire by server time under RLS.
- Offers are requests for availability, not reservable inventory. There is no checkout, payment collection, pooled aviation payment, automatic booking, or inventory hold.
- Inquiry responses are visible in the traveler account. There are no outbound response email notifications yet; the UI does not claim an email was delivered.
- Provider verification is deliberately administrative, not a user-editable field. There is no admin web console in this slice.
- Member profiles are private by default. A host can see an applicant's profile, and accepted circle members can see each other's profiles. Exact contact email is never stored in a readable profile table.
- Circles are discoverable to authenticated members. Chat is available only to accepted circle members. Do not put a private itinerary or home address in a discoverable circle description.
- The studio displays a disconnected state until configuration is present. Auth/API errors remain errors; they do not fall back to simulated success.

## Verification boundary

TypeScript, seven offer validation tests, and nine SQL migration/RLS tests passed. SQL tests execute the migration in PGlite with Supabase auth.uid and roles mocked; they verify private profiles, provider self-approval rejection, published offer visibility, inquiry isolation, membership approval/capacity, revocation, event moderation, provider suspension, and event timezone/country-code validation. This is actual PostgreSQL policy execution, not hosted Supabase integration. Hosted integration, email delivery, migration rollback, backups, and operational review remain unverified.

## Event submissions

Partners can submit a named event with destination, venue, dates, category and coordinates. It remains pending until an administrator verifies it and sets event_submissions.status to approved. Public reads additionally require an approved provider. Pending submissions cannot self-approve; there is no direct member edit of an approved event.


Submitted geography includes country, uppercase two-letter country code and IANA timezone (default UTC). PostgreSQL validates the timezone against pg_timezone_names before accepting the submission. Confirm venue coordinates, country and event-local dates during editorial review; approval does not invent pricing or airport data.
