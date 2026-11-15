-- Event website, NASA POWER weather history, and the seating chart.

-- ---------------------------------------------------------------------------
-- Event website: one public page per event, off until the organizer publishes it.
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists website_enabled boolean not null default false;
alter table public.events add column if not exists website_slug text unique
  check (website_slug is null or website_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(website_slug) <= 80);
alter table public.events add column if not exists website_intro text check (char_length(website_intro) <= 2000);
alter table public.event_timeline_items add column if not exists show_on_website boolean not null default false;

-- What the public page shows: the basics, the guest-facing schedule and the registry's open
-- counts. No guest names, vendors, budgets or notes.
create or replace function public.event_website(s text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'title', e.title, 'event_type', e.event_type, 'event_date', e.event_date, 'location', e.location,
    'intro', e.website_intro, 'rsvp_open', e.guest_list_enabled, 'registry_open', e.registry_enabled,
    'schedule', coalesce((select jsonb_agg(jsonb_build_object('start', t.start_time, 'end', t.end_time, 'title', t.title) order by t.start_time)
                          from public.event_timeline_items t where t.event_id = e.id and t.show_on_website), '[]'::jsonb),
    'registry', case when e.registry_enabled then coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'url', i.url, 'price_note', i.price_note, 'quantity', i.quantity,
                    'remaining', greatest(i.quantity - coalesce((select sum(c.quantity) from public.registry_claims c where c.item_id = i.id), 0), 0)) order by i.created_at)
                  from public.event_registry_items i where i.event_id = e.id), '[]'::jsonb) else '[]'::jsonb end)
  from public.events e
  where e.website_slug = s and e.website_enabled;
$$;
revoke execute on function public.event_website(text) from public;
grant execute on function public.event_website(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Weather history (NASA POWER). Coordinates come from Vendora listings in the event's city;
-- the computed summary is cached per event, date and place.
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists latitude double precision check (latitude is null or latitude between -90 and 90);
alter table public.events add column if not exists longitude double precision check (longitude is null or longitude between -180 and 180);

create table if not exists public.event_weather (
  event_id uuid primary key references public.events(id) on delete cascade,
  event_date date not null,
  latitude double precision not null,
  longitude double precision not null,
  place_note text,
  summary jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.event_weather enable row level security;
create policy "weather: viewers read" on public.event_weather for select using (public.can_view_event(event_id));
create policy "weather: owner writes" on public.event_weather for insert with check (public.owns_event(event_id));
create policy "weather: owner updates" on public.event_weather for update using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy "weather: owner deletes" on public.event_weather for delete using (public.owns_event(event_id));

-- Approximate coordinates for a city, from the average of Vendora listings there.
create or replace function public.city_coordinates(city_name text)
returns table (latitude double precision, longitude double precision, listings int)
language sql stable security definer set search_path = public as $$
  select avg(v.latitude), avg(v.longitude), count(*)::int
  from public.vendors v
  where v.latitude is not null and v.longitude is not null and length(trim(city_name)) >= 3
    and v.city ilike trim(split_part(city_name, ',', 1)) || '%'
    and (v.directory_listed or v.verification_status = 'verified')
  having count(*) > 0;
$$;
grant execute on function public.city_coordinates(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seating chart
-- ---------------------------------------------------------------------------
create table if not exists public.event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  seats int not null default 8 check (seats between 1 and 40),
  created_at timestamptz not null default now()
);
create index if not exists event_tables_idx on public.event_tables (event_id, created_at);
alter table public.event_tables enable row level security;
create policy "tables: viewers read" on public.event_tables for select using (public.can_view_event(event_id));
create policy "tables: owner insert" on public.event_tables for insert with check (public.owns_event(event_id));
create policy "tables: owner update" on public.event_tables for update using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy "tables: owner delete" on public.event_tables for delete using (public.owns_event(event_id));

alter table public.event_guests add column if not exists table_id uuid references public.event_tables(id) on delete set null;
-- A guest can only sit at a table of their own event.
create or replace function public.guard_guest_table()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.table_id is not null and not exists (select 1 from public.event_tables t where t.id = new.table_id and t.event_id = new.event_id) then
    raise exception 'That table belongs to another event.';
  end if;
  return new;
end;
$$;
drop trigger if exists event_guests_table_guard on public.event_guests;
create trigger event_guests_table_guard before insert or update of table_id on public.event_guests
  for each row execute function public.guard_guest_table();
