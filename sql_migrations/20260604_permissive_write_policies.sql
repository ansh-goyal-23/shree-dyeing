-- ====================================================================
-- Ensure all transactional public tables allow INSERT/UPDATE/DELETE for
-- any authenticated user. Frontend role/ownership guards control who can
-- click those buttons; backend stays permissive per project convention.
--
-- Fixes: Admins clicking "delete" on rows created by editors saw the
-- success toast but the row remained because no permissive DELETE policy
-- existed (RLS denied by default).
-- ====================================================================

do $$
declare
  tbl record;
begin
  for tbl in
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'r'
       and n.nspname = 'public'
       and c.relname not in ('user_roles', 'inventory_change_logs')
  loop
    -- Grants
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl.table_name);
    execute format('grant all on public.%I to service_role', tbl.table_name);

    -- Drop our previously-managed write policies if present so we can recreate.
    execute format('drop policy if exists %I on public.%I',
                   'auth_write_all_' || tbl.table_name, tbl.table_name);

    -- Permissive write policy for any authenticated user.
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'auth_write_all_' || tbl.table_name,
      tbl.table_name
    );
  end loop;
end $$;
