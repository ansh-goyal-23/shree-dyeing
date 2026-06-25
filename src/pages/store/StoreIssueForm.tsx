import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useStoreItems,
  useStoreRacks,
  useCreateStoreIssue,
  useUpdateStoreIssue,
  useStoreIssue,
  useStoreIssueLines,
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
import { Plus, Trash2, Save, ArrowUpFromLine } from 'lucide-react';
import { toast } from 'sonner';

const NO_RACK = '__no_rack__';
const NO_ITEM = '__no_item__';

interface LineRow {
  key: string;
  item_id: string;
  unit: string;
  quantity: string;
  rack_id: string;
  purpose: string;
}

const newLine = (): LineRow => ({
  key: Math.random().toString(36).slice(2),
  item_id: '',
  unit: '',
  quantity: '',
  rack_id: '',
  purpose: '',
});

interface Props { mode?: 'create' | 'edit' }

const StoreIssueForm: React.FC<Props> = ({ mode = 'create' }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = mode === 'edit';

  const { data: items = [] } = useStoreItems({ activeOnly: true });
  const { data: racks = [] } = useStoreRacks();
  const { data: stock = [] } = useStoreCurrentStock();
  const { data: issue } = useStoreIssue(isEdit ? id : undefined);
  const { data: existingLines = [] } = useStoreIssueLines(issue?.issue_number);

  const createIssue = useCreateStoreIssue();
  const updateIssue = useUpdateStoreIssue();

  const today = new Date().toISOString().slice(0, 10);
  const [header, setHeader] = useState({
    issue_date: today,
    department: '',
    issued_to: '',
    remarks: '',
  });
  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate on edit
  useEffect(() => {
    if (!isEdit || hydrated || !issue) return;
    setHeader({
      issue_date: issue.issue_date,
      department: issue.department || '',
      issued_to: issue.issued_to || '',
      remarks: issue.remarks || '',
    });
    // Net outflow per (item, rack) — sum negative entries minus reversals
    const map = new Map<string, LineRow>();
    for (const t of existingLines) {
      const key = `${t.item_id}::${t.rack_id ?? ''}`;
      const cur = map.get(key) || {
        ...newLine(),
        item_id: t.item_id,
        unit: t.unit,
        rack_id: t.rack_id || '',
        purpose: t.purpose || '',
        quantity: '0',
      };
      cur.quantity = String(Number(cur.quantity || 0) + Number(t.quantity));
      // Keep latest purpose if any
      if (t.purpose) cur.purpose = t.purpose;
      map.set(key, cur);
    }
    const rows = Array.from(map.values())
      .filter(r => Number(r.quantity) < 0)
      .map(r => ({ ...r, quantity: String(Math.abs(Number(r.quantity))) }));
    if (rows.length) setLines(rows); else setLines([newLine()]);
    setHydrated(true);
  }, [isEdit, issue, existingLines, hydrated]);

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

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stock) {
      const key = `${s.item_id}::${s.rack_id ?? ''}`;
      m.set(key, Number(s.current_quantity));
    }
    return m;
  }, [stock]);

  const handleSave = async () => {
    const valid = lines.filter(l => l.item_id && parseFloat(l.quantity) > 0);
    if (!valid.length) {
      toast.error('Add at least one item with quantity');
      return;
    }
    const payloadLines = valid.map(l => ({
      item_id: l.item_id,
      quantity: parseFloat(l.quantity),
      unit: l.unit,
      rack_id: l.rack_id || null,
      purpose: l.purpose || null,
    }));

    try {
      if (isEdit && issue) {
        await updateIssue.mutateAsync({
          id: issue.id,
          issue_number: issue.issue_number,
          issue_date: header.issue_date,
          department: header.department,
          issued_to: header.issued_to,
          remarks: header.remarks,
          lines: payloadLines,
        });
        toast.success(`Issue ${issue.issue_number} updated — stock adjusted`);
        navigate('/store/internal-issues');
      } else {
        const result = await createIssue.mutateAsync({
          issue_date: header.issue_date,
          department: header.department,
          issued_to: header.issued_to,
          remarks: header.remarks,
          lines: payloadLines,
        });
        toast.success(`Issue ${result.issue_number} saved — stock reduced`);
        navigate('/store/internal-issues');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to save issue');
    }
  };

  const pending = createIssue.isPending || updateIssue.isPending;

  return (
    <div className="p-6 space-y-4" data-owner-id={issue?.created_by || undefined}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpFromLine className="h-6 w-6" />
          {isEdit ? `Edit Issue ${issue?.issue_number ?? ''}` : 'New Internal Issue'}
        </h1>
        <Button variant="outline" onClick={() => navigate('/store/internal-issues')}>Back to list</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Issue Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={header.issue_date}
              onChange={(e) => setHeader(h => ({ ...h, issue_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Department</Label>
            <Input
              value={header.department}
              onChange={(e) => setHeader(h => ({ ...h, department: e.target.value }))}
              placeholder="Dyeing / Winding / Packing…"
            />
          </div>
          <div>
            <Label>Issued To</Label>
            <Input
              value={header.issued_to}
              onChange={(e) => setHeader(h => ({ ...h, issued_to: e.target.value }))}
              placeholder="Person / Supervisor"
            />
          </div>
          <div className="md:col-span-3">
            <Label>Remarks</Label>
            <Textarea
              rows={1}
              value={header.remarks}
              onChange={(e) => setHeader(h => ({ ...h, remarks: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

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
                <TableHead className="min-w-[160px]">Rack</TableHead>
                <TableHead className="min-w-[110px] text-right">Available</TableHead>
                <TableHead className="min-w-[200px]">Purpose</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(line => {
                const it = items.find(i => i.id === line.item_id);
                const available = stockMap.get(`${line.item_id}::${line.rack_id || ''}`) ?? 0;
                const requested = parseFloat(line.quantity) || 0;
                const insufficient = line.item_id && requested > available && !isEdit;
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
                          {items.map(i => (
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
                        className={insufficient ? 'border-destructive' : ''}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{line.unit || it?.unit || '—'}</TableCell>
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
                    <TableCell className={`text-right text-xs ${insufficient ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {line.item_id ? available.toFixed(3) : '—'}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.purpose}
                        onChange={(e) => updateLine(line.key, { purpose: e.target.value })}
                        placeholder="Use / reason"
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
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/store/internal-issues')}>Cancel</Button>
        <Button onClick={handleSave} disabled={pending}>
          <Save className="h-4 w-4 mr-1" />
          {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Issue'}
        </Button>
      </div>
    </div>
  );
};

export default StoreIssueForm;
