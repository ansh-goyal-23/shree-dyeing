import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStoreInwardList, useStoreInwardLineDetails } from '@/hooks/useStore';
import { INWARD_ITEM_TYPES } from '@/pages/store/StoreInwardCreate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowDownToLine, Plus, ChevronDown, ChevronRight } from 'lucide-react';

const typeLabel = (v?: string | null) =>
  INWARD_ITEM_TYPES.find(t => t.value === v)?.label || v || '—';

const InwardLines: React.FC<{ inwardNumber: string }> = ({ inwardNumber }) => {
  const { data: lines = [], isLoading } = useStoreInwardLineDetails(inwardNumber);

  if (isLoading) {
    return <div className="py-3 text-sm text-muted-foreground">Loading items…</div>;
  }
  if (!lines.length) {
    return <div className="py-3 text-sm text-muted-foreground">No line items found.</div>;
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item Type</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Rack</TableHead>
            <TableHead>Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map(l => (
            <TableRow key={l.id}>
              <TableCell>{typeLabel(l.item_type)}</TableCell>
              <TableCell className="font-medium">{l.item_name}</TableCell>
              <TableCell className="text-right">{Number(l.quantity).toFixed(3)}</TableCell>
              <TableCell>{l.unit}</TableCell>
              <TableCell>{l.rack_code ? `${l.rack_code}${l.rack_name ? ` — ${l.rack_name}` : ''}` : '—'}</TableCell>
              <TableCell>{l.remarks || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const StoreInwardList: React.FC = () => {
  const { data: rows = [], isLoading } = useStoreInwardList();
  const [expanded, setExpanded] = useState<string | null>(null);

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
              <TableHead className="w-8"></TableHead>
              <TableHead>Inward #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>GRN #</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No inward entries yet.</TableCell></TableRow>
            ) : rows.map(r => (
              <React.Fragment key={r.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpanded(e => (e === r.inward_number ? null : r.inward_number))}
                >
                  <TableCell>
                    {expanded === r.inward_number
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.inward_number}</TableCell>
                  <TableCell>{r.inward_date}</TableCell>
                  <TableCell>{r.supplier || '—'}</TableCell>
                  <TableCell>{r.invoice_number || '—'}</TableCell>
                  <TableCell>{r.grn_number || '—'}</TableCell>
                </TableRow>
                {expanded === r.inward_number && (
                  <TableRow>
                    <TableCell colSpan={6} className="p-2">
                      <InwardLines inwardNumber={r.inward_number} />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default StoreInwardList;
