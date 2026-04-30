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

type LotApply = { kind: 'lot'; lot: Lot; delta: LotConsumptionDelta };
type DispatchApply = { kind: 'dispatch'; challanId: string; delta: DispatchConsumptionDelta; lots: Lot[] };
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
      setPending({ kind: 'lot', lot: params.lot, delta });
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
      setPending({ kind: 'dispatch', challanId: params.challan.id, delta, lots: params.lots });
      setOpen(true);
    } catch (e: any) {
      toast.error(`Inventory preview failed: ${e?.message || e}`);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!pending) { setOpen(false); return; }
    if (rows.length === 0) { setOpen(false); setPending(null); return; }
    setBusy(true);
    try {
      if (pending.kind === 'lot') {
        await applyLotPreview({ lot: pending.lot, delta: pending.delta, source: 'Lot Save' });
      } else {
        await applyDispatchPreview({ challanId: pending.challanId, delta: pending.delta, lots: pending.lots, source: 'Dispatch' });
      }
      toast.success('Inventory updated');
    } catch (e: any) {
      toast.error(`Failed to update inventory: ${e?.message || e}`);
    } finally {
      setBusy(false);
      setOpen(false);
      setPending(null);
    }
  }, [pending, rows]);

  const handleCancel = useCallback(async () => {
    if (pending) {
      try {
        if (pending.kind === 'lot') await markLotInventoryUnsynced(pending.lot.lot_no);
        else await markChallanInventoryUnsynced(pending.challanId);
      } catch { /* ignore */ }
    }
    setOpen(false);
    setPending(null);
  }, [pending]);

  return { open, rows, title, busy, openForLot, openForDispatch, handleApprove, handleCancel };
}
