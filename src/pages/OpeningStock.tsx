import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import { useExpenseItems } from '@/hooks/useExpenses';
import { useAddOpeningStock } from '@/hooks/useInventory';
import { toast } from 'sonner';

interface StockRow {
  key: string;
  item_id: string;
  quantity: string;
  unit: string;
  notes: string;
}

const newRow = (): StockRow => ({
  key: crypto.randomUUID(),
  item_id: '',
  quantity: '',
  unit: '',
  notes: '',
});

const OpeningStock: React.FC = () => {
  const navigate = useNavigate();
  const { data: allItems = [] } = useExpenseItems();
  const addOpening = useAddOpeningStock();
  const [rows, setRows] = useState<StockRow[]>([newRow()]);

  const updateRow = useCallback((key: string, updates: Partial<StockRow>) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...updates } : r));
  }, []);

  const handleItemChange = (key: string, itemId: string) => {
    const item = allItems.find(i => i.id === itemId);
    updateRow(key, { item_id: itemId, unit: item?.unit || '' });
  };

  const handleSubmit = async () => {
    const valid = rows.filter(r => r.item_id && parseFloat(r.quantity) > 0);
    if (valid.length === 0) {
      toast.error('Add at least one item with quantity > 0');
      return;
    }

    try {
      await addOpening.mutateAsync(
        valid.map(r => ({
          item_id: r.item_id,
          quantity: parseFloat(r.quantity),
          unit: r.unit,
          notes: r.notes,
        }))
      );
      toast.success(`Opening stock added for ${valid.length} item(s)`);
      navigate('/inventory');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save opening stock');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Add Opening Stock</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stock Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows(prev => [...prev, newRow()])}>
              <PlusCircle className="h-4 w-4 mr-1" /> Add Row
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.key}>
                  <TableCell>
                    <Select value={row.item_id} onValueChange={v => handleItemChange(row.key, v)}>
                      <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                      <SelectContent>
                        {allItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>{item.item_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={row.quantity}
                      onChange={e => updateRow(row.key, { quantity: e.target.value })}
                      placeholder="0"
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.unit || '-'}</TableCell>
                  <TableCell>
                    <Input
                      value={row.notes}
                      onChange={e => updateRow(row.key, { notes: e.target.value })}
                      placeholder="Optional notes"
                    />
                  </TableCell>
                  <TableCell>
                    {rows.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => setRows(prev => prev.filter(r => r.key !== row.key))}>
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

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={addOpening.isPending}>
          {addOpening.isPending ? 'Saving...' : 'Save Opening Stock'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/inventory')}>Cancel</Button>
      </div>
    </div>
  );
};

export default OpeningStock;
