-- Let trusted server contexts (seed scripts, service role) update bookings; end users still go through the rules.
create or replace function public.guard_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_vendor boolean; is_owner boolean;
begin
  -- Trusted server contexts (migrations, seeds, service role) are not end users.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
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
