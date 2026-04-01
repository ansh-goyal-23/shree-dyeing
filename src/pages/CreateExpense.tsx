import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Upload, PlusCircle, Trash2 } from 'lucide-react';
import DecimalInput from '@/components/DecimalInput';
import SupplierSelect from '@/components/SupplierSelect';
import CategorySelect from '@/components/CategorySelect';
import ItemSelect from '@/components/ItemSelect';
import { useCreateExpense } from '@/hooks/useExpenses';
import { useApp } from '@/context/AppContext';
import type { ExpenseType, PaymentStatus, ExpenseItem } from '@/types/expense';

const EMPTY_LOT = '__no_lot__';

interface LineItem {
  key: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

const newLine = (): LineItem => ({
  key: crypto.randomUUID(),
  item_id: '',
  item_name: '',
  quantity: 0,
  unit: '',
  rate: 0,
  amount: 0,
});

const ExpenseCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const createExpense = useCreateExpense();
  const { lots = [] } = useApp();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseType, setExpenseType] = useState<ExpenseType>('Purchase');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [linkedLotNo, setLinkedLotNo] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [gstPercent, setGstPercent] = useState<number>(0);
  const [freight, setFreight] = useState<number>(0);

  // For Direct Expense: single total amount, no line items
  const [directTotal, setDirectTotal] = useState<number>(0);

  // For Purchase / Asset: multi-item line items
  const [lineItems, setLineItems] = useState<LineItem[]>([newLine()]);

  const isPurchaseType = expenseType === 'Purchase' || expenseType === 'Asset';

  const updateLine = useCallback((key: string, updates: Partial<LineItem>) => {
    setLineItems(prev => prev.map(li => {
      if (li.key !== key) return li;
      const updated = { ...li, ...updates };
      updated.amount = Math.round(updated.quantity * updated.rate * 100) / 100;
      return updated;
    }));
  }, []);

  const subtotal = isPurchaseType
    ? lineItems.reduce((s, li) => s + li.amount, 0)
    : directTotal;
  const taxableTotal = Math.round((subtotal + freight) * 100) / 100;
  const gstAmount = Math.round(taxableTotal * (gstPercent / 100) * 100) / 100;
  const totalAmount = Math.round((taxableTotal + gstAmount) * 100) / 100;

  const handleItemSelect = (key: string, itemId: string, item?: ExpenseItem) => {
    updateLine(key, {
      item_id: itemId,
      item_name: item?.item_name || '',
      unit: item?.unit || '',
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f =>
        ['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) { toast.error('Date is required'); return; }
    if (totalAmount <= 0) { toast.error('Total amount must be > 0'); return; }
    if (isPurchaseType && lineItems.every(li => !li.item_id)) {
      toast.error('Add at least one item'); return;
    }

    try {
      await createExpense.mutateAsync({
        date,
        expense_type: expenseType,
        category_id: categoryId || null,
        supplier_id: supplierId || null,
        subtotal,
        gst_percent: gstPercent,
        gst_amount: gstAmount,
        freight,
        total_amount: totalAmount,
        linked_lot_no: linkedLotNo,
        payment_status: paymentStatus,
        notes,
        line_items: isPurchaseType
          ? lineItems.filter(li => li.item_id).map(li => ({
              item_id: li.item_id,
              item_name: li.item_name,
              quantity: li.quantity,
              unit: li.unit,
              rate: li.rate,
              amount: li.amount,
            }))
          : [],
        files: files.length > 0 ? files : undefined,
      });
      toast.success('Expense saved');
      navigate('/expenses');
    } catch (err: any) {
      console.error('Failed to create expense:', err);
      const msg = err?.message || err?.error_description || JSON.stringify(err);
      toast.error(`Failed to save: ${msg}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/expenses')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">New Expense / Bill</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Header */}
        <Card className="mb-4">
          <CardHeader><CardTitle>Bill Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Expense Type *</Label>
                <Select value={expenseType} onValueChange={v => { setExpenseType(v as ExpenseType); setCategoryId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Purchase">Purchase</SelectItem>
                    <SelectItem value="Direct Expense">Direct Expense</SelectItem>
                    <SelectItem value="Asset">Asset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <CategorySelect expenseType={expenseType} value={categoryId} onChange={(id) => setCategoryId(id)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>Supplier</Label>
                <SupplierSelect value={supplierId} onChange={(id) => setSupplierId(id)} />
              </div>
              <div>
                <Label>Payment Status *</Label>
                <Select value={paymentStatus} onValueChange={v => setPaymentStatus(v as PaymentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked Lot (optional)</Label>
                <Select value={linkedLotNo || EMPTY_LOT} onValueChange={v => setLinkedLotNo(v === EMPTY_LOT ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select lot..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_LOT}>None</SelectItem>
                    {lots.map(lot => <SelectItem key={lot.lot_no} value={lot.lot_no}>{lot.lot_no}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items (Purchase / Asset) */}
        {isPurchaseType && (
          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => setLineItems(prev => [...prev, newLine()])}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map(li => (
                    <TableRow key={li.key}>
                      <TableCell>
                        <ItemSelect
                          categoryId={categoryId}
                          expenseType={expenseType}
                          value={li.item_id}
                          onChange={(id, item) => handleItemSelect(li.key, id, item)}
                        />
                      </TableCell>
                      <TableCell>
                        <DecimalInput
                          value={li.quantity}
                          onValueChange={v => updateLine(li.key, { quantity: v })}
                          className="flex h-9 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{li.unit || '-'}</TableCell>
                      <TableCell>
                        <DecimalInput
                          value={li.rate}
                          onValueChange={v => updateLine(li.key, { rate: v })}
                          className="flex h-9 w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">{li.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {lineItems.length > 1 && (
                          <Button type="button" variant="ghost" size="icon"
                            onClick={() => setLineItems(prev => prev.filter(x => x.key !== li.key))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Direct Expense: just total */}
        {!isPurchaseType && (
          <Card className="mb-4">
            <CardHeader><CardTitle>Amount</CardTitle></CardHeader>
            <CardContent>
              <div className="max-w-xs">
                <Label>Total Amount (₹) *</Label>
                <DecimalInput
                  value={directTotal}
                  onValueChange={setDirectTotal}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Totals + GST */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
              <div>
                <Label>Subtotal</Label>
                <div className="text-lg font-mono font-semibold">₹{subtotal.toFixed(2)}</div>
              </div>
              <div>
                <Label>GST %</Label>
                <DecimalInput
                  value={gstPercent}
                  onValueChange={setGstPercent}
                  step="0.01"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label>GST Amount</Label>
                <div className="text-lg font-mono">₹{gstAmount.toFixed(2)}</div>
              </div>
              <div>
                <Label>Freight / Cartage</Label>
                <DecimalInput
                  value={freight}
                  onValueChange={setFreight}
                  step="0.01"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label>Total</Label>
                <div className="text-xl font-mono font-bold text-primary">₹{totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes & Files */}
        <Card className="mb-4">
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Upload Bills (JPG, PNG, PDF)</Label>
              <Input type="file" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={handleFileChange} />
              {files.length > 0 && (
                <div className="mt-1 text-sm text-muted-foreground space-y-1">
                  {files.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-1">
                      <Upload className="h-3 w-3" /> {file.name}
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="h-5 px-1 text-destructive">×</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={createExpense.isPending}>
            {createExpense.isPending ? 'Saving...' : 'Save Expense'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/expenses')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseCreatePage;
