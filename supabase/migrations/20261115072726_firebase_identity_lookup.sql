-- Server-only identity mapping preserves existing UUIDs and all ownership FKs.
-- Never expose this email lookup to anonymous or signed-in app users.
create or replace function public.firebase_identity_id(address text)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(address)) limit 1;
$$;
revoke all on function public.firebase_identity_id(text) from public, anon, authenticated;
grant execute on function public.firebase_identity_id(text) to service_role;

-- Shared across server instances, unlike an in-process signup/email throttle.
create schema if not exists vendora_auth_private;
revoke all on schema vendora_auth_private from public, anon, authenticated;
create table if not exists vendora_auth_private.rate_limits (
  key text not null,
  bucket bigint not null,
  attempts integer not null,
  primary key (key, bucket)
);
alter table vendora_auth_private.rate_limits enable row level security;
create or replace function public.firebase_auth_attempt(key_hash text, window_seconds integer, maximum integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare count_now integer; current_bucket bigint;
begin
  if window_seconds < 60 or maximum < 1 or length(key_hash) <> 64 then return false; end if;
  current_bucket := floor(extract(epoch from now()) / window_seconds);
  insert into vendora_auth_private.rate_limits as limits (key, bucket, attempts)
  values (key_hash, current_bucket, 1)
  on conflict (key, bucket) do update set attempts = least(limits.attempts + 1, maximum + 1)
  returning attempts into count_now;
  return count_now <= maximum;
end; $$;
revoke all on function public.firebase_auth_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.firebase_auth_attempt(text, integer, integer) to service_role;
