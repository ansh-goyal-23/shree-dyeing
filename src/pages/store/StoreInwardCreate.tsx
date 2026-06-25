import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStoreItems,
  useStoreRacks,
  useCreateStoreInward,
  useStoreCurrentStock,
  STORE_CATEGORY_LABEL,
} from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Save, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';

const NO_RACK = '__no_rack__';
const NO_ITEM = '__no_item__';

// Categories valid for inward (per spec: Grey Yarn, Chemicals, Dyes,
// Office Items, Tools, Packaging, Oil). At the item level we filter via
// category in {raw_material, office_utility, tool_equipment}.
const INWARD_ALLOWED_CATEGORIES = ['raw_material', 'office_utility', 'tool_equipment'] as const;

interface LineRow {
  key: string;
  item_id: string;
  unit: string;
  quantity: string;
  rate: string;
  rack_id: string;
  remarks: string;
}

const newLine = (): LineRow => ({
  key: Math.random().toString(36).slice(2),
  item_id: '',
  unit: '',
  quantity: '',
  rate: '',
  rack_id: '',
  remarks: '',
});

const StoreInwardCreate: React.FC = () => {
  const navigate = useNavigate();
  const { data: items = [] } = useStoreItems({ activeOnly: true });
  const { data: racks = [] } = useStoreRacks();
  const { data: stock = [] } = useStoreCurrentStock();
  const createInward = useCreateStoreInward();

  const today = new Date().toISOString().slice(0, 10);
  const [header, setHeader] = useState({
    inward_date: today,
    supplier: '',
    invoice_number: '',
    grn_number: '',
    remarks: '',
  });

  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const [lastSavedNumber, setLastSavedNumber] = useState<string | null>(null);

  const inwardItems = useMemo(
    () => items.filter(i => (INWARD_ALLOWED_CATEGORIES as readonly string[]).includes(i.category)),
    [items],
  );

  const updateLine = (key: string, patch: Partial<LineRow>) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  };

  const onItemChange = (key: string, itemId: string) => {
    const it = items.find(i => i.id === itemId);
    updateLine(key, {
      item_id: itemId,
      unit: it?.unit || '',
      rack_id: it?.default_rack || '',
    });
  };

  const removeLine = (key: string) => {
    setLines(prev => (prev.length === 1 ? [newLine()] : prev.filter(l => l.key !== key)));
  };

  const totalAmount = lines.reduce((s, l) => {
    const q = parseFloat(l.quantity) || 0;
    const r = parseFloat(l.rate) || 0;
    return s + q * r;
  }, 0);

  const handleSave = async () => {
    const valid = lines.filter(l => l.item_id && parseFloat(l.quantity) > 0);
    if (!valid.length) {
      toast.error('Add at least one item with quantity');
      return;
    }

    try {
      const result = await createInward.mutateAsync({
        inward_date: header.inward_date,
        supplier: header.supplier,
        invoice_number: header.invoice_number,
        grn_number: header.grn_number,
        remarks: header.remarks,
        lines: valid.map(l => ({
          item_id: l.item_id,
          quantity: parseFloat(l.quantity),
          unit: l.unit,
          rate: l.rate ? parseFloat(l.rate) : null,
          amount: l.rate ? parseFloat(l.rate) * parseFloat(l.quantity) : null,
          rack_id: l.rack_id || null,
          remarks: l.remarks || null,
        })),
      });
      toast.success(`Inward ${result.inward_number} saved — stock updated`);
      setLastSavedNumber(result.inward_number);
      // Reset form
      setHeader({ inward_date: today, supplier: '', invoice_number: '', grn_number: '', remarks: '' });
      setLines([newLine()]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save inward');
    }
  };

  // Show updated stock for items just received
  const recentlyAffectedItemIds = useMemo(() => {
    if (!lastSavedNumber) return new Set<string>();
    return new Set(lines.map(l => l.item_id).filter(Boolean));
  }, [lastSavedNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowDownToLine className="h-6 w-6" /> New Stock Inward
        </h1>
        <Button variant="outline" onClick={() => navigate('/store/stock-inward')}>Back to list</Button>
      </div>

      {/* Header */}
      <Card>
        <CardHeader><CardTitle className="text-base">Receipt Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={header.inward_date}
              onChange={(e) => setHeader(h => ({ ...h, inward_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Supplier</Label>
            <Input
              value={header.supplier}
              onChange={(e) => setHeader(h => ({ ...h, supplier: e.target.value }))}
              placeholder="Supplier / Vendor"
            />
          </div>
          <div>
            <Label>Invoice Number</Label>
            <Input
              value={header.invoice_number}
              onChange={(e) => setHeader(h => ({ ...h, invoice_number: e.target.value }))}
            />
          </div>
          <div>
            <Label>GRN Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              value={header.grn_number}
              onChange={(e) => setHeader(h => ({ ...h, grn_number: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Remarks</Label>
            <Textarea
              rows={1}
              value={header.remarks}
              onChange={(e) => setHeader(h => ({ ...h, remarks: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLines(p => [...p, newLine()])}>
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Item</TableHead>
                <TableHead className="min-w-[110px]">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="min-w-[110px]">Rate</TableHead>
                <TableHead className="min-w-[120px] text-right">Amount</TableHead>
                <TableHead className="min-w-[160px]">Rack</TableHead>
                <TableHead className="min-w-[160px]">Remarks</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(line => {
                const it = items.find(i => i.id === line.item_id);
                const q = parseFloat(line.quantity) || 0;
                const r = parseFloat(line.rate) || 0;
                const amount = q * r;
                return (
                  <TableRow key={line.key}>
                    <TableCell>
                      <Select
                        value={line.item_id || NO_ITEM}
                        onValueChange={(v) => onItemChange(line.key, v === NO_ITEM ? '' : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={NO_ITEM}>Select item</SelectItem>
                          {inwardItems.map(i => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.item_name} <span className="text-muted-foreground text-xs">({STORE_CATEGORY_LABEL[i.category]})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{line.unit || it?.unit || '—'}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        value={line.rate}
                        onChange={(e) => updateLine(line.key, { rate: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-right">{amount ? amount.toFixed(2) : '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={line.rack_id || NO_RACK}
                        onValueChange={(v) => updateLine(line.key, { rack_id: v === NO_RACK ? '' : v })}
                      >
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_RACK}>None</SelectItem>
                          {racks.filter(r => r.is_active).map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.rack_code} — {r.rack_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.remarks}
                        onChange={(e) => updateLine(line.key, { remarks: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeLine(line.key)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-3 text-sm">
            <div className="font-medium">Total: ₹ {totalAmount.toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/store/stock-inward')}>Cancel</Button>
        <Button onClick={handleSave} disabled={createInward.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {createInward.isPending ? 'Saving…' : 'Save Inward'}
        </Button>
      </div>

      {/* Updated stock summary after save */}
      {lastSavedNumber && recentlyAffectedItemIds.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Updated Stock ({lastSavedNumber})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Rack</TableHead>
                  <TableHead className="text-right">Current Qty</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock
                  .filter(s => recentlyAffectedItemIds.has(s.item_id))
                  .map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{s.item_name}</TableCell>
                      <TableCell>{s.rack_code || '—'}</TableCell>
                      <TableCell className="text-right">{Number(s.current_quantity).toFixed(3)}</TableCell>
                      <TableCell>{s.unit}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StoreInwardCreate;
