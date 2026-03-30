import React, { useState } from 'react';
import { useExpenseCategories, useCreateExpenseCategory } from '@/hooks/useExpenses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
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
  const [name, setName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }
    if (!expenseType) {
      toast.error('Please select an expense type first');
      return;
    }
    try {
      const created = await createCategory.mutateAsync({ category_name: name.trim(), expense_type: expenseType });
      onChange(created.id, created);
      setName('');
      setOpen(false);
      toast.success('Category added');
    } catch (e: any) {
      console.error('Create category error:', e);
      toast.error(e?.message || 'Failed to add category');
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1">
          <Select value={value || EMPTY} onValueChange={v => onChange(v === EMPTY ? '' : v, categories.find(c => c.id === v))}>
            <SelectTrigger><SelectValue placeholder={isLoading ? 'Loading...' : 'Select category...'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>None</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)}>
          <PlusCircle className="h-4 w-4" />
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Add Category{expenseType ? ` for ${expenseType}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Category Name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter category name"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createCategory.isPending}>
              {createCategory.isPending ? 'Adding...' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategorySelect;
