import React from 'react';
import { Link } from 'react-router-dom';
import { useStoreInwardList } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowDownToLine, Plus } from 'lucide-react';

const StoreInwardList: React.FC = () => {
  const { data: rows = [], isLoading } = useStoreInwardList();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowDownToLine className="h-6 w-6" /> Stock Inward
          </h1>
          <p className="text-sm text-muted-foreground">
            Goods received notes. Each entry creates positive stock transactions.
          </p>
        </div>
        <Link to="/store/stock-inward/create">
          <Button><Plus className="h-4 w-4 mr-1" /> New Stock Inward</Button>
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inward #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>GRN #</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No inward entries yet.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.inward_number}</TableCell>
                <TableCell>{r.inward_date}</TableCell>
                <TableCell>{r.supplier || '—'}</TableCell>
                <TableCell>{r.invoice_number || '—'}</TableCell>
                <TableCell>{r.grn_number || '—'}</TableCell>
                <TableCell className="text-right">₹ {Number(r.total_amount || 0).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default StoreInwardList;
