import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreRacks, useCreateEDYReceipt } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Globe2, Save } from 'lucide-react';
import { toast } from 'sonner';

const NO_RACK = '__no_rack__';

const ExternalDyedYarnReceive: React.FC = () => {
  const navigate = useNavigate();
  const { data: racks = [] } = useStoreRacks();
  const createEDY = useCreateEDYReceipt();

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    receipt_date: today,
    supplier: '',
    challan_number: '',
    yarn_type: '',
    shade: '',
    net_weight: '',
    rate: '',
    rack_id: '',
    remarks: '',
  });

  const amount = useMemo(() => {
    const w = parseFloat(form.net_weight);
    const r = parseFloat(form.rate);
    if (!isFinite(w) || !isFinite(r)) return null;
    return w * r;
  }, [form.net_weight, form.rate]);

  const handleSave = async () => {
    const nw = parseFloat(form.net_weight);
    if (!(nw > 0)) { toast.error('Enter a valid net weight'); return; }
    if (!form.supplier.trim()) { toast.error('Supplier / Dyer is required'); return; }
    try {
      const r = await createEDY.mutateAsync({
        receipt_date: form.receipt_date,
        supplier: form.supplier.trim(),
        challan_number: form.challan_number.trim() || null,
        yarn_type: form.yarn_type.trim() || null,
        shade: form.shade.trim() || null,
        net_weight: nw,
        rate: form.rate ? parseFloat(form.rate) : null,
        rack_id: form.rack_id || null,
        remarks: form.remarks || null,
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
        <CardHeader><CardTitle className="text-base">Receipt Details</CardTitle></CardHeader>
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
            <Label>Supplier / Dyer *</Label>
            <Input
              value={form.supplier}
              onChange={(e) => setForm(f => ({ ...f, supplier: e.target.value }))}
              placeholder="External dyeing factory name"
            />
          </div>
          <div>
            <Label>Challan Number</Label>
            <Input
              value={form.challan_number}
              onChange={(e) => setForm(f => ({ ...f, challan_number: e.target.value }))}
            />
          </div>
          <div>
            <Label>Yarn Type</Label>
            <Input
              value={form.yarn_type}
              onChange={(e) => setForm(f => ({ ...f, yarn_type: e.target.value }))}
              placeholder="e.g. 30/1 Cotton"
            />
          </div>
          <div>
            <Label>Shade</Label>
            <Input
              value={form.shade}
              onChange={(e) => setForm(f => ({ ...f, shade: e.target.value }))}
            />
          </div>
          <div>
            <Label>Net Weight (kg) *</Label>
            <Input
              type="number" step="any"
              value={form.net_weight}
              onChange={(e) => setForm(f => ({ ...f, net_weight: e.target.value }))}
            />
          </div>
          <div>
            <Label>Rate (optional)</Label>
            <Input
              type="number" step="any"
              value={form.rate}
              onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
              placeholder="Per kg"
            />
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              value={amount != null ? amount.toFixed(2) : ''}
              disabled
              placeholder="Auto = weight × rate"
            />
          </div>
          <div>
            <Label>Rack</Label>
            <Select
              value={form.rack_id || NO_RACK}
              onValueChange={(v) => setForm(f => ({ ...f, rack_id: v === NO_RACK ? '' : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Select rack" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_RACK}>None</SelectItem>
                {racks.filter(r => r.is_active).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.rack_code} — {r.rack_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Remarks</Label>
            <Textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
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
