-- ====================================================================
-- Auto-purge inventory/activity change logs older than 1 month.
-- Admins can delete; a SECURITY DEFINER RPC lets the frontend trigger
-- the cleanup on load. If pg_cron is available it is scheduled hourly.
-- ====================================================================

-- Admin delete policy (frontend won't usually call this, but kept for parity)
do $$ begin
  create policy "inv_logs admin delete" on public.inventory_change_logs
    for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;

create or replace function public.purge_old_inventory_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  delete from public.inventory_change_logs
  where created_at < now() - interval '1 month';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

grant execute on function public.purge_old_inventory_logs() to authenticated;

-- Best-effort pg_cron schedule (no-op if extension is unavailable).
do $$
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if found then
    perform cron.schedule(
      'purge_inventory_change_logs_hourly',
      '0 * * * *',
      $cron$ select public.purge_old_inventory_logs(); $cron$
    );
  end if;
exception when others then null;
end $$;
