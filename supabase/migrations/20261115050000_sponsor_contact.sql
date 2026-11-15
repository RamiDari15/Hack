-- Where to reach a sponsor. Vendora never sends anything: the organizer emails from their own inbox.
alter table public.sponsor_leads add column if not exists contact_email text
  check (contact_email is null or (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(contact_email) <= 200));
