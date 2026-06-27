import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateEDYReceipt } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe2, Save } from 'lucide-react';
import { toast } from 'sonner';

const ExternalDyedYarnReceive: React.FC = () => {
  const navigate = useNavigate();
  const createEDY = useCreateEDYReceipt();

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    receipt_date: today,
    challan_number: '',
    supplier: '',
    lot_no: '',
    shade_number: '',
    gross_weight: '',
    cone_count: '',
  });

  const handleSave = async () => {
    if (!form.supplier.trim()) { toast.error('Dyer is required'); return; }
    if (!form.lot_no.trim()) { toast.error('Lot is required'); return; }
    const gw = parseFloat(form.gross_weight);
    if (!(gw > 0)) { toast.error('Enter a valid gross weight'); return; }
    const cones = form.cone_count ? parseInt(form.cone_count, 10) : null;

    try {
      const r = await createEDY.mutateAsync({
        receipt_date: form.receipt_date,
        challan_number: form.challan_number.trim() || null,
        supplier: form.supplier.trim(),
        lot_no: form.lot_no.trim(),
        shade_number: form.shade_number.trim() || null,
        shade: form.shade_number.trim() || null,
        cone_count: cones,
        gross_weight: gw,
      });
      toast.success(`Receipt ${r.receipt_number} saved — EDY stock updated`);
      navigate('/store/external-dyed-yarn');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save EDY receipt');
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe2 className="h-6 w-6" /> External Dyed Yarn Receipt
        </h1>
        <Button variant="outline" onClick={() => navigate('/store/external-dyed-yarn')}>Back</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Entry Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={form.receipt_date}
              onChange={(e) => setForm(f => ({ ...f, receipt_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Challan # (optional)</Label>
            <Input
              value={form.challan_number}
              onChange={(e) => setForm(f => ({ ...f, challan_number: e.target.value }))}
            />
          </div>
          <div>
            <Label>Dyer *</Label>
            <Input
              value={form.supplier}
              onChange={(e) => setForm(f => ({ ...f, supplier: e.target.value }))}
              placeholder="External dyeing factory name"
            />
          </div>
          <div>
            <Label>Lot *</Label>
            <Input
              value={form.lot_no}
              onChange={(e) => setForm(f => ({ ...f, lot_no: e.target.value }))}
            />
          </div>
          <div>
            <Label>Shade</Label>
            <Input
              value={form.shade_number}
              onChange={(e) => setForm(f => ({ ...f, shade_number: e.target.value }))}
            />
          </div>
          <div>
            <Label>Gross Weight (kg) *</Label>
            <Input
              type="number" step="any"
              value={form.gross_weight}
              onChange={(e) => setForm(f => ({ ...f, gross_weight: e.target.value }))}
            />
          </div>
          <div>
            <Label>No. of Cones</Label>
            <Input
              type="number" min="0" step="1"
              value={form.cone_count}
              onChange={(e) => setForm(f => ({ ...f, cone_count: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/store/external-dyed-yarn')}>Cancel</Button>
        <Button onClick={handleSave} disabled={createEDY.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {createEDY.isPending ? 'Saving…' : 'Save Receipt'}
        </Button>
      </div>
    </div>
  );
};

export default ExternalDyedYarnReceive;
