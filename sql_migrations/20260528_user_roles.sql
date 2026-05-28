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

-- Admin-only function to list users + their roles.
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
          order by case r.role when 'admin' then 0 else 1 end limit 1),
        'viewer'
      )
    from auth.users u
    order by u.created_at desc;
end;
$$;

grant execute on function public.list_users_with_roles() to authenticated;

-- Admin-only: set a user's role (replaces any existing role)
create or replace function public.set_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can set roles';
  end if;
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end;
$$;

grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

-- Bootstrap: if no admins exist yet, allow the first authenticated user calling
-- claim_first_admin() to become admin. After that, only admins can promote.
create or replace function public.claim_first_admin()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'An admin already exists';
  end if;
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')
    on conflict (user_id, role) do nothing;
end;
$$;

grant execute on function public.claim_first_admin() to authenticated;
