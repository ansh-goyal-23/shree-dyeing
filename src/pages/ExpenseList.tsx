import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, ArrowUpDown } from 'lucide-react';
import { useExpenses, useDeleteExpense } from '@/hooks/useExpenses';
import { toast } from 'sonner';

const ExpenseList: React.FC = () => {
  const navigate = useNavigate();
  const { data: expenses = [], isLoading } = useExpenses();
  const deleteExpense = useDeleteExpense();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortField, setSortField] = useState<'date' | 'total_amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const categories = useMemo(() => [...new Set(expenses.map(e => e.category).filter(Boolean))], [expenses]);

  const filtered = useMemo(() => {
    let result = expenses;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e =>
        (e.item_name || '').toLowerCase().includes(s) ||
        e.supplier_name.toLowerCase().includes(s) ||
        e.notes.toLowerCase().includes(s)
      );
    }
    if (filterType !== 'all') result = result.filter(e => e.expense_type === filterType);
    if (filterPayment !== 'all') result = result.filter(e => e.payment_status === filterPayment);
    if (filterCategory !== 'all') result = result.filter(e => e.category === filterCategory);

    result = [...result].sort((a, b) => {
      const valA = sortField === 'date' ? new Date(a.date).getTime() : a.total_amount;
      const valB = sortField === 'date' ? new Date(b.date).getTime() : b.total_amount;
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return result;
  }, [expenses, search, filterType, filterPayment, filterCategory, sortField, sortDir]);

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Search item, supplier, notes..." value={search} onChange={e => setSearch(e.target.value)} />
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
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
            <div className="p-8 text-center text-muted-foreground">No expenses found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('date')}>
                    Date <ArrowUpDown className="inline h-3 w-3" />
                  </TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('total_amount')}>
                    Amount (Rs.) <ArrowUpDown className="inline h-3 w-3" />
                  </TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell className="font-medium">{e.item_name || '-'}</TableCell>
                    <TableCell>{e.category || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={e.expense_type === 'Purchase' ? 'default' : e.expense_type === 'Asset' ? 'secondary' : 'outline'}>
                        {e.expense_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{e.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={e.payment_status === 'Paid' ? 'default' : 'destructive'}>
                        {e.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.linked_lot_no || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
    </div>
  );
};

export default ExpenseList;
