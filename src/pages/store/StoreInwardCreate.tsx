import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStoreItems,
  useStoreRacks,
  useCreateStoreInward,
  useStoreCurrentStock,
  useUploadInwardBill,
  useStoreInwardList,
  STORE_UNITS,
  type UpsertCatalogueInput,
} from '@/hooks/useStore';
import type { StoreItem } from '@/types/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import AddRackDialog from '@/components/store/AddRackDialog';
import {
  Plus, Trash2, Save, ArrowDownToLine, ChevronsUpDown, Check, FileText, X, PackagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NO_RACK = '__no_rack__';

/** Raw-material types handled by Stock Inward. */
export const INWARD_ITEM_TYPES: { value: string; label: string }[] = [
  { value: 'grey_yarn', label: 'Grey Yarn' },
  { value: 'chemical', label: 'Chemicals' },
  { value: 'dye', label: 'Colors' },
  { value: 'oil', label: 'Oil' },
];

const typeLabel = (v?: string | null) =>
  INWARD_ITEM_TYPES.find(t => t.value === v)?.label || v || '—';

interface LineRow {
  key: string;
  item_type: string;
  // Either an existing item is picked...
  item_id: string;
  // ...or a new item is staged for creation on save.
  new_item_name: string;
  unit: string;
  quantity: string;
  rack_id: string;
  remarks: string;
}

const newLine = (): LineRow => ({
  key: Math.random().toString(36).slice(2),
  item_type: '',
  item_id: '',
  new_item_name: '',
  unit: '',
  quantity: '',
  rack_id: '',
  remarks: '',
});

const StoreInwardCreate: React.FC = () => {
  const navigate = useNavigate();
  const { data: items = [] } = useStoreItems({ activeOnly: true });
  const { data: racks = [] } = useStoreRacks();
  const { data: stock = [] } = useStoreCurrentStock();
  const { data: inwards = [] } = useStoreInwardList();
  const createInward = useCreateStoreInward();
  const uploadBill = useUploadInwardBill();

  const today = new Date().toISOString().slice(0, 10);
  const [header, setHeader] = useState({
    inward_date: today,
    supplier: '',
    invoice_number: '',
    grn_number: '',
    remarks: '',
  });

  const [bill, setBill] = useState<{ url: string; path: string; name: string } | null>(null);
  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const [lastSavedNumber, setLastSavedNumber] = useState<string | null>(null);
  const [pickerOpenKey, setPickerOpenKey] = useState<string | null>(null);

  const updateLine = (key: string, patch: Partial<LineRow>) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  };

  const pickExisting = (key: string, item: StoreItem) => {
    updateLine(key, { item_id: item.id, new_item_name: '', unit: item.unit });
    setPickerOpenKey(null);
  };

  const stageNewItem = (key: string, name: string) => {
    updateLine(key, { item_id: '', new_item_name: name.trim(), unit: '' });
    setPickerOpenKey(null);
  };

  const clearLineItem = (key: string) => {
    updateLine(key, { item_id: '', new_item_name: '', unit: '' });
  };

  const removeLine = (key: string) => {
    setLines(prev => (prev.length === 1 ? [newLine()] : prev.filter(l => l.key !== key)));
  };

  const handleUploadBill = async (file: File) => {
    try {
      const res = await uploadBill.mutateAsync(file);
      setBill({ url: res.url, path: res.path, name: file.name });
      toast.success('Bill uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Failed to upload bill');
    }
  };

  const handleSave = async () => {
    const filled = lines.filter(l => l.item_id || l.new_item_name || l.quantity || l.item_type);
    if (!filled.length) {
      toast.error('Add at least one item');
      return;
    }

    for (const l of filled) {
      const name = l.item_id
        ? items.find(i => i.id === l.item_id)?.item_name || 'item'
        : l.new_item_name || 'item';
      if (!l.item_type) { toast.error('Item Type is required for every row'); return; }
      if (!l.item_id && !l.new_item_name) { toast.error('Select or type an item for every row'); return; }
      const qty = parseFloat(l.quantity);
      if (!qty || qty <= 0) { toast.error(`Quantity must be greater than 0 for "${name}"`); return; }
      if (!l.unit) { toast.error(`Unit is required for "${name}"`); return; }
    }

    const invoice = header.invoice_number.trim();
    if (invoice) {
      const dup = inwards.find(i => (i.invoice_number || '').trim().toLowerCase() === invoice.toLowerCase());
      if (dup) {
        const ok = window.confirm(
          `Invoice "${invoice}" is already used in inward ${dup.inward_number} (${dup.inward_date}). Save anyway?`,
        );
        if (!ok) return;
      }
    }

    try {
      const payloadLines = filled.map(l => {
        const base = {
          item_id: l.item_id,
          quantity: parseFloat(l.quantity),
          unit: l.unit,
          rate: null,
          amount: null,
          rack_id: l.rack_id || null,
          remarks: l.remarks || null,
        };
        if (!l.item_id) {
          const ni: UpsertCatalogueInput = {
            item_name: l.new_item_name,
            category: 'raw_material',
            sub_category: l.item_type,
            unit: l.unit,
            is_asset: false,
          };
          return { ...base, new_item: ni };
        }
        return base;
      });

      const result = await createInward.mutateAsync({
        inward_date: header.inward_date,
        supplier: header.supplier,
        invoice_number: header.invoice_number,
        grn_number: header.grn_number,
        remarks: header.remarks,
        bill_url: bill?.url || null,
        bill_path: bill?.path || null,
        lines: payloadLines,
      });
      toast.success(`Inward ${result.inward_number} saved — stock updated`);
      setLastSavedNumber(result.inward_number);
      setHeader({ inward_date: today, supplier: '', invoice_number: '', grn_number: '', remarks: '' });
      setBill(null);
      setLines([newLine()]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save inward');
    }
  };

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
            <Input type="date" value={header.inward_date}
              onChange={(e) => setHeader(h => ({ ...h, inward_date: e.target.value }))} />
          </div>
          <div>
            <Label>Supplier</Label>
            <Input value={header.supplier}
              onChange={(e) => setHeader(h => ({ ...h, supplier: e.target.value }))}
              placeholder="Supplier / Vendor" />
          </div>
          <div>
            <Label>Invoice Number</Label>
            <Input value={header.invoice_number}
              onChange={(e) => setHeader(h => ({ ...h, invoice_number: e.target.value }))} />
          </div>
          <div>
            <Label>GRN Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={header.grn_number}
              onChange={(e) => setHeader(h => ({ ...h, grn_number: e.target.value }))} />
          </div>
          <div>
            <Label>Upload Bill (PDF / Image)</Label>
            {bill ? (
              <div className="flex items-center gap-2 mt-1 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <a href={bill.url} target="_blank" rel="noreferrer" className="underline truncate max-w-[180px]">{bill.name}</a>
                <Button variant="ghost" size="icon" onClick={() => setBill(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Input type="file" accept="application/pdf,image/*"
                disabled={uploadBill.isPending}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadBill(f); }} />
            )}
          </div>
          <div className="md:col-span-2">
            <Label>Remarks</Label>
            <Textarea rows={1} value={header.remarks}
              onChange={(e) => setHeader(h => ({ ...h, remarks: e.target.value }))} />
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
                <TableHead className="min-w-[150px]">Item Type</TableHead>
                <TableHead className="min-w-[260px]">Item</TableHead>
                <TableHead className="min-w-[110px]">Qty</TableHead>
                <TableHead className="min-w-[110px]">Unit</TableHead>
                <TableHead className="min-w-[200px]">Rack</TableHead>
                <TableHead className="min-w-[160px]">Remarks</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(line => {
                const existing = items.find(i => i.id === line.item_id);
                const isNew = !line.item_id && !!line.new_item_name;
                const typeItems = line.item_type
                  ? items.filter(i => i.category === 'raw_material' && i.sub_category === line.item_type)
                  : [];

                return (
                  <TableRow key={line.key} className={isNew ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    <TableCell>
                      <Select
                        value={line.item_type || undefined}
                        onValueChange={(v) => updateLine(line.key, {
                          item_type: v, item_id: '', new_item_name: '', unit: '',
                        })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {INWARD_ITEM_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <ItemPicker
                          open={pickerOpenKey === line.key}
                          onOpenChange={(o) => setPickerOpenKey(o ? line.key : null)}
                          items={typeItems}
                          disabled={!line.item_type}
                          value={existing ? existing.item_name : line.new_item_name}
                          isNew={isNew}
                          onPickExisting={(it) => pickExisting(line.key, it)}
                          onCreateNew={(name) => stageNewItem(line.key, name)}
                          onClear={() => clearLineItem(line.key)}
                        />
                        {isNew && (
                          <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40 text-xs">
                            <PackagePlus className="h-3 w-3 mr-1" />
                            New {typeLabel(line.item_type)} item
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="any" min="0" value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      {isNew ? (
                        <Select value={line.unit || undefined} onValueChange={(v) => updateLine(line.key, { unit: v })}>
                          <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                          <SelectContent>
                            {STORE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm text-muted-foreground">{line.unit || existing?.unit || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div className="flex-1">
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
                        </div>
                        <AddRackDialog onCreated={(rackId) => updateLine(line.key, { rack_id: rackId })} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input value={line.remarks}
                        onChange={(e) => updateLine(line.key, { remarks: e.target.value })} />
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

// -------- Item Picker (Combobox with create-new + dup detection) --------
interface ItemPickerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: StoreItem[];
  value: string;
  isNew: boolean;
  disabled?: boolean;
  onPickExisting: (item: StoreItem) => void;
  onCreateNew: (name: string) => void;
  onClear: () => void;
}

const ItemPicker: React.FC<ItemPickerProps> = ({
  open, onOpenChange, items, value, isNew, disabled, onPickExisting, onCreateNew, onClear,
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

  const exactExists = items.some(i => i.item_name.toLowerCase() === needle);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            isNew && 'border-amber-400'
          )}
        >
          <span className="truncate">
            {value || (disabled ? 'Select item type first' : 'Select or type item…')}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type item name…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {matches.length === 0 && !needle && (
              <CommandEmpty>No items of this type yet — start typing to create one.</CommandEmpty>
            )}
            {matches.length > 0 && (
              <CommandGroup heading={needle ? 'Suggestions (possible duplicates)' : 'Existing items'}>
                {matches.map(it => (
                  <CommandItem key={it.id} value={it.id} onSelect={() => onPickExisting(it)}>
                    <Check className={cn('mr-2 h-4 w-4', value === it.item_name ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span>{it.item_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {typeLabel(it.sub_category)} · {it.unit}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {needle && !exactExists && (
              <CommandGroup heading="Or">
                <CommandItem
                  value={`__create__${needle}`}
                  onSelect={() => onCreateNew(search)}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create new item “{search.trim()}”
                </CommandItem>
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

export default StoreInwardCreate;
