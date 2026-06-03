-- ====================================================================
-- Add 'editor' role + created_by tracking on transactional tables.
-- Frontend enforces edit/delete-own-row; backend RLS stays permissive.
--
-- IMPORTANT: Postgres forbids referencing a newly added enum value in the
-- same transaction. Run this file in TWO steps in the Supabase SQL editor:
--   STEP 1: run the block between BEGIN STEP 1 / END STEP 1 on its own.
--   STEP 2: run the rest of the file.
-- ====================================================================

-- ---------- BEGIN STEP 1 (run alone, then commit) ----------
alter type public.app_role add value if not exists 'editor';
-- ---------- END STEP 1 ----------


-- ---------- BEGIN STEP 2 (run after step 1 has been committed) ----------

-- Update precedence in get_my_role() so admin > editor > viewer.
-- Cast to text so this works even if the enum value was just added.
create or replace function public.get_my_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid()
  order by case role::text
    when 'admin'  then 0
    when 'editor' then 1
    else 2
  end
  limit 1;
$$;

-- list_users_with_roles: include editor in coalesce ordering
create or replace function public.list_users_with_roles()
returns table (user_id uuid, email text, created_at timestamptz, role text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can list users';
  end if;
  return query
    select u.id, u.email::text, u.created_at,
      coalesce(
        (select r.role::text from public.user_roles r
          where r.user_id = u.id
          order by case r.role::text
            when 'admin'  then 0
            when 'editor' then 1
            else 2
          end
          limit 1),
        'viewer'
      )
    from auth.users u
    order by u.created_at desc;
end;
$$;

-- Add created_by to transactional tables.
do $$
declare
  t text;
  tables text[] := array[
    'lots','recipe_dyes','recipe_chemicals',
    'process_steps','step_dyes','step_chemicals',
    'lot_photos',
    'intake_entries','intake_items',
    'expenses','expense_documents','expense_line_items',
    'challans','challan_items',
    'inventory_transactions'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relname=t and c.relkind='r') then
      execute format(
        'alter table public.%I add column if not exists created_by uuid default auth.uid()',
        t
      );
    end if;
  end loop;
end $$;

-- ---------- END STEP 2 ----------
