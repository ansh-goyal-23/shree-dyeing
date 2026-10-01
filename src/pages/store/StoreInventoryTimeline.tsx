import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useItemTimeline,
  useStoreItems,
  useStoreCurrentStockByItem,
  useAssets,
  STORE_CATEGORY_LABEL,
  RAW_MATERIAL_SUBCATEGORIES,
  type StockLedgerRow,
} from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Activity, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck,
  ExternalLink, Globe2, History, PackageCheck, Search, Truck, Wrench,
  AlertCircle, ArrowLeft, RotateCcw, Calendar,
} from 'lucide-react';
import type { StoreTransactionType } from '@/types/store';

const ALL = 'all';
const PAGE_SIZE = 50;

// ---------- Event metadata ----------

interface EventMeta {
  label: string;
  // colors per spec (vertical timeline dot + card accent)
  dotClass: string;     // bg + ring
  bandClass: string;    // left-border accent on the card
  badgeClass: string;
  Icon: React.ComponentType<{ className?: string }>;
  group: 'in' | 'out' | 'adjust' | 'neutral';
}

const EVENT_META: Record<StoreTransactionType, EventMeta> = {
  stock_in: {
    label: 'Stock In', group: 'in',
    dotClass: 'bg-emerald-500 ring-emerald-200',
    bandClass: 'border-l-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Icon: ArrowDownToLine,
  },
  finished_lot_receipt: {
    label: 'Finished Lot Received', group: 'in',
    dotClass: 'bg-emerald-600 ring-emerald-200',
    bandClass: 'border-l-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Icon: PackageCheck,
  },
  external_dyed_yarn_receipt: {
    label: 'External Dyed Yarn Received', group: 'in',
    dotClass: 'bg-emerald-500 ring-emerald-200',
    bandClass: 'border-l-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Icon: Globe2,
  },
  internal_issue: {
    label: 'Internal Issue', group: 'out',
    dotClass: 'bg-blue-500 ring-blue-200',
    bandClass: 'border-l-blue-500',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    Icon: ArrowUpFromLine,
  },
  asset_issue: {
    label: 'Asset Issued', group: 'out',
    dotClass: 'bg-blue-500 ring-blue-200',
    bandClass: 'border-l-blue-500',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    Icon: Wrench,
  },
  asset_return: {
    label: 'Asset Returned', group: 'in',
    dotClass: 'bg-violet-500 ring-violet-200',
    bandClass: 'border-l-violet-500',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    Icon: RotateCcw,
  },
  stock_adjustment: {
    label: 'Stock Adjustment', group: 'adjust',
    dotClass: 'bg-orange-500 ring-orange-200',
    bandClass: 'border-l-orange-500',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    Icon: ClipboardCheck,
  },
  challan_dispatch: {
    label: 'Dispatch (Challan)', group: 'out',
    dotClass: 'bg-red-500 ring-red-200',
    bandClass: 'border-l-red-500',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    Icon: Truck,
  },
  challan_return: {
    label: 'Return (Challan)', group: 'in',
    dotClass: 'bg-emerald-500 ring-emerald-200',
    bandClass: 'border-l-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Icon: RotateCcw,
  },
};

function refRoute(row: StockLedgerRow): { label: string; route: string } | null {
  const ref = (row.reference_type || '').toLowerCase();
  const num = row.reference_number || '';
  if (!ref) return null;
  if (ref === 'challan') return { label: 'Open Challan', route: num ? `/dispatch/${num}` : '/dispatch' };
  if (ref === 'lot') return { label: 'Open Lot', route: num ? `/shade-management/lots/${encodeURIComponent(num)}` : '/shade-management/lots' };
  if (ref === 'inward' || ref === 'stock_inward') return { label: 'Open Stock Receipt', route: '/store/stock-inward' };
  if (ref === 'issue' || ref === 'internal_issue') return { label: 'Open Issue Slip', route: '/store/internal-issues' };
  if (ref === 'fg' || ref === 'finished_good' || ref === 'finished_goods') return { label: 'Open FG Receipt', route: '/store/finished-goods' };
  if (ref === 'edy' || ref === 'external_dyed_yarn') return { label: 'Open EDY Receipt', route: '/store/external-dyed-yarn' };
  if (ref === 'asset') return { label: 'Open Asset Record', route: '/store/assets' };
  if (ref === 'challan_return') return { label: 'Open Return', route: '/dispatch/returns' };
  if (ref === 'verification') return { label: 'Open Verification', route: '/store/stock-verification' };
  return null;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return d;
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleString();
  } catch { return d; }
}
function n(v: any) { return Number(v ?? 0); }

// ---------- Item picker (no itemId in URL) ----------

const ItemPicker: React.FC<{ onPick: (id: string) => void }> = ({ onPick }) => {
  const { data: items = [], isLoading } = useStoreItems({ activeOnly: false });
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(ALL);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(i => {
      if (category !== ALL && i.category !== category) return false;
      if (!needle) return true;
      return (
        i.item_name.toLowerCase().includes(needle) ||
        i.item_code.toLowerCase().includes(needle)
      );
    }).slice(0, 200);
  }, [items, q, category]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" /> Find an item to view its timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search by name, code, lot, asset ID, txn or reference…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              <SelectItem value="raw_material">Raw Materials</SelectItem>
              <SelectItem value="office_utility">Office Utilities</SelectItem>
              <SelectItem value="tool_equipment">Tools & Equipment</SelectItem>
              <SelectItem value="finished_good">Finished Goods</SelectItem>
              <SelectItem value="external_dyed_yarn">External Dyed Yarn</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          Tip: timelines are also opened directly from Current Stock, Stock Ledger, Item Master, Finished Goods, External Dyed Yarn and Assets.
        </div>
        <div className="border rounded-md max-h-[60vh] overflow-y-auto divide-y">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No items match.</div>
          ) : filtered.map(i => (
            <button
              key={i.id}
              onClick={() => onPick(i.id)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/60 text-left"
            >
              <div>
                <div className="font-medium">{i.item_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{i.item_code}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{STORE_CATEGORY_LABEL[i.category]}</Badge>
                {i.is_asset && <Badge variant="secondary">Asset</Badge>}
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ---------- Timeline view ----------

const TimelineView: React.FC<{ itemId: string }> = ({ itemId }) => {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useItemTimeline(itemId);
  const { data: items = [] } = useStoreItems({ activeOnly: false });
  const { data: currentStock = [] } = useStoreCurrentStockByItem();
  const { data: assets = [] } = useAssets();

  const item = items.find(i => i.id === itemId);
  const stock = currentStock.find(s => s.item_id === itemId);
  const asset = assets.find(a => a.item_id === itemId);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState(ALL);
  const [createdBy, setCreatedBy] = useState('');
  const [rack, setRack] = useState('');
  const [department, setDepartment] = useState('');
  const [supplier, setSupplier] = useState('');
  const [flow, setFlow] = useState<'all' | 'in' | 'out' | 'adjust'>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return events.filter(r => {
      if (dateFrom && r.transaction_date < dateFrom) return false;
      if (dateTo && r.transaction_date > dateTo) return false;
      if (type !== ALL && r.transaction_type !== type) return false;
      if (createdBy && !(r.created_by || '').toLowerCase().includes(createdBy.toLowerCase())) return false;
      if (rack && !(r.rack_code || '').toLowerCase().includes(rack.toLowerCase())) return false;
      if (department && !(r.department || '').toLowerCase().includes(department.toLowerCase())) return false;
      if (supplier && !(r.supplier || '').toLowerCase().includes(supplier.toLowerCase())) return false;
      if (flow !== 'all') {
        const g = EVENT_META[r.transaction_type]?.group;
        if (flow === 'in' && g !== 'in') return false;
        if (flow === 'out' && g !== 'out') return false;
        if (flow === 'adjust' && g !== 'adjust') return false;
      }
      return true;
    });
  }, [events, dateFrom, dateTo, type, createdBy, rack, department, supplier, flow]);

  React.useEffect(() => { setPage(1); }, [dateFrom, dateTo, type, createdBy, rack, department, supplier, flow]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEvents = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page]
  );

  // Analytics computed across full (unfiltered) history.
  const analytics = useMemo(() => {
    let received = 0, issued = 0, dispatched = 0, adjusted = 0;
    for (const r of events) {
      const g = EVENT_META[r.transaction_type]?.group;
      if (r.transaction_type === 'challan_dispatch') dispatched += n(r.qty_out);
      if (g === 'in') received += n(r.qty_in);
      if (g === 'out' && r.transaction_type !== 'challan_dispatch') issued += n(r.qty_out);
      if (g === 'adjust') adjusted += n(r.quantity);
    }
    const balance = events.length ? n(events[0].running_balance) : 0;
    const last = events[0];
    const first = events[events.length - 1];
    return {
      received, issued, dispatched, adjusted,
      balance,
      count: events.length,
      firstDate: first?.transaction_date,
      lastDate: last?.transaction_date,
      lastAt: last?.created_at,
    };
  }, [events]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Loading timeline…</div>;
  }
  if (!item) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 inline mr-2" />
          Item not found. <Button variant="link" onClick={() => navigate('/store/timeline')}>Pick another item</Button>
        </CardContent>
      </Card>
    );
  }

  const subLabel =
    item.category === 'raw_material'
      ? (RAW_MATERIAL_SUBCATEGORIES.find(s => s.value === item.sub_category)?.label || item.sub_category || '—')
      : '—';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" /> Inventory Timeline
          </h1>
          <div className="text-sm text-muted-foreground">
            {item.item_name} <span className="font-mono">({item.item_code})</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/store/timeline')}>
            <Search className="h-4 w-4 mr-1" /> Change Item
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>
      </div>

      {/* Current Status Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Current Stock</div>
            <div className="text-lg font-bold">
              {n(stock?.current_quantity ?? analytics.balance).toFixed(3)} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Category</div>
            <div className="font-medium">{STORE_CATEGORY_LABEL[item.category]}</div>
            <div className="text-xs text-muted-foreground">{subLabel !== '—' ? subLabel : null}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Current Rack</div>
            <div className="font-medium">
              {stock?.default_rack_code
                ? `${stock.default_rack_code}${stock.default_rack_name ? ' — ' + stock.default_rack_name : ''}`
                : (asset?.rack_code ? `${asset.rack_code}${asset.rack_name ? ' — ' + asset.rack_name : ''}` : '—')}
            </div>
          </div>
          {item.is_asset && (
            <>
              <div>
                <div className="text-xs text-muted-foreground">Current Holder</div>
                <div className="font-medium">{asset?.current_holder || '—'}</div>
                <div className="text-xs text-muted-foreground">{asset?.department || ''}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Condition</div>
                <div className="font-medium">{asset?.condition || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant="secondary">{asset?.status || '—'}</Badge>
              </div>
            </>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Last Transaction</div>
            <div className="font-medium">{fmtDate(stock?.last_transaction_date || analytics.lastDate)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last Updated</div>
            <div className="font-medium text-xs">{fmtDateTime(stock?.last_transaction_at || analytics.lastAt)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <Stat title="Received" value={analytics.received.toFixed(3)} accent="text-emerald-700" />
        <Stat title="Issued" value={analytics.issued.toFixed(3)} accent="text-blue-700" />
        <Stat title="Dispatched" value={analytics.dispatched.toFixed(3)} accent="text-red-700" />
        <Stat title="Adjustments (net)" value={analytics.adjusted.toFixed(3)} accent="text-orange-700" />
        <Stat title="Current Balance" value={analytics.balance.toFixed(3)} accent="font-bold" />
        <Stat title="Transactions" value={String(analytics.count)} />
        <Stat title="First Activity" value={fmtDate(analytics.firstDate)} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Event Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All events</SelectItem>
                {(Object.keys(EVENT_META) as StoreTransactionType[]).map(k => (
                  <SelectItem key={k} value={k}>{EVENT_META[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Flow</label>
            <Select value={flow} onValueChange={(v: any) => setFlow(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in">Only Stock In</SelectItem>
                <SelectItem value="out">Only Stock Out</SelectItem>
                <SelectItem value="adjust">Only Adjustments</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Created By</label>
            <Input value={createdBy} onChange={e => setCreatedBy(e.target.value)} placeholder="user…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Rack</label>
            <Input value={rack} onChange={e => setRack(e.target.value)} placeholder="rack code…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Department</label>
            <Input value={department} onChange={e => setDepartment(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Supplier</label>
            <Input value={supplier} onChange={e => setSupplier(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => {
              setDateFrom(''); setDateTo(''); setType(ALL); setFlow('all');
              setCreatedBy(''); setRack(''); setDepartment(''); setSupplier('');
            }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Lifecycle ({filtered.length} events)
          </CardTitle>
          <div className="text-xs text-muted-foreground">Newest at top</div>
        </CardHeader>
        <CardContent>
          {pageEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No events match the current filters.
            </div>
          ) : (
            <ol className="relative border-l-2 border-muted ml-4 space-y-4">
              {pageEvents.map((e, idx) => {
                const meta = EVENT_META[e.transaction_type] || {
                  label: e.transaction_type, dotClass: 'bg-muted-foreground ring-muted',
                  bandClass: 'border-l-muted-foreground', badgeClass: 'bg-muted text-foreground',
                  Icon: Boxes, group: 'neutral' as const,
                };
                const ref = refRoute(e);
                const before = n(e.running_balance) - n(e.quantity);
                return (
                  <li key={e.id} className="ml-6">
                    <span
                      className={
                        'absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full ring-4 ' +
                        meta.dotClass
                      }
                      style={{ marginTop: '0.5rem' }}
                    >
                      <meta.Icon className="h-3 w-3 text-white" />
                    </span>
                    <div className={'rounded-md border bg-card border-l-4 ' + meta.bandClass + ' p-3 shadow-sm'}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={meta.badgeClass}>{meta.label}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">{e.transaction_number}</span>
                          {e.reference_number && (
                            <span className="text-xs text-muted-foreground">
                              · Ref <span className="font-mono">{e.reference_number}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDate(e.transaction_date)} · {fmtDateTime(e.created_at)}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">In</div>
                          <div className="text-emerald-700 font-medium">{n(e.qty_in).toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Out</div>
                          <div className="text-red-700 font-medium">{n(e.qty_out).toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Before</div>
                          <div>{before.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance After</div>
                          <div className="font-semibold">{n(e.running_balance).toFixed(3)} {e.unit || item.unit}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Rack</div>
                          <div>{e.rack_code ? `${e.rack_code}` : '—'}</div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        {e.supplier && <div><span className="font-medium text-foreground">Supplier:</span> {e.supplier}</div>}
                        {e.person && <div><span className="font-medium text-foreground">Person:</span> {e.person}</div>}
                        {e.department && <div><span className="font-medium text-foreground">Dept:</span> {e.department}</div>}
                        {e.created_by && <div><span className="font-medium text-foreground">By:</span> {e.created_by}</div>}
                      </div>

                      {e.remarks && (
                        <div className="mt-2 text-xs italic text-muted-foreground">"{e.remarks}"</div>
                      )}

                      {ref && (
                        <div className="mt-2">
                          <Button size="sm" variant="outline" onClick={() => navigate(ref.route)}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> {ref.label}
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {pageEvents.length < filtered.length && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => setPage(p => Math.min(p + 1, totalPages))}>
                Load more ({filtered.length - pageEvents.length} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Stat: React.FC<{ title: string; value: string; accent?: string }> = ({ title, value, accent }) => (
  <Card>
    <CardContent className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className={'text-base ' + (accent || 'font-medium')}>{value}</div>
    </CardContent>
  </Card>
);

// ---------- Root component ----------

const StoreInventoryTimeline: React.FC = () => {
  const { itemId: paramId } = useParams();
  const [search] = useSearchParams();
  const codeParam = search.get('code');
  const { data: items = [] } = useStoreItems({ activeOnly: false });

  // Resolve item by code if ?code= passed (used by FG/EDY rows that only know the lot/receipt code)
  const resolvedId =
    paramId ||
    (codeParam ? items.find(i => i.item_code.toLowerCase() === codeParam.toLowerCase())?.id : undefined);

  return (
    <div className="container mx-auto p-4 space-y-4">
      {resolvedId
        ? <TimelineView itemId={resolvedId} />
        : codeParam && items.length > 0
          ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No item with code <span className="font-mono">{codeParam}</span>.</CardContent></Card>
          : (
            <>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5" /> Inventory Timeline
                </h1>
                <p className="text-sm text-muted-foreground">
                  Complete lifecycle of any inventory item, asset, or finished lot. Read-only view over the Stock Ledger.
                </p>
              </div>
              <ItemPicker onPick={(id) => window.location.assign(`/store/timeline/${id}`)} />
            </>
          )}
    </div>
  );
};

export default StoreInventoryTimeline;
