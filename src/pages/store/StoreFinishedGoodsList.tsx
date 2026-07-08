import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFGReceiptList, useFGCurrentStock, useDeleteYarnReceipt } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EditYarnReceiptDialog from '@/components/store/EditYarnReceiptDialog';
import type { StoreFinishedGoodsReceipt } from '@/types/store';
import { toast } from 'sonner';
import { PackageCheck, Plus, Search, Activity, Pencil, Trash2 } from 'lucide-react';

const FinishedGoodsList: React.FC = () => {
  const { data: receipts = [], isLoading } = useFGReceiptList();
  const { data: stock = [], isLoading: stockLoading } = useFGCurrentStock();
  const deleteReceipt = useDeleteYarnReceipt();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<StoreFinishedGoodsReceipt | null>(null);
  const [confirmDel, setConfirmDel] = useState<StoreFinishedGoodsReceipt | null>(null);

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteReceipt.mutateAsync({
        id: confirmDel.id,
        receipt_number: confirmDel.receipt_number,
        item_id: confirmDel.item_id,
        source: 'finished_goods',
      });
      toast.success(`Receipt ${confirmDel.receipt_number} deleted`);
      setConfirmDel(null);
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const filteredStock = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stock;
    return stock.filter(s =>
      s.lot_no?.toLowerCase().includes(needle) ||
      s.shade?.toLowerCase().includes(needle) ||
      s.client?.toLowerCase().includes(needle) ||
      s.rack_code?.toLowerCase().includes(needle),
    );
  }, [stock, q]);

  const filteredReceipts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return receipts;
    return receipts.filter(r =>
      r.lot_no?.toLowerCase().includes(needle) ||
      r.receipt_number?.toLowerCase().includes(needle) ||
      r.shade?.toLowerCase().includes(needle) ||
      r.client?.toLowerCase().includes(needle),
    );
  }, [receipts, q]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageCheck className="h-6 w-6" /> Finished Goods
          </h1>
          <p className="text-sm text-muted-foreground">
            Lot-based finished goods inventory. Receive completed production lots into store.
          </p>
        </div>
        <Link to="/store/finished-goods/receive">
          <Button><Plus className="h-4 w-4 mr-1" /> Receive Finished Lot</Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search lot, shade, client, rack…"
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="receipts">Receipt History</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card className="overflow-x-auto">
            <CardHeader>
              <CardTitle className="text-base">Finished Goods — Current Stock (by Lot)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot Number</TableHead>
                    <TableHead>Shade</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Yarn Type</TableHead>
                    <TableHead>Rack</TableHead>
                    <TableHead className="text-right">Current Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Timeline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filteredStock.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No finished goods in stock.</TableCell></TableRow>
                  ) : filteredStock.map(s => (
                    <TableRow key={s.receipt_id}>
                      <TableCell className="font-mono text-xs">{s.lot_no}</TableCell>
                      <TableCell>{s.shade || '—'}</TableCell>
                      <TableCell>{s.client || '—'}</TableCell>
                      <TableCell>{s.yarn_type || '—'}</TableCell>
                      <TableCell>{s.rack_code ? `${s.rack_code} — ${s.rack_name}` : '—'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(s.current_balance).toFixed(3)} {s.unit || 'kg'}
                      </TableCell>
                      <TableCell>
                        {s.lot_status ? <Badge variant="secondary">{s.lot_status}</Badge> : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" title="View Timeline">
                          <Link to={`/store/timeline?code=${encodeURIComponent('FG-' + s.lot_no)}`}>
                            <Activity className="h-4 w-4" />
                          </Link>
                        </Button>
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
                    <TableHead>Lot</TableHead>
                    <TableHead>Shade</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Net Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filteredReceipts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No receipts yet.</TableCell></TableRow>
                  ) : filteredReceipts.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                      <TableCell>{r.receipt_date}</TableCell>
                      <TableCell className="font-mono text-xs">{r.lot_no}</TableCell>
                      <TableCell>{r.shade || '—'}</TableCell>
                      <TableCell>{r.client || '—'}</TableCell>
                      <TableCell className="text-right">{Number(r.net_weight).toFixed(3)} kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinishedGoodsList;
