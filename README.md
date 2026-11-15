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

The local database contains 750 public business listings researched from Eventective profile pages, including at least 100 within 25 miles of Ann Arbor's center (42.2808, -83.7430). Each listing has a source URL. The saved source dataset is `data/vendors/public-businesses.json`. Businesses are unclaimed and **not Vendora-verified**. Published website/social links, contact information, portfolio image URLs and package information are retained where available; missing facts are not invented. Images are displayed from the public source with attribution, rather than copied into the repository.

Each business has 36 clearly labeled demonstration calendar entries over the next 180 days, plus a deterministic random count of 3–20 demonstration reviews. These entries are separate from real bookings and customer reviews and do not describe the business's actual availability or reputation.

After starting a fresh local stack with migrations applied, populate it with `python3 scripts/import-vendors.py --apply`. Without `--apply`, the importer validates the dataset and reports its intended counts. Add `--new-only` to import only new listings. Real businesses get no simulated reviews or generated calendars (the database rejects them); sample calendars exist only on the fictional "Sample" vendors in `supabase/seed.sql`. It never contacts vendors or alters real bookings. `python3 scripts/expand-vendors.py` maintains the 750-business target and local coverage, checking source coordinates and cover photos. Searching for Ann Arbor in the app uses a 25-mile radius instead of matching only the city name.

### Hosted Supabase (later)
Create a project, then run `npx supabase link` and `npx supabase db push` to apply the migrations. In Auth → URL configuration, set the Site URL and add `<site>/**` to the Redirect URLs. Google: enable the provider and set `NEXT_PUBLIC_AUTH_GOOGLE=true`. SSOJet: Auth → Providers → New Provider → Auto-discovery (OIDC), identifier `custom:ssojet`, using SSOJet's issuer URL, client ID and secret. Register the callback URL Supabase shows in SSOJet, then set `NEXT_PUBLIC_AUTH_SSOJET=true`.

## Commands
| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `lint` | Develop, production build (with ESLint), lint |
| `npm run db:start` | Local Supabase with the migrations applied |
| `npm run test:db` | Runs the migrations in an in-memory Postgres and checks 32 row-level security rules |
| `npm run mock:providers` | Local stand-in for OpenAI on port 4010 (testing only) |
| `npm run test:e2e` | Full browser flow against the running app and local Supabase, then checks every homepage link. Needs Playwright installed globally (`NODE_PATH=$(npm root -g)`) |
| `node e2e/api-privacy.mjs` | Calls the Supabase REST API directly as two users to confirm one cannot read or change the other's data |

## Pages
| Route | Access | What it does |
| --- | --- | --- |
| `/` | Public | Homepage, sections in the order of the approved brief |
| `/how-it-works` | Public | The five steps, each marked live or planned |
| `/vendors`, `/vendors/[id]` | Public | Verified vendors from Supabase (samples when not connected). Filters: category, location. Profile shows packages and lets a signed-in user send an inquiry for one of their events, after an explicit confirmation |
| `/vendors/join` | Public | Requirements, verification, fees (not set yet) |
| `/discover` | Public page, search needs sign-in | OpenAI web search (built-in `web_search` tool), shown apart from verified listings. Signed-in users can save a result to one of their events |
| `/sponsorships` | Public | Preview only |
| `/sign-in` | Public | Email magic link, Google, SSOJet (as enabled) |
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
- **Real Supabase software, run locally** (Auth, Postgres 17, PostgREST, email inbox): sign-up and sign-in by magic link, creating and saving an event, saving a web result, signing out and back in with everything still there, a second user getting a 404 on the first user's event, and vendor quotes labeled apart from AI estimates. 19 of 19 browser checks and 8 of 8 direct API checks pass. `supabase db lint` reports no errors.
- **OpenAI was a stand-in** (`e2e/mock-providers.mjs`), because no keys were available. The stand-ins reject any request that doesn't match the shape each provider documents, so the request format is checked, but no real model or search answered. Web search keeps a result only if its site appears in the search call's sources, so the model can't invent a link.
- **Not tested:** a hosted Supabase project, Google and SSOJet sign-in, real email delivery, and live OpenAI calls.

## Not built yet
Vendor onboarding forms and an admin verification screen, quote replies and messaging UI for vendors, holds and calendars, payments and invoices, favorites and compare, cohosts, a weather provider and the NASA POWER features, walkthrough generation, sponsor data and outreach sending, reviews, notifications, real legal pages.

## Marketplace pages

| Route | Who | What |
|---|---|---|
| `/vendor`, `/vendor/apply`, `/vendor/profile/[id]` | Signed in | Apply as a vendor, edit the profile and packages, see incoming requests |
| `/admin` | Admins | Verify vendors or ask for changes with a note |
| `/bookings/[id]` | The organizer and the vendor | Messages, quotes, accept, hold, confirm, cancel |

Make an account an admin (local database only):

```
docker exec -i supabase_db_vendora psql -U postgres -c "update public.profiles set roles = array_append(roles, 'admin') where id = (select id from auth.users where email = 'you@example.com');"
```

`node e2e/marketplace.mjs` runs the whole flow through the UI (23 checks).

## Demo data

`npx supabase db reset` rebuilds the local database and loads `supabase/seed.sql`: fictional vendors (all named "Sample"), an organizer with two events, and a booking in every status. Sign in with any of these addresses; the magic link arrives in the local inbox at http://127.0.0.1:55324.

| Email | Role |
|---|---|
| `maya@demo.test` | Organizer with the sample wedding and graduation |
| `admin@demo.test` | Admin: vendor review at `/admin` |
| `kitchen@demo.test` | Vendor with a quote waiting and a message thread |
| `studio@demo.test` | Vendor with a hold and a new inquiry |
| `lanterns@demo.test` | Vendor with a confirmed booking |
| `newvendor@demo.test` | Vendor with one application in review and one sent back |
