import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useVerificationSession,
  useVerificationLines,
  useUpdateVerificationLine,
  useApproveVerificationSession,
  useCancelVerificationSession,
  STORE_CATEGORY_LABEL,
} from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, CheckCircle2, XCircle, Search, Download } from 'lucide-react';
import { toast } from 'sonner';

const ALL = 'all';

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

const StoreVerificationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session } = useVerificationSession(id);
  const { data: lines = [], isLoading } = useVerificationLines(id);
  const update = useUpdateVerificationLine();
  const approve = useApproveVerificationSession();
  const cancel = useCancelVerificationSession();

  const [q, setQ] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const isDraft = session?.status === 'draft';

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter(l =>
      l.item_name.toLowerCase().includes(needle) ||
      l.item_code.toLowerCase().includes(needle) ||
      (l.sub_category || '').toLowerCase().includes(needle)
    );
  }, [q, lines]);

  const summary = useMemo(() => {
    let counted = 0, missing = 0, plus = 0, minus = 0;
    lines.forEach(l => {
      if (l.physical_quantity === null) { missing++; return; }
      counted++;
      const d = Number(l.difference ?? 0);
      if (d > 0.00001) plus++;
      else if (d < -0.00001) minus++;
    });
    return { counted, missing, plus, minus, total: lines.length };
  }, [lines]);

  const handleBlurPhysical = (line: typeof lines[number], raw: string) => {
    const trimmed = raw.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && Number.isNaN(next as number)) {
      toast.error('Invalid number');
      return;
    }
    const current = line.physical_quantity;
    if ((current ?? null) === (next ?? null)) return;
    update.mutate(
      { id: line.id, session_id: line.session_id, physical_quantity: next },
      { onError: (e: any) => toast.error(e?.message ?? 'Failed to save') },
    );
  };

  const exportCsv = () => {
    const head = ['Item Code','Item Name','Category','Sub-category','Rack','Unit','System Qty','Physical Qty','Difference','Remarks'];
    const rows = filtered.map(l => [
      l.item_code, l.item_name, STORE_CATEGORY_LABEL[l.category] || l.category,
      l.sub_category || '', l.rack_code || '', l.unit,
      l.system_quantity, l.physical_quantity ?? '',
      l.difference ?? '', (l.remarks || '').replace(/\n/g, ' '),
    ]);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${session?.session_number ?? 'verification'}.csv`;
    a.click();
  };

  const doApprove = async () => {
    try {
      const r = await approve.mutateAsync(id!);
      toast.success(`Approved. ${r.adjustments_created} adjustment(s) created.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Approve failed');
    }
  };

  const doCancel = async () => {
    try {
      await cancel.mutateAsync(id!);
      toast.success('Session cancelled');
    } catch (e: any) {
      toast.error(e?.message ?? 'Cancel failed');
    }
  };

  if (!session) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/store/stock-verification"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {session.session_number}
              <Badge variant={
                session.status === 'approved' ? 'default'
                : session.status === 'cancelled' ? 'destructive'
                : 'secondary'
              }>{session.status}</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {session.session_date}{session.title ? ` · ${session.title}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV</Button>
          {isDraft && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline"><XCircle className="h-4 w-4 mr-2" />Cancel Session</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this verification session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      No stock adjustments will be created. The session and its counts remain as an audit record.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction onClick={doCancel}>Cancel Session</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button><CheckCircle2 className="h-4 w-4 mr-2" />Approve Difference</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve and post adjustments?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A `stock_adjustment` transaction will be created for every counted item whose
                      physical quantity differs from system quantity. Uncounted lines are ignored.
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction onClick={doApprove}>Approve & Post</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total Items</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Counted</div>
          <div className="text-2xl font-bold">{summary.counted}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold">{summary.missing}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Surplus (+)</div>
          <div className="text-2xl font-bold text-emerald-600">{summary.plus}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Shortage (−)</div>
          <div className="text-2xl font-bold text-destructive">{summary.minus}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search item..."
              value={q} onChange={e => setQ(e.target.value)} />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Rack</TableHead>
                  <TableHead className="text-right">System Qty</TableHead>
                  <TableHead className="text-right">Physical Qty</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No items.</TableCell></TableRow>
                ) : filtered.map(l => {
                  const diff = l.difference;
                  const diffColor = diff === null ? 'text-muted-foreground'
                    : diff > 0.00001 ? 'text-emerald-600'
                    : diff < -0.00001 ? 'text-destructive'
                    : '';
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.item_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{l.item_code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{STORE_CATEGORY_LABEL[l.category] || l.category}</div>
                        {l.sub_category && <div className="text-xs text-muted-foreground">{l.sub_category}</div>}
                      </TableCell>
                      <TableCell>{l.rack_code || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(l.system_quantity)}</TableCell>
                      <TableCell className="text-right font-mono w-[150px]">
                        {isDraft ? (
                          <Input
                            type="number"
                            step="any"
                            className="text-right h-8"
                            defaultValue={l.physical_quantity ?? ''}
                            onChange={e => setDrafts(d => ({ ...d, [l.id]: e.target.value }))}
                            onBlur={e => handleBlurPhysical(l, e.target.value)}
                          />
                        ) : (
                          fmt(l.physical_quantity)
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${diffColor}`}>
                        {diff === null ? '-' : (diff > 0 ? '+' : '') + fmt(diff)}
                      </TableCell>
                      <TableCell>{l.unit}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {session.status === 'approved' && (
        <p className="text-sm text-muted-foreground">
          Approved on {session.approved_at?.slice(0, 10)} — {session.adjustment_count} stock adjustment transaction(s) created.
        </p>
      )}
      {session.remarks && (
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Remarks</div>
          <div className="text-sm whitespace-pre-wrap">{session.remarks}</div>
        </CardContent></Card>
      )}
    </div>
  );
};

export default StoreVerificationDetail;
