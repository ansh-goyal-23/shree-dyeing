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
import { AlertTriangle, Package, SlidersHorizontal } from 'lucide-react';
import { useInventoryStock, useAdjustStock } from '@/hooks/useInventory';
import { useExpenseItems } from '@/hooks/useExpenses';
import { toast } from 'sonner';

const InventoryList: React.FC = () => {
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
      setShowAdjust(false);
      setAdjustItemId('');
      setAdjustQty('');
      setAdjustReason('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to adjust stock');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
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
        <CardHeader><CardTitle>Search & Filter</CardTitle></CardHeader>
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
              <p className="text-xs">Stock will appear here when you save Purchase or Asset expenses</p>
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
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isLow ? 'bg-destructive/5' : ''}`}
                      onClick={() => navigate(`/inventory/${item.item_id}`)}
                    >
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.category_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.item_type === 'Asset' ? 'secondary' : 'outline'}>
                          {item.item_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.current_stock}</TableCell>
                      <TableCell>{item.unit || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{item.minimum_stock_level || '-'}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Low
                          </Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item *</Label>
              <Select value={adjustItemId} onValueChange={setAdjustItemId}>
                <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                <SelectContent>
                  {allItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.item_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity (+ to add, − to reduce) *</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                placeholder="e.g. 10 or -5"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} rows={2} placeholder="Reason for adjustment..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjustStock.isPending}>
              {adjustStock.isPending ? 'Adjusting...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryList;
