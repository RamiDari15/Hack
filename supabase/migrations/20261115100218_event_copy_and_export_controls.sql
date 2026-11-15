-- Restrict writes to the columns each feature actually edits.
revoke update on public.event_notes from authenticated;
grant update(title,body,done) on public.event_notes to authenticated;
revoke update on public.event_ideas,public.saved_ideas from authenticated;

-- A reusable plan copies working data, not transactions, messages or invitations.
create or replace function public.copy_event(p_event uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare me uuid:=public.session_user_id(); original public.events; eid uuid; pick record; sid uuid;
begin
 if me is null then raise exception 'Sign in first.'; end if;
 select * into original from public.events where id=p_event and owner_id=me;
 if original.id is null then raise exception 'Only the owner can duplicate this event.'; end if;
 insert into public.events(owner_id,title,event_type,event_date,location,guest_count,budget_cents,style,notes,
  guest_list_enabled,meal_options,registry_enabled,website_intro,starter_plan,latitude,longitude)
 values(me,left(original.title||' (copy)',140),original.event_type,original.event_date,original.location,
  original.guest_count,original.budget_cents,original.style,original.notes,original.guest_list_enabled,
  original.meal_options,original.registry_enabled,original.website_intro,original.starter_plan,original.latitude,original.longitude) returning id into eid;
 for pick in select * from public.event_shortlist where event_id=p_event loop
  insert into public.event_shortlist(event_id,vendor_id,added_by,pricing_selection) values(eid,pick.vendor_id,me,pick.pricing_selection) returning id into sid;
  update public.event_shortlist set in_package=pick.in_package,planned_cents=pick.planned_cents where id=sid;
 end loop;
 insert into public.event_guests(event_id,name,email,party_size)
 select eid,name,email,party_size from public.event_guests where event_id=p_event;
 insert into public.event_tables(event_id,name,seats) select eid,name,seats from public.event_tables where event_id=p_event;
 insert into public.event_tasks(event_id,title,due_note,created_by)
 select eid,title,due_note,me from public.event_tasks where event_id=p_event;
 insert into public.event_timeline_items(event_id,start_time,end_time,title,notes,show_on_website)
 select eid,start_time,end_time,title,notes,show_on_website from public.event_timeline_items where event_id=p_event;
 insert into public.event_registry_items(event_id,title,url,price_note,quantity,note)
 select eid,title,url,price_note,quantity,note from public.event_registry_items where event_id=p_event;
 insert into public.event_ideas(event_id,idea_key,title,note,added_by)
 select eid,idea_key,title,note,me from public.event_ideas where event_id=p_event;
 insert into public.style_board_items(event_id,section,image_url,image_data,caption,added_by)
 select eid,section,image_url,image_data,caption,me from public.style_board_items where event_id=p_event;
 insert into public.event_notes(event_id,user_id,title,body)
 select eid,me,title,left('Copied planning note: '||body,3000) from public.event_notes where event_id=p_event;
 return eid;
end $$;
revoke all on function public.copy_event(uuid) from public,anon;
grant execute on function public.copy_event(uuid) to authenticated;

-- Missing provenance and amount fields must be rejected too.
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
  if coalesce(p_pricing->>'source','') not in ('planning_range','published') or coalesce(jsonb_typeof(p_pricing->'max_cents'),'')<>'number' then raise exception 'Invalid pricing selection.'; end if;
  amount:=(p_pricing->>'max_cents')::bigint;
  if amount<0 or amount>100000000 then raise exception 'Planning amount is out of range.'; end if;
 end if;
 insert into public.event_shortlist(event_id,vendor_id,added_by,planned_cents,pricing_selection)
 values(eid,p_vendor,me,null,p_pricing) on conflict(event_id,vendor_id) do nothing returning id into sid;
 if sid is null then select id into sid from public.event_shortlist where event_id=eid and vendor_id=p_vendor; end if;
 if p_pricing is not null and public.owns_event(eid) then update public.event_shortlist set planned_cents=amount,pricing_selection=p_pricing where id=sid; end if;
 return jsonb_build_object('event_id',eid,'shortlist_id',sid);
end $$;
