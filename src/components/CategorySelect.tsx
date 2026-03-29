import React, { useState } from 'react';
import { useExpenseCategories, useCreateExpenseCategory } from '@/hooks/useExpenses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle } from 'lucide-react';
import type { ExpenseCategory } from '@/types/expense';

interface CategorySelectProps {
  expenseType: string;
  value: string;
  onChange: (id: string, cat?: ExpenseCategory) => void;
}

const EMPTY = '__none__';

const CategorySelect: React.FC<CategorySelectProps> = ({ expenseType, value, onChange }) => {
  const { data: categories = [], isLoading } = useExpenseCategories(expenseType);
  const createCategory = useCreateExpenseCategory();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');

  const filtered = categories.filter(c => c.category_name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await createCategory.mutateAsync({ category_name: name, expense_type: expenseType });
      onChange(created.id, created);
      setName('');
      setOpen(false);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Select value={value || EMPTY} onValueChange={v => onChange(v === EMPTY ? '' : v, categories.find(c => c.id === v))}>
          <SelectTrigger><SelectValue placeholder={isLoading ? 'Loading...' : 'Select category...'} /></SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <Input placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)} className="mb-2" />
            </div>
            <SelectItem value={EMPTY}>None</SelectItem>
            {filtered.map(c => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Category for {expenseType}</DialogTitle></DialogHeader>
          <div><Label>Category Name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createCategory.isPending}>{createCategory.isPending ? 'Adding...' : 'Add Category'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategorySelect;
