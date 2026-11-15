-- Inbox: one row per booking conversation the user is part of, with unread counts.
-- Read markers are private to each user and only for bookings they are a party to.
create table if not exists public.message_reads (
  user_id uuid not null default public.session_user_id() references public.profiles(id) on delete cascade,
  event_vendor_id uuid not null references public.event_vendors(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, event_vendor_id)
);
alter table public.message_reads enable row level security;
create policy "reads: own read" on public.message_reads for select using (user_id = public.session_user_id());
create policy "reads: own insert" on public.message_reads for insert
  with check (user_id = public.session_user_id() and public.is_booking_party(event_vendor_id));
create policy "reads: own update" on public.message_reads for update using (user_id = public.session_user_id())
  with check (user_id = public.session_user_id() and public.is_booking_party(event_vendor_id));
revoke all on public.message_reads from anon;

-- Security definer so a vendor sees the thread even though the event row itself is private to the
-- organizer. Access is checked explicitly: the caller must own the vendor or be able to view the event.
-- Vendors get the event type and date instead of the organizer's private event title.
create or replace function public.my_inbox()
returns table (event_vendor_id uuid, status text, vendor_id uuid, vendor_name text, event_id uuid, event_title text,
  i_am_vendor boolean, last_body text, last_at timestamptz, last_from_me boolean, unread int)
language sql stable security definer set search_path = public as $$
  select ev.id, ev.status::text, v.id, v.name, e.id,
    case when public.can_view_event(e.id) then e.title
      else concat_ws(' on ', e.event_type, to_char(e.event_date, 'Mon FMDD, YYYY')) end,
    public.owns_vendor(v.id),
    lm.body, coalesce(lm.created_at, ev.created_at), lm.sender_id = public.session_user_id(),
    (select count(*)::int from public.messages m
      where m.event_vendor_id = ev.id and m.sender_id <> public.session_user_id()
        and m.created_at > coalesce((select r.last_read_at from public.message_reads r
          where r.event_vendor_id = ev.id and r.user_id = public.session_user_id()), '-infinity'))
  from public.event_vendors ev
  join public.vendors v on v.id = ev.vendor_id
  join public.events e on e.id = ev.event_id
  left join lateral (select m.body, m.created_at, m.sender_id from public.messages m
    where m.event_vendor_id = ev.id order by m.created_at desc limit 1) lm on true
  where public.session_user_id() is not null
    and (public.owns_vendor(v.id) or public.can_view_event(e.id))
  order by coalesce(lm.created_at, ev.created_at) desc
  limit 200;
$$;
revoke all on function public.my_inbox() from public, anon;
grant execute on function public.my_inbox() to authenticated;

-- Saved vendors: a personal list, separate from an event's shortlist.
create table if not exists public.saved_vendors (
  user_id uuid not null default public.session_user_id() references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);
alter table public.saved_vendors enable row level security;
create policy "saved: own read" on public.saved_vendors for select using (user_id = public.session_user_id());
create policy "saved: own insert" on public.saved_vendors for insert with check (user_id = public.session_user_id());
create policy "saved: own delete" on public.saved_vendors for delete using (user_id = public.session_user_id());
revoke all on public.saved_vendors from anon;
revoke update on public.saved_vendors from authenticated;
