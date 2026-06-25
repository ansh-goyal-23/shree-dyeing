import React, { useMemo, useState } from 'react';
import {
  useStoreCurrentStockByItem,
  useStoreRacks,
  useCreateStoreRack,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABEL,
  RAW_MATERIAL_SUBCATEGORIES,
  type StoreCurrentStockByItemRow,
} from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Package, PlusCircle, Activity, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type SortKey = 'item_name' | 'category' | 'first_received_date' | 'last_transaction_date' | 'current_quantity';

const ALL = 'all';

const InventoryCatalogue: React.FC = () => {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useStoreCurrentStockByItem();
  const { data: racks = [] } = useStoreRacks();
  const createRack = useCreateStoreRack();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [subFilter, setSubFilter] = useState<string>(ALL);
  const [assetFilter, setAssetFilter] = useState<string>(ALL);
  const [sortKey, setSortKey] = useState<SortKey>('item_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [rackDialogOpen, setRackDialogOpen] = useState(false);
  const [rackForm, setRackForm] = useState({ rack_code: '', rack_name: '', area: '', description: '' });

  const subOptions = useMemo(() => {
    if (categoryFilter === 'raw_material') return RAW_MATERIAL_SUBCATEGORIES;
    const uniq = Array.from(new Set(rows
      .filter(r => categoryFilter === ALL || r.category === categoryFilter)
      .map(r => r.sub_category)
      .filter(Boolean) as string[]));
    return uniq.map(v => ({ value: v, label: v }));
  }, [rows, categoryFilter]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = rows.filter(r => {
      if (categoryFilter !== ALL && r.category !== categoryFilter) return false;
      if (subFilter !== ALL && (r.sub_category || '') !== subFilter) return false;
      if (assetFilter === 'asset' && !r.is_asset) return false;
      if (assetFilter === 'non_asset' && r.is_asset) return false;
      if (!needle) return true;
      return (
        r.item_name.toLowerCase().includes(needle) ||
        r.item_code.toLowerCase().includes(needle) ||
        (r.sub_category || '').toLowerCase().includes(needle)
      );
    });
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = (a as any)[sortKey] ?? '';
      const bv = (b as any)[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return list;
  }, [rows, search, categoryFilter, subFilter, assetFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const SortableHead: React.FC<{ k: SortKey; children: React.ReactNode; className?: string }> = ({ k, children, className }) => (
    <TableHead className={className}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  const submitRack = async () => {
    if (!rackForm.rack_code.trim() || !rackForm.rack_name.trim()) {
      toast.error('Rack code and name are required');
      return;
    }
    try {
      await createRack.mutateAsync({
        rack_code: rackForm.rack_code.trim(),
        rack_name: rackForm.rack_name.trim(),
        area: rackForm.area || null,
        description: rackForm.description || null,
        is_active: true,
      } as any);
      toast.success('Rack added');
      setRackDialogOpen(false);
      setRackForm({ rack_code: '', rack_name: '', area: '', description: '' });
    } catch (e: any) {
      toast.error(e.message || 'Failed to add rack');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" /> Inventory Catalogue
          </h1>
          <p className="text-muted-foreground text-sm">
            Auto-generated from Stock Inward, Finished Goods, External Dyed Yarn and Asset Management. Items are created as you transact — no manual setup needed.
          </p>
        </div>
        <Button variant="outline" onClick={() => setRackDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-1" /> New Rack
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item name or code…"
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setSubFilter(ALL); }}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Categories</SelectItem>
            {STORE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subFilter} onValueChange={setSubFilter} disabled={!subOptions.length}>
          <SelectTrigger><SelectValue placeholder="Sub Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Sub Categories</SelectItem>
            {subOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead k="item_name" className="min-w-[200px]">Item Name</SortableHead>
              <SortableHead k="category">Category</SortableHead>
              <TableHead>Sub Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Asset</TableHead>
              <SortableHead k="first_received_date">First Received</SortableHead>
              <SortableHead k="last_transaction_date">Last Transaction</SortableHead>
              <SortableHead k="current_quantity" className="text-right">Current Stock</SortableHead>
              <TableHead className="text-right">Timeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No items yet. Create the first item via Stock Inward.</TableCell></TableRow>
            ) : filtered.map((r: StoreCurrentStockByItemRow) => {
              const subLabel = RAW_MATERIAL_SUBCATEGORIES.find(s => s.value === r.sub_category)?.label || r.sub_category || '—';
              const qty = Number(r.current_quantity);
              return (
                <TableRow
                  key={r.item_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/store/timeline/${r.item_id}`)}
                >
                  <TableCell>
                    <div className="font-medium">{r.item_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.item_code}</div>
                  </TableCell>
                  <TableCell>{STORE_CATEGORY_LABEL[r.category]}</TableCell>
                  <TableCell>{subLabel}</TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell>{r.is_asset ? <Badge variant="secondary">Yes</Badge> : <span className="text-muted-foreground">No</span>}</TableCell>
                  <TableCell className="text-xs">{r.first_received_date || '—'}</TableCell>
                  <TableCell className="text-xs">{r.last_transaction_date || '—'}</TableCell>
                  <TableCell className={'text-right font-semibold ' + (qty < 0 ? 'text-destructive' : qty === 0 ? 'text-muted-foreground' : '')}>
                    {qty.toFixed(3)} <span className="text-xs text-muted-foreground">{r.unit}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View Timeline"
                      onClick={(e) => { e.stopPropagation(); navigate(`/store/timeline/${r.item_id}`); }}
                    >
                      <Activity className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Quick add Rack */}
      <Dialog open={rackDialogOpen} onOpenChange={setRackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Rack</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rack Code *</Label>
              <Input value={rackForm.rack_code} onChange={(e) => setRackForm(f => ({ ...f, rack_code: e.target.value }))} />
            </div>
            <div>
              <Label>Rack Name *</Label>
              <Input value={rackForm.rack_name} onChange={(e) => setRackForm(f => ({ ...f, rack_name: e.target.value }))} />
            </div>
            <div>
              <Label>Area</Label>
              <Input value={rackForm.area} onChange={(e) => setRackForm(f => ({ ...f, area: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={rackForm.description} onChange={(e) => setRackForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRackDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitRack} disabled={createRack.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryCatalogue;
