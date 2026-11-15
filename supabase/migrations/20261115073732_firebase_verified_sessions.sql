-- auth.uid() alone is not an email-verification check for third-party tokens.
-- Keep Supabase's system functions intact and use an application identity gate in
-- every existing ownership policy/helper, including SECURITY DEFINER RPCs.
create or replace function public.session_user_id()
returns uuid language sql stable security invoker set search_path = '' as $$
  select case
    when coalesce(auth.jwt()->>'iss', '') like 'https://securetoken.google.com/%' then
      case when auth.jwt()->>'iss' = 'https://securetoken.google.com/vendora-auth-ramidari15'
        and auth.jwt()->>'email_verified' = 'true'
        and auth.jwt()->>'role' = 'authenticated'
      then auth.uid() else null::uuid end
    else auth.uid()
  end;
$$;
revoke all on function public.session_user_id() from public;
grant execute on function public.session_user_id() to anon, authenticated, service_role;

-- Preserve each policy's commands, target roles and permissive/restrictive mode.
do $$
declare policy_row record; statement text;
begin
  for policy_row in
    select p.polname, n.nspname, c.relname,
      pg_get_expr(p.polqual, p.polrelid) as using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  loop
    if coalesce(policy_row.using_expr, '') like '%auth.uid()%'
      or coalesce(policy_row.check_expr, '') like '%auth.uid()%' then
      statement := format('alter policy %I on %I.%I', policy_row.polname, policy_row.nspname, policy_row.relname);
      if policy_row.using_expr is not null then
        statement := statement || ' using (' || replace(policy_row.using_expr, 'auth.uid()', 'public.session_user_id()') || ')';
      end if;
      if policy_row.check_expr is not null then
        statement := statement || ' with check (' || replace(policy_row.check_expr, 'auth.uid()', 'public.session_user_id()') || ')';
      end if;
      execute statement;
    end if;
  end loop;
end $$;

-- Replacing the function body keeps ownership, ACLs and dependent policies intact.
do $$
declare function_row record;
begin
  for function_row in
    select p.oid, pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname <> 'session_user_id' and p.prosrc like '%auth.uid()%'
  loop
    execute replace(function_row.definition, 'auth.uid()', 'public.session_user_id()');
  end loop;
end $$;
