-- ====================================================================
-- User roles: admin / viewer
-- Run this in Supabase SQL Editor.
-- ====================================================================

do $$ begin
  create type public.app_role as enum ('admin', 'viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

do $$ begin
  create policy "user_roles read all authenticated"
    on public.user_roles for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "user_roles write authenticated"
    on public.user_roles for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.get_my_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid() order by
    case role when 'admin' then 0 else 1 end limit 1;
$$;

-- Helper view to list users + role (admin only via RLS on user_roles)
create or replace view public.users_with_roles
with (security_invoker = on) as
select u.id as user_id, u.email, u.created_at,
  coalesce(
    (select role::text from public.user_roles r where r.user_id = u.id
       order by case r.role when 'admin' then 0 else 1 end limit 1),
    'viewer'
  ) as role
from auth.users u;

grant select on public.users_with_roles to authenticated;
