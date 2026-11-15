-- Optional guest list with RSVP links, the day-of timeline, and email alerts.

-- ---------------------------------------------------------------------------
-- Guest list (off by default; the organizer turns it on per event)
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists guest_list_enabled boolean not null default false;
alter table public.events add column if not exists meal_options text[] not null default '{}'
  check (cardinality(meal_options) <= 8);

create table if not exists public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200)),
  party_size int not null default 1 check (party_size between 1 and 20),
  status text not null default 'invited' check (status in ('invited', 'yes', 'no', 'maybe')),
  attending int check (attending is null or attending between 0 and 20),
  meal text check (char_length(meal) <= 80),
  dietary text check (char_length(dietary) <= 300),
  rsvp_token uuid not null unique default gen_random_uuid(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists event_guests_event_idx on public.event_guests (event_id, created_at);
alter table public.event_guests enable row level security;
create policy "guests: viewers read" on public.event_guests for select using (public.can_view_event(event_id));
create policy "guests: owner insert" on public.event_guests for insert with check (public.owns_event(event_id));
create policy "guests: owner update" on public.event_guests for update using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy "guests: owner delete" on public.event_guests for delete using (public.owns_event(event_id));

-- Guests have no account. The RSVP link's token is the only key, and these two functions
-- are the only way in: one guest's own row and the event basics, nothing else.
create or replace function public.rsvp_lookup(t uuid)
returns table (guest_name text, party_size int, status text, attending int, meal text, dietary text,
  event_title text, event_type text, event_date date, location text, meal_options text[])
language sql stable security definer set search_path = public as $$
  select g.name, g.party_size, g.status, g.attending, g.meal, g.dietary,
         e.title, e.event_type, e.event_date, e.location, e.meal_options
  from public.event_guests g join public.events e on e.id = g.event_id
  where g.rsvp_token = t and e.guest_list_enabled;
$$;

create or replace function public.rsvp_respond(t uuid, s text, n int, m text, d text)
returns void language plpgsql security definer set search_path = public as $$
declare g record;
begin
  select g2.id, g2.party_size, e.meal_options into g
  from public.event_guests g2 join public.events e on e.id = g2.event_id
  where g2.rsvp_token = t and e.guest_list_enabled;
  if g.id is null then raise exception 'This RSVP link is no longer active.'; end if;
  if s not in ('yes', 'no', 'maybe') then raise exception 'Choose yes, no or maybe.'; end if;
  if s = 'no' then n := 0; end if;
  if n is null or n < 0 or n > g.party_size then raise exception 'Choose how many of your party are coming.'; end if;
  if m is not null and m <> '' and not (m = any(g.meal_options)) then raise exception 'Choose one of the meal options.'; end if;
  update public.event_guests set status = s, attending = n, meal = nullif(m, ''),
    dietary = nullif(left(coalesce(d, ''), 300), ''), responded_at = now()
  where id = g.id;
end;
$$;
revoke execute on function public.rsvp_lookup(uuid) from public;
revoke execute on function public.rsvp_respond(uuid, text, int, text, text) from public;
grant execute on function public.rsvp_lookup(uuid) to anon, authenticated;
grant execute on function public.rsvp_respond(uuid, text, int, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Day-of timeline
-- ---------------------------------------------------------------------------
create table if not exists public.event_timeline_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  start_time time not null,
  end_time time,
  title text not null check (char_length(title) between 1 and 160),
  notes text check (char_length(notes) <= 600),
  event_vendor_id uuid references public.event_vendors(id) on delete set null,
  source text not null default 'organizer' check (source in ('organizer', 'ai')),
  created_at timestamptz not null default now()
);
create index if not exists timeline_event_idx on public.event_timeline_items (event_id, start_time);
alter table public.event_timeline_items enable row level security;
-- Event viewers, and the vendor on a linked booking, can read.
create policy "timeline: viewers read" on public.event_timeline_items for select
  using (public.can_view_event(event_id) or (event_vendor_id is not null and public.is_booking_party(event_vendor_id)));
create policy "timeline: owner insert" on public.event_timeline_items for insert with check (
  public.owns_event(event_id)
  and (event_vendor_id is null or exists (select 1 from public.event_vendors b where b.id = event_vendor_id and b.event_id = event_timeline_items.event_id)));
create policy "timeline: owner update" on public.event_timeline_items for update using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy "timeline: owner delete" on public.event_timeline_items for delete using (public.owns_event(event_id));

alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check check (kind in ('plan', 'discover', 'sponsor', 'advice', 'timeline'));

-- ---------------------------------------------------------------------------
-- Email alerts: every in-app notification is queued for email when the person wants alerts.
-- The queue is readable only by the server's service role, never by users.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email_alerts boolean not null default true;

-- Booking pages live at /bookings/<id> for both sides.
create or replace function public.notify(uid uuid, t text, l text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, link)
  select uid, t, replace(l, '/vendor/bookings/', '/bookings/') where uid is not null and uid is distinct from auth.uid();
$$;
revoke execute on function public.notify(uuid, text, text) from public, anon, authenticated;
update public.notifications set link = replace(link, '/vendor/bookings/', '/bookings/') where link like '/vendor/bookings/%';

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  to_email text not null,
  subject text not null,
  link text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  attempts int not null default 0,
  sent_at timestamptz,
  error text
);
alter table public.email_outbox enable row level security; -- no policies: users cannot read or write it
revoke all on public.email_outbox from anon, authenticated;

create or replace function public.queue_email_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare addr text;
begin
  select u.email into addr from auth.users u join public.profiles p on p.id = u.id
  where u.id = new.user_id and p.email_alerts;
  if addr is not null then
    insert into public.email_outbox (notification_id, to_email, subject, link) values (new.id, addr, new.title, new.link);
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_email on public.notifications;
create trigger notifications_email after insert on public.notifications
  for each row execute function public.queue_email_alert();

-- The server claims a batch, sends, then marks each one. Service role only.
create or replace function public.claim_email_outbox(max_rows int default 20)
returns setof public.email_outbox language sql security definer set search_path = public as $$
  update public.email_outbox set claimed_at = now(), attempts = attempts + 1
  where id in (select id from public.email_outbox
               where sent_at is null and attempts < 5 and (claimed_at is null or claimed_at < now() - interval '10 minutes')
               order by created_at limit least(max_rows, 100) for update skip locked)
  returning *;
$$;
create or replace function public.finish_email_outbox(row_id uuid, failure text default null)
returns void language sql security definer set search_path = public as $$
  update public.email_outbox set sent_at = case when failure is null then now() end, error = left(failure, 500)
  where id = row_id;
$$;
revoke execute on function public.claim_email_outbox(int) from public, anon, authenticated;
revoke execute on function public.finish_email_outbox(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(int) to service_role;
grant execute on function public.finish_email_outbox(uuid, text) to service_role;
grant update (email_alerts) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Registry (optional per event). Guests claim gifts from their RSVP page.
-- Vendora lists links only; nothing is bought or paid here.
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists registry_enabled boolean not null default false;

create table if not exists public.event_registry_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  url text check (url is null or (url ~ '^https?://' and char_length(url) <= 2000)),
  price_note text check (char_length(price_note) <= 40),
  quantity int not null default 1 check (quantity between 1 and 50),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists registry_event_idx on public.event_registry_items (event_id, created_at);
alter table public.event_registry_items enable row level security;
create policy "registry: viewers read" on public.event_registry_items for select using (public.can_view_event(event_id));
create policy "registry: owner insert" on public.event_registry_items for insert with check (public.owns_event(event_id));
create policy "registry: owner update" on public.event_registry_items for update using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy "registry: owner delete" on public.event_registry_items for delete using (public.owns_event(event_id));

create table if not exists public.registry_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.event_registry_items(id) on delete cascade,
  guest_id uuid not null references public.event_guests(id) on delete cascade,
  quantity int not null check (quantity between 1 and 50),
  created_at timestamptz not null default now(),
  unique (item_id, guest_id)
);
alter table public.registry_claims enable row level security;
create policy "claims: viewers read" on public.registry_claims for select
  using (exists (select 1 from public.event_registry_items i where i.id = item_id and public.can_view_event(i.event_id)));
revoke insert, update, delete on public.registry_claims from anon, authenticated;

-- What a guest sees: every item, how many are still open, and their own claim. Not who else claimed.
create or replace function public.registry_for_guest(t uuid)
returns table (item_id uuid, title text, url text, price_note text, quantity int, note text, remaining int, mine int)
language sql stable security definer set search_path = public as $$
  select i.id, i.title, i.url, i.price_note, i.quantity, i.note,
         greatest(i.quantity - coalesce((select sum(c.quantity) from public.registry_claims c where c.item_id = i.id), 0), 0)::int,
         coalesce((select c.quantity from public.registry_claims c where c.item_id = i.id and c.guest_id = g.id), 0)::int
  from public.event_guests g
  join public.events e on e.id = g.event_id and e.registry_enabled and e.guest_list_enabled
  join public.event_registry_items i on i.event_id = e.id
  where g.rsvp_token = t
  order by i.created_at;
$$;

-- Claim (or with n = 0, release) a gift. Never more than what is left.
create or replace function public.registry_claim(t uuid, item uuid, n int)
returns void language plpgsql security definer set search_path = public as $$
declare g uuid; q int; taken int;
begin
  select g2.id into g from public.event_guests g2 join public.events e on e.id = g2.event_id
  where g2.rsvp_token = t and e.registry_enabled and e.guest_list_enabled;
  if g is null then raise exception 'This registry is not open.'; end if;
  select i.quantity into q from public.event_registry_items i join public.event_guests g3 on g3.event_id = i.event_id
  where i.id = item and g3.id = g for update of i;
  if q is null then raise exception 'That gift is not on this registry.'; end if;
  if n is null or n < 0 then raise exception 'Choose how many.'; end if;
  if n = 0 then delete from public.registry_claims where item_id = item and guest_id = g; return; end if;
  select coalesce(sum(quantity), 0) into taken from public.registry_claims where item_id = item and guest_id <> g;
  if taken + n > q then raise exception 'Someone already claimed that gift.'; end if;
  insert into public.registry_claims (item_id, guest_id, quantity) values (item, g, n)
  on conflict (item_id, guest_id) do update set quantity = excluded.quantity;
end;
$$;
revoke execute on function public.registry_for_guest(uuid) from public;
revoke execute on function public.registry_claim(uuid, uuid, int) from public;
grant execute on function public.registry_for_guest(uuid) to anon, authenticated;
grant execute on function public.registry_claim(uuid, uuid, int) to anon, authenticated;
