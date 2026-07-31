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
} from '@/hooks/useStore';
import { INWARD_ITEM_TYPES } from '@/pages/store/StoreInwardCreate';
import type { StoreItem } from '@/types/store';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';

import { Plus, Trash2, Save, ArrowUpFromLine, ChevronsUpDown, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NO_RACK = '__no_rack__';

/** Item types issuable from store to a department. */
export const ISSUE_ITEM_TYPES: { value: string; label: string }[] = [
  ...INWARD_ITEM_TYPES,
  { value: 'office_utility', label: 'Office Utility' },
  { value: 'tool_equipment', label: 'Tools & Equipment' },
];

export const issueTypeLabel = (v?: string | null) =>
  ISSUE_ITEM_TYPES.find(t => t.value === v)?.label || v || '—';

const itemTypeOf = (it: StoreItem) =>
  it.category === 'raw_material' ? (it.sub_category || '') : it.category;

interface LineRow {
  key: string;
  item_type: string;
  item_id: string;
  unit: string;
  quantity: string;
  rack_id: string;
  purpose: string;
}

const newLine = (): LineRow => ({
  key: Math.random().toString(36).slice(2),
  item_type: '',
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
  const [pickerOpenKey, setPickerOpenKey] = useState<string | null>(null);

  // Hydrate on edit
  useEffect(() => {
    if (!isEdit || hydrated || !issue || !items.length) return;
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
      const it = items.find(i => i.id === t.item_id);
      const cur = map.get(key) || {
        ...newLine(),
        item_type: it ? itemTypeOf(it) : '',
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
  }, [isEdit, issue, existingLines, hydrated, items]);

  const updateLine = (key: string, patch: Partial<LineRow>) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  };

  const pickExisting = (key: string, item: StoreItem) => {
    updateLine(key, {
      item_id: item.id,
      unit: item.unit,
      rack_id: item.default_rack || '',
    });
    setPickerOpenKey(null);
  };

  const clearLineItem = (key: string) => {
    updateLine(key, { item_id: '', unit: '' });
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
    const filled = lines.filter(l => l.item_type || l.item_id || l.quantity);
    if (!filled.length) {
      toast.error('Add at least one item with quantity');
      return;
    }

    for (const l of filled) {
      const name = items.find(i => i.id === l.item_id)?.item_name || 'item';
      if (!l.item_type) { toast.error('Item Type is required for every row'); return; }
      if (!l.item_id) { toast.error('Select an item for every row'); return; }
      const qty = parseFloat(l.quantity);
      if (!qty || qty <= 0) { toast.error(`Quantity must be greater than 0 for "${name}"`); return; }
      if (!l.unit) { toast.error(`Unit is required for "${name}"`); return; }
      const available = stockMap.get(`${l.item_id}::${l.rack_id || ''}`) ?? 0;
      if (qty > available) {
        if (!isEdit) {
          toast.error(`Only ${available.toFixed(3)} ${l.unit} available for "${name}" in the selected rack`);
          return;
        }
      }
    }

    // Duplicate item + rack warning
    const seen = new Set<string>();
    let dup = false;
    for (const l of filled) {
      const key = `${l.item_id}::${l.rack_id || ''}`;
      if (seen.has(key)) dup = true;
      seen.add(key);
    }
    if (dup) {
      const ok = window.confirm('The same item and rack appears in more than one row. Save anyway?');
      if (!ok) return;
    }

    const payloadLines = filled.map(l => ({
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
                <TableHead className="min-w-[150px]">Item Type</TableHead>
                <TableHead className="min-w-[260px]">Item</TableHead>
                <TableHead className="min-w-[110px]">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="min-w-[200px]">Rack</TableHead>
                <TableHead className="min-w-[110px] text-right">Available</TableHead>
                <TableHead className="min-w-[200px]">Purpose</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(line => {
                const existing = items.find(i => i.id === line.item_id);
                const typeItems = line.item_type
                  ? items.filter(i => itemTypeOf(i) === line.item_type)
                  : [];
                const available = stockMap.get(`${line.item_id}::${line.rack_id || ''}`) ?? 0;
                const requested = parseFloat(line.quantity) || 0;
                const insufficient = !!line.item_id && requested > available;
                // Only racks that actually hold stock for this item can be issued from.
                const stockedRackIds = new Set(
                  stock
                    .filter(s => s.item_id === line.item_id && Number(s.current_quantity) > 0 && s.rack_id)
                    .map(s => s.rack_id as string),
                );
                const activeRacks = racks.filter(r => r.is_active);
                const rackOptions = stockedRackIds.size
                  ? activeRacks.filter(r => stockedRackIds.has(r.id) || r.id === line.rack_id)
                  : activeRacks;

                return (
                  <TableRow key={line.key}>
                    <TableCell>
                      <Select
                        value={line.item_type || undefined}
                        onValueChange={(v) => updateLine(line.key, {
                          item_type: v, item_id: '', unit: '',
                        })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {ISSUE_ITEM_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <ItemPicker
                        open={pickerOpenKey === line.key}
                        onOpenChange={(o) => setPickerOpenKey(o ? line.key : null)}
                        items={typeItems}
                        disabled={!line.item_type}
                        value={existing ? existing.item_name : ''}
                        onPickExisting={(it) => pickExisting(line.key, it)}
                        onClear={() => clearLineItem(line.key)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        className={insufficient ? 'border-destructive' : ''}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{line.unit || existing?.unit || '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={line.rack_id || NO_RACK}
                        onValueChange={(v) => updateLine(line.key, { rack_id: v === NO_RACK ? '' : v })}
                      >
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_RACK}>None</SelectItem>
                          {rackOptions.map(r => (
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

// -------- Item Picker (searchable, existing items only) --------
interface ItemPickerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: StoreItem[];
  value: string;
  disabled?: boolean;
  onPickExisting: (item: StoreItem) => void;
  onClear: () => void;
}

const ItemPicker: React.FC<ItemPickerProps> = ({
  open, onOpenChange, items, value, disabled, onPickExisting, onClear,
}) => {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!needle) return items.slice(0, 20);
    const tokens = needle.split(/\s+/);
    return items
      .map(it => {
        const lc = it.item_name.toLowerCase();
        const cc = it.item_code.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (lc.includes(t)) score += 2;
          if (cc.includes(t)) score += 1;
        }
        if (lc === needle) score += 10;
        return { it, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(x => x.it);
  }, [items, needle]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          <span className="truncate">
            {value || (disabled ? 'Select item type first' : 'Search item…')}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type item name…" value={search} onValueChange={setSearch} />
          <CommandList>
            {matches.length === 0 && (
              <CommandEmpty>No items of this type in the catalogue.</CommandEmpty>
            )}
            {matches.length > 0 && (
              <CommandGroup heading="Catalogue items">
                {matches.map(it => (
                  <CommandItem key={it.id} value={it.id} onSelect={() => onPickExisting(it)}>
                    <Check className={cn('mr-2 h-4 w-4', value === it.item_name ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span>{it.item_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {issueTypeLabel(itemTypeOf(it))} · {it.unit}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {value && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => { onClear(); onOpenChange(false); }}>
                  <X className="mr-2 h-4 w-4" /> Clear selection
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default StoreIssueForm;
