# Vendora

Event planning and vendor marketplace. Next.js 15 (App Router), Supabase (Postgres, Auth, RLS), GSAP ScrollTrigger, Three.js, OpenAI Responses API (planner and web search).

## Setup (local, everything runs on your machine)
Needs Node 18.18+ and Docker Desktop running.
1. `npm install`
2. `npm run db:start`. This starts Supabase locally (Postgres, Auth, REST, and an email inbox at http://127.0.0.1:55324) and applies `supabase/migrations/`. It prints an API URL and an anon key.
3. `cp .env.example .env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from step 2, and set `NEXT_PUBLIC_SITE_URL=http://localhost:3100`.
4. Add `OPENAI_API_KEY` and `OPENAI_MODEL` to `.env.local` yourself, in your editor. They are read only on the server.
5. `npm run dev -- --port 3100`, open http://localhost:3100, and sign in with any email. The sign-in link arrives in the local inbox at http://127.0.0.1:55324.
6. To make yourself an admin (to verify vendors), run this in `docker exec -it supabase_db_vendora psql -U postgres`:
   `update public.profiles set roles = '{customer,admin}' where id = (select id from auth.users where email = 'you@example.com');`

Vendora uses API port `55321`, database port `55322`, and inbox port `55324` so it can run alongside other local Supabase projects. Start the app on port `3100` because another Vendora preview uses port `3000`.

The vendor directory reads from Supabase. If database settings are missing, it displays a connection notice instead of fictional vendor cards.

### Populated US directory

The directory contains 830 public business listings, with at least 20 in each of the 15 categories and at least 100 within 25 miles of Ann Arbor's center (42.2808, -83.7430). Sources include Eventective, WeddingRule, Loverly, and HireMobileBartenders, with accessible images from the directory or the business's website. Each listing has a source URL. The saved source dataset is `data/vendors/public-businesses.json`. Businesses are unclaimed and **not Vendora-verified**. Published website/social links, contact information, portfolio image URLs and package information are retained where available; missing facts are not invented. Images are linked rather than copied into the repository.

Real directory businesses have no generated reviews or calendars. Original generated test records are retained separately in a private hosted archive.

Every directory business also has three planning budget options (Essentials, Signature, Premium) in `data/vendors/budget-options.json`. These are generated separately from sourced packages by `python3 scripts/generate-budget-options.py`. The importer persists them as `vendor_packages` rows with `price_cents = null` and a structured `budget_option` description. The data layer separates these from published packages and actual quotes. The profile's **Budget options** section calculates per-person and hourly totals; **Published packages** shows only sourced offers, including their billing units. No generated budget is used as a vendor quote or booking amount. Run `node e2e/vendor-pricing.mjs` to check billing units, quantity calculations, and hourly minimums.

After starting a fresh local stack with migrations applied, populate it with `python3 scripts/import-vendors.py --apply`. Without `--apply`, the importer validates the dataset, including the 20-per-category minimum, and reports its intended counts. Add `--new-only` to import only new listings, or `--sql-output PATH` to export SQL for a reviewed hosted import. Real businesses get no simulated reviews or generated calendars (the database rejects them); sample calendars exist only on the fictional "Sample" vendors in `supabase/seed.sql`. It never contacts vendors or alters real bookings. `python3 scripts/expand-vendors.py` maintains at least 750 businesses and local coverage without removing later additions. `python3 scripts/complete-vendor-categories.py` fills category gaps from published business profiles and checks cover images; existing photo booth and event decor specialists are classified by their published services. Searching for Ann Arbor in the app uses a 25-mile radius instead of matching only the city name.

### Hosted Supabase (later)
Create a project, then run `npx supabase link` and `npx supabase db push` to apply the migrations. In Auth → URL configuration, set the Site URL and add `<site>/**` to the Redirect URLs. Google: enable the provider and set `NEXT_PUBLIC_AUTH_GOOGLE=true`. SSOJet: Auth → Providers → New Provider → Auto-discovery (OIDC), identifier `custom:ssojet`, using SSOJet's issuer URL, client ID and secret. Register the callback URL Supabase shows in SSOJet, then set `NEXT_PUBLIC_AUTH_SSOJET=true`.

## Commands
| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `lint` | Develop, production build (with ESLint), lint |
| `npm run db:start` | Local Supabase with the migrations applied |
| `npm run test:db` | Runs the migrations in an in-memory Postgres and checks 183 row-level security rules |
| `npm run mock:providers` | Local stand-in for OpenAI on port 4010 (testing only) |
| `npm run test:e2e` | Full browser flow against the running app and local Supabase, then checks every homepage link. Needs Playwright installed globally (`NODE_PATH=$(npm root -g)`) |
| `node e2e/auth-flow.mjs` | Account workflow: planner and vendor doors, sign up, sign in, wrong password, sign out, redirects, forgot password through the local inbox (26 checks) |
| `node e2e/planning-tools.mjs` | Filters, shortlist and compare, package and trade-offs, shared planning, style board, event website, weather (NASA POWER stand-in) and seating (35 checks) |
| `node e2e/api-privacy.mjs` | Calls the Supabase REST API directly as two users to confirm one cannot read or change the other's data |

## Pages
| Route | Access | What it does |
| --- | --- | --- |
| `/` | Public | Homepage, sections in the order of the approved brief |
| `/how-it-works` | Public | The five steps, each marked live or planned |
| `/vendors`, `/vendors/[id]` | Public | Verified vendors from Supabase (samples when not connected). Filters: category, location, distance from Ann Arbor, published price cap, verified only, has photos; sort by price or distance. Profile shows packages and lets a signed-in user send an inquiry for one of their events, after an explicit confirmation |
| `/vendors/join` | Public | Requirements, verification, fees (not set yet) |
| `/discover` | Public page, search needs sign-in | OpenAI web search (built-in `web_search` tool), shown apart from verified listings. Signed-in users can save a result to one of their events |
| `/sponsorships` | Public | Preview only |
| `/sign-in`, `/sign-in/vendor` | Public | Separate planner and vendor doors (the vendor door adds the vendor role and sends new vendors to the application; vendor pages redirect there). Email and password (sign in, create account, forgot password), Google, SSOJet (as enabled). `/account/password` sets a new password |
| `/dashboard` | Signed in | The user's events from the database |
| `/events/new`, `/events/[id]` | Signed in | Create, edit, delete an event; budget (AI estimate vs vendor quotes), vendors and their status, web results saved to the event (marked external), suggested checklist |
| `/planner` | Signed in | AI planner. Structured estimate, saved to an event when one is chosen |
| `/auth/callback`, `/auth/sign-out` | | Session exchange (same-site `next` only) and sign-out (POST) |

## How the backend fits together
- `lib/supabase/server.js`, `client.js`, `middleware.js` use `@supabase/ssr` with cookie sessions. `middleware.js` refreshes the session and redirects signed-out users away from `/dashboard`, `/events`, and `/planner`.
- Server Actions in `app/events/actions.js` validate input and write through the user's session, so RLS applies.
- `/api/plan` and `/api/discover` require a signed-in user and enforce `AI_DAILY_LIMIT` requests per 24 hours (counted in `ai_requests`). Keys are read on the server only.
- `/api/plan` sends the event details plus up to 15 verified vendors near the event, asks for a strict JSON schema, and labels the result as an estimate.

## Security model (supabase/migrations)
- A profile row is created on sign-up. Users can change their display name only; roles change only through an admin.
- Vendors always start as `pending`. A trigger blocks anyone but an admin from verifying, and blocks owner transfer.
- Events, saved web results, and AI estimates are private to the event owner. Inquiries can only go to verified vendors and start as `inquiry`. Quotes are written by the vendor. Messages are limited to the two parties.

## Verified vs not verified (2026-11-15)
- **Real Supabase software, run locally** (Auth, Postgres 17, PostgREST, email inbox): sign-up and sign-in with email and password, creating and saving an event, saving a web result, signing out and back in with everything still there, a second user getting a 404 on the first user's event, and vendor quotes labeled apart from AI estimates. 19 of 19 browser checks and 8 of 8 direct API checks pass. `supabase db lint` reports no errors.
- **OpenAI was a stand-in** (`e2e/mock-providers.mjs`), because no keys were available. The stand-ins reject any request that doesn't match the shape each provider documents, so the request format is checked, but no real model or search answered. Web search keeps a result only if its site appears in the search call's sources, so the model can't invent a link.
- **Not tested:** a hosted Supabase project, Google and SSOJet sign-in, real email delivery, and live OpenAI calls.

## Not built yet
Payments and invoices, reviews, sending sponsor outreach from Vendora, real legal pages, a hosted deployment.

## Marketplace pages

| Route | Who | What |
|---|---|---|
| `/vendor`, `/vendor/apply`, `/vendor/profile/[id]` | Signed in | Apply as a vendor, edit the profile and packages, see incoming requests |
| `/admin` | Admins | Verify vendors or ask for changes with a note |
| `/bookings/[id]` | The organizer and the vendor | Messages, quotes, accept, hold, confirm, cancel |
| `/events/[id]/choose` | Event viewers | Vendor walkthrough: one category at a time, ranked by verification, location, published price vs. the AI estimate and the vendor's calendar; "Help me choose" asks the AI to compare (`/api/vendor-advice`) |
| `/events/[id]/guests`, `/rsvp/[token]` | Event owner; guests by private link | Optional guest list, RSVPs with meal choices, headcount sync to the event and planner |
| `/events/[id]/registry` | Event owner; guests on their RSVP page | Optional registry; guests claim gifts (links only, nothing sold) |
| `/events/[id]/timeline` | Event viewers; linked vendors see their items | Day-of run sheet, AI draft from bookings (`/api/timeline`), print |
| `/events/[id]/quotes` | Event viewers | Side-by-side quotes by category vs. the AI estimate |
| `/account` | Signed in | Name and email alerts. Alerts are queued in Postgres and sent by the server (local: Mailpit; production: Resend) |
| `/events/[id]/sponsors` | Event owner | Sponsor list, proposal drafted from the event, email from your own mail app, status tracking |
| `/events/[id]/shortlist`, `/events/[id]/compare` | Event viewers | Shortlist vendors (public listings too), vote and comment together, compare 2 to 4 side by side: photos, published price, services, distance, policies, setup, votes |
| `/events/[id]/package` | Event viewers (owner picks) | One vendor per category, combined cost against the budget, and a what-if budget trade-off tool (guest count, Save/Middle/Splurge, skip optional categories). Nothing in the trade-off tool is saved |
| `/events/[id]/team`, `/invites/[token]` | Event owner; invitee | Invite a partner or planner by link. Helpers can shortlist, vote, comment, message vendors and own tasks, not book or pay |
| `/events/[id]/tasks` | Event viewers | Shared checklist with owners; import the planner's tasks |
| `/events/[id]/board` | Event viewers | Style board by section (venue, flowers, decor, outfits). Photos are resized in the browser and stay private to the event |
| `/events/[id]/website`, `/e/[slug]` | Owner; anyone with the link | Public event page: date, place, schedule items marked Shown, registry. Never shows guest names, vendors or budget. `?g=<rsvp token>` adds a reply button |
| `/events/[id]` weather panel | Event viewers (owner refreshes) | NASA POWER daily history (20 years, 3 days either side of the date): rain on the date, rainy days, typical high and low, hot and windy days. History, not a forecast |
| `/events/[id]/seating` | Event viewers (owner edits) | Tables and seats; counts guests coming or not replied; arrange automatically or move guests by hand |

Make an account an admin (local database only):

```
docker exec -i supabase_db_vendora psql -U postgres -c "update public.profiles set roles = array_append(roles, 'admin') where id = (select id from auth.users where email = 'you@example.com');"
```

`node e2e/marketplace.mjs` runs the whole flow through the UI (23 checks).

## Demo data

`npx supabase db reset` rebuilds the local database and loads `supabase/seed.sql`: fictional vendors (all named "Sample"), an organizer with two events, and a booking in every status. Sign in with any of these addresses and the local demo password `vendora-demo`. Password reset emails arrive in the local inbox at http://127.0.0.1:55324.

| Email | Role |
|---|---|
| `maya@demo.test` | Organizer with the sample wedding and graduation |
| `admin@demo.test` | Admin: vendor review at `/admin` |
| `kitchen@demo.test` | Vendor with a quote waiting and a message thread |
| `studio@demo.test` | Vendor with a hold and a new inquiry |
| `lanterns@demo.test` | Vendor with a confirmed booking |
| `newvendor@demo.test` | Vendor with one application in review and one sent back |
| `sam@demo.test` | Maya's partner on the wedding: shortlist votes, comments and tasks |
