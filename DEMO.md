# Vendora demo walkthrough (about 10 minutes)

## Before you present
1. `git pull`, then `npx supabase start` (Docker running).
2. `npx supabase db reset`, then `python3 scripts/import-vendors.py --apply`.
3. `.env.local` has the Supabase URL and anon key, `SUPABASE_SERVICE_ROLE_KEY` (from `npx supabase status`, for email alerts), `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-4.1-mini`.
4. `npm run dev -- --port 3100`. Open http://localhost:3100. Demo accounts sign in with the password `vendora-demo`. Emails (alerts, password resets) land in the local inbox at http://127.0.0.1:55324.
5. Run one planner request and one web search beforehand, so you know the key works.
6. On the wedding page, press **Check weather history** once, so the NASA POWER panel is filled (needs internet access to power.larc.nasa.gov).

Use three browser windows (or one normal and two private) so each person stays signed in:
organizer `maya@demo.test`, vendor `kitchen@demo.test`, admin `admin@demo.test`. For shared planning, `sam@demo.test` is Maya's partner.

## 1. The idea (homepage, 30 s)
Scroll the homepage slowly: the string lights turn into a crowd, then vendor groups, then a floor plan.
Line: "Every event is a pile of vendors and guesses. Vendora puts them in one place and labels where every number came from."

## 2. Find vendors (45 s)
- **Vendors** → type `Ann Arbor` in Location → Search. Real local businesses within 25 miles.
- Open **More filters**: price cap (uses each business's own published price), 10/25/50 miles, sort by lowest price or nearest, verified only, has photos.
- Open a public listing: photos, published packages, budget guide, contact links. Point out "Not yet verified by Vendora".
- Open **Sample Lantern Hall**: a verified vendor. Note the calendar (June 2027) and the "Request a quote" box.

## 3. Plan with AI (60 s), as Maya
- **Your events** → *Maya and Sam’s garden wedding* → **Rebuild estimate**.
- Ask: "Plan our 150-person garden wedding in Ann Arbor within $30,000."
- The planner uses the event details, verified vendors and local published prices.
- Show the budget table: **AI estimate** rows vs **Vendor quote** rows. Quotes replace estimates as they arrive.

## 4. Choose vendors with the walkthrough (60 s)
- On the wedding page, point at **Plan step by step**: each step ticks itself off from the event's real data, and the planner's generated tasks sit underneath.
- Click **Choose vendors**. One category at a time, vendors are ranked for this event: verified first, published prices against the AI estimate, and each vendor's Vendora calendar for June 12 (Sample Lantern Hall shows as booked that day).
- Click **Compare venues with AI**: the planner explains the best fit using only the vendors on the page and lists questions to ask. It is labeled AI suggestion.
- **Next: Catering** moves through the categories. **Request a quote** sends an inquiry after a confirmation tick.

## 5. Book a vendor (90 s)
- On the wedding page, **Vendors** lists one booking in every status.
- Open **Sample Table Kitchen** (Quote received): read the message thread, then **Accept quote**.
- Switch to `kitchen@demo.test` at **Vendor sign in** (`/sign-in/vendor`) → **For vendors**: the request shows with the event details. The vendor can reply, send a revised quote or hold the date.
- Back as Maya: tick the box and **Confirm booking**. The badge turns Confirmed. Nothing is paid or sent without confirmation.

## 6. Contact sponsors (30 s)
- On the wedding page, **Contact sponsors**. Sample Bloom Florist is already marked Contacted.
- Add a sponsor with an email: Vendora drafts a proposal from the event details. **Email** opens your own mail app with it; Vendora never sends anything itself. Then **Mark as contacted**.

## 7. Guests, registry, day-of and quotes (60 s)
- Wedding page, **Event tools**:
  - **Guest list and RSVPs** (optional, on for the sample): 3 coming, 3 maybe, 2 not replied; meal counts. **Use 8 as the guest count** feeds the planner and per-person prices. Copy an RSVP link and open it in a private window: the guest replies without an account and can claim a registry gift.
  - **Registry** (optional): Sample picnic blanket already claimed.
  - **Day-of timeline**: **Draft with AI** builds a run sheet from confirmed and held bookings (labeled AI draft). **Print run sheet**. Sample Lantern Hall sees its times on its booking page.
  - **Compare quotes**: every quote by category against the AI estimate, with per-guest cost.
- Email alerts: as `kitchen@demo.test`, send Maya a message; the email lands in the inbox tab (http://127.0.0.1:55324). Turn alerts off under **Account**.

## 7b. Plan together: shortlist, package, team (75 s)
- Wedding → **Shortlist**: Sample Lantern Hall and Sample Table Kitchen are in the package; Sam added Sample Orchard Barn and voted yes, with comments from both. Tick Lantern Hall and Orchard Barn → **Compare selected**: photos, published price, distance, policies and votes side by side.
- **Package**: chosen vendors plus AI estimates for the rest, against the $30,000 budget. In **Budget trade-offs**, drag the guest slider, set a category to Save or untick an optional one, and the total and savings ideas update. Label: what-if, not saved.
- **Team**: create an invite link for a partner (Vendora doesn't email it). **Tasks**: shared checklist with owners; Sam already finished one. **Style board**: add a photo under Flowers.

## 7c. Website, weather and seating (60 s)
- **Website**: live at `/e/sample-garden-wedding`. Shows the date, place, the ceremony time and the registry, never guest names, vendors or budget. Each guest's "Copy website link" adds their own reply button.
- **Weather risk** (wedding page, right column): NASA POWER daily records for the last 20 years around June 12 in Ann Arbor: how many years it rained on the date, typical high and low, very hot and windy days, and advice. It says history, not a forecast. This is the NASA track feature.
- **Seating chart**: two sample tables, Ana and Ben seated. **Arrange automatically** places the rest; guests who said no are left out and parties that haven't replied count at full size.

## 8. Trust and safety (45 s), as admin
- `admin@demo.test` → `/admin`: Sample Velvet Strings is waiting for review. Show the legal name and website check, then **Verify**.
- Mention: vendors only appear as Verified after review, and a stranger gets a 404 on someone else's booking (database row-level security, 183 automated checks).

## 9. Web search (optional, 30 s)
**Web search** → "outdoor wedding venues with string lights near Ann Arbor". Results are labeled **External, confirm** and kept apart from verified vendors. Save one to the event.

## If something goes wrong
- Can't sign in: demo accounts use `vendora-demo`; if it fails, rerun step 2 (the reset sets the passwords). Emails only land in the local inbox at http://127.0.0.1:55324, never in a real mailbox.
- Planner says it is not configured: `.env.local` is missing the key or model; restart the dev server after editing it.
- Data looks wrong: rerun step 2 of "Before you present".
