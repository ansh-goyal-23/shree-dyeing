import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  computeLotConsumption,
  applyLotPreview,
  computeDispatchConsumption,
  applyDispatchPreview,
} from '@/lib/inventoryEngine';
import type { ApprovalRow } from '@/types/inventoryV2';
import type { Lot } from '@/types';

/**
 * Inventory changes now apply automatically (no approval popup).
 * Every affected line is written to `inventory_change_logs` with the acting
 * user's id + email so admins can audit changes from the Inventory Logs page.
 *
 * The hook keeps its previous shape so existing call sites keep working — the
 * `open` state never flips to true, so the (still-rendered) dialog is a no-op.
 */

type RefType = 'lot' | 'challan';

async function writeLogs(params: {
  rows: ApprovalRow[];
  action: string;
  referenceType: RefType;
  referenceId: string;
}) {
  if (!params.rows.length) return;
  try {
    const { data: u } = await supabase.auth.getUser();
    const user_id = u?.user?.id || null;
    const user_email = u?.user?.email || null;
    const payload = params.rows.map(r => ({
      user_id,
      user_email,
      action: params.action,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      section: r.section,
      item_label: r.label,
      unit: r.unit || null,
      prev_stock: String(r.prevStock ?? ''),
      change: String(r.change ?? ''),
      new_stock: String(r.newStock ?? ''),
      warn: !!r.warn,
    }));
    const { error } = await supabase.from('inventory_change_logs').insert(payload);
    if (error) console.error('inventory log insert failed', error);
  } catch (e) {
    console.error('inventory log error', e);
  }
}

export function useInventoryApproval() {
  // Kept only for API compatibility with existing call sites / dialog.
  const [open] = useState(false);
  const [rows] = useState<ApprovalRow[]>([]);
  const [title] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const openForLot = useCallback(async (
    params: Parameters<typeof computeLotConsumption>[0],
    _opts?: { title?: string; isEdit?: boolean }
  ) => {
    setBusy(true);
    try {
      const { delta, rows } = await computeLotConsumption(params);
      if (rows.length > 0) {
        await applyLotPreview({ lot: params.lot, delta, source: 'Lot Save' });
        await writeLogs({ rows, action: 'Lot Save', referenceType: 'lot', referenceId: params.lot.lot_no });
        toast.success('Inventory updated');
      }
    } catch (e: any) {
      toast.error(`Inventory update failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const openForDispatch = useCallback(async (
    params: Parameters<typeof computeDispatchConsumption>[0],
    _opts?: { title?: string }
  ) => {
    setBusy(true);
    try {
      const { delta, rows } = await computeDispatchConsumption(params);
      if (rows.length > 0) {
        await applyDispatchPreview({ challanId: params.challan.id, delta, lots: params.lots, source: 'Dispatch' });
        await writeLogs({ rows, action: 'Dispatch', referenceType: 'challan', referenceId: params.challan.id });
        toast.success('Inventory updated');
      }
    } catch (e: any) {
      toast.error(`Inventory update failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const openForLotDelete = useCallback(async (params: {
    lot: Lot;
    masterItems: Parameters<typeof computeLotConsumption>[0]['masterItems'];
    onAfterApprove: () => Promise<void> | void;
  }) => {
    setBusy(true);
    try {
      const { delta, rows } = await computeLotConsumption({
        lot: { ...params.lot, net_weight: 0 } as Lot,
        recipeDyes: [], recipeChemicals: [],
        steps: [], stepDyes: [], stepChemicals: [],
        masterItems: params.masterItems,
      });
      if (rows.length > 0) {
        await applyLotPreview({ lot: params.lot, delta, source: 'Lot Delete' });
        await writeLogs({ rows, action: 'Lot Delete', referenceType: 'lot', referenceId: params.lot.lot_no });
      }
      await params.onAfterApprove();
      toast.success('Lot deleted and inventory reversed');
    } catch (e: any) {
      toast.error(`Delete failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const openForDispatchDelete = useCallback(async (params: {
    challan: { id: string; date: string };
    lots: Lot[];
    onAfterApprove: () => Promise<void> | void;
  }) => {
    setBusy(true);
    try {
      const { delta, rows } = await computeDispatchConsumption({
        challan: params.challan,
        items: [],
        lots: params.lots,
        allowOilRestore: true,
      });
      if (rows.length > 0) {
        await applyDispatchPreview({ challanId: params.challan.id, delta, lots: params.lots, source: 'Dispatch Delete' });
        await writeLogs({ rows, action: 'Dispatch Delete', referenceType: 'challan', referenceId: params.challan.id });
      }
      await params.onAfterApprove();
      toast.success('Challan deleted and inventory reversed');
    } catch (e: any) {
      toast.error(`Delete failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // No-op handlers retained for backward compatibility with InventoryApprovalDialog props.
  const handleApprove = useCallback(async () => {}, []);
  const handleCancel = useCallback(async () => {}, []);

  return { open, rows, title, busy, openForLot, openForDispatch, openForLotDelete, openForDispatchDelete, handleApprove, handleCancel };
}
