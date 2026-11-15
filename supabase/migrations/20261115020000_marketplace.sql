-- Marketplace: vendor onboarding details, booking rules, quote replies, invoices (records only),
-- reviews, favorites, cohosts, in-app notifications and sponsor leads.
-- Rules that grant trust or move money-related state are enforced here, not in the app.

-- ---------------------------------------------------------------------------
-- Roles you can give yourself (never admin)
-- ---------------------------------------------------------------------------
create or replace function public.add_my_role(r text)
returns text[] language plpgsql security definer set search_path = public as $$
declare out_roles text[];
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if r not in ('vendor', 'organizer', 'sponsor') then raise exception 'That role cannot be self-assigned.'; end if;
  update public.profiles set roles = (select array_agg(distinct x) from unnest(roles || r) x)
    where id = auth.uid() returning roles into out_roles;
  return out_roles;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vendor onboarding details. review_note is written by admins only.
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists legal_name text check (char_length(legal_name) <= 160),
  add column if not exists business_id text check (char_length(business_id) <= 80),
  add column if not exists website text check (website is null or website ~ '^https?://'),
  add column if not exists contact_email text check (char_length(contact_email) <= 200),
  add column if not exists phone text check (char_length(phone) <= 40),
  add column if not exists review_note text check (char_length(review_note) <= 1000),
  add column if not exists submitted_at timestamptz not null default now();

create or replace function public.guard_vendor_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    if new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status <> 'verified') then
      new.verified_at = now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verification_status = 'pending';
    new.verified_at = null;
    new.review_note = null;
  else
    new.owner_id = old.owner_id;
    new.review_note = old.review_note;
    new.verified_at = old.verified_at;
    -- A rejected vendor who edits their details goes back into the queue. Verified stays verified.
    if old.verification_status = 'rejected' then
      new.verification_status = 'pending';
      new.submitted_at = now();
    else
      new.verification_status = old.verification_status;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cohosts: people the owner invites can see the event and talk to vendors.
-- Only the owner sends inquiries, answers quotes, confirms or deletes.
-- ---------------------------------------------------------------------------
create table if not exists public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'cohost' check (role in ('cohost')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

create or replace function public.can_view_event(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = e and owner_id = auth.uid())
      or exists (select 1 from public.event_members where event_id = e and user_id = auth.uid());
$$;

-- Party to a booking: anyone who can view the event, or the vendor's owner.
create or replace function public.is_booking_party(ev uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_vendors b
    where b.id = ev and (public.can_view_event(b.event_id) or public.owns_vendor(b.vendor_id))
  );
$$;

create or replace function public.accept_invite(t uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.event_invites; me text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  me := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into inv from public.event_invites where token = t;
  if inv.id is null then raise exception 'This invite link is not valid.'; end if;
  if inv.accepted_at is not null and inv.accepted_by <> auth.uid() then raise exception 'This invite was already used.'; end if;
  if lower(inv.email) <> me then raise exception 'This invite was sent to a different email address.'; end if;
  insert into public.event_members (event_id, user_id) values (inv.event_id, auth.uid()) on conflict do nothing;
  update public.event_invites set accepted_by = auth.uid(), accepted_at = coalesce(accepted_at, now()) where id = inv.id;
  return inv.event_id;
end;
$$;

alter table public.event_members enable row level security;
alter table public.event_invites enable row level security;
create policy "members: viewers read" on public.event_members for select using (public.can_view_event(event_id));
create policy "members: owner or self removes" on public.event_members for delete
  using (public.owns_event(event_id) or user_id = auth.uid());
create policy "invites: owner all" on public.event_invites for all
  using (public.owns_event(event_id)) with check (public.owns_event(event_id) and created_by = auth.uid());

-- Events: cohosts read. Writes stay with the owner.
drop policy if exists "events: owner all" on public.events;
create policy "events: viewers read" on public.events for select using (owner_id = auth.uid() or public.can_view_event(id));
create policy "events: owner insert" on public.events for insert with check (owner_id = auth.uid());
create policy "events: owner update" on public.events for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "events: owner delete" on public.events for delete using (owner_id = auth.uid());

drop policy if exists "bookings: parties read" on public.event_vendors;
create policy "bookings: parties read" on public.event_vendors for select
  using (public.can_view_event(event_id) or public.owns_vendor(vendor_id));

drop policy if exists "saved results: owner all" on public.event_saved_results;
create policy "saved results: viewers read" on public.event_saved_results for select using (public.can_view_event(event_id));
create policy "saved results: viewers add" on public.event_saved_results for insert with check (public.can_view_event(event_id));
create policy "saved results: viewers remove" on public.event_saved_results for delete using (public.can_view_event(event_id));

create policy "ai_requests: event viewers read plans" on public.ai_requests for select
  using (kind = 'plan' and event_id is not null and public.can_view_event(event_id));

-- ---------------------------------------------------------------------------
-- Booking rules. Who may move a booking to which state.
--   vendor: inquiry -> quote (by sending a quote), quote -> hold (up to 14 days), decline (cancelled)
--   owner:  quote or hold -> confirmed (needs an accepted quote), cancel at any time
-- ---------------------------------------------------------------------------
create or replace function public.guard_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_vendor boolean; is_owner boolean;
begin
  if new.event_id <> old.event_id or new.vendor_id <> old.vendor_id then
    raise exception 'A booking cannot move to another event or vendor.';
  end if;
  is_vendor := public.owns_vendor(old.vendor_id);
  is_owner := public.owns_event(old.event_id);
  if new.status = old.status then
    if new.hold_expires_at is distinct from old.hold_expires_at and not (is_vendor and old.status = 'hold') then
      raise exception 'Only the vendor can change a hold.';
    end if;
    return new;
  end if;
  if old.status = 'cancelled' then raise exception 'This booking is cancelled.'; end if;
  if new.status = 'quote' and old.status = 'inquiry' and is_vendor then
    return new;
  elsif new.status = 'hold' and old.status = 'quote' and is_vendor then
    new.hold_expires_at := least(coalesce(new.hold_expires_at, now() + interval '7 days'), now() + interval '14 days');
    return new;
  elsif new.status = 'confirmed' and old.status in ('quote', 'hold') and is_owner then
    if not exists (select 1 from public.quotes q where q.event_vendor_id = old.id and q.status = 'accepted') then
      raise exception 'Accept a quote before confirming.';
    end if;
    new.hold_expires_at := null;
    return new;
  elsif new.status = 'cancelled' and (is_owner or is_vendor) then
    new.hold_expires_at := null;
    return new;
  end if;
  raise exception 'That change is not allowed (% to %).', old.status, new.status;
end;
$$;
drop trigger if exists event_vendors_guard on public.event_vendors;
create trigger event_vendors_guard before update on public.event_vendors
  for each row execute function public.guard_booking();

-- Quotes: vendors may only quote open bookings, always as 'sent'.
drop policy if exists "quotes: vendor writes" on public.quotes;
create policy "quotes: vendor writes" on public.quotes for insert with check (
  status = 'sent' and exists (select 1 from public.event_vendors b where b.id = event_vendor_id
    and public.owns_vendor(b.vendor_id) and b.status in ('inquiry', 'quote', 'hold')));

-- The event owner accepts or declines. Accepting one declines the other open quotes on that booking.
create or replace function public.respond_to_quote(q uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  select qt.id, qt.status, qt.valid_until, b.id as booking_id, b.event_id, b.status as booking_status
    into rec from public.quotes qt join public.event_vendors b on b.id = qt.event_vendor_id where qt.id = q;
  if rec.id is null or not public.owns_event(rec.event_id) then raise exception 'Quote not found.'; end if;
  if rec.status <> 'sent' then raise exception 'This quote was already answered.'; end if;
  if rec.booking_status = 'cancelled' then raise exception 'This booking is cancelled.'; end if;
  if accept and rec.valid_until is not null and rec.valid_until < current_date then
    update public.quotes set status = 'expired' where id = q;
    raise exception 'This quote has expired. Ask the vendor for a new one.';
  end if;
  if accept then
    update public.quotes set status = 'declined' where event_vendor_id = rec.booking_id and status = 'sent' and id <> q;
    update public.quotes set status = 'accepted' where id = q;
    return 'accepted';
  end if;
  update public.quotes set status = 'declined' where id = q;
  return 'declined';
end;
$$;

-- ---------------------------------------------------------------------------
-- Vendor view of their bookings: the event details the customer agreed to share.
-- ---------------------------------------------------------------------------
create or replace function public.booking_summaries(only_booking uuid default null)
returns table (
  booking_id uuid, status text, hold_expires_at timestamptz, created_at timestamptz,
  vendor_id uuid, vendor_name text, vendor_category text,
  event_id uuid, event_type text, event_date date, location text, guest_count int, style text,
  viewer_is_vendor boolean, viewer_is_owner boolean
) language sql stable security definer set search_path = public as $$
  select b.id, b.status, b.hold_expires_at, b.created_at,
         v.id, v.name, v.category,
         e.id, e.event_type, e.event_date, e.location, e.guest_count, e.style,
         public.owns_vendor(v.id), public.owns_event(e.id)
  from public.event_vendors b
  join public.vendors v on v.id = b.vendor_id
  join public.events e on e.id = b.event_id
  where (only_booking is null or b.id = only_booking)
    and (public.owns_vendor(v.id) or public.can_view_event(e.id))
  order by e.event_date nulls last, b.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Invoices: a record of what is owed and paid. Payments happen outside Vendora for now.
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  event_vendor_id uuid not null references public.event_vendors(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'installment', 'final')),
  amount_cents bigint not null check (amount_cents > 0),
  due_date date,
  note text check (char_length(note) <= 500),
  status text not null default 'due' check (status in ('due', 'paid', 'void')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
create policy "invoices: parties read" on public.invoices for select using (public.is_booking_party(event_vendor_id));
create policy "invoices: vendor creates" on public.invoices for insert with check (
  status = 'due' and exists (select 1 from public.event_vendors b where b.id = event_vendor_id
    and public.owns_vendor(b.vendor_id) and b.status in ('hold', 'confirmed')));

-- Owner records a payment they made; vendor can void a due invoice.
create or replace function public.set_invoice_status(i uuid, s text)
returns text language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  select inv.id, inv.status, b.event_id, b.vendor_id into rec
    from public.invoices inv join public.event_vendors b on b.id = inv.event_vendor_id where inv.id = i;
  if rec.id is null or not (public.owns_event(rec.event_id) or public.owns_vendor(rec.vendor_id)) then raise exception 'Invoice not found.'; end if;
  if rec.status <> 'due' then raise exception 'This invoice is already %.', rec.status; end if;
  if s = 'paid' and public.owns_event(rec.event_id) then
    update public.invoices set status = 'paid', paid_at = now() where id = i;
  elsif s = 'void' and public.owns_vendor(rec.vendor_id) then
    update public.invoices set status = 'void' where id = i;
  else
    raise exception 'That change is not allowed.';
  end if;
  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews: only from the event owner, only after a confirmed booking's event date has passed.
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  event_vendor_id uuid not null unique references public.event_vendors(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 2000),
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy "reviews: public read" on public.reviews for select using (
  exists (select 1 from public.vendors v where v.id = vendor_id and v.verification_status = 'verified')
  or author_id = auth.uid() or public.owns_vendor(vendor_id));
create policy "reviews: after the event" on public.reviews for insert with check (
  author_id = auth.uid() and exists (
    select 1 from public.event_vendors b join public.events e on e.id = b.event_id
    where b.id = event_vendor_id and b.vendor_id = reviews.vendor_id and e.owner_id = auth.uid()
      and b.status = 'confirmed' and e.event_date is not null and e.event_date < current_date));

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);
alter table public.favorites enable row level security;
create policy "favorites: own" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Sponsor leads: research results and drafted proposals. Nothing is ever sent from here.
-- ---------------------------------------------------------------------------
create table if not exists public.sponsor_leads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  url text check (url is null or (url ~ '^https?://' and char_length(url) <= 2000)),
  reason text check (char_length(reason) <= 1000),
  proposal text check (char_length(proposal) <= 6000),
  status text not null default 'idea' check (status in ('idea', 'approved', 'contacted', 'agreed', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists sponsor_leads_touch on public.sponsor_leads;
create trigger sponsor_leads_touch before update on public.sponsor_leads for each row execute function public.touch_updated_at();
alter table public.sponsor_leads enable row level security;
create policy "sponsors: viewers read" on public.sponsor_leads for select using (public.can_view_event(event_id));
create policy "sponsors: owner insert" on public.sponsor_leads for insert with check (public.owns_event(event_id));
create policy "sponsors: owner update" on public.sponsor_leads for update using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy "sponsors: owner delete" on public.sponsor_leads for delete using (public.owns_event(event_id));

alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check check (kind in ('plan', 'discover', 'sponsor'));

-- ---------------------------------------------------------------------------
-- In-app notifications, written only by triggers.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications: own read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(uid uuid, t text, l text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, link) select uid, t, l where uid is not null and uid is distinct from auth.uid();
$$;
revoke execute on function public.notify(uuid, text, text) from public, anon, authenticated;

create or replace function public.on_booking_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record; owner uuid;
begin
  select id, name, owner_id into v from public.vendors where id = new.vendor_id;
  select owner_id into owner from public.events where id = new.event_id;
  if tg_op = 'INSERT' then
    perform public.notify(v.owner_id, 'New inquiry for ' || v.name, '/vendor/bookings/' || new.id);
  elsif new.status <> old.status then
    perform public.notify(owner, v.name || ': ' || new.status, '/bookings/' || new.id);
    perform public.notify(v.owner_id, 'Booking ' || new.status, '/vendor/bookings/' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists event_vendors_notify on public.event_vendors;
create trigger event_vendors_notify after insert or update on public.event_vendors
  for each row execute function public.on_booking_change();

create or replace function public.on_quote_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select ev.id, ev.event_id, e.owner_id as event_owner, v.owner_id as vendor_owner, v.name
    into b from public.event_vendors ev join public.events e on e.id = ev.event_id join public.vendors v on v.id = ev.vendor_id
    where ev.id = new.event_vendor_id;
  if tg_op = 'INSERT' then
    perform public.notify(b.event_owner, 'New quote from ' || b.name, '/bookings/' || b.id);
  elsif new.status <> old.status and new.status in ('accepted', 'declined') then
    perform public.notify(b.vendor_owner, 'Your quote was ' || new.status, '/vendor/bookings/' || b.id);
  end if;
  return new;
end;
$$;
drop trigger if exists quotes_notify on public.quotes;
create trigger quotes_notify after insert or update on public.quotes
  for each row execute function public.on_quote_change();

create or replace function public.on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select ev.id, e.owner_id as event_owner, v.owner_id as vendor_owner, v.name
    into b from public.event_vendors ev join public.events e on e.id = ev.event_id join public.vendors v on v.id = ev.vendor_id
    where ev.id = new.event_vendor_id;
  if new.sender_id = b.vendor_owner then
    perform public.notify(b.event_owner, 'Message from ' || b.name, '/bookings/' || b.id);
  else
    perform public.notify(b.vendor_owner, 'New message on a booking', '/vendor/bookings/' || b.id);
  end if;
  return new;
end;
$$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages for each row execute function public.on_message();

create or replace function public.on_invoice()
returns trigger language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select ev.id, e.owner_id as event_owner, v.owner_id as vendor_owner, v.name
    into b from public.event_vendors ev join public.events e on e.id = ev.event_id join public.vendors v on v.id = ev.vendor_id
    where ev.id = new.event_vendor_id;
  if tg_op = 'INSERT' then
    perform public.notify(b.event_owner, 'Invoice from ' || b.name, '/bookings/' || b.id);
  elsif new.status = 'paid' and old.status <> 'paid' then
    perform public.notify(b.vendor_owner, 'Payment recorded by the customer', '/vendor/bookings/' || b.id);
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_notify on public.invoices;
create trigger invoices_notify after insert or update on public.invoices for each row execute function public.on_invoice();
