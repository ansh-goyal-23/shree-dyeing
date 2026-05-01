import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { ApprovalRow, ApprovalSection } from '@/types/inventoryV2';

interface Props {
  open: boolean;
  rows: ApprovalRow[];
  title?: string;
  busy?: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

const SECTION_ORDER: ApprovalSection[] = ['Yarn', 'Dyes', 'Chemicals', 'Finished Goods', 'Oil'];

const InventoryApprovalDialog: React.FC<Props> = ({ open, rows, title, busy, onApprove, onCancel }) => {
  const grouped: Record<string, ApprovalRow[]> = {};
  for (const r of rows) (grouped[r.section] ||= []).push(r);
  const sections = SECTION_ORDER.filter(s => grouped[s]?.length);
  const hasWarn = rows.some(r => r.warn);
  const empty = rows.length === 0;

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-y-auto [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title || 'Inventory Changes'}</DialogTitle>
          <DialogDescription>
            {empty
              ? 'No inventory changes detected for this save.'
              : 'Review the calculated stock changes below. Approve to apply, or Cancel to leave inventory unchanged.'}
          </DialogDescription>
        </DialogHeader>

        {hasWarn && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Some items will go below zero. Stock will be allowed to go negative if you approve.</span>
          </div>
        )}

        {!empty && (
          <div className="space-y-5">
            {sections.map(section => (
              <div key={section}>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">{section}</h3>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Item</th>
                        <th className="text-right p-2 font-medium">Previous</th>
                        <th className="text-right p-2 font-medium">Change</th>
                        <th className="text-right p-2 font-medium">New</th>
                        <th className="text-left p-2 font-medium">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[section].map((r, i) => (
                        <tr key={i} className={`border-t ${r.warn ? 'bg-destructive/5' : ''}`}>
                          <td className="p-2">
                            <span className="inline-flex items-center gap-2">
                              {r.warn && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                              {r.label}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono">{r.prevStock}</td>
                          <td className="p-2 text-right font-mono font-semibold">{r.change}</td>
                          <td className={`p-2 text-right font-mono ${r.warn ? 'text-destructive font-semibold' : ''}`}>{r.newStock}</td>
                          <td className="p-2 text-muted-foreground">{r.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={onApprove} disabled={busy}>
            {busy ? 'Applying…' : empty ? 'Close' : 'Approve Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryApprovalDialog;
