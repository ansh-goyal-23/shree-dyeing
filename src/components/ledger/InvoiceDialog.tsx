import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { removeInvoiceFile, uploadInvoiceFile, useSaveInvoice } from '@/hooks/usePartyLedger';
import { fmtPaise, partyKey, todayIso, type ChallanView, type InvoiceView, type LedgerResult } from '@/lib/partyLedger';

const GST = 5; // job-work GST, used only for the "with GST" suggestion

export interface InvoicePrefill { party?: string; challan_ids?: string[] }

interface Props {
  open: boolean;
  onClose: () => void;
  ledger: LedgerResult;
  partyNames: string[];
  editing?: InvoiceView | null;
  prefill?: InvoicePrefill | null;
}

const fmtD = (s: string) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

const InvoiceDialog: React.FC<Props> = ({ open, onClose, ledger, partyNames, editing, prefill }) => {
  const save = useSaveInvoice();
  const [party, setParty] = useState('');
  const [no, setNo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [noLinkOk, setNoLinkOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(''); setNoLinkOk(false); setFile(null); setSaving(false);
    if (editing) {
      setParty(editing.party); setNo(editing.invoice_no); setAmount(String(editing.amt / 100));
      setDate(editing.invoice_date); setDue(editing.due_date || ''); setNote(editing.note || '');
      setPicked(new Set(editing.challan_ids));
    } else {
      setParty(prefill?.party || ''); setNo(''); setAmount(''); setDate(todayIso()); setDue(''); setNote('');
      setPicked(new Set(prefill?.challan_ids || []));
    }
  }, [open, editing, prefill]);

  const key = partyKey(party);
  const available: ChallanView[] = useMemo(
    () => ledger.challans.filter(c =>
      c.partyKey === key && (c.state === 'pending' || (editing && c.invoices.some(i => i.id === editing.id)) || picked.has(c.id))),
    [ledger.challans, key, editing, picked],
  );
  // drop ticks that no longer belong to the chosen party
  useEffect(() => {
    const ids = new Set(available.map(c => c.id));
    setPicked(prev => {
      const next = new Set([...prev].filter(id => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [available]);

  const sum = available.filter(c => picked.has(c.id)).reduce((a, c) => a + c.amt, 0);
  const withGst = Math.round((sum * (100 + GST)) / 100);
  const allOn = available.length > 0 && available.every(c => picked.has(c.id));

  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    const p = party.trim().replace(/\s+/g, ' ');
    if (!p) return setError('Enter the party name.');
    if (!no.trim()) return setError('Enter the invoice number.');
    if (!(amt > 0)) return setError('Enter an invoice total greater than zero.');
    if (!date) return setError('Choose the invoice date.');
    if (due && due < date) return setError('The due date is before the invoice date.');
    if (!picked.size && available.length && !noLinkOk) {
      setNoLinkOk(true);
      return setError('No challans are ticked. Tick the challans this invoice covers, or press Save again to save without linking.');
    }
    setSaving(true); setError('');
    let uploaded: string | null = null;
    try {
      let file_path = editing?.file_path ?? null;
      let file_name = editing?.file_name ?? null;
      if (file) {
        uploaded = await uploadInvoiceFile(file);
        file_path = uploaded; file_name = file.name;
      }
      await save.mutateAsync({
        id: editing?.id, party: p, invoice_no: no.trim(), amount: Math.round(amt * 100) / 100,
        invoice_date: date, due_date: due || null, note: note.trim() || null,
        challan_ids: [...picked], file_path, file_name,
      });
      if (uploaded && editing?.file_path) await removeInvoiceFile(editing.file_path); // replaced
      toast.success(editing ? 'Invoice updated.' : 'Invoice added.');
      onClose();
    } catch (err: any) {
      if (uploaded) await removeInvoiceFile(uploaded);
      setError(err.message || 'Could not save the invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && !saving && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit invoice' : 'Add invoice'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          <div className="space-y-1.5">
            <Label htmlFor="inv-party">Party</Label>
            <Input id="inv-party" list="ledger-parties" value={party} onChange={e => setParty(e.target.value)} placeholder="Choose or type a party name" />
            <datalist id="ledger-parties">{partyNames.map(n => <option key={n} value={n} />)}</datalist>
          </div>

          <div className="rounded-md border">
            <div className="flex items-center justify-between px-3 py-2 border-b text-xs font-medium text-muted-foreground">
              <span>Challans covered by this invoice</span>
              {available.length > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={allOn} onCheckedChange={v => setPicked(v ? new Set(available.map(c => c.id)) : new Set())} /> Select all
                </label>
              )}
            </div>
            {!key ? (
              <p className="p-3 text-sm text-muted-foreground">Choose a party to see its challans that still need an invoice.</p>
            ) : !available.length ? (
              <p className="p-3 text-sm text-muted-foreground">This party has no challans waiting for an invoice. You can still save the invoice without linking any.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y">
                {available.map(c => (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={picked.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <span className="flex-1 min-w-0"><b>{c.no}</b> <span className="text-xs text-muted-foreground">{fmtD(c.date)} · {c.kg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg</span></span>
                    <span className="tabular-nums">{fmtPaise(c.amt)}</span>
                  </label>
                ))}
              </div>
            )}
            {available.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t text-sm">
                {picked.size ? (
                  <>
                    <span>{picked.size} selected · <b className="tabular-nums">{fmtPaise(sum)}</b> before GST</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setAmount(String(withGst / 100))}>
                      Use {fmtPaise(withGst)} with {GST}% GST as total
                    </Button>
                  </>
                ) : <span className="text-muted-foreground">Tick the challans this invoice bills for.</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="inv-no">Invoice number</Label><Input id="inv-no" value={no} onChange={e => setNo(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="inv-amt">Invoice total (₹, incl. GST)</Label><Input id="inv-amt" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="inv-date">Invoice date</Label><Input id="inv-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="inv-due">Due date (optional)</Label><Input id="inv-due" type="date" value={due} onChange={e => setDue(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="inv-note">Note (optional)</Label><Textarea id="inv-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. lot details" /></div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-file">Invoice file (PDF or photo)</Label>
            <Input id="inv-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">
              {editing?.file_name ? `Current file: ${editing.file_name}. Choose another to replace it.` : 'Optional. Up to 20 MB.'}
            </p>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save invoice</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDialog;
