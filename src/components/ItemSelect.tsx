import React, { useState } from 'react';
import { useExpenseItems, useCreateExpenseItem } from '@/hooks/useExpenses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ExpenseItem } from '@/types/expense';

interface ItemSelectProps {
  categoryId?: string;
  expenseType?: string;
  value: string;
  onChange: (itemId: string, item?: ExpenseItem) => void;
}

const ItemSelect: React.FC<ItemSelectProps> = ({ categoryId, expenseType, value, onChange }) => {
  const { data: items = [], isLoading, error } = useExpenseItems(categoryId, expenseType);
  const createItem = useCreateExpenseItem();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newItem, setNewItem] = useState<{ item_name: string; unit: string; item_type: 'Consumable' | 'Asset' }>({
    item_name: '',
    unit: 'kg',
    item_type: 'Consumable',
  });

  const filtered = items.filter(item => item.item_name.toLowerCase().includes(search.toLowerCase()));

  if (error) console.error('Failed to load expense items:', error);

  const handleCreate = async () => {
    if (!newItem.item_name.trim()) {
      toast.error('Item name is required');
      return;
    }
    try {
      const created = await createItem.mutateAsync({
        item_name: newItem.item_name.trim(),
        category_id: categoryId || null,
        expense_type: expenseType || 'Purchase',
        unit: newItem.unit,
        item_type: newItem.item_type,
      });
      onChange(created.id, created);
      setNewItem({ item_name: '', unit: 'kg', item_type: 'Consumable' });
      setOpen(false);
      toast.success('Item added');
    } catch (e: any) {
      console.error('Add item error:', e);
      const msg = e?.message || e?.toString() || 'Unknown error';
      toast.error(`Failed to add item: ${msg}`);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1">
          <Select
            value={value || '__empty__'}
            onValueChange={v => {
              if (v === '__empty__') { onChange(''); return; }
              const sel = items.find(i => i.id === v);
              onChange(v, sel);
            }}
            disabled={isLoading || !!error}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? 'Loading...' : error ? 'Error' : 'Select item...'} />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="mb-2" />
              </div>
              <SelectItem value="__empty__">None</SelectItem>
              {filtered.map(item => (
                <SelectItem key={item.id} value={item.id}>{item.item_name} ({item.unit})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)}>
          <PlusCircle className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Add New Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item Name *</Label>
              <Input
                autoFocus
                value={newItem.item_name}
                onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={newItem.unit} onValueChange={u => setNewItem(p => ({ ...p, unit: u }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['kg', 'gm', 'piece', 'liter', 'meter', 'set'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Item Type</Label>
              <Select value={newItem.item_type} onValueChange={t => setNewItem(p => ({ ...p, item_type: t as 'Consumable' | 'Asset' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consumable">Consumable</SelectItem>
                  <SelectItem value="Asset">Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createItem.isPending}>
              {createItem.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ItemSelect;
