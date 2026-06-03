import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore, isEqual } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlusCircle, Trash2, ArrowUpDown, Eye, CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExpenses, useDeleteExpense, useUpdateExpensePayment } from '@/hooks/useExpenses';
import { toast } from 'sonner';
import ExpenseDetailDialog from '@/components/ExpenseDetailDialog';

const ExpenseList: React.FC = () => {
  const navigate = useNavigate();
  const { data: expenses = [], isLoading } = useExpenses();
  const deleteExpense = useDeleteExpense();
  const updatePayment = useUpdateExpensePayment();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [sortField, setSortField] = useState<'date' | 'total_amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  const filtered = useMemo(() => {
    let result = expenses;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e =>
        (e.supplier_name || '').toLowerCase().includes(s) ||
        (e.category_name || '').toLowerCase().includes(s) ||
        e.notes.toLowerCase().includes(s)
      );
    }
    if (filterType !== 'all') result = result.filter(e => e.expense_type === filterType);
    if (filterPayment !== 'all') result = result.filter(e => e.payment_status === filterPayment);

    if (fromDate) {
      const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      result = result.filter(e => {
        const d = parseISO(e.date);
        return isAfter(d, from) || isEqual(d, from);
      });
    }
    if (toDate) {
      const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
      result = result.filter(e => {
        const d = parseISO(e.date);
        return isBefore(d, to) || isEqual(d, to);
      });
    }

    result = [...result].sort((a, b) => {
      const valA = sortField === 'date' ? new Date(a.date).getTime() : a.total_amount;
      const valB = sortField === 'date' ? new Date(b.date).getTime() : b.total_amount;
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return result;
  }, [expenses, search, filterType, filterPayment, sortField, sortDir, fromDate, toDate]);

  const toggleSort = (field: 'date' | 'total_amount') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await deleteExpense.mutateAsync(id);
      toast.success('Expense deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const totalAmount = filtered.reduce((sum, e) => sum + e.total_amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => navigate('/expenses/create')}>
          <PlusCircle className="h-4 w-4 mr-2" /> New Expense
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Search & Filter</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Input placeholder="Search supplier, category, notes..." value={search} onChange={e => setSearch(e.target.value)} />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Purchase">Purchase</SelectItem>
                <SelectItem value="Direct Expense">Direct Expense</SelectItem>
                <SelectItem value="Asset">Asset</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger><SelectValue placeholder="Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "dd-MMM-yyyy") : "From Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "dd-MMM-yyyy") : "To Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {(fromDate || toDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
                <X className="h-4 w-4 mr-1" /> Clear Dates
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No expenses found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('date')}>
                    Date <ArrowUpDown className="inline h-3 w-3" />
                  </TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('total_amount')}>
                    Total (₹) <ArrowUpDown className="inline h-3 w-3" />
                  </TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id} data-owner-id={(e as any).created_by || ''}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell className="font-medium">{e.supplier_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={e.expense_type === 'Purchase' ? 'default' : e.expense_type === 'Asset' ? 'secondary' : 'outline'}>
                        {e.expense_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.category_name || '-'}</TableCell>
                    <TableCell className="text-right font-mono">{e.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={e.payment_status === 'Paid' ? 'default' : 'destructive'}
                        className="cursor-pointer select-none"
                        onClick={async () => {
                          const newStatus = e.payment_status === 'Paid' ? 'Unpaid' : 'Paid';
                          try {
                            await updatePayment.mutateAsync({ id: e.id, payment_status: newStatus });
                            toast.success(`Marked as ${newStatus}`);
                          } catch {
                            toast.error('Failed to update payment status');
                          }
                        }}
                      >
                        {e.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.linked_lot_no || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetailId(e.id)} title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={4} className="text-right">Total:</TableCell>
                  <TableCell className="text-right font-mono">{totalAmount.toFixed(2)}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExpenseDetailDialog
        expenseId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
};

export default ExpenseList;
