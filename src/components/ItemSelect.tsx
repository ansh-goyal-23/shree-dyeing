import React, { useState } from 'react';
import { useExpenseItems, useCreateExpenseItem } from '@/hooks/useExpenses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle } from 'lucide-react';
import type { ExpenseItem } from '@/types/expense';

interface ItemSelectProps {
  value: string;
  onChange: (itemId: string, item?: ExpenseItem) => void;
}

const ItemSelect: React.FC<ItemSelectProps> = ({ value, onChange }) => {
  const { data: items = [], isLoading, error } = useExpenseItems();
  const createItem = useCreateExpenseItem();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newItem, setNewItem] = useState<{ item_name: string; category: string; unit: string; item_type: 'Consumable' | 'Asset' }>({
    item_name: '',
    category: '',
    unit: 'kg',
    item_type: 'Consumable',
  });

  const filtered = items.filter((item) => item.item_name.toLowerCase().includes(search.toLowerCase()));

  if (error) {
    console.error('Failed to load expense items:', error);
  }

  const handleCreate = async () => {
    if (!newItem.item_name.trim()) return;

    try {
      const created = await createItem.mutateAsync(newItem);
      onChange(created.id, created);
      setNewItem({ item_name: '', category: '', unit: 'kg', item_type: 'Consumable' });
      setOpen(false);
    } catch (createError) {
      console.error('Failed to create expense item:', createError);
    }
  };

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Select
          value={value}
          onValueChange={(nextValue) => {
            const selectedItem = items.find((item) => item.id === nextValue);
            onChange(nextValue, selectedItem);
          }}
          disabled={isLoading || !!error}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? 'Loading items...' : error ? 'Error loading items' : 'Select item...'} />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
            </div>
            {filtered.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.item_name} ({item.unit})
              </SelectItem>
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="p-2 text-sm text-muted-foreground">
                {error ? 'Unable to load items' : 'No items found'}
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name *</Label>
              <Input value={newItem.item_name} onChange={(e) => setNewItem((prev) => ({ ...prev, item_name: e.target.value }))} />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={newItem.category} onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))} />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={newItem.unit} onValueChange={(nextUnit) => setNewItem((prev) => ({ ...prev, unit: nextUnit }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['kg', 'gm', 'piece', 'liter', 'meter', 'set'].map((unitOption) => (
                    <SelectItem key={unitOption} value={unitOption}>{unitOption}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Item Type</Label>
              <Select value={newItem.item_type} onValueChange={(nextType) => setNewItem((prev) => ({ ...prev, item_type: nextType as 'Consumable' | 'Asset' }))}>
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
    </div>
  );
};

export default ItemSelect;
