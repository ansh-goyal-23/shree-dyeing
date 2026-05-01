import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  computeLotConsumption,
  applyLotPreview,
  computeDispatchConsumption,
  applyDispatchPreview,
  markLotInventoryUnsynced,
  markChallanInventoryUnsynced,
} from '@/lib/inventoryEngine';
import type { ApprovalRow, LotConsumptionDelta, DispatchConsumptionDelta } from '@/types/inventoryV2';
import type { Lot } from '@/types';

type LotApply = { kind: 'lot'; lot: Lot; delta: LotConsumptionDelta; source: 'Lot Save' | 'Lot Edit' | 'Lot Delete'; onAfterApprove?: () => Promise<void> | void; skipMarkUnsynced?: boolean };
type DispatchApply = { kind: 'dispatch'; challanId: string; delta: DispatchConsumptionDelta; lots: Lot[]; source: 'Dispatch' | 'Dispatch Edit' | 'Dispatch Delete'; onAfterApprove?: () => Promise<void> | void; skipMarkUnsynced?: boolean };
type Pending = LotApply | DispatchApply;

export function useInventoryApproval() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [title, setTitle] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const openForLot = useCallback(async (params: Parameters<typeof computeLotConsumption>[0], opts?: { title?: string; isEdit?: boolean }) => {
    try {
      const { delta, rows } = await computeLotConsumption(params);
      setRows(rows);
      setTitle(opts?.title || `Inventory changes — Lot ${params.lot.lot_no}`);
      setPending({ kind: 'lot', lot: params.lot, delta, source: 'Lot Save' });
      setOpen(true);
    } catch (e: any) {
      toast.error(`Inventory preview failed: ${e?.message || e}`);
    }
  }, []);

  const openForDispatch = useCallback(async (params: Parameters<typeof computeDispatchConsumption>[0], opts?: { title?: string }) => {
    try {
      const { delta, rows } = await computeDispatchConsumption(params);
      setRows(rows);
      setTitle(opts?.title || `Inventory changes — Challan`);
      setPending({ kind: 'dispatch', challanId: params.challan.id, delta, lots: params.lots, source: 'Dispatch' });
      setOpen(true);
    } catch (e: any) {
      toast.error(`Inventory preview failed: ${e?.message || e}`);
    }
  }, []);

  // Reversal: compute consumption with empty inputs (yields negative deltas that restore stock)
  const openForLotDelete = useCallback(async (params: { lot: Lot; masterItems: Parameters<typeof computeLotConsumption>[0]['masterItems']; onAfterApprove: () => Promise<void> | void }) => {
    try {
      const { delta, rows } = await computeLotConsumption({
        lot: { ...params.lot, net_weight: 0 } as Lot,
        recipeDyes: [], recipeChemicals: [],
        steps: [], stepDyes: [], stepChemicals: [],
        masterItems: params.masterItems,
      });
      setRows(rows);
      setTitle(`Reverse inventory — Delete Lot ${params.lot.lot_no}`);
      setPending({ kind: 'lot', lot: params.lot, delta, source: 'Lot Delete', onAfterApprove: params.onAfterApprove, skipMarkUnsynced: true });
      setOpen(true);
    } catch (e: any) {
      toast.error(`Inventory preview failed: ${e?.message || e}`);
    }
  }, []);

  const openForDispatchDelete = useCallback(async (params: { challan: { id: string; date: string }; lots: Lot[]; onAfterApprove: () => Promise<void> | void }) => {
    try {
      const { delta, rows } = await computeDispatchConsumption({
        challan: params.challan,
        items: [],
        lots: params.lots,
      });
      setRows(rows);
      setTitle(`Reverse inventory — Delete Challan`);
      setPending({ kind: 'dispatch', challanId: params.challan.id, delta, lots: params.lots, source: 'Dispatch Delete', onAfterApprove: params.onAfterApprove, skipMarkUnsynced: true });
      setOpen(true);
    } catch (e: any) {
      toast.error(`Inventory preview failed: ${e?.message || e}`);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!pending) { setOpen(false); return; }
    // For deletes, even if rows empty, run after-approve to perform actual deletion
    if (rows.length === 0 && !pending.onAfterApprove) { setOpen(false); setPending(null); return; }
    setBusy(true);
    try {
      if (pending.kind === 'lot') {
        if (rows.length > 0) {
          await applyLotPreview({ lot: pending.lot, delta: pending.delta, source: pending.source });
        }
      } else {
        if (rows.length > 0) {
          await applyDispatchPreview({ challanId: pending.challanId, delta: pending.delta, lots: pending.lots, source: pending.source });
        }
      }
      if (pending.onAfterApprove) await pending.onAfterApprove();
      toast.success(pending.source.includes('Delete') ? 'Inventory reversed and record deleted' : 'Inventory updated');
    } catch (e: any) {
      toast.error(`Failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
      setOpen(false);
      setPending(null);
    }
  }, [pending, rows]);

  const handleCancel = useCallback(async () => {
    if (pending && !pending.skipMarkUnsynced) {
      try {
        if (pending.kind === 'lot') await markLotInventoryUnsynced(pending.lot.lot_no);
        else await markChallanInventoryUnsynced(pending.challanId);
      } catch { /* ignore */ }
    }
    setOpen(false);
    setPending(null);
  }, [pending]);

  return { open, rows, title, busy, openForLot, openForDispatch, openForLotDelete, openForDispatchDelete, handleApprove, handleCancel };
}
