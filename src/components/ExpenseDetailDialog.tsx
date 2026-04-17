import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useExpenseDetail } from '@/hooks/useExpenses';
import { FileText } from 'lucide-react';

interface Props {
  expenseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ExpenseDetailDialog: React.FC<Props> = ({ expenseId, open, onOpenChange }) => {
  const { data, isLoading } = useExpenseDetail(expenseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Expense Details</DialogTitle>
          <DialogDescription>
            {data?.expense ? `Bill dated ${data.expense.date}` : 'Loading expense information...'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading || !data ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Date</div>
                  <div className="font-medium">{data.expense.date}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Type</div>
                  <div><Badge variant="outline">{data.expense.expense_type}</Badge></div>
                </div>
                <div>
                  <div className="text-muted-foreground">Payment</div>
                  <div>
                    <Badge variant={data.expense.payment_status === 'Paid' ? 'default' : 'destructive'}>
                      {data.expense.payment_status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Supplier</div>
                  <div className="font-medium">{data.expense.supplier_name || '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Category</div>
                  <div className="font-medium">{data.expense.category_name || '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Linked Lot</div>
                  <div className="font-medium">{data.expense.linked_lot_no || '-'}</div>
                </div>
              </div>

              {data.expense.notes && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <div className="text-muted-foreground mb-1">Notes</div>
                    <div className="whitespace-pre-wrap">{data.expense.notes}</div>
                  </div>
                </>
              )}

              <Separator />

              {/* Line items */}
              <div>
                <div className="font-semibold mb-2">Line Items</div>
                {data.expense.line_items && data.expense.line_items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.expense.line_items.map(li => (
                        <TableRow key={li.id}>
                          <TableCell className="font-medium">{li.item_name}</TableCell>
                          <TableCell className="text-right font-mono">{li.quantity}</TableCell>
                          <TableCell>{li.unit}</TableCell>
                          <TableCell className="text-right font-mono">{li.rate.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{li.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-muted-foreground">No line items</div>
                )}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-1 text-sm max-w-xs ml-auto">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">₹{data.expense.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Freight</span>
                  <span className="font-mono">₹{data.expense.freight.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST ({data.expense.gst_percent}%)</span>
                  <span className="font-mono">₹{data.expense.gst_amount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="font-mono">₹{data.expense.total_amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Documents */}
              {data.documents.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="font-semibold mb-2">Attached Documents</div>
                    <div className="space-y-1">
                      {data.documents.map(doc => (
                        <a
                          key={doc.id}
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          {doc.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseDetailDialog;
