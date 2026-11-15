-- Vendora schema v2. Review before running. Run once in the Supabase SQL editor on a new project.
-- Every table has row-level security. Users can only change their own rows, and the columns
-- that grant trust (roles, verification status) can only be changed by an admin.

-- gen_random_uuid() is built into Postgres 13+, so no extension is needed.

-- ---------------------------------------------------------------------------
-- Profiles: one per auth user, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  roles text[] not null default '{customer}'
    check (roles <@ array['customer','organizer','vendor','sponsor','admin']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin check used by policies. security definer so it can read profiles without recursion.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and 'admin' = any(roles));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- ---------------------------------------------------------------------------
-- Vendors and packages
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  category text not null,
  city text,
  service_radius_mi int check (service_radius_mi between 0 and 1000),
  description text check (char_length(description) <= 4000),
  setup_requirements text,
  booking_policy text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendors_public_idx on public.vendors (verification_status, category);

-- Verification guard: only admins can verify. A vendor's own insert or edit is always pending.
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
  else
    new.verification_status = old.verification_status;
    new.verified_at = old.verified_at;
    new.owner_id = old.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_verification_guard on public.vendors;
create trigger vendors_verification_guard
  before insert or update on public.vendors
  for each row execute function public.guard_vendor_verification();
drop trigger if exists vendors_touch on public.vendors;
create trigger vendors_touch before update on public.vendors
  for each row execute function public.touch_updated_at();

create table if not exists public.vendor_packages (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  title text not null,
  price_cents int check (price_cents >= 0),   -- null means quote required
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  event_type text not null,
  event_date date,
  location text,
  guest_count int check (guest_count between 1 and 100000),
  budget_cents bigint check (budget_cents >= 0),
  style text,
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_owner_idx on public.events (owner_id, event_date);
drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- Booking state: inquiry -> quote -> hold -> confirmed. Kept separate on purpose.
create table if not exists public.event_vendors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  status text not null default 'inquiry'
    check (status in ('inquiry','quote','hold','confirmed','cancelled')),
  hold_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, vendor_id)
);
drop trigger if exists event_vendors_touch on public.event_vendors;
create trigger event_vendors_touch before update on public.event_vendors
  for each row execute function public.touch_updated_at();

-- Helpers for policies
create or replace function public.owns_event(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = e and owner_id = auth.uid());
$$;
create or replace function public.owns_vendor(v uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vendors where id = v and owner_id = auth.uid());
$$;
create or replace function public.is_booking_party(ev uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_vendors b
    where b.id = ev and (public.owns_event(b.event_id) or public.owns_vendor(b.vendor_id))
  );
$$;

-- Quotes: written by the vendor, read by both parties. Replace AI estimates in the UI.
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  event_vendor_id uuid not null references public.event_vendors(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  description text,
  valid_until date,
  status text not null default 'sent' check (status in ('sent','accepted','declined','expired')),
  created_at timestamptz not null default now()
);

-- Messages between the event owner and the vendor on one booking
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  event_vendor_id uuid not null references public.event_vendors(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- AI and search usage: one row per request, for the daily cost limit and to keep the result.
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('plan','discover')),
  event_id uuid references public.events(id) on delete set null,
  input jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_requests_user_idx on public.ai_requests (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_packages enable row level security;
alter table public.events enable row level security;
alter table public.event_vendors enable row level security;
alter table public.quotes enable row level security;
alter table public.messages enable row level security;
alter table public.ai_requests enable row level security;

-- Profiles: read and rename your own. Roles are changed only by admins.
create policy "profiles: read own" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin update" on public.profiles for update using (public.is_admin());
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;
-- Admins change roles through the dashboard or service role, never from the browser.

-- Vendors: anyone reads verified vendors; owners read and edit their own; the guard trigger
-- keeps verification in admin hands.
create policy "vendors: public read verified" on public.vendors for select
  using (verification_status = 'verified' or owner_id = auth.uid() or public.is_admin());
create policy "vendors: owner insert" on public.vendors for insert with check (owner_id = auth.uid());
create policy "vendors: owner update" on public.vendors for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "vendors: owner delete" on public.vendors for delete using (owner_id = auth.uid());

create policy "packages: public read" on public.vendor_packages for select using (
  exists (select 1 from public.vendors v where v.id = vendor_id
    and (v.verification_status = 'verified' or v.owner_id = auth.uid())));
create policy "packages: owner write" on public.vendor_packages for all
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

-- Events: private to the owner.
create policy "events: owner all" on public.events for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Bookings: the event owner creates the inquiry for a verified vendor. Both parties read.
-- Vendors move status forward (quote, hold); the event owner confirms or cancels.
create policy "bookings: parties read" on public.event_vendors for select
  using (public.owns_event(event_id) or public.owns_vendor(vendor_id));
create policy "bookings: owner creates inquiry" on public.event_vendors for insert
  with check (public.owns_event(event_id) and status = 'inquiry'
    and exists (select 1 from public.vendors v where v.id = vendor_id and v.verification_status = 'verified'));
create policy "bookings: parties update" on public.event_vendors for update
  using (public.owns_event(event_id) or public.owns_vendor(vendor_id));

create policy "quotes: parties read" on public.quotes for select using (public.is_booking_party(event_vendor_id));
create policy "quotes: vendor writes" on public.quotes for insert with check (
  exists (select 1 from public.event_vendors b where b.id = event_vendor_id and public.owns_vendor(b.vendor_id)));

create policy "messages: parties read" on public.messages for select using (public.is_booking_party(event_vendor_id));
create policy "messages: parties write" on public.messages for insert
  with check (sender_id = auth.uid() and public.is_booking_party(event_vendor_id));

create policy "ai_requests: own read" on public.ai_requests for select using (user_id = auth.uid());
create policy "ai_requests: own insert" on public.ai_requests for insert
  with check (user_id = auth.uid() and (event_id is null or public.owns_event(event_id)));
