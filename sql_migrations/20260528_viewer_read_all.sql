-- ====================================================================
-- Ensure every authenticated user (admin + viewer) can READ all data
-- in the public schema. Does not change write/RLS semantics for inserts
-- or updates. Safe to run multiple times.
-- ====================================================================

do $$
declare
  tbl record;
  pol record;
begin
  for tbl in
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'r'
       and n.nspname = 'public'
  loop
    -- 1) Make sure SELECT is granted to authenticated + service_role
    execute format('grant select on public.%I to authenticated', tbl.table_name);
    execute format('grant all    on public.%I to service_role',  tbl.table_name);

    -- 2) Drop any pre-existing restrictive SELECT policies that may
    --    be blocking viewers (only the ones we manage here).
    for pol in
      select policyname
        from pg_policies
       where schemaname = 'public'
         and tablename  = tbl.table_name
         and policyname like 'viewer_read_all_%'
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl.table_name);
    end loop;

    -- 3) Add a permissive SELECT policy for every authenticated user.
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      'viewer_read_all_' || tbl.table_name,
      tbl.table_name
    );
  end loop;
end $$;
