import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ChallanReturn, ChallanReturnItem, ReturnReason } from '@/types/challanReturn';
import { logBusinessEvent } from '@/lib/activityCenter';

// -------------------------------------------------------------------
// Store integration: a return restocks Finished Goods / EDY stock via a
// `challan_return` transaction -- the exact mirror of how dispatch
// deducts it (see useChallan.ts's applyChallanStockDelta). Same
// FG-<lot_no> / EDY-<lot_no> lookup; if no matching store item exists
// the line is silently skipped, same as dispatch.
// -------------------------------------------------------------------

const sb = supabase as any;

async function applyChallanReturnStock(
  return_number: string,
  return_date: string,
  items: { lot_no: string; returned_net_weight: number }[],
) {
  const withQty = items.filter(i => i.lot_no && Number(i.returned_net_weight) > 0.00001);
  if (withQty.length === 0) return;

  const codes = withQty.flatMap(i => [`FG-${i.lot_no}`, `EDY-${i.lot_no}`]);
  const { data: storeItems, error } = await sb
    .from('store_items')
    .select('id, item_code, unit')
    .in('item_code', codes);
  if (error) return; // store module may not have a matching item; do not block the return
  const byCode = new Map((storeItems ?? []).map((i: any) => [i.item_code, i]));

  for (const it of withQty) {
    const item: any = byCode.get(`FG-${it.lot_no}`) ?? byCode.get(`EDY-${it.lot_no}`);
    if (!item) continue; // not tracked in store -- skip, same as dispatch
    const { data: txnNum, error: nErr } = await sb.rpc('next_store_txn_number');
    if (nErr) continue;
    await sb.from('store_stock_transactions').insert({
      transaction_number: txnNum,
      transaction_date: return_date,
      transaction_type: 'challan_return',
      item_id: item.id,
      quantity: Number(it.returned_net_weight), // positive: return restocks
      unit: item.unit,
      reference_type: 'challan_return',
      reference_number: return_number,
      remarks: `Return ${return_number}`,
    });
  }
}

const mapReturn = (r: any): ChallanReturn => ({
  id: r.id,
  return_number: r.return_number,
  date: r.date,
  client_id: r.client_id,
  client_name: r.clients?.client_name || '',
  notes: r.notes || '',
  prepared_by_name: r.prepared_by_name || '',
  received_by_name: r.received_by_name || '',
  received_by_contact_number: r.received_by_contact_number || '',
  created_at: r.created_at,
  created_by: r.created_by || null,
});

const mapReturnItem = (r: any): ChallanReturnItem => ({
  id: r.id,
  return_id: r.return_id,
  original_challan_id: r.original_challan_id,
  original_challan_item_id: r.original_challan_item_id,
  original_challan_number: r.challans?.challan_number || '',
  lot_no: r.lot_no,
  shade_number: r.shade_number || '',
  color_name: r.color_name || '',
  denier: r.denier || '',
  ref_no: r.ref_no || null,
  lot_type: (r.lot_type === 'Sampling' ? 'Sampling' : 'Production'),
  packaging_type: r.packaging_type || 'paper_tube',
  returned_gross_weight: Number(r.returned_gross_weight) || 0,
  returned_net_weight: Number(r.returned_net_weight) || 0,
  returned_num_of_units: Number(r.returned_num_of_units) || 0,
  returned_extra_cones: Number(r.returned_extra_cones) || 0,
  rate: Number(r.rate) || 0,
  rate_tier_label: r.rate_tier_label || null,
  paper_tube_surcharge: Number(r.paper_tube_surcharge) || 0,
  amount: Number(r.amount) || 0,
  reason: r.reason || 'Other',
  reason_note: r.reason_note || null,
  created_at: r.created_at,
  created_by: r.created_by || null,
});

export function useChallanReturns() {
  return useQuery({
    queryKey: ['challan_returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challan_returns')
        .select('*, clients(client_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapReturn);
    },
  });
}

export function useChallanReturn(id: string) {
  return useQuery({
    queryKey: ['challan_returns', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challan_returns')
        .select('*, clients(client_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return mapReturn(data);
    },
    enabled: !!id,
  });
}

export function useChallanReturnItems(returnId: string) {
  return useQuery({
    queryKey: ['challan_return_items', returnId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challan_return_items')
        .select('*, challans:original_challan_id(challan_number)')
        .eq('return_id', returnId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapReturnItem);
    },
    enabled: !!returnId,
  });
}

/** All return items across every return, for the Excel export and for
 * computing "already returned" totals per original line. */
export function useAllChallanReturnItems() {
  return useQuery({
    queryKey: ['all_challan_return_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challan_return_items')
        .select('*, challans:original_challan_id(challan_number), challan_returns(return_number, date, client_id)');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateChallanReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      return_number: string;
      date: string;
      client_id: string;
      notes: string;
      prepared_by_name: string;
      received_by_name: string;
      received_by_contact_number: string;
      items: Array<{
        original_challan_id: string;
        original_challan_item_id: string;
        lot_no: string;
        shade_number: string;
        color_name: string;
        denier: string;
        ref_no?: string | null;
        lot_type?: 'Production' | 'Sampling';
        packaging_type: string;
        returned_gross_weight: number;
        returned_net_weight: number;
        returned_num_of_units: number;
        returned_extra_cones: number;
        rate: number;
        rate_tier_label?: string | null;
        paper_tube_surcharge: number;
        amount: number;
        reason: ReturnReason;
        reason_note?: string | null;
      }>;
    }) => {
      const { data: ret, error: rErr } = await supabase
        .from('challan_returns')
        .insert({
          return_number: payload.return_number,
          date: payload.date,
          client_id: payload.client_id,
          notes: payload.notes,
          prepared_by_name: payload.prepared_by_name,
          received_by_name: payload.received_by_name,
          received_by_contact_number: payload.received_by_contact_number,
        } as any)
        .select()
        .single();
      if (rErr) throw rErr;

      if (payload.items.length > 0) {
        const rows = payload.items.map(i => ({ ...i, return_id: ret.id }));
        const { error: iErr } = await sb.from('challan_return_items').insert(rows);
        if (iErr) {
          await supabase.from('challan_returns').delete().eq('id', ret.id);
          throw iErr;
        }
      }

      await applyChallanReturnStock(
        payload.return_number,
        payload.date,
        payload.items.map(i => ({ lot_no: i.lot_no, returned_net_weight: i.returned_net_weight })),
      );

      return ret;
    },
    onSuccess: (ret, vars) => {
      qc.invalidateQueries({ queryKey: ['challan_returns'] });
      qc.invalidateQueries({ queryKey: ['all_challan_return_items'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock_by_item'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      const totalKg = vars.items.reduce((s, i) => s + (Number(i.returned_net_weight) || 0), 0);
      logBusinessEvent({
        module: 'dispatch', eventType: 'challan_return.created', severity: 'success',
        entityType: 'challan_return', entityId: ret.id, referenceNumber: vars.return_number,
        summary: `Created Return ${vars.return_number} — ${vars.items.length} line(s), ${totalKg.toFixed(2)} kg`,
        details: { items: vars.items.length, total_kg: totalKg, date: vars.date },
      });
    },
  });
}
