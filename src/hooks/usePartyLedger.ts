import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logBusinessEvent } from '@/lib/activityCenter';
import {
  type ChallanOverride, type LedgerChallanInput, type LedgerInvoiceRow, type LedgerPaymentRow,
} from '@/lib/partyLedger';

// Admin-only tables (enforced by RLS) -- non-admins simply get an error/empty.
const sb = supabase as any;

const BUCKET = 'ledger-invoices';
const KEY = 'ledger';

/** Supabase returns at most 1000 rows per request; page through. */
async function fetchAll(build: () => any): Promise<any[]> {
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

export function useLedgerInvoices() {
  return useQuery({
    queryKey: [KEY, 'invoices'],
    queryFn: async (): Promise<LedgerInvoiceRow[]> => {
      const rows = await fetchAll(() => sb.from('ledger_invoices').select('*').order('invoice_date').order('created_at'));
      return rows.map((r: any) => ({ ...r, amount: Number(r.amount), challan_ids: r.challan_ids || [] }));
    },
  });
}

export function useLedgerPayments() {
  return useQuery({
    queryKey: [KEY, 'payments'],
    queryFn: async (): Promise<LedgerPaymentRow[]> => {
      const rows = await fetchAll(() => sb.from('ledger_payments').select('*').order('paid_on').order('created_at'));
      return rows.map((r: any) => ({ ...r, amount: Number(r.amount) }));
    },
  });
}

export function useLedgerOverrides() {
  return useQuery({
    queryKey: [KEY, 'status'],
    queryFn: async (): Promise<Record<string, ChallanOverride>> => {
      const rows = await fetchAll(() => sb.from('ledger_challan_status').select('challan_id,status'));
      const map: Record<string, ChallanOverride> = {};
      rows.forEach((r: any) => { map[r.challan_id] = r.status; });
      return map;
    },
  });
}

/** Every challan with its value (item amounts + paper tube surcharge), read live from the app's own tables. */
export function useLedgerChallans() {
  return useQuery({
    queryKey: [KEY, 'challans'],
    queryFn: async (): Promise<{ challans: LedgerChallanInput[]; clientNames: string[] }> => {
      const [heads, items, clients] = await Promise.all([
        fetchAll(() => sb.from('challans').select('id, challan_number, challan_kind, date, clients(client_name)').order('id')),
        fetchAll(() => sb.from('challan_items').select('id, challan_id, net_weight, amount, paper_tube_surcharge').order('id')),
        fetchAll(() => sb.from('clients').select('client_name').order('client_name')),
      ]);
      const sums = new Map<string, { kg: number; value: number }>();
      items.forEach((it: any) => {
        const s = sums.get(it.challan_id) || { kg: 0, value: 0 };
        s.kg += Number(it.net_weight) || 0;
        s.value += (Number(it.amount) || 0) + (Number(it.paper_tube_surcharge) || 0);
        sums.set(it.challan_id, s);
      });
      const challans: LedgerChallanInput[] = heads.map((h: any) => {
        const s = sums.get(h.id) || { kg: 0, value: 0 };
        return {
          id: h.id,
          no: String(h.challan_number),
          date: h.date,
          party: h.clients?.client_name || '(no client)',
          kind: h.challan_kind === 'edy' ? 'edy' : 'production',
          kg: s.kg,
          value: Math.round(s.value * 100) / 100,
        };
      });
      return { challans, clientNames: clients.map((c: any) => c.client_name).filter(Boolean) };
    },
  });
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: [KEY] });

export interface InvoiceInput {
  id?: string;
  party: string;
  invoice_no: string;
  amount: number;
  invoice_date: string;
  due_date: string | null;
  note: string | null;
  challan_ids: string[];
  file_path: string | null;
  file_name: string | null;
}

export function useSaveInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InvoiceInput) => {
      const { id, ...row } = input;
      const q = id ? sb.from('ledger_invoices').update(row).eq('id', id) : sb.from('ledger_invoices').insert(row);
      const { data, error } = await q.select('id').single();
      if (error) {
        if (String(error.message).includes('ledger_invoices_party_no_uq')) {
          throw new Error(`${row.party} already has an invoice numbered ${row.invoice_no}.`);
        }
        throw error;
      }
      logBusinessEvent({
        module: 'Party Ledger', eventType: id ? 'invoice_updated' : 'invoice_created', severity: 'info',
        entityType: 'ledger_invoice', entityId: data?.id, entityName: row.party, referenceNumber: row.invoice_no,
        summary: `${id ? 'Updated' : 'Added'} invoice ${row.invoice_no} for ${row.party} (₹${row.amount})`,
      });
      return data?.id as string;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inv: { id: string; party: string; invoice_no: string; amount: number; file_path?: string | null }) => {
      const { error } = await sb.from('ledger_invoices').delete().eq('id', inv.id);
      if (error) throw error;
      if (inv.file_path) await supabase.storage.from(BUCKET).remove([inv.file_path]);
      logBusinessEvent({
        module: 'Party Ledger', eventType: 'invoice_deleted', severity: 'warning',
        entityType: 'ledger_invoice', entityId: inv.id, entityName: inv.party, referenceNumber: inv.invoice_no,
        summary: `Deleted invoice ${inv.invoice_no} of ${inv.party} (₹${inv.amount})`,
      });
    },
    onSuccess: () => invalidate(qc),
  });
}

export interface PaymentInput {
  id?: string;
  party: string;
  amount: number;
  paid_on: string;
  mode: string;
  reference: string | null;
  invoice_id: string | null;
  note: string | null;
}

export function useSavePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PaymentInput) => {
      const { id, ...row } = input;
      const q = id ? sb.from('ledger_payments').update(row).eq('id', id) : sb.from('ledger_payments').insert(row);
      const { data, error } = await q.select('id').single();
      if (error) throw error;
      logBusinessEvent({
        module: 'Party Ledger', eventType: id ? 'payment_updated' : 'payment_recorded', severity: 'info',
        entityType: 'ledger_payment', entityId: data?.id, entityName: row.party, referenceNumber: row.reference || undefined,
        summary: `${id ? 'Updated' : 'Recorded'} ${row.mode} of ₹${row.amount} from ${row.party}`,
      });
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; party: string; amount: number; mode: string }) => {
      const { error } = await sb.from('ledger_payments').delete().eq('id', p.id);
      if (error) throw error;
      logBusinessEvent({
        module: 'Party Ledger', eventType: 'payment_deleted', severity: 'warning',
        entityType: 'ledger_payment', entityId: p.id, entityName: p.party,
        summary: `Deleted ${p.mode} of ₹${p.amount} from ${p.party}`,
      });
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Mark challans "invoiced earlier" / "no invoice needed", or null to put them back to "not invoiced". */
export function useSetChallanStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ChallanOverride | null }) => {
      if (!ids.length) return;
      if (status === null) {
        for (let i = 0; i < ids.length; i += 200) {
          const { error } = await sb.from('ledger_challan_status').delete().in('challan_id', ids.slice(i, i + 200));
          if (error) throw error;
        }
      } else {
        const rows = ids.map(challan_id => ({ challan_id, status, updated_at: new Date().toISOString() }));
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await sb.from('ledger_challan_status').upsert(rows.slice(i, i + 200), { onConflict: 'challan_id' });
          if (error) throw error;
        }
      }
      logBusinessEvent({
        module: 'Party Ledger', eventType: 'challan_status_changed', severity: 'info',
        summary: `Marked ${ids.length} challan(s) as ${status === 'earlier' ? 'invoiced earlier' : status === 'exempt' ? 'no invoice needed' : 'not invoiced'}`,
      });
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Upload an invoice file to the private bucket; returns the object path. */
export async function uploadInvoiceFile(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

export async function removeInvoiceFile(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

/** Short-lived link to open an invoice file. */
export async function invoiceFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error || new Error('Could not open the file.');
  return data.signedUrl;
}
