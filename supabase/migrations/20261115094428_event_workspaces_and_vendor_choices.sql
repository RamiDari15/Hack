-- Private planning data, never business quotes, bookings or reviews.
alter table public.events add column if not exists workspace_key text;
alter table public.events add column if not exists starter_plan jsonb check (starter_plan is null or jsonb_typeof(starter_plan)='object');
create unique index if not exists events_workspace_key on public.events(owner_id,workspace_key) where workspace_key is not null;
alter table public.event_shortlist add column if not exists pricing_selection jsonb check (pricing_selection is null or jsonb_typeof(pricing_selection)='object');
grant update(pricing_selection) on public.event_shortlist to authenticated;

create table if not exists public.event_notes (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null default public.session_user_id() references public.profiles(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 160),
 body text not null check (char_length(body) between 1 and 3000),
 done boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists event_notes_event_idx on public.event_notes(event_id,created_at);
alter table public.event_notes enable row level security;
create policy "notes: event readers" on public.event_notes for select to authenticated using (public.can_view_event(event_id));
create policy "notes: own add" on public.event_notes for insert to authenticated with check (user_id=public.session_user_id() and public.can_view_event(event_id));
create policy "notes: own update" on public.event_notes for update to authenticated using (user_id=public.session_user_id()) with check (user_id=public.session_user_id() and public.can_view_event(event_id));
create policy "notes: own or owner delete" on public.event_notes for delete to authenticated using (user_id=public.session_user_id() or public.owns_event(event_id));
revoke all on public.event_notes from anon;
grant select,insert,delete on public.event_notes to authenticated;
grant update(title,body,done) on public.event_notes to authenticated;

-- Creating an event and adding a vendor are a single transaction. No contact is sent.
create or replace function public.plan_vendor(p_vendor uuid, p_event uuid default null, p_details jsonb default '{}', p_pricing jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare me uuid:=public.session_user_id(); eid uuid:=p_event; sid uuid; amount bigint;
begin
 if me is null then raise exception 'Sign in first.'; end if;
 if not exists(select 1 from public.vendors where id=p_vendor) then raise exception 'Vendor not found.'; end if;
 if eid is null then
  insert into public.events(owner_id,title,event_type,event_date,location,guest_count,budget_cents)
  values(me,p_details->>'title',coalesce(p_details->>'event_type','Other'),nullif(p_details->>'event_date','')::date,
   nullif(p_details->>'location',''),nullif(p_details->>'guest_count','')::int,nullif(p_details->>'budget_cents','')::bigint)
  returning id into eid;
 end if;
 if not public.can_view_event(eid) then raise exception 'Choose one of your events.'; end if;
 if p_pricing is not null then
  if p_pricing->>'source' not in ('planning_range','published') or jsonb_typeof(p_pricing->'max_cents')<>'number' then raise exception 'Invalid pricing selection.'; end if;
  amount:=(p_pricing->>'max_cents')::bigint;
  if amount<0 or amount>100000000 then raise exception 'Planning amount is out of range.'; end if;
 end if;
 insert into public.event_shortlist(event_id,vendor_id,added_by,planned_cents,pricing_selection)
 values(eid,p_vendor,me,null,p_pricing) on conflict(event_id,vendor_id) do nothing returning id into sid;
 if sid is null then select id into sid from public.event_shortlist where event_id=eid and vendor_id=p_vendor; end if;
 if p_pricing is not null and public.owns_event(eid) then update public.event_shortlist set planned_cents=amount,pricing_selection=p_pricing where id=sid; end if;
 return jsonb_build_object('event_id',eid,'shortlist_id',sid);
end $$;
revoke all on function public.plan_vendor(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.plan_vendor(uuid,uuid,jsonb,jsonb) to authenticated;

create table if not exists public.event_ideas (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 idea_key text not null check(char_length(idea_key) between 1 and 80),
 title text not null check(char_length(title) between 1 and 160),
 note text check(char_length(note)<=1000),
 added_by uuid not null default public.session_user_id() references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),unique(event_id,idea_key)
);
alter table public.event_ideas enable row level security;
create policy "ideas: event readers" on public.event_ideas for select to authenticated using(public.can_view_event(event_id));
create policy "ideas: event add" on public.event_ideas for insert to authenticated with check(added_by=public.session_user_id() and public.can_view_event(event_id));
create policy "ideas: author or owner remove" on public.event_ideas for delete to authenticated using(added_by=public.session_user_id() or public.owns_event(event_id));
revoke all on public.event_ideas from anon;
grant select,insert,delete on public.event_ideas to authenticated;
create table if not exists public.saved_ideas (
 user_id uuid not null default public.session_user_id() references public.profiles(id) on delete cascade,
 idea_key text not null check(char_length(idea_key) between 1 and 80),
 created_at timestamptz not null default now(),primary key(user_id,idea_key)
);
alter table public.saved_ideas enable row level security;
create policy "saved ideas: own read" on public.saved_ideas for select to authenticated using(user_id=public.session_user_id());
create policy "saved ideas: own add" on public.saved_ideas for insert to authenticated with check(user_id=public.session_user_id());
create policy "saved ideas: own remove" on public.saved_ideas for delete to authenticated using(user_id=public.session_user_id());
revoke all on public.saved_ideas from anon;
grant select,insert,delete on public.saved_ideas to authenticated;

-- Curated presentation templates are private working plans. SECURITY INVOKER keeps
-- all existing ownership rules in force; the owner is always the verified caller.
-- Re-running this function preserves edits and does not duplicate any event.
create or replace function public.create_event_workspace(templates jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare me uuid:=public.session_user_id(); template jsonb; eid uuid; existing uuid; entry jsonb;
 wanted_category text; vendor record; sid uuid; cost bigint; counter int; photo_counter int; table_ids uuid[];
 table_id uuid; guest_id uuid; gift_id uuid; guest_token uuid; result jsonb:='[]';
begin
 if me is null then raise exception 'Sign in first.'; end if;
 if jsonb_typeof(templates)<>'array' or jsonb_array_length(templates)>3 or octet_length(templates::text)>200000 then raise exception 'Invalid workspace templates.'; end if;
 for template in select value from jsonb_array_elements(templates) loop
  eid:=null;
  insert into public.events(owner_id,workspace_key,title,event_type,event_date,location,guest_count,budget_cents,style,notes,
    guest_list_enabled,meal_options,registry_enabled,website_intro,website_slug,starter_plan,latitude,longitude)
  values(me,template->>'key',template->>'title',template->>'event_type',(template->>'event_date')::date,template->>'location',
    (template->>'guest_count')::int,(template->>'budget_cents')::bigint,template->>'style',
    'Presentation workspace with example guests, draft budgets and private planning notes. Real businesses are research choices; no business has been contacted or booked.',
    true,array['Seasonal chicken','Garden vegetarian','Plant-based'],true,
    'We cannot wait to celebrate together. Join us for good food, warm conversation and a few unforgettable moments. All the details for the day are here.',
    (template->>'key')||'-'||left(me::text,6),template->'plan',(template->>'latitude')::float8,(template->>'longitude')::float8)
  on conflict(owner_id,workspace_key) where workspace_key is not null do nothing returning id into eid;
  if eid is null then
   select id into eid from public.events where owner_id=me and workspace_key=template->>'key';
   result:=result||jsonb_build_array(jsonb_build_object('id',eid,'title',template->>'title','created',false));continue;
  end if;
  table_ids:='{}';
  for counter in 1..greatest(2,ceil((template->>'guest_count')::numeric/8)::int) loop
   insert into public.event_tables(event_id,name,seats) values(eid,'Table '||counter,8) returning id into table_id;
   table_ids:=array_append(table_ids,table_id);
  end loop;
  counter:=0;
  for entry in select value from jsonb_array_elements(template->'guests') limit 100 loop
   counter:=counter+1;
   insert into public.event_guests(event_id,name,party_size,status,attending,meal,dietary,responded_at,table_id)
   values(eid,entry->>'name',(entry->>'party_size')::int,entry->>'status',(entry->>'attending')::int,entry->>'meal',nullif(entry->>'dietary',''),
    case when entry->>'status'<>'invited' then now()-interval '2 days' end,
    case when entry->>'status'='yes' then table_ids[1+((counter-1)/4)%cardinality(table_ids)] end) returning id,rsvp_token into guest_id,guest_token;
  end loop;
  counter:=0;
  for entry in select value from jsonb_array_elements(template->'gifts') limit 20 loop
   counter:=counter+1;
   insert into public.event_registry_items(event_id,title,price_note,quantity,note)
    values(eid,entry->>'title',entry->>'price_note',(entry->>'quantity')::int,entry->>'note') returning id into gift_id;
   if counter<=3 then perform public.registry_claim(guest_token,gift_id,1); end if;
  end loop;
  counter:=0;
  for entry in select value from jsonb_array_elements(template->'timeline') limit 30 loop
   counter:=counter+1;
   insert into public.event_timeline_items(event_id,start_time,end_time,title,notes,source,show_on_website)
    values(eid,(entry->>0)::time,(entry->>1)::time,entry->>2,entry->>3,'organizer',counter between 5 and 10);
  end loop;
  counter:=0;
  for entry in select value from jsonb_array_elements(template->'tasks') limit 30 loop
   counter:=counter+1;
   insert into public.event_tasks(event_id,title,due_note,assignee_id,created_by,done)
    values(eid,entry#>>'{}',case when counter<4 then 'This week' when counter<8 then 'One month before' else 'The week before' end,me,me,counter<=3);
  end loop;
  insert into public.user_todos(user_id,title,event_id,due_date) values(me,'Review the vendor shortlist for '||(template->>'title'),eid,current_date+3),(me,'Confirm the key details for '||(template->>'title'),eid,current_date+7);
  for entry in select value from jsonb_array_elements(template->'notes') limit 10 loop
   insert into public.event_notes(event_id,user_id,title,body) values(eid,me,entry->>'title',entry->>'body');
  end loop;
  photo_counter:=0;
  for wanted_category in select jsonb_array_elements_text(template->'categories') loop
   counter:=0;
   select round((c->>'high')::numeric*100)::bigint into cost from jsonb_array_elements(template->'plan'->'categories') c where c->>'name'=wanted_category;
   for vendor in select v.id,v.name,v.portfolio_photos,v.source_url from public.vendors v
     where v.directory_listed and v.category=wanted_category
     order by case when v.city ilike '%Ann Arbor%' then 0 when v.city ilike '%Ypsilanti%' then 1 else 2 end,
      jsonb_array_length(v.portfolio_photos) desc,v.name limit 2 loop
    counter:=counter+1;
    insert into public.event_shortlist(event_id,vendor_id,added_by,in_package,planned_cents,pricing_selection)
     values(eid,vendor.id,me,false,null,jsonb_build_object('source','planning_range','title','Starter allocation','quantity',1,'unit','event','min_cents',round(cost*.8),'max_cents',cost)) returning id into sid;
    update public.event_shortlist set in_package=(counter=1),planned_cents=cost where id=sid;
    insert into public.shortlist_votes(shortlist_id,user_id,vote) values(sid,me,case when counter=1 then 1 else -1 end);
    insert into public.shortlist_comments(shortlist_id,user_id,body) values(sid,me,case when counter=1 then 'Strong fit for the feel of the day. Compare inclusions, travel and availability before deciding.' else 'Keep as an alternative while we compare coverage and the complete cost.' end);
    insert into public.saved_vendors(user_id,vendor_id) values(me,vendor.id) on conflict do nothing;
    if counter=1 and vendor.portfolio_photos->>0 like 'https://%' then
     photo_counter:=photo_counter+1;
     insert into public.style_board_items(event_id,section,image_url,caption,added_by)
      values(eid,case wanted_category when 'Venues' then 'venue' when 'Florists' then 'flowers' when 'Decor & styling' then 'decor' when 'Hair & makeup' then 'outfits' else 'other' end,
       vendor.portfolio_photos->>0,left('Inspiration from '||vendor.name,200),me);
    end if;
   end loop;
  end loop;
  insert into public.event_ideas(event_id,idea_key,title,note,added_by) values(eid,template->>'idea',template->>'style','Use the palette, atmosphere and checklist as a starting point.',me);
  insert into public.saved_ideas(user_id,idea_key) values(me,template->>'idea') on conflict do nothing;
  insert into public.event_invites(event_id,email,created_by) values(eid,'alex.rivera@example.test',me),(eid,'jamie.patel@example.test',me);
  insert into public.sponsor_leads(event_id,name,url,reason,proposal,status)
   select eid,v.name,v.website,'A local business to research for an in-kind partnership.',
    'Hello! We are planning '||(template->>'title')||' in Ann Arbor and would love to discuss a small, audience-appropriate partnership. Could we learn what opportunities you offer?','idea'
   from public.vendors v where v.directory_listed and v.city ilike '%Ann Arbor%' and v.category in ('Catering','Florists') order by v.name limit 3;
  result:=result||jsonb_build_array(jsonb_build_object('id',eid,'title',template->>'title','created',true));
 end loop;
 return result;
end $$;
revoke all on function public.create_event_workspace(jsonb) from public,anon;
grant execute on function public.create_event_workspace(jsonb) to authenticated;
