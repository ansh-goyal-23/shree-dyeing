import React from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Copy, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BillSummary } from '@/lib/billSummary';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  challanNumbers: string[];
  bill: BillSummary;
  /** Number of return lines netted into the bill (0 if none / excluded). */
  returnsNetted: number;
  /** Only shown when the selection actually has returns to include. */
  hasReturns: boolean;
  includeReturns: boolean;
  onIncludeReturnsChange: (v: boolean) => void;
}

const money = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });

const CreateBillDialog: React.FC<Props> = ({
  open, onOpenChange, clientName, challanNumbers, bill, returnsNetted, hasReturns, includeReturns, onIncludeReturnsChange,
}) => {
  const itemText = (l: BillSummary['lines'][number]) =>
    l.challans.length ? `${l.item} (Ch. No. ${l.challans.join(', ')})` : l.item;

  const handleCopy = async () => {
    const rows = [
      ['Line', 'Item', 'Qty (kg)', 'Rate', 'Amount'],
      ...bill.lines.map(l => [l.line, itemText(l), l.qty ?? '', l.rate ?? '', l.amount]),
      ['', 'Total', bill.totalQty, '', bill.subtotal],
    ];
    try {
      await navigator.clipboard.writeText(rows.map(r => r.join('\t')).join('\n'));
      toast.success('Bill table copied — paste it into Excel, Sheets or WhatsApp.');
    } catch {
      toast.error('Could not copy. Use Download Excel instead.');
    }
  };

  const handleDownload = () => {
    const aoa: (string | number)[][] = [
      ['Sample Bill — for accountant'],
      ['Client', clientName],
      ['Challans', challanNumbers.join(', ')],
      [],
      ['Line', 'Item', 'Qty (kg)', 'Rate', 'Amount'],
      ...bill.lines.map(l => [l.line, itemText(l), l.qty ?? '', l.rate ?? '', l.amount]),
      ['', 'Total (before GST)', bill.totalQty, '', bill.subtotal],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 70 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill');
    const clientPart = clientName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'client';
    XLSX.writeFile(wb, `sample-bill-${clientPart}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sample Bill — {clientName}</DialogTitle>
          <DialogDescription>
            {challanNumbers.length} challan{challanNumbers.length !== 1 ? 's' : ''}: {challanNumbers.join(', ')}.
            Amounts are before GST and round-off.
          </DialogDescription>
        </DialogHeader>

        {hasReturns && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary w-4 h-4"
              checked={includeReturns}
              onChange={e => onIncludeReturnsChange(e.target.checked)}
            />
            Net off return challans against these challans
            {includeReturns && returnsNetted > 0 ? ` (${returnsNetted} return line${returnsNetted !== 1 ? 's' : ''})` : ''}
          </label>
        )}

        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-3 font-medium w-12">Line</th>
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 font-medium text-right">Qty (kg)</th>
                <th className="p-3 font-medium text-right">Rate</th>
                <th className="p-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nothing billable in the selected challans.</td></tr>
              ) : bill.lines.map(l => (
                <tr key={l.line} className="border-b border-border align-top">
                  <td className="p-3">{l.line}</td>
                  <td className="p-3">
                    <div className="font-medium">{l.item}</div>
                    {l.challans.length > 0 && (
                      <div className="text-xs text-muted-foreground italic">Ch. No. {l.challans.join(', ')}</div>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">{l.qty === null ? '' : kg(l.qty)}</td>
                  <td className="p-3 text-right whitespace-nowrap">{l.rate === null ? '' : money(l.rate)}</td>
                  <td className="p-3 text-right whitespace-nowrap font-medium">{money(l.amount)}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-semibold">
                <td className="p-3" />
                <td className="p-3">Total (before GST)</td>
                <td className="p-3 text-right whitespace-nowrap">{kg(bill.totalQty)}</td>
                <td className="p-3" />
                <td className="p-3 text-right whitespace-nowrap">₹{money(bill.subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={handleCopy} disabled={bill.lines.length === 0}>
            <Copy className="w-4 h-4 mr-1" /> Copy table
          </Button>
          <Button onClick={handleDownload} disabled={bill.lines.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Download Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBillDialog;
