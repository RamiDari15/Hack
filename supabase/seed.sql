-- Demo data for the local database. Loaded by `npx supabase db reset`.
-- Everything here is fictional and labeled "Sample". Prices are sample prices for the demo, not real offers.
-- Sign in with any of these addresses and the demo password vendora-demo (local demo accounts only, never use it on a hosted project).
-- Password reset emails arrive in the local inbox at http://127.0.0.1:55324.
--   maya@demo.test      organizer (owns the events)
--   admin@demo.test     admin (vendor review)
--   lanterns@demo.test  vendor owner: Sample Lantern Hall, Sample Orchard Barn
--   kitchen@demo.test   vendor owner: Sample Table Kitchen, Sample Sugar Studio, Sample Pour House
--   studio@demo.test    vendor owner: Sample North Light Photo, Sample Night Shift DJs, Sample Petal Room, Sample Rent-a-Glow
--   newvendor@demo.test vendor owner with one application in review and one sent back
--   sam@demo.test       partner helping plan the wedding (shortlist votes, comments, tasks)

-- ---------------------------------------------------------------- accounts
create or replace function pg_temp.demo_user(uid uuid, mail text, full_name text) returns void language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, extensions.crypt('vendora-demo', extensions.gen_salt('bf')), now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name), now(), now(), false, false)
  on conflict (id) do nothing;
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, 'email',
    jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true), now(), now(), now())
  on conflict do nothing;
end $$;

select pg_temp.demo_user('d0000000-0000-4000-8000-000000000001', 'maya@demo.test', 'Maya (sample)');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000002', 'admin@demo.test', 'Vendora admin (sample)');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000003', 'lanterns@demo.test', 'Lantern Hall owner (sample)');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000004', 'kitchen@demo.test', 'Table Kitchen owner (sample)');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000005', 'studio@demo.test', 'North Light owner (sample)');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000006', 'newvendor@demo.test', 'New vendor (sample)');

update public.profiles set roles = '{customer,organizer}' where id = 'd0000000-0000-4000-8000-000000000001';
update public.profiles set roles = '{customer,admin}' where id = 'd0000000-0000-4000-8000-000000000002';
update public.profiles set roles = '{customer,vendor}' where id in ('d0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006');

-- ---------------------------------------------------------------- vendors
-- Verification can only be set by an admin, so act as the admin account for these inserts.
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated"}', false);

insert into public.vendors (id, owner_id, name, category, city, service_radius_mi, description, setup_requirements, booking_policy,
  legal_name, website, contact_email, verification_status, review_note, submitted_at) values
('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'Sample Lantern Hall', 'Venues', 'Ann Arbor, MI', 25,
  'Fictional business. A brick hall with a string-lit courtyard, seats 180 for dinner.', 'Load-in from 2pm. House power on every wall.', 'Sample policy: 30% deposit to hold the date.',
  'Sample Lantern Hall LLC', 'https://example.com', 'lanterns@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', 'Sample Orchard Barn', 'Venues', 'Ypsilanti, MI', 30,
  'Fictional business. Restored barn beside an apple orchard, open-air ceremony lawn.', 'Generator needed for amplified music outdoors.', 'Sample policy: full refund up to 90 days out.',
  'Sample Orchard Barn LLC', 'https://example.com', 'lanterns@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004', 'Sample Table Kitchen', 'Catering', 'Ann Arbor, MI', 40,
  'Fictional business. Family-style dinners and late-night snacks.', 'Needs a prep room with two outlets.', 'Sample policy: final headcount 14 days before.',
  'Sample Table Kitchen LLC', 'https://example.com', 'kitchen@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'Sample Sugar Studio', 'Cake & desserts', 'Detroit, MI', 50,
  'Fictional business. Tiered cakes and dessert tables.', 'Cool table away from direct sun.', null,
  'Sample Sugar Studio LLC', 'https://example.com', 'kitchen@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 'Sample Pour House', 'Bar services', 'Ann Arbor, MI', 30,
  'Fictional business. Licensed bartenders and a mobile bar.', 'Venue must allow outside alcohol service.', null,
  'Sample Pour House LLC', 'https://example.com', 'kitchen@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000005', 'Sample North Light Photo', 'Photography', 'Ann Arbor, MI', 60,
  'Fictional business. Documentary-style photos, edited gallery in three weeks.', null, null,
  'Sample North Light LLC', 'https://example.com', 'studio@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000005', 'Sample Night Shift DJs', 'Music & DJ', 'Detroit, MI', 60,
  'Fictional business. DJ and MC with dance-floor lighting.', 'One 20A circuit near the floor.', null,
  'Sample Night Shift LLC', 'https://example.com', 'studio@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000005', 'Sample Petal Room', 'Florists', 'Ypsilanti, MI', 35,
  'Fictional business. Seasonal, garden-style arrangements.', null, null,
  'Sample Petal Room LLC', 'https://example.com', 'studio@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000005', 'Sample Rent-a-Glow', 'Rentals', 'Ann Arbor, MI', 45,
  'Fictional business. String lights, lanterns, tables and chairs.', 'Ladder access for overhead lights.', null,
  'Sample Rent-a-Glow LLC', 'https://example.com', 'studio@demo.test', 'verified', null, now()),
('a0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000006', 'Sample Velvet Strings', 'Entertainment', 'Ann Arbor, MI', 40,
  'Fictional business. String quartet for ceremonies.', null, null,
  'Sample Velvet Strings LLC', 'https://example.com', 'newvendor@demo.test', 'pending', null, now()),
('a0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000006', 'Sample Glow Booth', 'Photo booth', 'Detroit, MI', 50,
  'Fictional business. Open-air photo booth with prints.', null, null,
  '', null, 'newvendor@demo.test', 'rejected', 'Sample note: add your legal business name and a website so we can check the business.', now())
on conflict (id) do nothing;

select set_config('request.jwt.claims', '', false);

insert into public.vendor_packages (vendor_id, title, price_cents, description) values
('a0000000-0000-4000-8000-000000000001', 'Evening hall and courtyard', 420000, 'Sample price. 5pm to midnight.'),
('a0000000-0000-4000-8000-000000000001', 'Ceremony only', 150000, 'Sample price. Two hours.'),
('a0000000-0000-4000-8000-000000000002', 'Full day barn and lawn', null, 'Quote required.'),
('a0000000-0000-4000-8000-000000000003', 'Family-style dinner for 150', 975000, 'Sample price. About $65 per guest.'),
('a0000000-0000-4000-8000-000000000003', 'Late-night snacks', 90000, 'Sample price. Serves up to 150.'),
('a0000000-0000-4000-8000-000000000004', 'Three-tier cake', 65000, 'Sample price.'),
('a0000000-0000-4000-8000-000000000005', 'Bar service, four hours', null, 'Quote required.'),
('a0000000-0000-4000-8000-000000000006', 'Eight hours of coverage', 380000, 'Sample price.'),
('a0000000-0000-4000-8000-000000000007', 'DJ and MC, five hours', 160000, 'Sample price.'),
('a0000000-0000-4000-8000-000000000008', 'Ceremony and centerpieces', null, 'Quote required.'),
('a0000000-0000-4000-8000-000000000009', 'Courtyard string lights', 75000, 'Sample price.');

-- ---------------------------------------------------------------- events
insert into public.events (id, owner_id, title, event_type, event_date, location, guest_count, budget_cents, style, notes) values
('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Maya and Sam’s garden wedding (sample)', 'Wedding',
  '2027-06-12', 'Ann Arbor, MI', 150, 3000000, 'Garden, string lights', 'Sample event.'),
('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Jordan’s graduation party (sample)', 'Graduation',
  '2027-05-01', 'Ypsilanti, MI', 60, 500000, 'Backyard', 'Sample event.')
on conflict (id) do nothing;

-- A saved planner estimate for the wedding, so the budget table has rows.
insert into public.ai_requests (user_id, kind, event_id, input, output) values
('d0000000-0000-4000-8000-000000000001', 'plan', 'e0000000-0000-4000-8000-000000000001',
 '{"prompt":"Sample request: plan our garden wedding for 150 guests within $30,000."}',
 '{"summary":"Sample estimate. A June garden wedding for 150 guests in Ann Arbor fits a $30,000 budget with a buffer.",
   "assumptions":["June Saturday in southeast Michigan","Family-style dinner","Sample data"],
   "categories":[
     {"name":"Venues","low":3800,"high":5200,"notes":"Hall and courtyard"},
     {"name":"Catering","low":9000,"high":11500,"notes":"Family-style dinner"},
     {"name":"Photography","low":3000,"high":4200,"notes":""},
     {"name":"Music & DJ","low":1300,"high":2000,"notes":""},
     {"name":"Florists","low":1800,"high":2800,"notes":""},
     {"name":"Rentals","low":900,"high":1500,"notes":"Lights, linens"},
     {"name":"Taxes and service fees","low":1600,"high":2100,"notes":""},
     {"name":"Tips","low":700,"high":1100,"notes":""},
     {"name":"Delivery and travel","low":300,"high":600,"notes":""},
     {"name":"Setup and cleanup","low":500,"high":900,"notes":""},
     {"name":"Contingency","low":1500,"high":2200,"notes":""}],
   "missing_items":["Rain plan for the courtyard","Officiant"],
   "cost_saving_ideas":["Friday date","Shared ceremony and reception space"],
   "checklist":[{"task":"Book the venue","when":"10 months before"},{"task":"Book photographer and DJ","when":"8 months before"},{"task":"Final headcount to caterer","when":"2 weeks before"}],
   "estimate":true}');

-- ---------------------------------------------------------------- bookings, one per status
insert into public.event_vendors (id, event_id, vendor_id, status, hold_expires_at) values
('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'confirmed', null),
('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'quote', null),
('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'hold', now() + interval '7 days'),
('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007', 'inquiry', null),
('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'cancelled', null)
on conflict (id) do nothing;

insert into public.quotes (event_vendor_id, amount_cents, description, valid_until, status, created_at) values
('b0000000-0000-4000-8000-000000000001', 450000, 'Sample quote: hall and courtyard, 5pm to midnight, tables and chairs included.', '2027-01-31', 'accepted', now() - interval '6 days'),
('b0000000-0000-4000-8000-000000000002', 1050000, 'Sample quote: family-style dinner for 150, staff and rentals included.', '2027-02-28', 'sent', now() - interval '1 day'),
('b0000000-0000-4000-8000-000000000003', 360000, 'Sample quote: eight hours, second shooter included.', '2027-02-28', 'sent', now() - interval '3 days');

insert into public.messages (event_vendor_id, sender_id, body, created_at) values
('b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Hi! Could you do a vegetarian main for about 30 guests?', now() - interval '2 days'),
('b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'Yes, no extra charge. I put it in the quote. Want to set up a tasting?', now() - interval '1 day'),
('b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'Confirmed for June 12. We will send the floor plan a month before.', now() - interval '5 days'),
('b0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'Holding your date for a week while you decide.', now() - interval '3 days');

-- ---------------------------------------------------------------- sample calendars (fictional vendors only)
update public.vendors set calendar_is_demo = true where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006');
insert into public.vendor_calendar_entries (vendor_id, starts_at, ends_at, status, title, is_demo) values
('a0000000-0000-4000-8000-000000000001', '2027-06-12T16:00:00Z', '2027-06-13T04:00:00Z', 'booked', 'Sample wedding (confirmed booking)', true),
('a0000000-0000-4000-8000-000000000001', '2027-06-05T16:00:00Z', '2027-06-06T04:00:00Z', 'booked', 'Sample private event', true),
('a0000000-0000-4000-8000-000000000001', '2027-06-19T16:00:00Z', '2027-06-20T04:00:00Z', 'tentative', 'Sample hold', true),
('a0000000-0000-4000-8000-000000000001', '2027-06-26T16:00:00Z', '2027-06-27T04:00:00Z', 'blocked', 'Sample maintenance day', true),
('a0000000-0000-4000-8000-000000000006', '2027-06-12T14:00:00Z', '2027-06-12T23:00:00Z', 'tentative', 'Sample hold for a wedding', true),
('a0000000-0000-4000-8000-000000000006', '2027-06-20T14:00:00Z', '2027-06-20T23:00:00Z', 'booked', 'Sample graduation shoot', true);

-- Sample sponsor leads for the wedding. Fictional businesses with .test addresses, so nothing reaches a real inbox.
insert into public.sponsor_leads (event_id, name, url, contact_email, reason, status, proposal) values
('e0000000-0000-4000-8000-000000000001', 'Sample Bloom Florist', null, 'hello@sample-bloom.test',
  'Fictional business. A local florist reaching couples planning summer weddings.', 'contacted',
  E'Hi Sample Bloom Florist team,\n\nWe are planning a 150-guest garden wedding in Ann Arbor on June 12, 2027. Would you be open to sponsoring the welcome table? In return we can offer a sign at the entrance and a thank-you in the program.\n\nThank you for considering it.'),
('e0000000-0000-4000-8000-000000000001', 'Sample Main Street Bakery', null, null,
  'Fictional business. Could provide favors in exchange for a mention.', 'idea', null);

-- Sample guest list, registry and day-of timeline for the wedding. Fictional guests with .test addresses.
update public.events set guest_list_enabled = true, registry_enabled = true, meal_options = '{Chicken,Salmon,Vegetarian}'
where id = 'e0000000-0000-4000-8000-000000000001';

insert into public.event_guests (event_id, name, email, party_size, status, attending, meal, dietary, rsvp_token, responded_at) values
('e0000000-0000-4000-8000-000000000001', 'Ana Ruiz (sample)', 'ana@guests.test', 2, 'yes', 2, 'Salmon', null, 'c0000000-0000-4000-8000-000000000001', now() - interval '3 days'),
('e0000000-0000-4000-8000-000000000001', 'Ben Okafor (sample)', 'ben@guests.test', 1, 'yes', 1, 'Vegetarian', 'No nuts', 'c0000000-0000-4000-8000-000000000002', now() - interval '2 days'),
('e0000000-0000-4000-8000-000000000001', 'Chen family (sample)', 'chen@guests.test', 4, 'maybe', 3, null, null, 'c0000000-0000-4000-8000-000000000003', now() - interval '1 day'),
('e0000000-0000-4000-8000-000000000001', 'Dana Price (sample)', null, 1, 'no', 0, null, null, 'c0000000-0000-4000-8000-000000000004', now() - interval '1 day'),
('e0000000-0000-4000-8000-000000000001', 'Eli Brooks (sample)', 'eli@guests.test', 2, 'invited', null, null, null, 'c0000000-0000-4000-8000-000000000005', null);

insert into public.event_registry_items (id, event_id, title, price_note, quantity, note) values
('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Sample gift: dinner plates', 'Sample price, about $20 each', 8, 'Any plain white set'),
('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Sample gift: picnic blanket', 'Sample price, about $45', 1, null),
('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Sample gift: honeymoon fund contribution', null, 10, 'Any amount, given in person');
insert into public.registry_claims (item_id, guest_id, quantity)
select 'f0000000-0000-4000-8000-000000000002', id, 1 from public.event_guests where rsvp_token = 'c0000000-0000-4000-8000-000000000001';

insert into public.event_timeline_items (event_id, start_time, end_time, title, notes, event_vendor_id, source) values
('e0000000-0000-4000-8000-000000000001', '14:00', '16:30', 'Sample Lantern Hall opens for setup', 'Sample time. Hall access from 2pm per the accepted quote.', 'b0000000-0000-4000-8000-000000000001', 'organizer'),
('e0000000-0000-4000-8000-000000000001', '17:00', '17:30', 'Ceremony in the courtyard', null, null, 'organizer'),
('e0000000-0000-4000-8000-000000000001', '23:30', '00:00', 'Last dance, then the hall closes at midnight', null, 'b0000000-0000-4000-8000-000000000001', 'organizer');

-- ---------------------------------------------------------------- shared planning, package, website, seating
-- A sample partner who helps plan the wedding. Sign in as sam@demo.test to see the shared view.
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000007', 'sam@demo.test', 'Sam (sample partner)');
update public.profiles set roles = '{customer,organizer}' where id = 'd0000000-0000-4000-8000-000000000007';
insert into public.event_members (event_id, user_id) values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000007') on conflict do nothing;

insert into public.event_shortlist (id, event_id, vendor_id, added_by, in_package) values
('a1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', true),
('a1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000007', false),
('a1000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', true);
insert into public.shortlist_votes (shortlist_id, user_id, vote) values
('a1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1),
('a1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000007', 1),
('a1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', -1);
insert into public.shortlist_comments (shortlist_id, user_id, body) values
('a1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000007', 'Sample comment: the orchard lawn would be lovely for the ceremony.'),
('a1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Sample comment: worried about renting a generator for music.');

insert into public.event_tasks (event_id, title, due_note, assignee_id, done, created_by) values
('e0000000-0000-4000-8000-000000000001', 'Sample task: book a tasting with Table Kitchen', '2 months before', 'd0000000-0000-4000-8000-000000000001', false, 'd0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000001', 'Sample task: send the guest list links', '3 months before', 'd0000000-0000-4000-8000-000000000007', true, 'd0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000001', 'Sample task: pick a florist', null, null, false, 'd0000000-0000-4000-8000-000000000007');

update public.events set website_enabled = true, website_slug = 'sample-garden-wedding',
  website_intro = 'Sample welcome message. We can’t wait to celebrate with you in the courtyard.'
where id = 'e0000000-0000-4000-8000-000000000001';
update public.event_timeline_items set show_on_website = true
where event_id = 'e0000000-0000-4000-8000-000000000001' and title = 'Ceremony in the courtyard';

insert into public.event_tables (id, event_id, name, seats) values
('a2000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Table 1', 8),
('a2000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Table 2', 8);
update public.event_guests set table_id = 'a2000000-0000-4000-8000-000000000001'
where rsvp_token in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');
