import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStockLedger,
  useStoreItems,
  useStoreRacks,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABEL,
  RAW_MATERIAL_SUBCATEGORIES,
  type StockLedgerRow,
} from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BookOpenCheck, Search, Download, ArrowDown, ArrowUp,
  FileSpreadsheet, ExternalLink, X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StoreTransactionType } from '@/types/store';

const ALL = 'all';
const PAGE_SIZE = 100;

const TXN_LABEL: Record<StoreTransactionType, string> = {
  stock_in: 'Stock In',
  internal_issue: 'Internal Issue',
  finished_lot_receipt: 'Finished Lot Receipt',
  external_dyed_yarn_receipt: 'External Dyed Yarn Receipt',
  challan_dispatch: 'Challan Dispatch',
  stock_adjustment: 'Stock Adjustment',
  asset_issue: 'Asset Issue',
  asset_return: 'Asset Return',
};

const TXN_CLASS: Record<StoreTransactionType, string> = {
  stock_in: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  finished_lot_receipt: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  external_dyed_yarn_receipt: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  asset_return: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  internal_issue: 'bg-blue-100 text-blue-800 border-blue-300',
  asset_issue: 'bg-blue-100 text-blue-800 border-blue-300',
  stock_adjustment: 'bg-orange-100 text-orange-800 border-orange-300',
  challan_dispatch: 'bg-red-100 text-red-800 border-red-300',
};

const TXN_TYPE_OPTIONS: { value: StoreTransactionType; label: string }[] = (
  Object.keys(TXN_LABEL) as StoreTransactionType[]
).map(v => ({ value: v, label: TXN_LABEL[v] }));

function refRoute(row: StockLedgerRow): string | null {
  const ref = row.reference_type?.toLowerCase() || '';
  const num = row.reference_number || '';
  if (!ref) return null;
  if (ref === 'challan') return num ? `/dispatch/${num}` : '/dispatch';
  if (ref === 'lot') return num ? `/shade-management/lots/${encodeURIComponent(num)}` : '/shade-management/lots';
  if (ref === 'inward' || ref === 'stock_inward') return '/store/stock-inward';
  if (ref === 'issue' || ref === 'internal_issue') return '/store/internal-issues';
  if (ref === 'fg' || ref === 'finished_good' || ref === 'finished_goods') return '/store/finished-goods';
  if (ref === 'edy' || ref === 'external_dyed_yarn') return '/store/external-dyed-yarn';
  if (ref === 'asset') return '/store/assets';
  if (ref === 'verification') return '/store/stock-verification';
  return null;
}

const StockLedgerPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useStockLedger();
  const { data: items = [] } = useStoreItems({ activeOnly: false });
  const { data: racks = [] } = useStoreRacks();

  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [item, setItem] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [sub, setSub] = useState(ALL);
  const [txnType, setTxnType] = useState(ALL);
  const [supplier, setSupplier] = useState('');
  const [department, setDepartment] = useState('');
  const [rack, setRack] = useState(ALL);
  const [createdBy, setCreatedBy] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [assetOnly, setAssetOnly] = useState(false);
  const [fgOnly, setFgOnly] = useState(false);
  const [edyOnly, setEdyOnly] = useState(false);

  const [page, setPage] = useState(1);
  const [active, setActive] = useState<StockLedgerRow | null>(null);

  const subOptions = useMemo(() => {
    if (category === 'raw_material') return RAW_MATERIAL_SUBCATEGORIES;
    const uniq = Array.from(new Set(rows
      .filter(r => category === ALL || r.category === category)
      .map(r => r.sub_category)
      .filter(Boolean) as string[]));
    return uniq.map(v => ({ value: v, label: v }));
  }, [rows, category]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const supN = supplier.trim().toLowerCase();
    const depN = department.trim().toLowerCase();
    const cbN = createdBy.trim().toLowerCase();
    const refN = referenceNumber.trim().toLowerCase();
    const lotN = lotNumber.trim().toLowerCase();
    return rows.filter(r => {
      if (dateFrom && r.transaction_date < dateFrom) return false;
      if (dateTo && r.transaction_date > dateTo) return false;
      if (item !== ALL && r.item_id !== item) return false;
      if (category !== ALL && r.category !== category) return false;
      if (sub !== ALL && (r.sub_category || '') !== sub) return false;
      if (txnType !== ALL && r.transaction_type !== txnType) return false;
      if (rack !== ALL && (r.rack_id || '') !== rack) return false;
      if (assetOnly && !r.is_asset) return false;
      if (fgOnly && r.category !== 'finished_good') return false;
      if (edyOnly && r.category !== 'external_dyed_yarn') return false;
      if (supN && !(r.supplier || '').toLowerCase().includes(supN)) return false;
      if (depN && !(r.department || '').toLowerCase().includes(depN)) return false;
      if (cbN && !(r.created_by || '').toLowerCase().includes(cbN)) return false;
      if (refN && !(r.reference_number || '').toLowerCase().includes(refN)) return false;
      if (lotN) {
        const inLot =
          (r.reference_type === 'lot' && (r.reference_number || '').toLowerCase().includes(lotN)) ||
          r.item_code.toLowerCase().includes(lotN);
        if (!inLot) return false;
      }
      if (!needle) return true;
      return (
        r.transaction_number.toLowerCase().includes(needle) ||
        r.item_name.toLowerCase().includes(needle) ||
        r.item_code.toLowerCase().includes(needle) ||
        (r.reference_number || '').toLowerCase().includes(needle) ||
        (r.supplier || '').toLowerCase().includes(needle) ||
        (r.person || '').toLowerCase().includes(needle) ||
        (r.remarks || '').toLowerCase().includes(needle) ||
        (r.rack_code || '').toLowerCase().includes(needle)
      );
    });
  }, [
    rows, q, dateFrom, dateTo, item, category, sub, txnType, rack,
    assetOnly, fgOnly, edyOnly, supplier, department, createdBy,
    referenceNumber, lotNumber,
  ]);

  // Audit totals (operate over filtered set)
  const audit = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    for (const r of filtered) { totalIn += Number(r.qty_in); totalOut += Number(r.qty_out); }
    // Opening/closing only meaningful when single item filter applied:
    const singleItem = item !== ALL && filtered.length > 0;
    let opening: number | null = null;
    let closing: number | null = null;
    if (singleItem) {
      // filtered is sorted DESC by date; first = latest
      const latest = filtered[0];
      const oldest = filtered[filtered.length - 1];
      closing = Number(latest.running_balance);
      opening = Number(oldest.running_balance) - Number(oldest.quantity);
    }
    return {
      totalCount: rows.length,
      filteredCount: filtered.length,
      totalIn, totalOut,
      opening, closing,
    };
  }, [filtered, rows.length, item]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  React.useEffect(() => { setPage(1); }, [
    q, dateFrom, dateTo, item, category, sub, txnType, rack,
    assetOnly, fgOnly, edyOnly, supplier, department, createdBy,
    referenceNumber, lotNumber,
  ]);

  const exportRows = (ext: 'csv' | 'xls') => {
    if (!filtered.length) { toast.error('Nothing to export'); return; }
    const head = [
      'Date', 'Time', 'Txn #', 'Type', 'Item Code', 'Item', 'Category', 'Sub Category',
      'Reference Type', 'Reference #', 'In Qty', 'Out Qty', 'Running Balance', 'Unit',
      'Rack', 'Supplier', 'Issued To / Person', 'Department', 'Created By', 'Remarks', 'Created At',
    ];
    const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    for (const r of filtered) {
      const dt = new Date(r.created_at);
      lines.push([
        r.transaction_date,
        dt.toLocaleTimeString(),
        r.transaction_number,
        TXN_LABEL[r.transaction_type],
        r.item_code,
        r.item_name,
        STORE_CATEGORY_LABEL[r.category],
        r.sub_category || '',
        r.reference_type || '',
        r.reference_number || '',
        Number(r.qty_in).toFixed(3),
        Number(r.qty_out).toFixed(3),
        Number(r.running_balance).toFixed(3),
        r.unit,
        r.rack_code ? `${r.rack_code} - ${r.rack_name || ''}` : '',
        r.supplier || '',
        r.person || '',
        r.department || '',
        r.created_by || '',
        r.remarks || '',
        r.created_at,
      ].map(esc).join(','));
    }
    const mime = ext === 'xls' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8;';
    const blob = new Blob([lines.join('\n')], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-ledger-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQ(''); setDateFrom(''); setDateTo(''); setItem(ALL); setCategory(ALL); setSub(ALL);
    setTxnType(ALL); setSupplier(''); setDepartment(''); setRack(ALL); setCreatedBy('');
    setReferenceNumber(''); setLotNumber(''); setAssetOnly(false); setFgOnly(false); setEdyOnly(false);
  };

  const activeRefRoute = active ? refRoute(active) : null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpenCheck className="h-6 w-6" /> Stock Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Single source of truth for every inventory movement. Read-only — auto-generated from stock transactions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportRows('csv')}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" onClick={() => exportRows('xls')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* Audit summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Total Entries</div>
          <div className="text-xl font-bold">{audit.totalCount.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Filtered</div>
          <div className="text-xl font-bold">{audit.filteredCount.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Total In</div>
          <div className="text-xl font-bold text-emerald-600">+{audit.totalIn.toFixed(3)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Total Out</div>
          <div className="text-xl font-bold text-red-600">-{audit.totalOut.toFixed(3)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Opening</div>
          <div className="text-xl font-bold">{audit.opening === null ? '—' : audit.opening.toFixed(3)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Closing</div>
          <div className="text-xl font-bold">{audit.closing === null ? '—' : audit.closing.toFixed(3)}</div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <div className="relative md:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search txn#, item, lot, ref, supplier, remarks…"
                className="pl-9"
              />
            </div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
            <Select value={txnType} onValueChange={setTxnType}>
              <SelectTrigger><SelectValue placeholder="Transaction Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Types</SelectItem>
                {TXN_TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={item} onValueChange={setItem}>
              <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Items</SelectItem>
                {items.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.item_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
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
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier" />
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" />
            <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Reference #" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
            <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="Lot Number" />
            <Input value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Created By (user id)" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={assetOnly} onChange={(e) => setAssetOnly(e.target.checked)} />
              Assets Only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={fgOnly} onChange={(e) => setFgOnly(e.target.checked)} />
              Finished Goods Only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={edyOnly} onChange={(e) => setEdyOnly(e.target.checked)} />
              External Dyed Yarn Only
            </label>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / Time</TableHead>
              <TableHead>Txn #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="min-w-[200px]">Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Rack</TableHead>
              <TableHead>Supplier / Issued To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Loading ledger…</TableCell></TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No ledger entries match the filters.</TableCell></TableRow>
            ) : pageRows.map(r => {
              const qIn = Number(r.qty_in);
              const qOut = Number(r.qty_out);
              const bal = Number(r.running_balance);
              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setActive(r)}
                >
                  <TableCell className="whitespace-nowrap text-xs">
                    <div>{r.transaction_date}</div>
                    <div className="text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.transaction_number}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TXN_CLASS[r.transaction_type]}>
                      {qIn > 0
                        ? <ArrowUp className="h-3 w-3 inline mr-1" />
                        : <ArrowDown className="h-3 w-3 inline mr-1" />}
                      {TXN_LABEL[r.transaction_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.item_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.item_code}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{STORE_CATEGORY_LABEL[r.category]}</div>
                    {r.sub_category && <div className="text-muted-foreground">{r.sub_category}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.reference_type
                      ? <div>{r.reference_type}<div className="font-mono">{r.reference_number || '—'}</div></div>
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-700">
                    {qIn > 0 ? `+${qIn.toFixed(3)}` : ''}
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-700">
                    {qOut > 0 ? `-${qOut.toFixed(3)}` : ''}
                  </TableCell>
                  <TableCell className={'text-right font-semibold ' + (bal < 0 ? 'text-destructive' : '')}>
                    {bal.toFixed(3)}
                  </TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell className="text-xs">{r.rack_code || '—'}</TableCell>
                  <TableCell className="text-xs">{r.supplier || r.person || '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages} — showing {pageRows.length} of {filtered.length.toLocaleString()} entries
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>First</Button>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</Button>
        </div>
      </div>

      {/* Detail side panel */}
      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ledger Entry</SheetTitle>
            <SheetDescription>{active?.transaction_number}</SheetDescription>
          </SheetHeader>
          {active && (
            <div className="space-y-4 mt-4 text-sm">
              <section>
                <div className="text-xs uppercase text-muted-foreground mb-1">Basic Details</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-muted-foreground text-xs">Date</div><div>{active.transaction_date}</div></div>
                  <div><div className="text-muted-foreground text-xs">Time</div><div>{new Date(active.created_at).toLocaleTimeString()}</div></div>
                  <div className="col-span-2"><div className="text-muted-foreground text-xs">Type</div>
                    <Badge variant="outline" className={TXN_CLASS[active.transaction_type]}>{TXN_LABEL[active.transaction_type]}</Badge>
                  </div>
                  <div className="col-span-2"><div className="text-muted-foreground text-xs">Item</div>
                    <div className="font-medium">{active.item_name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{active.item_code}</div>
                  </div>
                  <div><div className="text-muted-foreground text-xs">Category</div><div>{STORE_CATEGORY_LABEL[active.category]}</div></div>
                  <div><div className="text-muted-foreground text-xs">Sub Category</div><div>{active.sub_category || '—'}</div></div>
                  <div><div className="text-muted-foreground text-xs">Rack</div><div>{active.rack_code ? `${active.rack_code} — ${active.rack_name}` : '—'}</div></div>
                </div>
              </section>

              <section>
                <div className="text-xs uppercase text-muted-foreground mb-1">Stock Movement</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="border rounded p-2">
                    <div className="text-xs text-muted-foreground">Before</div>
                    <div className="text-lg font-semibold">
                      {(Number(active.running_balance) - Number(active.quantity)).toFixed(3)}
                    </div>
                  </div>
                  <div className="border rounded p-2">
                    <div className="text-xs text-muted-foreground">Movement</div>
                    <div className={'text-lg font-semibold ' + (Number(active.quantity) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {Number(active.quantity) > 0 ? '+' : ''}{Number(active.quantity).toFixed(3)}
                    </div>
                  </div>
                  <div className="border rounded p-2">
                    <div className="text-xs text-muted-foreground">After</div>
                    <div className="text-lg font-semibold">{Number(active.running_balance).toFixed(3)}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Unit: {active.unit}</div>
              </section>

              <section>
                <div className="text-xs uppercase text-muted-foreground mb-1">Reference</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-muted-foreground text-xs">Type</div><div>{active.reference_type || '—'}</div></div>
                  <div><div className="text-muted-foreground text-xs">Number</div><div className="font-mono">{active.reference_number || '—'}</div></div>
                  <div><div className="text-muted-foreground text-xs">Supplier</div><div>{active.supplier || '—'}</div></div>
                  <div><div className="text-muted-foreground text-xs">Issued To / Person</div><div>{active.person || '—'}</div></div>
                  <div><div className="text-muted-foreground text-xs">Department</div><div>{active.department || '—'}</div></div>
                </div>
                {activeRefRoute && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => { navigate(activeRefRoute); setActive(null); }}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" /> Open Reference
                  </Button>
                )}
              </section>

              <section>
                <div className="text-xs uppercase text-muted-foreground mb-1">Audit</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-muted-foreground text-xs">Created By</div><div className="font-mono text-xs">{active.created_by || '—'}</div></div>
                  <div><div className="text-muted-foreground text-xs">Created At</div><div className="text-xs">{new Date(active.created_at).toLocaleString()}</div></div>
                </div>
                {active.remarks && (
                  <div className="mt-2">
                    <div className="text-muted-foreground text-xs">Remarks</div>
                    <div>{active.remarks}</div>
                  </div>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default StockLedgerPage;
