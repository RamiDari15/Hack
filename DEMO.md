# Vendora demo walkthrough (about 5 minutes)

## Before you present
1. `git pull`, then `npx supabase start` (Docker running).
2. `npx supabase db reset`, then `python3 scripts/import-vendors.py --apply`.
3. `.env.local` has the Supabase URL and anon key, `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-4.1-mini`.
4. `npm run dev -- --port 3100`. Open http://localhost:3100 and, in a second tab, the sign-in inbox at http://127.0.0.1:55324.
5. Run one planner request and one web search beforehand, so you know the key works.

Use three browser windows (or one normal and two private) so each person stays signed in:
organizer `maya@demo.test`, vendor `kitchen@demo.test`, admin `admin@demo.test`.

## 1. The idea (homepage, 30 s)
Scroll the homepage slowly: the string lights turn into a crowd, then vendor groups, then a floor plan.
Line: "Every event is a pile of vendors and guesses. Vendora puts them in one place and labels where every number came from."

## 2. Find vendors (45 s)
- **Vendors** → type `Ann Arbor` in Location → Search. Real local businesses within 25 miles.
- Open a public listing: photos, published packages, budget guide, contact links. Point out "Not yet verified by Vendora".
- Open **Sample Lantern Hall**: a verified vendor. Note the calendar (June 2027) and the "Request a quote" box.

## 3. Plan with AI (60 s), as Maya
- **Your events** → *Maya and Sam’s garden wedding* → **Rebuild estimate**.
- Ask: "Plan our 150-person garden wedding in Ann Arbor within $30,000."
- The planner uses the event details, verified vendors and local published prices.
- Show the budget table: **AI estimate** rows vs **Vendor quote** rows. Quotes replace estimates as they arrive.

## 4. Book a vendor (90 s)
- On the wedding page, **Vendors** lists one booking in every status.
- Open **Sample Table Kitchen** (Quote received): read the message thread, then **Accept quote**.
- Switch to `kitchen@demo.test` → **For vendors**: the request shows with the event details. The vendor can reply, send a revised quote or hold the date.
- Back as Maya: tick the box and **Confirm booking**. The badge turns Confirmed. Nothing is paid or sent without confirmation.

## 5. Trust and safety (45 s), as admin
- `admin@demo.test` → `/admin`: Sample Velvet Strings is waiting for review. Show the legal name and website check, then **Verify**.
- Mention: vendors only appear as Verified after review, and a stranger gets a 404 on someone else's booking (database row-level security, 95 automated checks).

## 6. Web search (optional, 30 s)
**Web search** → "outdoor wedding venues with string lights near Ann Arbor". Results are labeled **External, confirm** and kept apart from verified vendors. Save one to the event.

## If something goes wrong
- Sign-in link not arriving: open the inbox tab at http://127.0.0.1:55324.
- Planner says it is not configured: `.env.local` is missing the key or model; restart the dev server after editing it.
- Data looks wrong: rerun step 2 of "Before you present".
