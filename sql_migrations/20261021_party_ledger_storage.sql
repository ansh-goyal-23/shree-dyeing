-- 20261021_party_ledger_storage.sql
-- Private storage bucket for the PDF / photo of each invoice on the Party Ledger.
-- Admin-only (read + write + delete). One bucket serves both the production and
-- staging builds (storage is not schema-scoped); files are keyed by a random uuid path.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ledger-invoices', 'ledger-invoices', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "ledger_invoices_files_admin_all" on storage.objects;
create policy "ledger_invoices_files_admin_all" on storage.objects for all to authenticated
  using (bucket_id = 'ledger-invoices' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'ledger-invoices' and public.has_role(auth.uid(), 'admin'));
