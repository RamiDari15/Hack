-- Real businesses from the public directory must not carry invented reviews or invented schedules.
-- Simulated reviews and demo calendars are allowed only on fictional "Sample" vendors (supabase/seed.sql).
update public.vendors set demo_reviews = '[]'::jsonb, calendar_is_demo = false where directory_listed;
delete from public.vendor_calendar_entries e using public.vendors v
  where e.vendor_id = v.id and v.directory_listed and e.is_demo;

alter table public.vendors add constraint vendors_no_simulated_reviews_on_listings
  check (not (directory_listed and jsonb_array_length(demo_reviews) > 0));
alter table public.vendors add constraint vendors_no_demo_calendar_on_listings
  check (not (directory_listed and calendar_is_demo));

create or replace function public.guard_demo_calendar()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_demo and exists (select 1 from public.vendors v where v.id = new.vendor_id and v.directory_listed) then
    raise exception 'Demo calendar entries are not allowed on real business listings.';
  end if;
  return new;
end;
$$;
drop trigger if exists vendor_calendar_demo_guard on public.vendor_calendar_entries;
create trigger vendor_calendar_demo_guard before insert or update on public.vendor_calendar_entries
  for each row execute function public.guard_demo_calendar();
