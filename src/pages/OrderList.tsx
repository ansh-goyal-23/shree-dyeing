import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, Pencil, AlertTriangle, Ban, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  useOrders, useCreateOrder, useUpdateOrder, useDeleteOrder, useSetOrderCancelled, useClientNames,
  useReplaceAllOrders,
} from '@/hooks/useOrders';
import { parseOrderSheetFile, type ParsedOrderRow, type SkippedOrderRow } from '@/lib/orderSheetImport';
import type { OrderInput, OrderStatus } from '@/types/order';

const emptyForm: OrderInput = {
  client_name: '', poc: '', order_date: new Date().toISOString().slice(0, 10),
  color_name: '', yarn_type: '', sample_type: '', shade_no: '', order_qty: 0, uom: 'KG', notes: '',
};

const statusVariant = (s: OrderStatus): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (s === 'Fulfilled') return 'default';
  if (s === 'Partially Sent') return 'secondary';
  if (s === 'Cancelled') return 'destructive';
  return 'outline';
};

const OrderList: React.FC = () => {
  const { data: orders = [], isLoading } = useOrders();
  const { data: clientNames = [] } = useClientNames();
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const setCancelled = useSetOrderCancelled();
  const replaceAllOrders = useReplaceAllOrders();

  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCancelled, setShowCancelled] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OrderInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ fileName: string; rows: ParsedOrderRow[]; skipped: SkippedOrderRow[] } | null>(null);
  const [importing, setImporting] = useState(false);

  const uniqueClients = useMemo(
    () => Array.from(new Set([...clientNames, ...orders.map(o => o.client_name)])).sort(),
    [clientNames, orders]
  );

  const filtered = useMemo(() => {
    let result = orders;
    if (!showCancelled) result = result.filter(o => !o.is_cancelled);
    if (filterClient !== 'all') result = result.filter(o => o.client_name === filterClient);
    if (filterStatus !== 'all') result = result.filter(o => o.status === filterStatus);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(o =>
        o.client_name.toLowerCase().includes(s) ||
        o.color_name.toLowerCase().includes(s) ||
        (o.shade_no || '').toLowerCase().includes(s) ||
        (o.poc || '').toLowerCase().includes(s)
      );
    }
    return result;
  }, [orders, search, filterClient, filterStatus, showCancelled]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      const { rows, skipped } = await parseOrderSheetFile(file);
      if (rows.length === 0) {
        toast.error('No usable rows found in that file (every row was missing a Client or Colour, or had an unrecognized date).');
        return;
      }
      setImportPreview({ fileName: file.name, rows, skipped });
    } catch (err: any) {
      toast.error(err?.message || 'Could not read that file. Make sure it\'s a .xlsx, .xls or .csv export of the order sheet.');
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const { insertedCount } = await replaceAllOrders.mutateAsync({
        rows: importPreview.rows,
        fileName: importPreview.fileName,
        previousCount: orders.length,
      });
      toast.success(
        `Replaced all orders: ${insertedCount} row(s) imported from ${importPreview.fileName}` +
        (importPreview.skipped.length ? ` (${importPreview.skipped.length} row(s) skipped)` : '')
      );
      setImportPreview(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to replace orders');
    } finally {
      setImporting(false);
    }
  };

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (o: typeof orders[number]) => {
    setEditingId(o.id);
    setForm({
      client_name: o.client_name, poc: o.poc, order_date: o.order_date, color_name: o.color_name,
      yarn_type: o.yarn_type, sample_type: o.sample_type, shade_no: o.shade_no,
      order_qty: o.order_qty, uom: o.uom, notes: o.notes,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.client_name.trim() || !form.color_name.trim() || form.order_qty <= 0) {
      toast.error('Client, colour and a positive order quantity are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateOrder.mutateAsync({ id: editingId, ...form });
        toast.success('Order updated');
      } else {
        await createOrder.mutateAsync(form);
        toast.success('Order added');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this order permanently?')) return;
    try {
      await deleteOrder.mutateAsync(id);
      toast.success('Order deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleToggleCancel = async (id: string, isCancelled: boolean) => {
    try {
      await setCancelled.mutateAsync({ id, is_cancelled: !isCancelled });
      toast.success(isCancelled ? 'Order reopened' : 'Order cancelled');
    } catch { toast.error('Failed to update order'); }
  };

  const totalOrderQty = filtered.reduce((sum, o) => sum + o.order_qty, 0);
  const totalBalance = filtered.reduce((sum, o) => sum + o.balance_qty, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Qty Sent and Balance are calculated live from matching dispatch challans — matched automatically by client, colour, yarn type and shade no.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button variant="outline" onClick={handleUploadClick}>
            <Upload className="h-4 w-4 mr-2" /> Upload Excel
          </Button>
          <Button onClick={openCreate}>
            <PlusCircle className="h-4 w-4 mr-2" /> New Order
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Search & Filter</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Search client, colour, shade, POC..." value={search} onChange={e => setSearch(e.target.value)} />
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {uniqueClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Partially Sent">Partially Sent</SelectItem>
                <SelectItem value="Fulfilled">Fulfilled</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showCancelled ? 'secondary' : 'outline'}
              onClick={() => setShowCancelled(v => !v)}
            >
              {showCancelled ? 'Hide Cancelled' : 'Show Cancelled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No orders found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>POC</TableHead>
                  <TableHead>Colour</TableHead>
                  <TableHead>Yarn Type</TableHead>
                  <TableHead>Shade No.</TableHead>
                  <TableHead className="text-right">Order Qty</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(o => (
                  <TableRow key={o.id} className={o.is_cancelled ? 'opacity-60' : ''}>
                    <TableCell>{o.order_date}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        {o.client_name}
                        {(o as any).possibleDuplicate && (
                          <span title="Another open order shares this client, colour and yarn type with no shade no. yet — dispatches may double-count until one gets a shade no.">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{o.poc || '-'}</TableCell>
                    <TableCell>{o.color_name}</TableCell>
                    <TableCell>{o.yarn_type || '-'}</TableCell>
                    <TableCell>{o.shade_no || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right font-mono">{o.order_qty} {o.uom}</TableCell>
                    <TableCell className="text-right font-mono">{o.qty_sent.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{o.balance_qty.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(o)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleToggleCancel(o.id, o.is_cancelled)}
                          title={o.is_cancelled ? 'Reopen' : 'Cancel order'}
                        >
                          {o.is_cancelled ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4 text-amber-600" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={6} className="text-right">Total:</TableCell>
                  <TableCell className="text-right font-mono">{totalOrderQty.toFixed(2)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-mono">{totalBalance.toFixed(2)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Order' : 'New Order'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Client *</Label>
              <Input
                list="order-client-names"
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="Client name"
              />
              <datalist id="order-client-names">
                {uniqueClients.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>POC</Label>
              <Input value={form.poc} onChange={e => setForm(f => ({ ...f, poc: e.target.value }))} placeholder="Point of contact" />
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Colour *</Label>
              <Input value={form.color_name} onChange={e => setForm(f => ({ ...f, color_name: e.target.value }))} placeholder="Colour name" />
            </div>
            <div className="space-y-1">
              <Label>Yarn Type</Label>
              <Input value={form.yarn_type} onChange={e => setForm(f => ({ ...f, yarn_type: e.target.value }))} placeholder="e.g. 150/tex, 2/40" />
            </div>
            <div className="space-y-1">
              <Label>Sample Type</Label>
              <Input value={form.sample_type} onChange={e => setForm(f => ({ ...f, sample_type: e.target.value }))} placeholder="e.g. Fabric Cutting" />
            </div>
            <div className="space-y-1">
              <Label>Shade No.</Label>
              <Input value={form.shade_no} onChange={e => setForm(f => ({ ...f, shade_no: e.target.value }))} placeholder="Leave blank if not assigned yet" />
            </div>
            <div className="space-y-1">
              <Label>Order Qty *</Label>
              <Input
                type="number" min="0" step="0.01"
                value={form.order_qty || ''}
                onChange={e => setForm(f => ({ ...f, order_qty: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label>UOM</Label>
              <Select value={form.uom || 'KG'} onValueChange={v => setForm(f => ({ ...f, uom: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KG">KG</SelectItem>
                  <SelectItem value="PCS">PCS</SelectItem>
                  <SelectItem value="MTR">MTR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!importPreview} onOpenChange={(o) => !o && !importing && setImportPreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all orders?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will permanently delete all <strong>{orders.length}</strong> existing order(s) and
                  replace them with <strong>{importPreview?.rows.length}</strong> row(s) from{' '}
                  <strong>{importPreview?.fileName}</strong>. This cannot be undone.
                </p>
                {!!importPreview?.skipped.length && (
                  <div className="text-sm text-amber-600 flex items-start gap-1">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      {importPreview.skipped.length} row(s) will be skipped: {importPreview.skipped.slice(0, 5).map(s => `row ${s.rowNumber} (${s.reason})`).join(', ')}
                      {importPreview.skipped.length > 5 ? `, and ${importPreview.skipped.length - 5} more` : ''}.
                    </span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmImport(); }}
              disabled={importing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {importing ? 'Replacing...' : 'Replace All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrderList;
