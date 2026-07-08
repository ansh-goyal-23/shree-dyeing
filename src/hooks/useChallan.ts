import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Challan, ChallanItem } from '@/types/challan';
import { logBusinessEvent } from '@/lib/activityCenter';

// -------------------------------------------------------------------
// Store integration: dispatching a challan must reduce store stock
// for the matching Finished Goods / External Dyed Yarn item via a
// `challan_dispatch` stock transaction. Lookup is by item_code:
//   FG-<lot_no>  (finished goods receipts)
//   EDY-<lot_no> (external dyed yarn receipts)
// If no matching store item exists the line is silently skipped —
// raw materials are never deducted from a challan.
// Edits use net-delta reversal; deletes reverse the full quantity.
// -------------------------------------------------------------------

const sb = supabase as any;

type AggLine = { lot_no: string; net_weight: number };

async function applyChallanStockDelta(
  challan_number: string,
  challan_date: string,
  prev: AggLine[],
  next: AggLine[],
) {
  const agg = new Map<string, number>();
  for (const it of prev) {
    if (!it.lot_no) continue;
    agg.set(it.lot_no, (agg.get(it.lot_no) ?? 0) - Number(it.net_weight || 0));
  }
  for (const it of next) {
    if (!it.lot_no) continue;
    agg.set(it.lot_no, (agg.get(it.lot_no) ?? 0) + Number(it.net_weight || 0));
  }

  const lotsWithDelta = [...agg.entries()].filter(([, d]) => Math.abs(d) > 0.00001);
  if (lotsWithDelta.length === 0) return;

  const candidateCodes = lotsWithDelta.flatMap(([l]) => [`FG-${l}`, `EDY-${l}`]);
  const { data: items, error } = await sb
    .from('store_items')
    .select('id, item_code, unit')
    .in('item_code', candidateCodes);
  if (error) return; // store module may not yet have a matching item; do not block challan
  const byCode = new Map((items ?? []).map((i: any) => [i.item_code, i]));

  for (const [lot, delta] of lotsWithDelta) {
    const item: any = byCode.get(`FG-${lot}`) ?? byCode.get(`EDY-${lot}`);
    if (!item) continue; // not yet received into store — skip
    const { data: txnNum, error: nErr } = await sb.rpc('next_store_txn_number');
    if (nErr) continue;
    await sb.from('store_stock_transactions').insert({
      transaction_number: txnNum,
      transaction_date: challan_date,
      transaction_type: 'challan_dispatch',
      item_id: item.id,
      quantity: -delta, // positive delta dispatched ⇒ negative stock change
      unit: item.unit,
      reference_type: 'challan',
      reference_number: challan_number,
      remarks: `Challan ${challan_number}`,
    });
  }
}


const mapChallan = (r: any): Challan => ({
  id: r.id,
  challan_number: r.challan_number,
  challan_kind: (r.challan_kind === 'edy' ? 'edy' : 'production'),
  date: r.date,
  client_id: r.client_id,
  client_name: r.clients?.client_name || '',
  notes: r.notes || '',
  prepared_by_name: r.prepared_by_name || '',
  receiver_name: r.receiver_name || '',
  receiver_contact_number: r.receiver_contact_number || '',
  created_at: r.created_at,
  created_by: r.created_by || null,
});

const mapItem = (r: any): ChallanItem => ({
  id: r.id,
  challan_id: r.challan_id,
  lot_no: r.lot_no,
  shade_number: r.shade_number || '',
  color_name: r.color_name || '',
  packaging_type: r.packaging_type || 'paper_tube',
  gross_weight: Number(r.gross_weight) || 0,
  num_of_units: Number(r.num_of_units) ?? Number(r.num_of_paper_tubes) ?? 0,
  net_weight: Number(r.net_weight) || 0,
  rate: Number(r.rate) || 0,
  amount: Number(r.amount) || 0,
  created_by: r.created_by || null,
});

export function useChallans() {
  return useQuery({
    queryKey: ['challans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challans')
        .select('*, clients(client_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapChallan);
    },
  });
}

export function useChallan(id: string) {
  return useQuery({
    queryKey: ['challans', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challans')
        .select('*, clients(client_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return mapChallan(data);
    },
    enabled: !!id,
  });
}

export function useChallanItems(challanId: string) {
  return useQuery({
    queryKey: ['challan_items', challanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challan_items')
        .select('*')
        .eq('challan_id', challanId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapItem);
    },
    enabled: !!challanId,
  });
}

export function useCreateChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      challan_number: string;
      date: string;
      client_id: string;
      notes: string;
      prepared_by_name: string;
      receiver_name: string;
      receiver_contact_number: string;
      items: Omit<ChallanItem, 'id' | 'challan_id'>[];
    }) => {
      const { data: challan, error: cErr } = await supabase
        .from('challans')
        .insert({
          challan_number: payload.challan_number,
          challan_kind: 'production',
          date: payload.date,
          client_id: payload.client_id,
          notes: payload.notes,
          prepared_by_name: payload.prepared_by_name,
          receiver_name: payload.receiver_name,
          receiver_contact_number: payload.receiver_contact_number,
        } as any)
        .select()
        .single();
      if (cErr) throw cErr;

      if (payload.items.length > 0) {
        const { error: iErr } = await supabase.from('challan_items').insert(
          payload.items.map(item => ({
            challan_id: challan.id,
            lot_no: item.lot_no,
            shade_number: item.shade_number,
            color_name: item.color_name,
            packaging_type: item.packaging_type,
            gross_weight: item.gross_weight,
            num_of_units: item.num_of_units,
            net_weight: item.net_weight,
            rate: item.rate,
            amount: item.amount,
          }))
        );
        if (iErr) throw iErr;
      }

      // Store integration: deduct FG / EDY stock for dispatched lots.
      await applyChallanStockDelta(
        payload.challan_number,
        payload.date,
        [],
        payload.items.map(i => ({ lot_no: i.lot_no, net_weight: i.net_weight })),
      );

      return challan;
    },
    onSuccess: (challan, vars) => {
      qc.invalidateQueries({ queryKey: ['challans'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock_by_item'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      const totalKg = vars.items.reduce((s, i) => s + (Number(i.net_weight) || 0), 0);
      logBusinessEvent({
        module: 'dispatch', eventType: 'challan.created', severity: 'success',
        entityType: 'challan', entityId: challan.id, referenceNumber: vars.challan_number,
        summary: `Created Challan ${vars.challan_number} — ${vars.items.length} lot(s), ${totalKg.toFixed(2)} kg`,
        details: { items: vars.items.length, total_kg: totalKg, date: vars.date },
      });
    },
  });
}

export function useUpdateChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      challan_number: string;
      date: string;
      client_id: string;
      notes: string;
      prepared_by_name: string;
      receiver_name: string;
      receiver_contact_number: string;
      items: Omit<ChallanItem, 'id' | 'challan_id'>[];
    }) => {
      // Snapshot previous items + previous challan_number/date so we can
      // post the correct reversal even if the user just edited the header.
      const { data: prevChallan } = await sb
        .from('challans')
        .select('challan_number, date')
        .eq('id', payload.id)
        .single();
      const { data: prevItemsRaw } = await sb
        .from('challan_items')
        .select('lot_no, net_weight')
        .eq('challan_id', payload.id);
      const prevItems: AggLine[] = (prevItemsRaw ?? []).map((r: any) => ({
        lot_no: r.lot_no, net_weight: Number(r.net_weight) || 0,
      }));

      const { error: cErr } = await supabase
        .from('challans')
        .update({
          challan_number: payload.challan_number,
          date: payload.date,
          client_id: payload.client_id,
          notes: payload.notes,
          prepared_by_name: payload.prepared_by_name,
          receiver_name: payload.receiver_name,
          receiver_contact_number: payload.receiver_contact_number,
        })
        .eq('id', payload.id);
      if (cErr) throw cErr;

      await supabase.from('challan_items').delete().eq('challan_id', payload.id);
      if (payload.items.length > 0) {
        const { error: iErr } = await supabase.from('challan_items').insert(
          payload.items.map(item => ({
            challan_id: payload.id,
            lot_no: item.lot_no,
            shade_number: item.shade_number,
            color_name: item.color_name,
            packaging_type: item.packaging_type,
            gross_weight: item.gross_weight,
            num_of_units: item.num_of_units,
            net_weight: item.net_weight,
            rate: item.rate,
            amount: item.amount,
          }))
        );
        if (iErr) throw iErr;
      }

      // Reverse old stock impact (under previous challan number) and apply new.
      if (prevChallan && (prevChallan.challan_number !== payload.challan_number)) {
        await applyChallanStockDelta(prevChallan.challan_number, prevChallan.date, prevItems, []);
        await applyChallanStockDelta(
          payload.challan_number, payload.date, [],
          payload.items.map(i => ({ lot_no: i.lot_no, net_weight: i.net_weight })),
        );
      } else {
        await applyChallanStockDelta(
          payload.challan_number, payload.date, prevItems,
          payload.items.map(i => ({ lot_no: i.lot_no, net_weight: i.net_weight })),
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challans'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock_by_item'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
    },
  });
}

export function useDeleteChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Snapshot challan + items, post reversal transactions, then delete.
      const { data: prevChallan } = await sb
        .from('challans').select('challan_number, date').eq('id', id).single();
      const { data: prevItemsRaw } = await sb
        .from('challan_items').select('lot_no, net_weight').eq('challan_id', id);
      const prevItems: AggLine[] = (prevItemsRaw ?? []).map((r: any) => ({
        lot_no: r.lot_no, net_weight: Number(r.net_weight) || 0,
      }));

      await supabase.from('challan_items').delete().eq('challan_id', id);
      const { data: deleted, error } = await supabase.from('challans').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!deleted || deleted.length === 0) {
        throw new Error('Delete blocked by row-level security. Apply the latest SQL migration (permissive_write_policies).');
      }

      if (prevChallan) {
        await applyChallanStockDelta(prevChallan.challan_number, prevChallan.date, prevItems, []);
      }
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['challans'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock_by_item'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      logBusinessEvent({
        module: 'dispatch', eventType: 'challan.deleted', severity: 'warning',
        entityType: 'challan', entityId: id, summary: 'Challan deleted',
      });
    },
  });
}

// ------------------------------------------------------------------
// EDY Challan creation. Reuses the same challans/challan_items tables
// but marks the header with challan_kind='edy' and stores
//   lot_no        = EDY receipt number
//   color_name    = Dyer (supplier) name
//   shade_number  = Shade
//   gross_weight  = dispatched gross weight
//   num_of_units  = # of cones
//   packaging_type / net_weight / rate / amount default to chesse / 0
// Stock deduction still hits store (EDY-<lot_no>) but by gross weight.
// ------------------------------------------------------------------
export interface EDYChallanItemInput {
  lot_no: string;         // EDY receipt number
  dyer: string;
  shade_number: string;
  gross_weight: number;
  num_of_units: number;   // cones
}

async function applyEDYStockDelta(
  challan_number: string,
  challan_date: string,
  prev: { lot_no: string; gross_weight: number }[],
  next: { lot_no: string; gross_weight: number }[],
) {
  const agg = new Map<string, number>();
  for (const it of prev) {
    if (!it.lot_no) continue;
    agg.set(it.lot_no, (agg.get(it.lot_no) ?? 0) - Number(it.gross_weight || 0));
  }
  for (const it of next) {
    if (!it.lot_no) continue;
    agg.set(it.lot_no, (agg.get(it.lot_no) ?? 0) + Number(it.gross_weight || 0));
  }
  const withDelta = [...agg.entries()].filter(([, d]) => Math.abs(d) > 0.00001);
  if (withDelta.length === 0) return;

  const codes = withDelta.map(([l]) => `EDY-${l}`);
  const { data: items, error } = await sb
    .from('store_items').select('id, item_code, unit').in('item_code', codes);
  if (error) return;
  const byCode = new Map((items ?? []).map((i: any) => [i.item_code, i]));

  for (const [lot, delta] of withDelta) {
    const item: any = byCode.get(`EDY-${lot}`);
    if (!item) continue;
    const { data: txnNum, error: nErr } = await sb.rpc('next_store_txn_number');
    if (nErr) continue;
    await sb.from('store_stock_transactions').insert({
      transaction_number: txnNum,
      transaction_date: challan_date,
      transaction_type: 'challan_dispatch',
      item_id: item.id,
      quantity: -delta,
      unit: item.unit,
      reference_type: 'challan',
      reference_number: challan_number,
      remarks: `EDY Challan ${challan_number}`,
    });
  }
}

export function useCreateEDYChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      challan_number: string;
      date: string;
      client_id: string;
      notes: string;
      prepared_by_name: string;
      receiver_name: string;
      receiver_contact_number: string;
      items: EDYChallanItemInput[];
    }) => {
      const { data: challan, error: cErr } = await supabase
        .from('challans')
        .insert({
          challan_number: payload.challan_number,
          challan_kind: 'edy',
          date: payload.date,
          client_id: payload.client_id,
          notes: payload.notes,
          prepared_by_name: payload.prepared_by_name,
          receiver_name: payload.receiver_name,
          receiver_contact_number: payload.receiver_contact_number,
        } as any)
        .select()
        .single();
      if (cErr) throw cErr;

      if (payload.items.length > 0) {
        const { error: iErr } = await supabase.from('challan_items').insert(
          payload.items.map(item => ({
            challan_id: challan.id,
            lot_no: item.lot_no,
            shade_number: item.shade_number,
            color_name: item.dyer,        // dyer stored in color_name for reuse
            packaging_type: 'chesse',
            gross_weight: item.gross_weight,
            num_of_units: item.num_of_units,
            net_weight: 0,
            rate: 0,
            amount: 0,
          }))
        );
        if (iErr) throw iErr;
      }

      await applyEDYStockDelta(
        payload.challan_number, payload.date, [],
        payload.items.map(i => ({ lot_no: i.lot_no, gross_weight: i.gross_weight })),
      );

      return challan;
    },
    onSuccess: (challan, vars) => {
      qc.invalidateQueries({ queryKey: ['challans'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock_by_item'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      const totalKg = vars.items.reduce((s, i) => s + (Number(i.gross_weight) || 0), 0);
      logBusinessEvent({
        module: 'dispatch', eventType: 'challan.created', severity: 'success',
        entityType: 'challan', entityId: challan.id, referenceNumber: vars.challan_number,
        summary: `Created EDY Challan ${vars.challan_number} — ${vars.items.length} lot(s), ${totalKg.toFixed(2)} kg`,
        details: { items: vars.items.length, total_kg: totalKg, date: vars.date, kind: 'edy' },
      });
    },
  });
}
