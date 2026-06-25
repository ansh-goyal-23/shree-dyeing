import React, { useMemo, useState } from 'react';
import {
  useStoreCurrentStockByItem,
  useStoreRacks,
  useItemTransactions,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABEL,
  RAW_MATERIAL_SUBCATEGORIES,
  type StoreCurrentStockByItemRow,
} from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Boxes, Search, Download, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ALL = 'all';

const CurrentStockPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useStoreCurrentStockByItem();
  const { data: racks = [] } = useStoreRacks();

  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [sub, setSub] = useState<string>(ALL);
  const [rack, setRack] = useState<string>(ALL);
  const [assetFilter, setAssetFilter] = useState<string>(ALL); // all|asset|non_asset
  const [nonZeroOnly, setNonZeroOnly] = useState(false);

  // Detail dialog
  const [active, setActive] = useState<StoreCurrentStockByItemRow | null>(null);
  const { data: txns = [], isLoading: txnsLoading } = useItemTransactions(active?.item_id);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (category !== ALL && r.category !== category) return false;
      if (sub !== ALL && (r.sub_category || '') !== sub) return false;
      if (rack !== ALL && (r.default_rack_id || '') !== rack) return false;
      if (assetFilter === 'asset' && !r.is_asset) return false;
      if (assetFilter === 'non_asset' && r.is_asset) return false;
      if (nonZeroOnly && Number(r.current_quantity) === 0) return false;
      if (!needle) return true;
      return (
        r.item_name.toLowerCase().includes(needle) ||
        r.item_code.toLowerCase().includes(needle) ||
        (r.sub_category || '').toLowerCase().includes(needle) ||
        (r.default_rack_code || '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, category, sub, rack, assetFilter, nonZeroOnly]);

  const subOptions = useMemo(() => {
    if (category === 'raw_material') return RAW_MATERIAL_SUBCATEGORIES;
    const uniq = Array.from(new Set(rows
      .filter(r => category === ALL || r.category === category)
      .map(r => r.sub_category)
      .filter(Boolean) as string[]));
    return uniq.map(v => ({ value: v, label: v }));
  }, [rows, category]);

  const exportCSV = () => {
    if (!filtered.length) { toast.error('Nothing to export'); return; }
    const head = ['Item Code', 'Item', 'Category', 'Sub Category', 'Current Qty', 'Unit', 'Rack', 'Asset', 'Last Transaction'];
    const lines = [head.join(',')];
    for (const r of filtered) {
      lines.push([
        r.item_code,
        `"${(r.item_name || '').replace(/"/g, '""')}"`,
        STORE_CATEGORY_LABEL[r.category],
        r.sub_category || '',
        Number(r.current_quantity).toFixed(3),
        r.unit,
        r.default_rack_code || '',
        r.is_asset ? 'Yes' : 'No',
        r.last_transaction_date || '',
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `current-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => ({
    items: filtered.length,
    nonZero: filtered.filter(r => Number(r.current_quantity) !== 0).length,
  }), [filtered]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="h-6 w-6" /> Current Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            Live balance — derived in real time from Stock Transactions. This page never stores stock.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Items shown</div>
          <div className="text-2xl font-bold">{totals.items}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">With non-zero stock</div>
          <div className="text-2xl font-bold">{totals.nonZero}</div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search item, code, rack…"
            className="pl-9"
            autoFocus
          />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v); setSub(ALL); }}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Categories</SelectItem>
            {STORE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sub} onValueChange={setSub} disabled={!subOptions.length}>
          <SelectTrigger><SelectValue placeholder="Sub Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Sub Categories</SelectItem>
            {subOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={rack} onValueChange={setRack}>
          <SelectTrigger><SelectValue placeholder="Rack" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Racks</SelectItem>
            {racks.filter(r => r.is_active).map(r => (
              <SelectItem key={r.id} value={r.id}>{r.rack_code} — {r.rack_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assetFilter} onValueChange={setAssetFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Items</SelectItem>
            <SelectItem value="asset">Assets Only</SelectItem>
            <SelectItem value="non_asset">Non-Assets</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={nonZeroOnly}
            onChange={(e) => setNonZeroOnly(e.target.checked)}
            className="h-4 w-4"
          />
          Hide zero-balance items
        </label>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Current Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Rack</TableHead>
              <TableHead>Last Transaction</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No items match the filters.</TableCell></TableRow>
            ) : filtered.map(r => {
              const qty = Number(r.current_quantity);
              return (
                <TableRow
                  key={r.item_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setActive(r)}
                >
                  <TableCell>
                    <div className="font-medium">{r.item_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.item_code}</div>
                  </TableCell>
                  <TableCell>
                    <div>{STORE_CATEGORY_LABEL[r.category]}</div>
                    {r.sub_category && (
                      <div className="text-xs text-muted-foreground">
                        {RAW_MATERIAL_SUBCATEGORIES.find(s => s.value === r.sub_category)?.label || r.sub_category}
                      </div>
                    )}
                    {r.is_asset && <Badge variant="secondary" className="mt-1">Asset</Badge>}
                  </TableCell>
                  <TableCell className={'text-right font-semibold ' + (qty < 0 ? 'text-destructive' : qty === 0 ? 'text-muted-foreground' : '')}>
                    {qty.toFixed(3)}
                  </TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell>{r.default_rack_code ? `${r.default_rack_code} — ${r.default_rack_name}` : '—'}</TableCell>
                  <TableCell className="text-xs">{r.last_transaction_date || '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Transaction history */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {active?.item_name} <span className="text-muted-foreground font-mono text-sm">({active?.item_code})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">
            Current Balance:{' '}
            <span className="font-bold text-foreground">
              {Number(active?.current_quantity || 0).toFixed(3)} {active?.unit}
            </span>
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Txn #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Rack</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Person / Supplier</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txnsLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : txns.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No transactions for this item.</TableCell></TableRow>
                ) : txns.map(t => {
                  const qty = Number(t.quantity);
                  return (
                    <TableRow key={t.id}>
                      <TableCell>{t.transaction_date}</TableCell>
                      <TableCell className="font-mono text-xs">{t.transaction_number}</TableCell>
                      <TableCell><Badge variant="outline">{t.transaction_type}</Badge></TableCell>
                      <TableCell className={'text-right font-medium ' + (qty < 0 ? 'text-destructive' : 'text-emerald-600')}>
                        {qty > 0 ? '+' : ''}{qty.toFixed(3)} {t.unit}
                      </TableCell>
                      <TableCell>{t.rack_id ? (racks.find(r => r.id === t.rack_id)?.rack_code || '—') : '—'}</TableCell>
                      <TableCell className="text-xs">
                        {t.reference_type ? `${t.reference_type}${t.reference_number ? ' / ' + t.reference_number : ''}` : '—'}
                      </TableCell>
                      <TableCell>{t.person || t.supplier || '—'}</TableCell>
                      <TableCell className="text-xs">{t.remarks || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CurrentStockPage;
