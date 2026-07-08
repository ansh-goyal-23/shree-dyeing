import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEDYReceiptList, useEDYCurrentStock, useDeleteYarnReceipt } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Globe2, Plus, Search, Activity, Pencil, Trash2 } from 'lucide-react';

const ExternalDyedYarnList: React.FC = () => {
  const { data: receipts = [], isLoading } = useEDYReceiptList();
  const { data: stock = [], isLoading: stockLoading } = useEDYCurrentStock();
  const deleteReceipt = useDeleteYarnReceipt();
  const [q, setQ] = useState('');
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

  const filteredStock = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stock;
    return stock.filter(s =>
      s.receipt_number?.toLowerCase().includes(needle) ||
      s.supplier?.toLowerCase().includes(needle) ||
      s.shade?.toLowerCase().includes(needle) ||
      s.yarn_type?.toLowerCase().includes(needle) ||
      s.challan_number?.toLowerCase().includes(needle) ||
      s.rack_code?.toLowerCase().includes(needle),
    );
  }, [stock, q]);

  const filteredReceipts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return receipts;
    return receipts.filter(r =>
      r.receipt_number?.toLowerCase().includes(needle) ||
      r.supplier?.toLowerCase().includes(needle) ||
      r.challan_number?.toLowerCase().includes(needle) ||
      r.shade?.toLowerCase().includes(needle) ||
      r.yarn_type?.toLowerCase().includes(needle),
    );
  }, [receipts, q]);

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

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search receipt, supplier, shade, challan, rack…"
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
              <CardTitle className="text-base">External Dyed Yarn — Current Stock</CardTitle>
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
                    <TableHead className="text-right">Timeline</TableHead>
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
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" title="View Timeline">
                          <Link to={`/store/timeline?code=${encodeURIComponent('EDY-' + s.receipt_number)}`}>
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
                    <TableHead>Supplier</TableHead>
                    <TableHead>Challan #</TableHead>
                    <TableHead>Yarn Type</TableHead>
                    <TableHead>Shade</TableHead>
                    <TableHead className="text-right">Net Weight</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
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
                      <TableCell>{r.supplier || '—'}</TableCell>
                      <TableCell>{r.challan_number || '—'}</TableCell>
                      <TableCell>{r.yarn_type || '—'}</TableCell>
                      <TableCell>{r.shade || '—'}</TableCell>
                      <TableCell className="text-right">{Number(r.net_weight).toFixed(3)} kg</TableCell>
                      <TableCell className="text-right">{r.rate != null ? Number(r.rate).toFixed(2) : '—'}</TableCell>
                      <TableCell className="text-right">{r.amount != null ? Number(r.amount).toFixed(2) : '—'}</TableCell>
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
