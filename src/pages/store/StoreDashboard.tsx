import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Boxes, AlertTriangle, Wrench, Scale, Activity } from 'lucide-react';
import { useStoreItems, useStoreTransactions, useStoreCurrentStock } from '@/hooks/useStore';
import { Link } from 'react-router-dom';

const StoreDashboard: React.FC = () => {
  const { data: items = [] } = useStoreItems({ activeOnly: true });
  const { data: txns = [] } = useStoreTransactions(500);
  const { data: stock = [] } = useStoreCurrentStock();

  const today = new Date().toISOString().slice(0, 10);
  const todayTxns = txns.filter(t => t.transaction_date === today).length;

  const pendingAssets = txns.reduce((acc, t) => {
    if (t.transaction_type === 'asset_issue') return acc + 1;
    if (t.transaction_type === 'asset_return') return acc - 1;
    return acc;
  }, 0);

  const finishedGoodsWeight = stock
    .filter(s => s.category === 'finished_good')
    .reduce((sum, s) => sum + Number(s.current_quantity || 0), 0);

  const cards = [
    { label: 'Current Stock Value', value: '—', hint: 'Coming soon', icon: Activity },
    { label: 'Number of Items', value: items.length.toString(), icon: Boxes },
    { label: 'Low Stock', value: '—', hint: 'Coming soon', icon: AlertTriangle },
    { label: 'Pending Assets', value: Math.max(pendingAssets, 0).toString(), icon: Wrench },
    { label: 'Finished Goods Weight', value: `${finishedGoodsWeight.toFixed(2)} kg`, icon: Scale },
    { label: "Today's Transactions", value: todayTxns.toString(), icon: Package },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Store Management</h1>
        <p className="text-muted-foreground">Inventory overview and quick stats.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
                {c.hint && <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/store/items" className="block">
          <Card className="hover:bg-muted/40 transition">
            <CardHeader><CardTitle className="text-base">Item Master</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Manage items, categories, racks.</CardContent>
          </Card>
        </Link>
        <Link to="/store/current-stock" className="block">
          <Card className="hover:bg-muted/40 transition">
            <CardHeader><CardTitle className="text-base">Current Stock</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Live stock derived from transactions.</CardContent>
          </Card>
        </Link>
        <Link to="/store/stock-inward" className="block">
          <Card className="hover:bg-muted/40 transition">
            <CardHeader><CardTitle className="text-base">Stock Inward</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Record incoming stock.</CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default StoreDashboard;
