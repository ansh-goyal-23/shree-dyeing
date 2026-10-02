import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEDYReceiptList, useEDYCurrentStock, useDeleteYarnReceipt, useStoreRacks } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EditYarnReceiptDialog from '@/components/store/EditYarnReceiptDialog';
import type { StoreExternalDyedYarnReceipt } from '@/types/store';
import { toast } from 'sonner';
import { Globe2, Plus, Search, Pencil, Trash2, Filter, X } from 'lucide-react';

interface StockFilters {
  q: string;
  dyer: string;
  shade: string;
  lot: string;
  rack: string;
  from: string;
  to: string;
}

const ExternalDyedYarnList: React.FC = () => {
  const { data: receipts = [], isLoading } = useEDYReceiptList();
  const { data: stock = [], isLoading: stockLoading } = useEDYCurrentStock();
  const { data: racks = [] } = useStoreRacks();
  const deleteReceipt = useDeleteYarnReceipt();
  const [filters, setFilters] = useState<StockFilters>({
    q: '', dyer: '', shade: '', lot: '', rack: '', from: '', to: '',
  });
  const [editing, setEditing] = useState<StoreExternalDyedYarnReceipt | null>(null);
  const [confirmDel, setConfirmDel] = useState<StoreExternalDyedYarnReceipt | null>(null);

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteReceipt.mutateAsync({
        id: confirmDel.id,
        receipt_number: confirmDel.receipt_number,
        item_id: confirmDel.item_id,
        source: 'external_dyed_yarn',
      });
      toast.success(`Receipt ${confirmDel.receipt_number} deleted`);
      setConfirmDel(null);
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const dyers = useMemo(
    () => Array.from(new Set(stock.map((s) => s.supplier).filter(Boolean))).sort((a, b) => a!.localeCompare(b!)),
    [stock],
  );
  const shades = useMemo(
    () => Array.from(new Set(stock.map((s) => s.shade_number || s.shade).filter(Boolean))).sort((a, b) => a!.localeCompare(b!)),
    [stock],
  );
  const lots = useMemo(
    () => Array.from(new Set(stock.map((s) => s.lot_no).filter(Boolean))).sort((a, b) => a!.localeCompare(b!)),
    [stock],
  );

  const filteredStock = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    return stock.filter((s) => {
      if (needle && !(
        s.receipt_number?.toLowerCase().includes(needle) ||
        s.supplier?.toLowerCase().includes(needle) ||
        s.shade?.toLowerCase().includes(needle) ||
        s.shade_number?.toLowerCase().includes(needle) ||
        s.lot_no?.toLowerCase().includes(needle) ||
        s.yarn_type?.toLowerCase().includes(needle) ||
        s.challan_number?.toLowerCase().includes(needle) ||
        s.rack_code?.toLowerCase().includes(needle)
      )) return false;
      if (filters.dyer && s.supplier !== filters.dyer) return false;
      if (filters.shade && (s.shade_number || s.shade) !== filters.shade) return false;
      if (filters.lot && s.lot_no !== filters.lot) return false;
      if (filters.rack && s.rack_id !== filters.rack) return false;
      if (filters.from && s.receipt_date && s.receipt_date < filters.from) return false;
      if (filters.to && s.receipt_date && s.receipt_date > filters.to) return false;
      return true;
    });
  }, [stock, filters]);

  const filteredReceipts = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    return receipts.filter((r) => {
      if (needle && !(
        r.receipt_number?.toLowerCase().includes(needle) ||
        r.supplier?.toLowerCase().includes(needle) ||
        r.challan_number?.toLowerCase().includes(needle) ||
        r.shade?.toLowerCase().includes(needle) ||
        r.shade_number?.toLowerCase().includes(needle) ||
        r.lot_no?.toLowerCase().includes(needle) ||
        r.yarn_type?.toLowerCase().includes(needle)
      )) return false;
      return true;
    });
  }, [receipts, filters.q]);

  const totalGross = useMemo(
    () => filteredStock.reduce((sum, s) => sum + Number(s.received_weight || 0), 0),
    [filteredStock],
  );
  const totalCones = useMemo(
    () => filteredStock.reduce((sum, s) => sum + Number(s.cone_count || 0), 0),
    [filteredStock],
  );

  const activeFilterCount = [filters.dyer, filters.shade, filters.lot, filters.rack, filters.from, filters.to].filter(Boolean).length;

  const clearFilters = () => setFilters({ q: '', dyer: '', shade: '', lot: '', rack: '', from: '', to: '' });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe2 className="h-6 w-6" /> External Dyed Yarn
          </h1>
          <p className="text-sm text-muted-foreground">
            Dyed yarn received from outside dyeing factories. Source = External Dyer.
          </p>
        </div>
        <Link to="/store/external-dyed-yarn/receive">
          <Button><Plus className="h-4 w-4 mr-1" /> New EDY Receipt</Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search receipt, supplier, shade, challan, rack…"
            className="pl-9"
          />
        </div>

        <Card className="overflow-visible">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {activeFilterCount} active
                  <button onClick={clearFilters} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Dyer</Label>
                <Select value={filters.dyer || '__all__'} onValueChange={(v) => setFilters((f) => ({ ...f, dyer: v === '__all__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="All dyers" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All dyers</SelectItem>
                    {dyers.map((d) => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Shade #</Label>
                <Select value={filters.shade || '__all__'} onValueChange={(v) => setFilters((f) => ({ ...f, shade: v === '__all__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="All shades" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All shades</SelectItem>
                    {shades.map((d) => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lot #</Label>
                <Select value={filters.lot || '__all__'} onValueChange={(v) => setFilters((f) => ({ ...f, lot: v === '__all__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="All lots" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All lots</SelectItem>
                    {lots.map((d) => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rack No.</Label>
                <Select value={filters.rack || '__all__'} onValueChange={(v) => setFilters((f) => ({ ...f, rack: v === '__all__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="All racks" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All racks</SelectItem>
                    {racks.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.rack_code} — {r.rack_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="receipts">Receipt History</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <Card className="overflow-x-auto">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base">External Dyed Yarn — Current Stock</CardTitle>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="bg-muted px-3 py-1 rounded-md">
                  <span className="text-muted-foreground">Total Gross Wt:</span>{' '}
                  <strong>{totalGross.toFixed(3)} kg</strong>
                </span>
                <span className="bg-muted px-3 py-1 rounded-md">
                  <span className="text-muted-foreground">Total Cones:</span>{' '}
                  <strong>{totalCones}</strong>
                </span>
                <span className="bg-muted px-3 py-1 rounded-md">
                  <span className="text-muted-foreground">Rows:</span>{' '}
                  <strong>{filteredStock.length}</strong>
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Challan #</TableHead>
                    <TableHead>Dyer</TableHead>
                    <TableHead>Lot #</TableHead>
                    <TableHead>Shade #</TableHead>
                    <TableHead className="text-right">Gross Wt</TableHead>
                    <TableHead className="text-right"># of Cones</TableHead>
                    <TableHead>Rack No.</TableHead>
                    <TableHead className="text-right">Current Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockLoading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filteredStock.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No external dyed yarn in stock.</TableCell></TableRow>
                  ) : filteredStock.map(s => (
                    <TableRow key={s.receipt_id}>
                      <TableCell>{s.receipt_date}</TableCell>
                      <TableCell>{s.challan_number || '—'}</TableCell>
                      <TableCell>{s.supplier || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{s.lot_no || '—'}</TableCell>
                      <TableCell>{s.shade_number || s.shade || '—'}</TableCell>
                      <TableCell className="text-right">{Number(s.received_weight).toFixed(3)} kg</TableCell>
                      <TableCell className="text-right">{s.cone_count ?? '—'}</TableCell>
                      <TableCell>{s.rack_code ? `${s.rack_code} — ${s.rack_name}` : '—'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(s.current_balance).toFixed(3)} {s.unit || 'kg'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
          <Card className="overflow-x-auto">
            <CardHeader>
              <CardTitle className="text-base">Receipt History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Challan #</TableHead>
                    <TableHead>Dyer</TableHead>
                    <TableHead>Lot #</TableHead>
                    <TableHead>Shade #</TableHead>
                    <TableHead className="text-right">Gross Wt</TableHead>
                    <TableHead className="text-right"># of Cones</TableHead>
                    <TableHead>Rack No.</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filteredReceipts.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No receipts yet.</TableCell></TableRow>
                  ) : filteredReceipts.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                      <TableCell>{r.receipt_date}</TableCell>
                      <TableCell>{r.challan_number || '—'}</TableCell>
                      <TableCell>{r.supplier || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.lot_no || '—'}</TableCell>
                      <TableCell>{r.shade_number || r.shade || '—'}</TableCell>
                      <TableCell className="text-right">{Number(r.gross_weight ?? r.net_weight).toFixed(3)} kg</TableCell>
                      <TableCell className="text-right">{r.cone_count ?? '—'}</TableCell>
                      <TableCell>{(r as any).rack_code ? `${(r as any).rack_code} — ${(r as any).rack_name}` : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditing(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => setConfirmDel(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditYarnReceiptDialog
        receipt={editing}
        source="external_dyed_yarn"
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete receipt {confirmDel?.receipt_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the receipt and its stock entry. Blocked if any stock has already been issued out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteReceipt.isPending}>
              {deleteReceipt.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExternalDyedYarnList;