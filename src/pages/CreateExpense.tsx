import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Upload } from 'lucide-react';
import ItemSelect from '@/components/ItemSelect';
import DecimalInput from '@/components/DecimalInput';
import { useCreateExpense } from '@/hooks/useExpenses';
import { useApp } from '@/context/AppContext';
import type { ExpenseType, PaymentStatus, ExpenseItem } from '@/types/expense';

const EMPTY_LOT_VALUE = '__no_lot_selected__';

const ExpenseCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const createExpense = useCreateExpense();
  const { lots = [] } = useApp();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [expenseType, setExpenseType] = useState<ExpenseType>('Purchase');
  const [itemId, setItemId] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [unit, setUnit] = useState('');
  const [rate, setRate] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [supplierName, setSupplierName] = useState('');
  const [linkedLotNo, setLinkedLotNo] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  const isPurchaseType = expenseType === 'Purchase' || expenseType === 'Asset';

  useEffect(() => {
    if (isPurchaseType && quantity > 0 && rate > 0) {
      setTotalAmount(Math.round(quantity * rate * 100) / 100);
    }
  }, [quantity, rate, isPurchaseType]);

  const handleItemChange = (id: string, item?: ExpenseItem) => {
    setItemId(id);
    if (item) {
      setCategory(item.category ?? '');
      setUnit(item.unit ?? '');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((file) =>
        ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
      );
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);

    if (!date) {
      toast.error('Date is required');
      return;
    }

    if (isPurchaseType && !itemId) {
      toast.error('Select an item');
      return;
    }

    if (totalAmount <= 0) {
      toast.error('Total amount is required');
      return;
    }

    try {
      await createExpense.mutateAsync({
        date,
        expense_type: expenseType,
        item_id: itemId || null,
        category,
        quantity: isPurchaseType ? quantity : null,
        unit: isPurchaseType ? unit : null,
        rate: isPurchaseType ? rate : null,
        total_amount: totalAmount,
        supplier_name: supplierName,
        linked_lot_no: linkedLotNo,
        payment_status: paymentStatus,
        notes,
        files: files.length > 0 ? files : undefined,
      });
      toast.success('Expense added successfully');
      navigate('/expenses');
    } catch (err) {
      console.error('Failed to create expense:', err);
      setPageError('Error loading form');
      toast.error(err instanceof Error ? err.message : 'Failed to add expense');
    }
  };

  if (pageError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">New Expense</h1>
        <Card>
          <CardContent className="py-8 text-center text-destructive">{pageError}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/expenses')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">New Expense</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Expense Type *</Label>
                <Select value={expenseType} onValueChange={(value) => setExpenseType(value as ExpenseType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Purchase">Purchase</SelectItem>
                    <SelectItem value="Direct Expense">Direct Expense</SelectItem>
                    <SelectItem value="Asset">Asset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {expenseType !== 'Direct Expense' && (
              <div>
                <Label>Item *</Label>
                <ItemSelect value={itemId} onChange={handleItemChange} />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div>
                <Label>Payment Status *</Label>
                <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as PaymentStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isPurchaseType && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>Quantity</Label>
                  <DecimalInput
                    value={quantity}
                    onValueChange={setQuantity}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input value={unit} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Rate</Label>
                  <DecimalInput
                    value={rate}
                    onValueChange={setRate}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Total Amount (Rs.) *</Label>
                <DecimalInput
                  value={totalAmount}
                  onValueChange={setTotalAmount}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label>Supplier Name</Label>
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Linked Lot No (optional)</Label>
                <Select
                  value={linkedLotNo || EMPTY_LOT_VALUE}
                  onValueChange={(value) => setLinkedLotNo(value === EMPTY_LOT_VALUE ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lot..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_LOT_VALUE}>None</SelectItem>
                    {lots.map((lot) => (
                      <SelectItem key={lot.lot_no} value={lot.lot_no}>
                        {lot.lot_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Upload Bills (JPG, PNG, PDF)</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={handleFileChange} />
                </div>
                {files.length > 0 && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center gap-1">
                        <Upload className="h-3 w-3" /> {file.name}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                          className="h-5 px-1 text-destructive"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createExpense.isPending}>
                {createExpense.isPending ? 'Saving...' : 'Save Expense'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/expenses')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default ExpenseCreatePage;
