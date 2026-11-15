-- When a vendor sends a quote, move the booking from "inquiry" to "quote" automatically.
create or replace function public.mark_booking_quoted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.event_vendors set status = 'quote' where id = new.event_vendor_id and status = 'inquiry';
  return new;
end;
$$;
drop trigger if exists quotes_mark_booking on public.quotes;
create trigger quotes_mark_booking after insert on public.quotes
  for each row execute function public.mark_booking_quoted();
