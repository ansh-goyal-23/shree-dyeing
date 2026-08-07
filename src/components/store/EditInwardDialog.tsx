import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2, Undo2 } from 'lucide-react';
import {
  useStoreRacks, useStoreInwardLineDetails, useUpdateStoreInward,
} from '@/hooks/useStore';
import type { StoreStockInward } from '@/types/store';
import { toast } from 'sonner';

interface Props {
  inward: StoreStockInward | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LineState {
  id: string;
  item_name: string;
  quantity: string;
  unit: string;
  rate: string;
  rack_id: string;
  remarks: string;
  deleted: boolean;
}

const EditInwardDialog: React.FC<Props> = ({ inward, open, onOpenChange }) => {
  const { data: racks = [] } = useStoreRacks();
  const { data: lines = [] } = useStoreInwardLineDetails(open ? inward?.inward_number : undefined);
  const update = useUpdateStoreInward();

  const [header, setHeader] = useState({
    inward_date: '',
    supplier: '',
    invoice_number: '',
    grn_number: '',
    remarks: '',
  });
  const [rows, setRows] = useState<LineState[]>([]);

  useEffect(() => {
    if (!inward) return;
    setHeader({
      inward_date: inward.inward_date || '',
      supplier: inward.supplier || '',
      invoice_number: inward.invoice_number || '',
      grn_number: inward.grn_number || '',
      remarks: inward.remarks || '',
    });
  }, [inward]);

  useEffect(() => {
    setRows(lines.map(l => ({
      id: l.id,
      item_name: l.item_name,
      quantity: l.quantity != null ? String(l.quantity) : '',
      unit: l.unit || '',
      rate: l.rate != null ? String(l.rate) : '',
      rack_id: l.rack_id || '',
      remarks: l.remarks || '',
      deleted: false,
    })));
  }, [lines]);

  const setRow = (id: string, patch: Partial<LineState>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    if (!inward) return;
    if (!header.inward_date) { toast.error('Date is required'); return; }
    const kept = rows.filter(r => !r.deleted);
    if (!kept.length) { toast.error('Keep at least one line item'); return; }
    for (const r of kept) {
      if (!(parseFloat(r.quantity) > 0)) { toast.error(`Enter a valid quantity for ${r.item_name}`); return; }
    }
    try {
      await update.mutateAsync({
        id: inward.id,
        inward_number: inward.inward_number,
        inward_date: header.inward_date,
        supplier: header.supplier.trim() || null,
        invoice_number: header.invoice_number.trim() || null,
        grn_number: header.grn_number.trim() || null,
        remarks: header.remarks.trim() || null,
        lines: rows.map(r => ({
          id: r.id,
          quantity: parseFloat(r.quantity) || 0,
          unit: r.unit,
          rate: r.rate ? parseFloat(r.rate) : null,
          rack_id: r.rack_id || null,
          remarks: r.remarks.trim() || null,
          deleted: r.deleted,
        })),
      });
      toast.success(`Inward ${inward.inward_number} updated`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update inward');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Stock Inward {inward?.inward_number}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={header.inward_date}
              onChange={e => setHeader(h => ({ ...h, inward_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Supplier</Label>
            <Input
              value={header.supplier}
              onChange={e => setHeader(h => ({ ...h, supplier: e.target.value }))}
            />
          </div>
          <div>
            <Label>Invoice #</Label>
            <Input
              value={header.invoice_number}
              onChange={e => setHeader(h => ({ ...h, invoice_number: e.target.value }))}
            />
          </div>
          <div>
            <Label>GRN #</Label>
            <Input
              value={header.grn_number}
              onChange={e => setHeader(h => ({ ...h, grn_number: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Remarks</Label>
            <Input
              value={header.remarks}
              onChange={e => setHeader(h => ({ ...h, remarks: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Line Items</Label>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No line items found.</p>
          )}
          {rows.map(r => (
            <div
              key={r.id}
              className={`rounded-md border p-3 space-y-2 ${
                r.deleted ? 'border-dashed opacity-60' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{r.item_name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRow(r.id, { deleted: !r.deleted })}
                >
                  {r.deleted
                    ? <><Undo2 className="h-4 w-4 mr-1" /> Restore</>
                    : <><Trash2 className="h-4 w-4 mr-1" /> Remove</>}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Qty ({r.unit})</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={r.quantity}
                    disabled={r.deleted}
                    onChange={e => setRow(r.id, { quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.rate}
                    disabled={r.deleted}
                    onChange={e => setRow(r.id, { rate: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Rack</Label>
                  <Select
                    value={r.rack_id || 'none'}
                    disabled={r.deleted}
                    onValueChange={v => setRow(r.id, { rack_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Rack" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {racks.map(rk => (
                        <SelectItem key={rk.id} value={rk.id}>
                          {rk.rack_code}{rk.rack_name ? ` — ${rk.rack_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Remarks</Label>
                  <Input
                    value={r.remarks}
                    disabled={r.deleted}
                    onChange={e => setRow(r.id, { remarks: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditInwardDialog;
