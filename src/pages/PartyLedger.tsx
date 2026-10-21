import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import InvoiceDialog, { type InvoicePrefill } from '@/components/ledger/InvoiceDialog';
import PaymentDialog, { type PaymentPrefill } from '@/components/ledger/PaymentDialog';
import {
  invoiceFileUrl, useDeleteInvoice, useDeletePayment, useLedgerChallans, useLedgerInvoices,
  useLedgerOverrides, useLedgerPayments, useSetChallanStatus,
} from '@/hooks/usePartyLedger';
import {
  computeLedger, fmtPaise, type ChallanOverride, type ChallanView, type InvoiceView, type PartyView, type PaymentView,
} from '@/lib/partyLedger';

const fmtD = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const kgf = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const chNos = (list: ChallanView[], max: number) =>
  list.slice(0, max).map(c => c.no).join(', ') + (list.length > max ? ` +${list.length - max}` : '');

const Tile: React.FC<{ label: string; value: string; sub?: string; tone?: 'main' | 'bad' | 'warn'; onClick?: () => void }> = ({ label, value, sub, tone, onClick }) => {
  const color = tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-600' : tone === 'main' ? 'text-primary' : '';
  const Cmp: any = onClick ? 'button' : 'div';
  return (
    <Cmp onClick={onClick} className={`card-industrial p-4 text-left ${onClick ? 'hover:bg-muted/40 cursor-pointer' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Cmp>
  );
};

const InvoicePill: React.FC<{ i: InvoiceView }> = ({ i }) => {
  if (i.rem === 0 && i.amt > 0 && i.credited >= i.amt) return <Badge variant="secondary">Credited</Badge>;
  if (i.status === 'paid') return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paid</Badge>;
  if (i.overdue) return <Badge variant="destructive">Overdue</Badge>;
  if (i.status === 'partial') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Partly paid</Badge>;
  return <Badge variant="secondary">Unpaid</Badge>;
};

const DueCell: React.FC<{ p: PartyView }> = ({ p }) => {
  if (p.due > 0) return <span className="font-semibold text-destructive">{fmtPaise(p.due)}</span>;
  if (p.due < 0) return <span className="font-semibold text-primary">{fmtPaise(-p.due)} advance</span>;
  return <span className="font-semibold text-emerald-700">Settled</span>;
};

const ChallanPill: React.FC<{ c: ChallanView }> = ({ c }) => {
  if (c.state === 'invoiced') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Invoiced</Badge>
        <span className="text-xs text-muted-foreground">{c.invoices.map(i => i.invoice_no).join(', ')}{c.invoices.length > 1 ? ` (in ${c.invoices.length} invoices)` : ''}</span>
      </span>
    );
  }
  if (c.state === 'earlier') return <Badge variant="secondary">Invoiced earlier</Badge>;
  if (c.state === 'exempt') return <Badge variant="secondary">{c.kind === 'edy' ? 'EDY, not billed' : 'No invoice needed'}</Badge>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Not invoiced</Badge>
      <span className="text-xs text-muted-foreground">{c.ageDays} d</span>
    </span>
  );
};

type Tab = 'parties' | 'invoices' | 'payments' | 'challans';
type Confirm =
  | { kind: 'invoice'; inv: InvoiceView }
  | { kind: 'payment'; pay: PaymentView }
  | null;

const PartyLedger: React.FC = () => {
  const invQ = useLedgerInvoices();
  const payQ = useLedgerPayments();
  const ovQ = useLedgerOverrides();
  const chQ = useLedgerChallans();
  const setStatus = useSetChallanStatus();
  const delInvoice = useDeleteInvoice();
  const delPayment = useDeletePayment();

  const [tab, setTab] = useState<Tab>('parties');
  const [partyKeySel, setPartyKeySel] = useState<string | null>(null);
  const [fParty, setFParty] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fcParty, setFcParty] = useState('');
  const [fcStatus, setFcStatus] = useState('pending');
  const [sel, setSel] = useState<Set<string>>(new Set());

  const [invDlg, setInvDlg] = useState<{ open: boolean; editing?: InvoiceView | null; prefill?: InvoicePrefill | null }>({ open: false });
  const [payDlg, setPayDlg] = useState<{ open: boolean; editing?: PaymentView | null; prefill?: PaymentPrefill | null }>({ open: false });
  const [confirm, setConfirm] = useState<Confirm>(null);

  const loading = invQ.isLoading || payQ.isLoading || ovQ.isLoading || chQ.isLoading;
  const error = (invQ.error || payQ.error || ovQ.error || chQ.error) as any;

  const ledger = useMemo(
    () => computeLedger({
      invoices: invQ.data || [], payments: payQ.data || [], challans: chQ.data?.challans || [],
      overrides: ovQ.data || {}, knownParties: chQ.data?.clientNames || [],
    }),
    [invQ.data, payQ.data, chQ.data, ovQ.data],
  );
  const partyNames = useMemo(() => [...new Set([...(chQ.data?.clientNames || []), ...ledger.parties.map(p => p.name)])].sort((a, b) => a.localeCompare(b)), [chQ.data, ledger]);

  const t = ledger.totals;
  const openParties = ledger.parties.filter(p => p.due > 0).length;
  const receivedCount = ledger.payments.filter(p => !p.isCredit).length;

  const openInvoice = (editing?: InvoiceView | null, prefill?: InvoicePrefill | null) => setInvDlg({ open: true, editing, prefill });
  const openPayment = (editing?: PaymentView | null, prefill?: PaymentPrefill | null) => setPayDlg({ open: true, editing, prefill });
  const ctxParty = tab === 'parties' && partyKeySel ? ledger.byKey.get(partyKeySel)?.name : undefined;

  const viewFile = async (path: string) => {
    try { window.open(await invoiceFileUrl(path), '_blank', 'noopener'); }
    catch (e: any) { toast.error(e.message || 'Could not open the file.'); }
  };

  const copyDues = async () => {
    const lines = ledger.parties.filter(p => p.due > 0).map(p => `${p.name}: ${fmtPaise(p.due)}`);
    lines.push(`Total due: ${fmtPaise(t.due)}`);
    try { await navigator.clipboard.writeText(lines.join('\n')); toast.success('Dues list copied.'); }
    catch { toast.error('Could not copy.'); }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === 'invoice') {
        const i = confirm.inv;
        await delInvoice.mutateAsync({ id: i.id, party: i.party, invoice_no: i.invoice_no, amount: i.amt / 100, file_path: i.file_path });
        toast.success('Invoice deleted. Its challans are back under "Not invoiced".');
      } else {
        const p = confirm.pay;
        await delPayment.mutateAsync({ id: p.id, party: p.party, amount: p.amt / 100, mode: p.mode });
        toast.success('Entry deleted.');
      }
    } catch (e: any) { toast.error(e.message || 'Could not delete.'); }
    setConfirm(null);
  };

  const applyStatus = async (st: ChallanOverride | null) => {
    const ids = [...sel].filter(id => ledger.challans.find(c => c.id === id)?.state !== 'invoiced');
    try {
      await setStatus.mutateAsync({ ids, status: st });
      setSel(new Set());
      toast.success(`${ids.length} challan${ids.length === 1 ? '' : 's'} updated.`);
    } catch (e: any) { toast.error(e.message || 'Could not update.'); }
  };

  // ---------- views ----------
  const partiesView = () => {
    if (!ledger.parties.length) return <Empty title="No entries yet" text="Add an invoice for a party, then record payments as they arrive." />;
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">Click a party to see its full statement.</span>
          <Button size="sm" variant="outline" onClick={copyDues}><Copy className="w-4 h-4 mr-1.5" />Copy dues list</Button>
        </div>
        <div className="card-industrial overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Party</TableHead><TableHead className="text-right">Billed</TableHead><TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Not yet invoiced</TableHead><TableHead className="text-right" /><TableHead className="text-right">Amount due</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ledger.parties.map(p => {
                const net = p.billed - p.credit;
                const pct = net > 0 ? Math.min(100, Math.round((p.received / net) * 100)) : 0;
                return (
                  <TableRow key={p.key} className="cursor-pointer" onClick={() => setPartyKeySel(p.key)}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.invoices.length} invoice{p.invoices.length === 1 ? '' : 's'} · {p.payments.length} payment{p.payments.length === 1 ? '' : 's'}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPaise(net)}
                      {p.credit > 0 && <div className="text-xs text-muted-foreground">after {fmtPaise(p.credit, true)} credit note</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPaise(p.received)}
                      <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5 min-w-[70px]" title={`${pct}% received`}><div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.pending.length ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{p.pending.length} challan{p.pending.length === 1 ? '' : 's'} · {fmtPaise(p.pendingValue, true)}</Badge> : <span className="text-muted-foreground">–</span>}
                    </TableCell>
                    <TableCell className="text-right">{p.overdue > 0 && <Badge variant="destructive">{fmtPaise(p.overdue, true)} overdue</Badge>}</TableCell>
                    <TableCell className="text-right tabular-nums"><DueCell p={p} /></TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>All parties</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPaise(t.billed - t.credit)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPaise(t.received)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPaise(t.pendingValue)}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{fmtPaise(t.billed - t.credit - t.received)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </>
    );
  };

  const statement = (p: PartyView) => {
    type Ent = { d: string; c: string; o: number; kind: 'inv' | 'pay'; inv?: InvoiceView; pay?: PaymentView; debit: number; credit: number };
    const ent: Ent[] = [
      ...p.invoices.map(i => ({ d: i.invoice_date || '', c: i.created_at, o: 0, kind: 'inv' as const, inv: i, debit: i.amt, credit: 0 })),
      ...p.payments.map(x => ({ d: x.paid_on || '', c: x.created_at, o: 1, kind: 'pay' as const, pay: x, debit: 0, credit: x.amt })),
    ].sort((a, b) => a.d.localeCompare(b.d) || a.o - b.o || a.c.localeCompare(b.c));
    let bal = 0;
    const openInvoices = p.invoices.filter(i => i.rem > 0);
    return (
      <>
        <button className="text-sm text-primary mb-2 inline-flex items-center gap-1" onClick={() => setPartyKeySel(null)}><ArrowLeft className="w-4 h-4" />All parties</button>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div><h2 className="text-xl font-semibold">{p.name}</h2><div className="text-xs text-muted-foreground">Statement as on {fmtD(new Date().toISOString().slice(0, 10))}</div></div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Amount due</div>
            <div className="text-2xl font-semibold tabular-nums">{p.due < 0 ? <>{fmtPaise(-p.due)} <span className="text-sm text-muted-foreground">advance</span></> : fmtPaise(p.due)}</div>
          </div>
        </div>
        {ent.length ? (
          <div className="card-industrial overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Particulars</TableHead><TableHead className="text-right">Invoiced</TableHead><TableHead className="text-right">Received / credited</TableHead><TableHead className="text-right">Balance</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {ent.map(e => {
                  bal += e.debit - e.credit;
                  return (
                    <TableRow key={`${e.kind}-${(e.inv || e.pay)!.id}`}>
                      <TableCell className="whitespace-nowrap">{fmtD(e.d)}</TableCell>
                      <TableCell>
                        {e.inv ? (
                          <>
                            <div className="font-medium">Invoice {e.inv.invoice_no}</div>
                            {e.inv.challans.length > 0 && <div className="text-xs text-muted-foreground">Challans {chNos(e.inv.challans, 6)}</div>}
                            {e.inv.note && <div className="text-xs text-muted-foreground">{e.inv.note}</div>}
                          </>
                        ) : e.pay && (
                          <>
                            <div className="font-medium">{e.pay.isCredit ? 'Credit note' : 'Payment received'}</div>
                            <div className="text-xs text-muted-foreground">{e.pay.isCredit ? e.pay.reference : [e.pay.mode, e.pay.reference].filter(Boolean).join(' · ')}{e.pay.applied ? ` → ${e.pay.applied}` : ''}</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{e.debit ? fmtPaise(e.debit) : ''}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.credit ? fmtPaise(e.credit) : ''}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPaise(bal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => (e.inv ? openInvoice(e.inv) : openPayment(e.pay))}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(e.inv ? { kind: 'invoice', inv: e.inv } : { kind: 'payment', pay: e.pay! })}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell /><TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPaise(p.billed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPaise(p.received + p.credit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPaise(p.due)}</TableCell><TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : <Empty title="Nothing yet" text="No invoices or payments for this party yet." />}

        {p.pending.length > 0 && (
          <section className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold text-sm">Challans not yet invoiced ({p.pending.length} · {fmtPaise(p.pendingValue)})</h3>
              <Button size="sm" onClick={() => openInvoice(null, { party: p.name, challan_ids: p.pending.map(c => c.id) })}>Create invoice for these</Button>
            </div>
            <div className="card-industrial overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Challan</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Weight (kg)</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Waiting</TableHead></TableRow></TableHeader>
                <TableBody>
                  {p.pending.map(c => (
                    <TableRow key={c.id}><TableCell className="font-medium">{c.no}</TableCell><TableCell>{fmtD(c.date)}</TableCell><TableCell className="text-right tabular-nums">{kgf(c.kg)}</TableCell><TableCell className="text-right tabular-nums">{fmtPaise(c.amt)}</TableCell><TableCell className="text-right tabular-nums">{c.ageDays} d</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {openInvoices.length > 0 && (
          <section className="mt-6">
            <h3 className="font-semibold text-sm mb-2">Open invoices</h3>
            <div className="card-industrial overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Due date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {openInvoices.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.invoice_no}</TableCell><TableCell>{fmtD(i.invoice_date)}</TableCell>
                      <TableCell>{i.due_date ? fmtD(i.due_date) : <span className="text-xs text-muted-foreground">No due date</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPaise(i.amt)}</TableCell><TableCell className="text-right tabular-nums">{fmtPaise(i.paid)}</TableCell><TableCell className="text-right tabular-nums">{fmtPaise(i.rem)}</TableCell>
                      <TableCell><InvoicePill i={i} /></TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openPayment(null, { party: p.name, invoice_id: i.id })}>Record payment</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </>
    );
  };

  const invoicesView = () => {
    if (!ledger.invoices.length) return <Empty title="No invoices yet" text="Add an invoice with its party, number, date and amount, and tick the challans it covers. You can attach the invoice PDF or a photo of it." />;
    const nameOf = (k: string) => ledger.byKey.get(k)?.name || k;
    const all = [...ledger.invoices].sort((a, b) => (b.invoice_date || '').localeCompare(a.invoice_date || '') || b.created_at.localeCompare(a.created_at));
    const f = all.filter(i => {
      if (fParty && i.partyKey !== fParty) return false;
      if (fStatus === 'open') return i.rem > 0;
      if (fStatus === 'overdue') return i.overdue;
      if (fStatus === 'paid') return i.rem === 0;
      if (fStatus === 'nolink') return !i.challans.length && !(i.credited >= i.amt);
      return true;
    });
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap gap-2">
            <select className="input-industrial" aria-label="Filter by party" value={fParty} onChange={e => setFParty(e.target.value)}>
              <option value="">All parties</option>
              {ledger.parties.filter(p => p.invoices.length).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            <select className="input-industrial" aria-label="Filter by status" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="all">All statuses</option><option value="open">Open</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="nolink">No challans linked</option>
            </select>
          </div>
          <span className="text-sm text-muted-foreground">{f.length} of {all.length} shown</span>
        </div>
        <div className="card-industrial overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Party</TableHead><TableHead>Challans</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
              <TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead>File</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {f.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No invoices match these filters.</TableCell></TableRow>}
              {f.map(i => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap">{fmtD(i.invoice_date)}</TableCell>
                  <TableCell><div className="font-medium">{i.invoice_no}</div>{i.note && <div className="text-xs text-muted-foreground max-w-[220px]">{i.note}</div>}</TableCell>
                  <TableCell>{nameOf(i.partyKey)}</TableCell>
                  <TableCell>
                    {i.challans.length ? (
                      <>
                        <div>{i.challans.length} challan{i.challans.length === 1 ? '' : 's'}</div>
                        <div className="text-xs text-muted-foreground">{chNos(i.challans, 4)} · {fmtPaise(i.challanSum)}</div>
                        {i.amt < i.challanSum && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100" title="The invoice total is lower than the value of the challans linked to it">Below challans</Badge>}
                      </>
                    ) : i.credited >= i.amt ? <span className="text-muted-foreground">–</span> : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">No challans</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPaise(i.amt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPaise(i.paid)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPaise(i.rem)}</TableCell>
                  <TableCell className="whitespace-nowrap">{i.due_date ? fmtD(i.due_date) : <span className="text-muted-foreground">–</span>}</TableCell>
                  <TableCell><InvoicePill i={i} /></TableCell>
                  <TableCell>{i.file_path ? <button className="text-primary underline text-sm" onClick={() => viewFile(i.file_path!)}>View</button> : null}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openInvoice(i)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'invoice', inv: i })}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  };

  const paymentsView = () => {
    if (!ledger.payments.length) return <Empty title="No payments recorded" text="Record each payment when it arrives. It reduces the party's dues straight away, against a chosen invoice or the oldest unpaid one." />;
    const all = [...ledger.payments].sort((a, b) => (b.paid_on || '').localeCompare(a.paid_on || '') || b.created_at.localeCompare(a.created_at));
    return (
      <div className="card-industrial overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead>Mode / reference</TableHead><TableHead>Applied to</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {all.map(x => (
              <TableRow key={x.id}>
                <TableCell className="whitespace-nowrap">{fmtD(x.paid_on)}</TableCell>
                <TableCell><div className="font-medium">{ledger.byKey.get(x.partyKey)?.name || x.party}</div>{x.note && <div className="text-xs text-muted-foreground max-w-[280px]">{x.note}</div>}</TableCell>
                <TableCell>{x.mode}{x.reference && <div className="text-xs text-muted-foreground">{x.reference}</div>}</TableCell>
                <TableCell>{x.applied}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPaise(x.amt)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => openPayment(x)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'payment', pay: x })}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const challansView = () => {
    if (!ledger.challans.length) return <Empty title="No challans found" text="Challans created in the dyeing software appear here so every one can be matched to an invoice." />;
    const cnt = { pending: 0, invoiced: 0, earlier: 0, exempt: 0 };
    ledger.challans.forEach(c => { cnt[c.state]++; });
    let f = ledger.challans.filter(c => (!fcParty || c.partyKey === fcParty) && (fcStatus === 'all' || c.state === fcStatus));
    if (fcStatus !== 'pending') f = [...f].reverse();
    const partyOpts = [...new Map(ledger.challans.map(c => [c.partyKey, ledger.byKey.get(c.partyKey)?.name || c.party])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const allSel = f.length > 0 && f.every(c => sel.has(c.id));
    const selList = [...sel].map(id => ledger.challans.find(c => c.id === id)).filter(Boolean) as ChallanView[];
    const selOpen = selList.filter(c => c.state !== 'invoiced');
    const oneParty = new Set(selOpen.map(c => c.partyKey)).size === 1;
    const busy = setStatus.isPending;
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <select className="input-industrial" aria-label="Filter by party" value={fcParty} onChange={e => setFcParty(e.target.value)}>
            <option value="">All parties</option>
            {partyOpts.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <select className="input-industrial" aria-label="Filter by status" value={fcStatus} onChange={e => setFcStatus(e.target.value)}>
            <option value="pending">Not invoiced ({cnt.pending})</option><option value="invoiced">Invoiced ({cnt.invoiced})</option>
            <option value="earlier">Invoiced earlier ({cnt.earlier})</option><option value="exempt">No invoice needed ({cnt.exempt})</option><option value="all">All challans ({ledger.challans.length})</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Challans come live from the dyeing software. A challan listed on an invoice counts as invoiced; deleting that invoice puts it back here.</p>
        {selList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-primary/10 rounded-md px-3 py-2 mb-3">
            <span className="font-medium mr-auto text-sm">{selList.length} selected · {fmtPaise(selList.reduce((a, c) => a + c.amt, 0))}</span>
            <Button size="sm" disabled={!oneParty || busy} title={oneParty ? '' : 'Select challans of one party to create an invoice'}
              onClick={() => openInvoice(null, { party: ledger.byKey.get(selOpen[0].partyKey)?.name, challan_ids: selOpen.map(c => c.id) })}>Create invoice</Button>
            <Button size="sm" variant="outline" disabled={!selOpen.length || busy} onClick={() => applyStatus('earlier')}>Mark invoiced earlier</Button>
            <Button size="sm" variant="outline" disabled={!selOpen.length || busy} onClick={() => applyStatus('exempt')}>No invoice needed</Button>
            <Button size="sm" variant="outline" disabled={!selOpen.length || busy} onClick={() => applyStatus(null)}>Back to not invoiced</Button>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
          </div>
        )}
        <div className="card-industrial overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-9"><Checkbox checked={allSel} onCheckedChange={v => setSel(prev => { const n = new Set(prev); f.forEach(c => (v ? n.add(c.id) : n.delete(c.id))); return n; })} aria-label="Select all shown" /></TableHead>
              <TableHead>Challan</TableHead><TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead className="text-right">Weight (kg)</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {f.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{fcStatus === 'pending' ? 'Every challan here has an invoice or has been marked as not needing one.' : 'No challans match these filters.'}</TableCell></TableRow>}
              {f.map(c => (
                <TableRow key={c.id}>
                  <TableCell><Checkbox checked={sel.has(c.id)} onCheckedChange={v => setSel(prev => { const n = new Set(prev); if (v) n.add(c.id); else n.delete(c.id); return n; })} aria-label={`Select challan ${c.no}`} /></TableCell>
                  <TableCell className="font-medium">{c.no}{c.kind === 'edy' && <span className="ml-1.5 text-xs text-muted-foreground">EDY</span>}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtD(c.date)}</TableCell>
                  <TableCell>{ledger.byKey.get(c.partyKey)?.name || c.party}</TableCell>
                  <TableCell className="text-right tabular-nums">{kgf(c.kg)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.kind === 'edy' ? <span className="text-muted-foreground">–</span> : fmtPaise(c.amt)}</TableCell>
                  <TableCell><ChallanPill c={c} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Value is the challan total before GST (item amounts plus paper tube surcharge).</p>
      </>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Party Ledger</h1>
          <p className="text-sm text-muted-foreground">Invoices raised, payments received and what each party owes — visible to admins only.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openInvoice(null, ctxParty ? { party: ctxParty } : null)}><Plus className="w-4 h-4 mr-1.5" />Add invoice</Button>
          <Button onClick={() => openPayment(null, ctxParty ? { party: ctxParty } : null)}>Record payment</Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Could not load the ledger ({error.message || 'unknown error'}). {String(error.message || '').includes('does not exist') || error.code === 'PGRST205'
            ? 'The ledger tables have not been created in this database yet.' : 'Reload the page to try again.'}
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Tile label="Total due" value={fmtPaise(t.due, true)} sub={`from ${openParties} part${openParties === 1 ? 'y' : 'ies'}`} tone="main" />
            <Tile label="Challans not invoiced" value={String(t.pendingCount)} sub={`worth ${fmtPaise(t.pendingValue, true)} before GST`} tone={t.pendingCount > 0 ? 'warn' : undefined}
              onClick={() => { setFcStatus('pending'); setFcParty(''); setTab('challans'); }} />
            <Tile label="Overdue" value={fmtPaise(t.overdue, true)} sub="past the due date" tone={t.overdue > 0 ? 'bad' : undefined} />
            <Tile label="Billed" value={fmtPaise(t.billed - t.credit, true)} sub={`${ledger.invoices.length} invoice${ledger.invoices.length === 1 ? '' : 's'}${t.credit > 0 ? ` · after ${fmtPaise(t.credit, true)} credit notes` : ''}`} />
            <Tile label="Received" value={fmtPaise(t.received, true)} sub={`${receivedCount} payment${receivedCount === 1 ? '' : 's'}`} />
          </div>

          <Tabs value={tab} onValueChange={v => { setTab(v as Tab); setPartyKeySel(null); }}>
            <TabsList>
              <TabsTrigger value="parties">Parties <span className="ml-1.5 text-xs opacity-70">{ledger.parties.length}</span></TabsTrigger>
              <TabsTrigger value="invoices">Invoices <span className="ml-1.5 text-xs opacity-70">{ledger.invoices.length}</span></TabsTrigger>
              <TabsTrigger value="payments">Payments <span className="ml-1.5 text-xs opacity-70">{ledger.payments.length}</span></TabsTrigger>
              <TabsTrigger value="challans">Challans <span className={`ml-1.5 text-xs ${t.pendingCount ? 'text-amber-700 font-semibold' : 'opacity-70'}`}>{t.pendingCount}</span></TabsTrigger>
            </TabsList>
          </Tabs>

          <div>
            {tab === 'parties' && (partyKeySel && ledger.byKey.get(partyKeySel) ? statement(ledger.byKey.get(partyKeySel)!) : partiesView())}
            {tab === 'invoices' && invoicesView()}
            {tab === 'payments' && paymentsView()}
            {tab === 'challans' && challansView()}
          </div>
        </>
      )}

      <InvoiceDialog open={invDlg.open} onClose={() => setInvDlg({ open: false })} ledger={ledger} partyNames={partyNames} editing={invDlg.editing} prefill={invDlg.prefill} />
      <PaymentDialog open={payDlg.open} onClose={() => setPayDlg({ open: false })} ledger={ledger} partyNames={partyNames} editing={payDlg.editing} prefill={payDlg.prefill} />

      <AlertDialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === 'invoice' ? `Delete invoice ${confirm.inv.invoice_no}?` : 'Delete this entry?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'invoice'
                ? 'The invoice and its attached file are removed, and its challans go back to "Not invoiced". Payments recorded against it stay and are applied to the party\'s other invoices.'
                : confirm?.kind === 'payment' ? `${confirm.pay.mode} of ${fmtPaise(confirm.pay.amt)} from ${confirm.pay.party} will be removed and the party's due goes up by that amount.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Empty: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="card-industrial p-10 text-center">
    <h3 className="font-semibold mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-md mx-auto">{text}</p>
  </div>
);

export default PartyLedger;
