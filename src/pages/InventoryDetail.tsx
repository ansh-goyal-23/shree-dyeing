import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, Save } from 'lucide-react';
import { useInventoryStock, useInventoryTransactions, useUpdateMinStock } from '@/hooks/useInventory';
import { toast } from 'sonner';

const InventoryDetail: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { data: allStock = [] } = useInventoryStock();
  const { data: transactions = [], isLoading: txLoading } = useInventoryTransactions(itemId);
  const updateMin = useUpdateMinStock();

  const item = allStock.find(s => s.item_id === itemId);
  const [minLevel, setMinLevel] = useState<string>('');
  const [minInit, setMinInit] = useState(false);

  if (!minInit && item) {
    setMinLevel(String(item.minimum_stock_level || 0));
    setMinInit(true);
  }

  const handleSaveMin = async () => {
    if (!item) return;
    try {
      await updateMin.mutateAsync({ id: item.id, minimum_stock_level: parseFloat(minLevel) || 0 });
      toast.success('Minimum stock level updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const isLow = item && item.minimum_stock_level > 0 && item.current_stock < item.minimum_stock_level;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{item?.item_name || 'Item Detail'}</h1>
      </div>

      {!item ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Item not found in inventory</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Current Stock</p>
                <p className={`text-3xl font-bold font-mono ${isLow ? 'text-destructive' : 'text-primary'}`}>
                  {item.current_stock}
                </p>
                <p className="text-sm text-muted-foreground">{item.unit}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge variant={item.item_type === 'Asset' ? 'secondary' : 'outline'} className="mt-2">
                  {item.item_type}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-medium mt-1">{item.category_name || '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Min Stock Level</p>
                <div className="flex gap-2">
                  <Input type="number" value={minLevel} onChange={e => setMinLevel(e.target.value)} className="w-24" />
                  <Button size="sm" onClick={handleSaveMin} disabled={updateMin.isPending}>
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
                {isLow && (
                  <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
                    <AlertTriangle className="h-3 w-3" /> Below minimum
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {txLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No transactions yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === 'IN' ? 'default' : 'destructive'}>
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{tx.source}</TableCell>
                        <TableCell className="text-right font-mono">
                          {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tx.reference_id || '-'}</TableCell>
                        <TableCell className="text-sm">{tx.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default InventoryDetail;
