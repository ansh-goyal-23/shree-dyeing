import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSavePayment } from '@/hooks/usePartyLedger';
import { CREDIT_NOTE, PAYMENT_MODES, fmtPaise, partyKey, todayIso, type LedgerResult, type PaymentView } from '@/lib/partyLedger';

export interface PaymentPrefill { party?: string; invoice_id?: string; amount?: number }

interface Props {
  open: boolean;
  onClose: () => void;
  ledger: LedgerResult;
  partyNames: string[];
  editing?: PaymentView | null;
  prefill?: PaymentPrefill | null;
}

const fmtD = (s: string) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

const PaymentDialog: React.FC<Props> = ({ open, onClose, ledger, partyNames, editing, prefill }) => {
  const save = useSavePayment();
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState<string>('UPI');
  const [reference, setReference] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(''); setSaving(false);
    if (editing) {
      setParty(editing.party); setAmount(String(editing.amt / 100)); setDate(editing.paid_on); setMode(editing.mode);
      setReference(editing.reference || ''); setInvoiceId(editing.invoice_id || ''); setNote(editing.note || '');
    } else {
      setParty(prefill?.party || ''); setAmount(prefill?.amount ? String(prefill.amount / 100) : ''); setDate(todayIso()); setMode('UPI');
      setReference(''); setInvoiceId(prefill?.invoice_id || ''); setNote('');
    }
  }, [open, editing, prefill]);

  const invoices = useMemo(() => {
    const p = ledger.byKey.get(partyKey(party));
    return (p?.invoices || []).filter(i => i.rem > 0 || i.id === invoiceId);
  }, [ledger, party, invoiceId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    const p = party.trim().replace(/\s+/g, ' ');
    if (!p) return setError('Enter the party name.');
    if (!(amt > 0)) return setError('Enter an amount greater than zero.');
    if (!date) return setError('Choose the date.');
    setSaving(true); setError('');
    try {
      await save.mutateAsync({
        id: editing?.id, party: p, amount: Math.round(amt * 100) / 100, paid_on: date, mode,
        reference: reference.trim() || null, invoice_id: invoiceId && invoices.some(i => i.id === invoiceId) ? invoiceId : null,
        note: note.trim() || null,
      });
      toast.success(editing ? 'Entry updated.' : mode === CREDIT_NOTE ? 'Credit note recorded.' : 'Payment recorded.');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit payment' : 'Record payment'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          <div className="space-y-1.5">
            <Label htmlFor="pay-party">Party</Label>
            <Input id="pay-party" list="ledger-parties-pay" value={party} onChange={e => setParty(e.target.value)} placeholder="Choose or type a party name" />
            <datalist id="ledger-parties-pay">{partyNames.map(n => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="pay-amt">{mode === CREDIT_NOTE ? 'Credit note amount (₹)' : 'Amount received (₹)'}</Label><Input id="pay-amt" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="pay-date">Date</Label><Input id="pay-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-mode">Mode</Label>
              <select id="pay-mode" className="input-industrial w-full" value={mode} onChange={e => setMode(e.target.value)}>
                {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="pay-ref">Reference (optional)</Label><Input id="pay-ref" value={reference} onChange={e => setReference(e.target.value)} placeholder="UTR / cheque no. / CN no." /></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-inv">Against invoice</Label>
            <select id="pay-inv" className="input-industrial w-full" value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
              <option value="">Oldest unpaid invoice first</option>
              {invoices.map(i => <option key={i.id} value={i.id}>{i.invoice_no} · {fmtD(i.invoice_date)} · balance {fmtPaise(i.rem)}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Leave on the first option to apply it to the oldest unpaid invoice. A credit note reduces the amount billed; it is not counted as money received.</p>
          </div>
          <div className="space-y-1.5"><Label htmlFor="pay-note">Note (optional)</Label><Textarea id="pay-note" value={note} onChange={e => setNote(e.target.value)} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
