import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStoreRacks, useUpdateYarnReceipt } from '@/hooks/useStore';
import type { StoreYarnReceipt } from '@/types/store';
import { toast } from 'sonner';

interface Props {
  receipt: StoreYarnReceipt | null;
  source: 'finished_goods' | 'external_dyed_yarn';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditYarnReceiptDialog: React.FC<Props> = ({ receipt, source, open, onOpenChange }) => {
  const { data: racks = [] } = useStoreRacks();
  const update = useUpdateYarnReceipt();

  const [form, setForm] = useState({
    receipt_date: '',
    lot_no: '',
    shade: '',
    shade_number: '',
    yarn_type: '',
    client: '',
    supplier: '',
    challan_number: '',
    cone_count: '',
    received_weight: '',
    rack_id: '',
    remarks: '',
  });

  useEffect(() => {
    if (!receipt) return;
    setForm({
      receipt_date: receipt.receipt_date || '',
      lot_no: receipt.lot_no || '',
      shade: receipt.shade || '',
      shade_number: receipt.shade_number || '',
      yarn_type: receipt.yarn_type || '',
      client: receipt.client || '',
      supplier: receipt.supplier || '',
      challan_number: receipt.challan_number || '',
      cone_count: receipt.cone_count != null ? String(receipt.cone_count) : '',
      received_weight: receipt.received_weight != null ? String(receipt.received_weight) : '',
      rack_id: receipt.rack_id || '',
      remarks: receipt.remarks || '',
    });
  }, [receipt]);

  const isFG = source === 'finished_goods';

  const handleSave = async () => {
    if (!receipt) return;
    const gw = parseFloat(form.received_weight);
    if (!(gw > 0)) { toast.error('Enter a valid weight'); return; }
    if (isFG && !form.lot_no.trim()) { toast.error('Lot No is required'); return; }
    if (!isFG && !form.supplier.trim()) { toast.error('Dyer is required'); return; }
    if (!isFG && !form.shade_number.trim()) { toast.error('Shade Number is required'); return; }
    try {
      await update.mutateAsync({
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        item_id: receipt.item_id,
        receipt_date: form.receipt_date,
        lot_no: form.lot_no.trim() || null,
        shade: (isFG ? form.shade : form.shade_number).trim() || null,
        shade_number: form.shade_number.trim() || null,
        yarn_type: form.yarn_type.trim() || null,
        client: isFG ? (form.client.trim() || null) : null,
        supplier: !isFG ? (form.supplier.trim() || null) : null,
        challan_number: !isFG ? (form.challan_number.trim() || null) : null,
        cone_count: form.cone_count ? parseInt(form.cone_count, 10) : null,
        received_weight: gw,
        rack_id: form.rack_id || null,
        remarks: form.remarks.trim() || null,
      });
      toast.success(`Receipt ${receipt.receipt_number} updated`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {isFG ? 'Finished Goods' : 'External Dyed Yarn'} Receipt</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Date *</Label>
            <Input type="date" value={form.receipt_date}
              onChange={e => setForm(f => ({ ...f, receipt_date: e.target.value }))} />
          </div>

          {isFG ? (
            <>
              <div>
                <Label>Lot # *</Label>
                <Input value={form.lot_no}
                  onChange={e => setForm(f => ({ ...f, lot_no: e.target.value }))} />
              </div>
              <div>
                <Label>Shade</Label>
                <Input value={form.shade}
                  onChange={e => setForm(f => ({ ...f, shade: e.target.value }))} />
              </div>
              <div>
                <Label>Client</Label>
                <Input value={form.client}
                  onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Dyer *</Label>
                <Input value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
              <div>
                <Label>Challan #</Label>
                <Input value={form.challan_number}
                  onChange={e => setForm(f => ({ ...f, challan_number: e.target.value }))} />
              </div>
              <div>
                <Label>Lot</Label>
                <Input value={form.lot_no}
                  onChange={e => setForm(f => ({ ...f, lot_no: e.target.value }))} />
              </div>
              <div>
                <Label>Shade # *</Label>
                <Input value={form.shade_number}
                  onChange={e => setForm(f => ({ ...f, shade_number: e.target.value }))} />
              </div>
            </>
          )}

          <div>
            <Label>Gross Weight (kg) *</Label>
            <Input type="number" step="any" value={form.received_weight}
              onChange={e => setForm(f => ({ ...f, received_weight: e.target.value }))} />
          </div>
          <div>
            <Label>No. of Cones</Label>
            <Input type="number" min="0" step="1" value={form.cone_count}
              onChange={e => setForm(f => ({ ...f, cone_count: e.target.value }))} />
          </div>
          <div>
            <Label>Yarn Type</Label>
            <Input value={form.yarn_type}
              onChange={e => setForm(f => ({ ...f, yarn_type: e.target.value }))} />
          </div>
          <div>
            <Label>Rack</Label>
            <Select
              value={form.rack_id || 'none'}
              onValueChange={v => setForm(f => ({ ...f, rack_id: v === 'none' ? '' : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Select rack" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {racks.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.rack_code}{r.rack_name ? ` — ${r.rack_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Remarks</Label>
            <Input value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
          </div>
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

export default EditYarnReceiptDialog;
