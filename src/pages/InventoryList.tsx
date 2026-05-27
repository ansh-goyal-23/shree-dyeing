import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Package, SlidersHorizontal, Droplet, Boxes } from 'lucide-react';
import { useInventoryStock, useAdjustStock } from '@/hooks/useInventory';
import { useExpenseItems } from '@/hooks/useExpenses';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const InventoryList: React.FC = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inventory</h1>

      <Tabs defaultValue="materials">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="yarn">Yarn</TabsTrigger>
          <TabsTrigger value="dyechem">Dyes &amp; Chemicals</TabsTrigger>
          <TabsTrigger value="oil">Oil</TabsTrigger>
          <TabsTrigger value="fg">Finished Goods</TabsTrigger>
        </TabsList>

        <TabsContent value="materials"><MaterialsTab /></TabsContent>
        <TabsContent value="yarn"><YarnTab /></TabsContent>
        <TabsContent value="dyechem"><DyeChemTab /></TabsContent>
        <TabsContent value="oil"><OilTab /></TabsContent>
        <TabsContent value="fg"><FGTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ============================================================
// Materials (Purchase / expense_items inventory) — original
// ============================================================
const MaterialsTab: React.FC = () => {
  const navigate = useNavigate();
  const { data: stock = [], isLoading } = useInventoryStock();
  const adjustStock = useAdjustStock();
  const { data: allItems = [] } = useExpenseItems();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const filtered = useMemo(() => {
    let result = stock;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(i =>
        (i.item_name || '').toLowerCase().includes(s) ||
        (i.category_name || '').toLowerCase().includes(s)
      );
    }
    if (filterType !== 'all') result = result.filter(i => i.item_type === filterType);
    return result;
  }, [stock, search, filterType]);

  const lowStockCount = stock.filter(s => s.minimum_stock_level > 0 && s.current_stock < s.minimum_stock_level).length;

  const handleAdjust = async () => {
    if (!adjustItemId || !adjustQty) { toast.error('Item and quantity required'); return; }
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty === 0) { toast.error('Enter a valid non-zero quantity'); return; }
    try {
      await adjustStock.mutateAsync({ item_id: adjustItemId, quantity: qty, reason: adjustReason });
      toast.success('Stock adjusted');
      setShowAdjust(false); setAdjustItemId(''); setAdjustQty(''); setAdjustReason('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to adjust stock');
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdjust(true)}>
          <SlidersHorizontal className="h-4 w-4 mr-2" /> Adjust Stock
        </Button>
      </div>

      {lowStockCount > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="font-medium text-destructive">{lowStockCount} item(s) below minimum stock level</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Search &amp; Filter</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Search item name, category..." value={search} onChange={e => setSearch(e.target.value)} />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="Item Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Consumable">Consumable</SelectItem>
                <SelectItem value="Asset">Asset</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Package className="h-10 w-10" />
              <p>No inventory items found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Min Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => {
                  const isLow = item.minimum_stock_level > 0 && item.current_stock < item.minimum_stock_level;
                  return (
                    <TableRow key={item.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isLow ? 'bg-destructive/5' : ''}`}
                      onClick={() => navigate(`/inventory/${item.item_id}`)}>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.category_name || '-'}</TableCell>
                      <TableCell><Badge variant={item.item_type === 'Asset' ? 'secondary' : 'outline'}>{item.item_type}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{item.current_stock}</TableCell>
                      <TableCell>{item.unit || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{item.minimum_stock_level || '-'}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Low</Badge>
                        ) : <Badge variant="default">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item *</Label>
              <Select value={adjustItemId} onValueChange={setAdjustItemId}>
                <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                <SelectContent>
                  {allItems.map(item => (<SelectItem key={item.id} value={item.id}>{item.item_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity (+ to add, − to reduce) *</Label>
              <Input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="e.g. 10 or -5" />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjustStock.isPending}>{adjustStock.isPending ? 'Adjusting...' : 'Confirm'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================
// YARN TAB
// ============================================================
const YarnTab: React.FC = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ['yarn_inventory'],
    queryFn: async () => {
      const { data, error } = await supabase.from('yarn_inventory').select('*').order('yarn_company');
      if (error) throw error;
      return data || [];
    },
  });
  const [search, setSearch] = useState('');
  const filtered = data.filter((r: any) =>
    !search || r.yarn_company.toLowerCase().includes(search.toLowerCase()) || r.yarn_type.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4 mt-4">
      <Input placeholder="Search yarn company / type..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
            : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2"><Boxes className="h-10 w-10" /><p>No yarn stock yet. Stock appears as lots consume yarn.</p></div>
            : <Table>
              <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Yarn Type</TableHead><TableHead className="text-right">Stock (kg)</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((r: any) => {
                  const negative = Number(r.current_stock) < 0;
                  return (
                    <TableRow key={r.id} className={negative ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-medium">{r.yarn_company}</TableCell>
                      <TableCell>{r.yarn_type}</TableCell>
                      <TableCell className={`text-right font-mono ${negative ? 'text-destructive font-semibold' : ''}`}>{Number(r.current_stock).toFixed(3)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.last_updated).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>}
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================
// DYES & CHEMICALS TAB
// ============================================================
const DyeChemTab: React.FC = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ['material_inventory'],
    queryFn: async () => {
      const { data, error } = await supabase.from('material_inventory').select('*, master_items(name, short_name, type, unit)').order('last_updated', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'dye' | 'chemical'>('all');
  const filtered = data.filter((r: any) => {
    const mi = r.master_items;
    if (!mi) return false;
    if (type !== 'all' && mi.type !== type) return false;
    if (search && !((mi.name || '').toLowerCase().includes(search.toLowerCase()) || (mi.short_name || '').toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
        <Input placeholder="Search dye / chemical..." value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={type} onValueChange={(v: any) => setType(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="dye">Dyes</SelectItem>
            <SelectItem value="chemical">Chemicals</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2"><Boxes className="h-10 w-10" /><p>No dye/chemical stock yet.</p></div>
          : <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Unit</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r: any) => {
                const mi = r.master_items;
                const negative = Number(r.current_stock) < 0;
                return (
                  <TableRow key={r.id} className={negative ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">{mi.short_name ? `${mi.short_name} (${mi.name})` : mi.name}</TableCell>
                    <TableCell><Badge variant="outline">{mi.type}</Badge></TableCell>
                    <TableCell className={`text-right font-mono ${negative ? 'text-destructive font-semibold' : ''}`}>{Number(r.current_stock).toFixed(3)}</TableCell>
                    <TableCell>{mi.type === 'dye' ? 'gm' : (mi.unit || '—')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.last_updated).toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>}
      </CardContent></Card>
    </div>
  );
};

// ============================================================
// OIL TAB
// ============================================================
const OilTab: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['oil_inventory'],
    queryFn: async () => {
      const { data, error } = await supabase.from('oil_inventory').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: ledger = [] } = useQuery({
    queryKey: ['oil_ledger'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_transactions_v2').select('*').eq('inventory_kind', 'oil').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });
  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Droplet className="h-5 w-5" /> Oil Stock</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
            <div className="text-3xl font-bold font-mono">{Number(data?.current_stock || 0).toFixed(3)} <span className="text-base font-normal text-muted-foreground">kg</span></div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent Movement</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ledger.length === 0 ? <div className="p-6 text-center text-muted-foreground">No movement yet.</div> :
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Lot</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Δ kg</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>
                {ledger.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono">{l.ref_key}</TableCell>
                    <TableCell><Badge variant="outline">{l.source}</Badge></TableCell>
                    <TableCell className={`text-right font-mono ${Number(l.delta) < 0 ? 'text-destructive' : 'text-green-600'}`}>{Number(l.delta) >= 0 ? '+' : ''}{Number(l.delta).toFixed(3)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>}
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================
// FINISHED GOODS TAB
// ============================================================
const FGTab: React.FC = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ['fg_stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('finished_goods_stock').select('*, lots(yarn_company_name, color_name, denier, shade_number)').order('last_updated', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const [search, setSearch] = useState('');
  const filtered = data.filter((r: any) => !search || r.lot_no.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4 mt-4">
      <Input placeholder="Search lot number..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2"><Boxes className="h-10 w-10" /><p>No finished-goods stock yet.</p></div>
          : <Table>
            <TableHeader><TableRow>
              <TableHead>Lot</TableHead><TableHead>Shade</TableHead><TableHead>Color</TableHead>
              <TableHead className="text-right">Original (cones / kg)</TableHead>
              <TableHead className="text-right">Remaining (cones / kg)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((r: any) => {
                const remCones = Number(r.remaining_cones);
                const remNet = Number(r.remaining_net_weight);
                const origCones = Number(r.original_cones);
                const negative = remCones < 0 || remNet < 0;
                const fullyDispatched = remCones <= 0 && origCones > 0;
                return (
                  <TableRow key={r.lot_no} className={negative ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-mono font-semibold">{r.lot_no}</TableCell>
                    <TableCell>{r.lots?.shade_number || '—'}</TableCell>
                    <TableCell>{r.lots?.color_name || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{origCones} / {Number(r.original_net_weight).toFixed(3)}</TableCell>
                    <TableCell className={`text-right font-mono ${negative ? 'text-destructive font-semibold' : ''}`}>{remCones} / {remNet.toFixed(3)}</TableCell>
                    <TableCell>
                      {negative ? <Badge variant="destructive">Over-dispatched</Badge>
                        : fullyDispatched ? <Badge variant="secondary">Dispatched</Badge>
                        : remCones < origCones ? <Badge variant="outline">Partial</Badge>
                        : <Badge>In Stock</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>}
      </CardContent></Card>
    </div>
  );
};

export default InventoryList;
