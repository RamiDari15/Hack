-- Re-run the verified-identity rewrite for migrations added after 20261115073732 (website, weather,
-- seating, to-dos and anything else that used auth.uid() directly). Idempotent.
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
