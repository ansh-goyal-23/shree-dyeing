-- 20261021_party_ledger.sql  (public schema)
--
-- Party Ledger (admin-only): invoices we raise to each party, payments /
-- credit notes we receive, and the link from every invoice to the challans it
-- bills -- so the owner can see how much each party owes and confirm that
-- every challan has been invoiced.
--
-- ADMIN-ONLY at the database level (not just hidden in the UI): this is
-- confidential finance data. Every table has a single admin-only RLS policy.
--
-- Design notes
--  * Challans are NOT copied here. The app reads them live from
--    challans / challan_items; an invoice just stores the challan ids it
--    covers (challan_ids). A challan is "invoiced" when any invoice lists it.
--  * "Amount due", "paid", "overdue" etc. are never stored. They are derived
--    in the app (src/lib/partyLedger.ts) from invoices + payments, so they
--    always follow the latest edits.
--  * party is plain text matched case-insensitively against clients.client_name,
--    because some parties we invoice may not be dyeing clients.
--  * A payment may be linked to one invoice (invoice_id); otherwise it is
--    applied to the oldest unpaid invoice first. mode = 'Credit note' is a
--    reduction of what was billed, not money received.
--  * ledger_challan_status only holds the OVERRIDES: 'earlier' (invoiced
--    before this ledger existed) and 'exempt' (no invoice needed). No row =
--    "not invoiced yet" (EDY challans default to exempt in the app).
-- SAFE / additive. Run in the Supabase SQL editor, then:
-- notify pgrst, 'reload schema';

create table if not exists public.ledger_invoices (
  id           uuid primary key default gen_random_uuid(),
  party        text not null check (length(btrim(party)) > 0),
  invoice_no   text not null check (length(btrim(invoice_no)) > 0),
  amount       numeric(12, 2) not null check (amount > 0),   -- total incl. GST
  invoice_date date not null,
  due_date     date,
  note         text,
  file_path    text,                                         -- object path in the ledger-invoices bucket
  file_name    text,
  challan_ids  uuid[] not null default '{}',
  created_at   timestamptz not null default now(),
  created_by   uuid
);
create unique index if not exists ledger_invoices_party_no_uq
  on public.ledger_invoices (lower(btrim(party)), lower(btrim(invoice_no)));
create index if not exists ledger_invoices_challans_idx on public.ledger_invoices using gin (challan_ids);

create table if not exists public.ledger_payments (
  id         uuid primary key default gen_random_uuid(),
  party      text not null check (length(btrim(party)) > 0),
  amount     numeric(12, 2) not null check (amount > 0),
  paid_on    date not null,
  mode       text not null default 'Other',                  -- UPI / NEFT / RTGS / Cheque / Cash / Credit note / Other
  reference  text,
  invoice_id uuid references public.ledger_invoices(id) on delete set null,
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists ledger_payments_party_idx on public.ledger_payments (lower(btrim(party)));

create table if not exists public.ledger_challan_status (
  challan_id uuid primary key,
  status     text not null check (status in ('earlier', 'exempt')),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.ledger_invoices, public.ledger_payments,
                                         public.ledger_challan_status to authenticated;
grant all on public.ledger_invoices, public.ledger_payments, public.ledger_challan_status to service_role;
revoke all on public.ledger_invoices, public.ledger_payments, public.ledger_challan_status from anon;
revoke truncate, trigger, references on public.ledger_invoices, public.ledger_payments,
                                         public.ledger_challan_status from authenticated;

alter table public.ledger_invoices       enable row level security;
alter table public.ledger_payments       enable row level security;
alter table public.ledger_challan_status enable row level security;

drop policy if exists "ledger_invoices_admin_all" on public.ledger_invoices;
create policy "ledger_invoices_admin_all" on public.ledger_invoices for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "ledger_payments_admin_all" on public.ledger_payments;
create policy "ledger_payments_admin_all" on public.ledger_payments for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "ledger_challan_status_admin_all" on public.ledger_challan_status;
create policy "ledger_challan_status_admin_all" on public.ledger_challan_status for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
