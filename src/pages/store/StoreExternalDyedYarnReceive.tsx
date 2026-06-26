import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreRacks, useCreateEDYReceipt, useUploadInwardBill } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Globe2, Save, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

const NO_RACK = '__no_rack__';

const ExternalDyedYarnReceive: React.FC = () => {
  const navigate = useNavigate();
  const { data: racks = [] } = useStoreRacks();
  const createEDY = useCreateEDYReceipt();
  const uploadBill = useUploadInwardBill();

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    receipt_date: today,
    supplier: '',
    lot_no: '',
    shade_number: '',
    cone_count: '',
    gross_weight: '',
    rack_id: '',
    remarks: '',
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleSave = async () => {
    const gw = parseFloat(form.gross_weight);
    if (!(gw > 0)) { toast.error('Enter a valid gross weight'); return; }
    if (!form.supplier.trim()) { toast.error('Dyer is required'); return; }
    if (!form.lot_no.trim()) { toast.error('Lot No is required'); return; }
    const cones = form.cone_count ? parseInt(form.cone_count, 10) : null;

    try {
      let challan_pdf_url: string | null = null;
      let challan_pdf_path: string | null = null;
      if (pdfFile) {
        const up = await uploadBill.mutateAsync(pdfFile);
        challan_pdf_url = up.url;
        challan_pdf_path = up.path;
      }
      const r = await createEDY.mutateAsync({
        receipt_date: form.receipt_date,
        supplier: form.supplier.trim(),
        lot_no: form.lot_no.trim(),
        shade_number: form.shade_number.trim() || null,
        shade: form.shade_number.trim() || null,
        cone_count: cones,
        gross_weight: gw,
        rack_id: form.rack_id || null,
        remarks: form.remarks || null,
        challan_pdf_url,
        challan_pdf_path,
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
            <Label>Challan Date *</Label>
            <Input
              type="date"
              value={form.receipt_date}
              onChange={(e) => setForm(f => ({ ...f, receipt_date: e.target.value }))}
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
            <Label>Lot No *</Label>
            <Input
              value={form.lot_no}
              onChange={(e) => setForm(f => ({ ...f, lot_no: e.target.value }))}
            />
          </div>
          <div>
            <Label>Shade No</Label>
            <Input
              value={form.shade_number}
              onChange={(e) => setForm(f => ({ ...f, shade_number: e.target.value }))}
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
          <div>
            <Label>Gross Weight (kg) *</Label>
            <Input
              type="number" step="any"
              value={form.gross_weight}
              onChange={(e) => setForm(f => ({ ...f, gross_weight: e.target.value }))}
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
          <div>
            <Label>Challan PDF</Label>
            <div className="flex items-center gap-2">
              <Input
                id="edy-challan-pdf"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('edy-challan-pdf')?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                {pdfFile ? 'Replace' : 'Upload'}
              </Button>
              {pdfFile && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[180px]">{pdfFile.name}</span>
                  <Button
                    size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => setPdfFile(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
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
        <Button onClick={handleSave} disabled={createEDY.isPending || uploadBill.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {createEDY.isPending || uploadBill.isPending ? 'Saving…' : 'Save Receipt'}
        </Button>
      </div>
    </div>
  );
};

export default ExternalDyedYarnReceive;
