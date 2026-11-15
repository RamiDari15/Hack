-- Private sample businesses can be shared with named customers without falsely
-- verifying them or opening them to the public directory. Only trusted seeding
-- may create these grants; neither customers nor vendors may grant access.
create table public.vendor_walkthrough_access (
 vendor_id uuid not null references public.vendors(id) on delete cascade,
 customer_id uuid not null references public.profiles(id) on delete cascade,
 primary key(vendor_id,customer_id)
);
create index vendor_walkthrough_customer_idx on public.vendor_walkthrough_access(customer_id,vendor_id);
alter table public.vendor_walkthrough_access enable row level security;
revoke all on public.vendor_walkthrough_access from public,anon,authenticated;
grant select on public.vendor_walkthrough_access to authenticated;
create policy "walkthrough: named customer reads" on public.vendor_walkthrough_access for select to authenticated
 using(customer_id=(select public.session_user_id()));
create policy "vendors: private walkthrough reads" on public.vendors for select to authenticated
 using(exists(select 1 from public.vendor_walkthrough_access a where a.vendor_id=vendors.id and a.customer_id=(select public.session_user_id())));
create policy "packages: private walkthrough reads" on public.vendor_packages for select to authenticated
 using(exists(select 1 from public.vendor_walkthrough_access a where a.vendor_id=vendor_packages.vendor_id and a.customer_id=(select public.session_user_id())));
create policy "calendar: private walkthrough reads" on public.vendor_calendar_entries for select to authenticated
 using(exists(select 1 from public.vendor_walkthrough_access a where a.vendor_id=vendor_calendar_entries.vendor_id and a.customer_id=(select public.session_user_id())));
create policy "bookings: private walkthrough inquiry" on public.event_vendors for insert to authenticated
 with check(status='inquiry' and public.owns_event(event_id) and exists(
  select 1 from public.vendor_walkthrough_access a where a.vendor_id=event_vendors.vendor_id and a.customer_id=(select public.session_user_id())));

-- Inquiry + opening message succeed together. Existing conversations are reused.
create function public.request_vendor_quote(p_event uuid,p_vendor uuid,p_message text default '')
returns uuid language plpgsql security invoker set search_path=public as $$
declare bid uuid;
begin
 if public.session_user_id() is null or not public.owns_event(p_event) then raise exception 'Choose an event you own.'; end if;
 if char_length(coalesce(p_message,''))>4000 then raise exception 'Message is too long.'; end if;
 insert into public.event_vendors(event_id,vendor_id,status) values(p_event,p_vendor,'inquiry')
 on conflict(event_id,vendor_id) do nothing returning id into bid;
 if bid is null then
  select id into bid from public.event_vendors where event_id=p_event and vendor_id=p_vendor;
  return bid;
 end if;
 if nullif(btrim(p_message),'') is not null then
  insert into public.messages(event_vendor_id,sender_id,body) values(bid,public.session_user_id(),btrim(p_message));
 end if;
 return bid;
end $$;
revoke all on function public.request_vendor_quote(uuid,uuid,text) from public,anon;
grant execute on function public.request_vendor_quote(uuid,uuid,text) to authenticated;

-- Sample conversations stay in-app. Never email a private walkthrough exchange.
create or replace function public.queue_email_alert()
returns trigger language plpgsql security definer set search_path=public as $$
declare addr text;
begin
 if exists(select 1 from public.vendor_walkthrough_access a join public.event_vendors b on b.vendor_id=a.vendor_id
   where new.link='/bookings/'||b.id::text) then return new; end if;
 select u.email into addr from auth.users u join public.profiles p on p.id=u.id where u.id=new.user_id and p.email_alerts;
 if addr is not null then
  insert into public.email_outbox(notification_id,to_email,subject,link) values(new.id,addr,new.title,new.link);
 end if;
 return new;
end $$;
revoke all on function public.queue_email_alert() from public,anon,authenticated;
