import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStoreItems,
  useStoreRacks,
  useCreateStoreInward,
  useStoreCurrentStock,
  useUploadInwardBill,
  STORE_CATEGORY_LABEL,
  STORE_CATEGORIES,
  RAW_MATERIAL_SUBCATEGORIES,
  type UpsertCatalogueInput,
} from '@/hooks/useStore';
import type { StoreItem, StoreItemCategory } from '@/types/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import {
  Plus, Trash2, Save, ArrowDownToLine, ChevronsUpDown, Check, Upload, FileText, X, PackagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NO_RACK = '__no_rack__';

// Inward can create items in any non-system category. We let the user pick.
const INWARD_CATEGORIES = STORE_CATEGORIES.filter(c =>
  ['raw_material', 'office_utility', 'tool_equipment', 'packaging', 'consumable'].includes(c.value as string)
);

interface LineRow {
  key: string;
  // Either an existing item is picked...
  item_id: string;
  // ...or a new item is staged for creation on save.
  new_item: null | {
    item_name: string;
    category: StoreItemCategory;
    sub_category: string;
    is_asset: boolean;
  };
  unit: string;
  quantity: string;
  rate: string;
  rack_id: string;
  remarks: string;
}

const newLine = (): LineRow => ({
  key: Math.random().toString(36).slice(2),
  item_id: '',
  new_item: null,
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
    updateLine(key, {
      item_id: item.id,
      new_item: null,
      unit: item.unit,
    });
    setPickerOpenKey(null);
  };

  const stageNewItem = (key: string, name: string) => {
    updateLine(key, {
      item_id: '',
      new_item: {
        item_name: name.trim(),
        category: 'raw_material',
        sub_category: '',
        is_asset: false,
      },
      unit: '',
    });
    setPickerOpenKey(null);
  };

  const clearLineItem = (key: string) => {
    updateLine(key, { item_id: '', new_item: null, unit: '' });
  };

  const removeLine = (key: string) => {
    setLines(prev => (prev.length === 1 ? [newLine()] : prev.filter(l => l.key !== key)));
  };

  const totalAmount = lines.reduce((s, l) => {
    const q = parseFloat(l.quantity) || 0;
    const r = parseFloat(l.rate) || 0;
    return s + q * r;
  }, 0);

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
    // Validate each line
    const valid = lines.filter(l => (l.item_id || l.new_item) && parseFloat(l.quantity) > 0);
    if (!valid.length) {
      toast.error('Add at least one item with quantity');
      return;
    }
    for (const l of valid) {
      if (l.new_item) {
        if (!l.new_item.item_name) { toast.error('New item name is required'); return; }
        if (!l.unit) { toast.error(`Unit is required for "${l.new_item.item_name}"`); return; }
      }
    }

    try {
      const payloadLines = valid.map(l => {
        const base = {
          item_id: l.item_id,
          quantity: parseFloat(l.quantity),
          unit: l.unit,
          rate: l.rate ? parseFloat(l.rate) : null,
          amount: l.rate ? parseFloat(l.rate) * parseFloat(l.quantity) : null,
          rack_id: l.rack_id || null,
          remarks: l.remarks || null,
        };
        if (l.new_item) {
          const ni: UpsertCatalogueInput = {
            item_name: l.new_item.item_name,
            category: l.new_item.category,
            sub_category: l.new_item.sub_category || null,
            unit: l.unit,
            is_asset: l.new_item.category === 'tool_equipment' ? l.new_item.is_asset : false,
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
                <TableHead className="min-w-[280px]">Item</TableHead>
                <TableHead className="min-w-[110px]">Qty</TableHead>
                <TableHead className="min-w-[90px]">Unit</TableHead>
                <TableHead className="min-w-[110px]">Rate</TableHead>
                <TableHead className="min-w-[120px] text-right">Amount</TableHead>
                <TableHead className="min-w-[160px]">Rack</TableHead>
                <TableHead className="min-w-[160px]">Remarks</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(line => {
                const existing = items.find(i => i.id === line.item_id);
                const q = parseFloat(line.quantity) || 0;
                const r = parseFloat(line.rate) || 0;
                const amount = q * r;
                const isNew = !!line.new_item;
                const subOptions =
                  line.new_item?.category === 'raw_material'
                    ? RAW_MATERIAL_SUBCATEGORIES
                    : [];

                return (
                  <React.Fragment key={line.key}>
                    <TableRow className={isNew ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                      <TableCell>
                        <ItemPicker
                          open={pickerOpenKey === line.key}
                          onOpenChange={(o) => setPickerOpenKey(o ? line.key : null)}
                          items={items}
                          value={existing ? existing.item_name : (line.new_item?.item_name || '')}
                          isNew={isNew}
                          onPickExisting={(it) => pickExisting(line.key, it)}
                          onCreateNew={(name) => stageNewItem(line.key, name)}
                          onClear={() => clearLineItem(line.key)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="any" value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        {isNew ? (
                          <Input value={line.unit}
                            placeholder="kg / pcs"
                            onChange={(e) => updateLine(line.key, { unit: e.target.value })} />
                        ) : (
                          <span className="text-sm text-muted-foreground">{line.unit || existing?.unit || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="any" value={line.rate}
                          onChange={(e) => updateLine(line.key, { rate: e.target.value })} />
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
                        <Input value={line.remarks}
                          onChange={(e) => updateLine(line.key, { remarks: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.key)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* New-item meta editor row */}
                    {isNew && line.new_item && (
                      <TableRow className="bg-amber-50/30 dark:bg-amber-950/10">
                        <TableCell colSpan={8}>
                          <div className="flex flex-wrap items-end gap-3 p-2">
                            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40">
                              <PackagePlus className="h-3 w-3 mr-1" /> New item will be created
                            </Badge>
                            <div className="min-w-[180px]">
                              <Label className="text-xs">Category *</Label>
                              <Select
                                value={line.new_item.category}
                                onValueChange={(v) => updateLine(line.key, {
                                  new_item: { ...line.new_item!, category: v as StoreItemCategory, sub_category: '' },
                                })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {INWARD_CATEGORIES.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="min-w-[180px]">
                              <Label className="text-xs">Sub Category</Label>
                              {subOptions.length ? (
                                <Select
                                  value={line.new_item.sub_category || ''}
                                  onValueChange={(v) => updateLine(line.key, {
                                    new_item: { ...line.new_item!, sub_category: v },
                                  })}
                                >
                                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                  <SelectContent>
                                    {subOptions.map(s => (
                                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={line.new_item.sub_category}
                                  placeholder="Optional"
                                  onChange={(e) => updateLine(line.key, {
                                    new_item: { ...line.new_item!, sub_category: e.target.value },
                                  })}
                                />
                              )}
                            </div>
                            {line.new_item.category === 'tool_equipment' && (
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={line.new_item.is_asset}
                                  onCheckedChange={(v) => updateLine(line.key, {
                                    new_item: { ...line.new_item!, is_asset: v },
                                  })}
                                />
                                <Label className="text-xs">Register as Asset</Label>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
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

// -------- Item Picker (Combobox with create-new + dup detection) --------
interface ItemPickerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: StoreItem[];
  value: string;
  isNew: boolean;
  onPickExisting: (item: StoreItem) => void;
  onCreateNew: (name: string) => void;
  onClear: () => void;
}

const ItemPicker: React.FC<ItemPickerProps> = ({
  open, onOpenChange, items, value, isNew, onPickExisting, onCreateNew, onClear,
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
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            isNew && 'border-amber-400'
          )}
        >
          <span className="truncate">{value || 'Select or create item…'}</span>
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
              <CommandEmpty>Start typing to search items.</CommandEmpty>
            )}
            {matches.length > 0 && (
              <CommandGroup heading={needle ? 'Suggestions (possible duplicates)' : 'Existing items'}>
                {matches.map(it => (
                  <CommandItem key={it.id} value={it.id} onSelect={() => onPickExisting(it)}>
                    <Check className={cn('mr-2 h-4 w-4', value === it.item_name ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span>{it.item_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {STORE_CATEGORY_LABEL[it.category]}{it.sub_category ? ` · ${it.sub_category}` : ''} · {it.unit}
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
