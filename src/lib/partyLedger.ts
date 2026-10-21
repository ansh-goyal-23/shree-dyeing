// Party Ledger maths. Pure functions (no React, no Supabase) so they can be tested.
//
// All money is handled in paise (integers) to avoid float drift.
//  * Payments linked to an invoice settle that invoice first; every other
//    payment (and any overflow) is applied to the oldest unpaid invoices.
//  * A "Credit note" payment reduces what was billed; it is not money received.
//  * A challan is "invoiced" when any invoice lists it. Otherwise it needs an
//    invoice, unless marked "invoiced earlier" / "no invoice needed". EDY
//    challans are not billed, so they default to "no invoice needed".

export const CREDIT_NOTE = 'Credit note';
export const PAYMENT_MODES = ['UPI', 'NEFT / RTGS', 'Cheque', 'Cash', CREDIT_NOTE, 'Other'] as const;

export interface LedgerInvoiceRow {
  id: string;
  party: string;
  invoice_no: string;
  amount: number; // rupees, incl. GST
  invoice_date: string; // YYYY-MM-DD
  due_date: string | null;
  note: string | null;
  file_path: string | null;
  file_name: string | null;
  challan_ids: string[];
  created_at: string;
}

export interface LedgerPaymentRow {
  id: string;
  party: string;
  amount: number; // rupees
  paid_on: string;
  mode: string;
  reference: string | null;
  invoice_id: string | null;
  note: string | null;
  created_at: string;
}

export type ChallanOverride = 'earlier' | 'exempt';
export type ChallanState = 'invoiced' | 'earlier' | 'exempt' | 'pending';

export interface LedgerChallanInput {
  id: string;
  no: string;
  date: string;
  party: string;
  kind: 'production' | 'edy';
  kg: number;
  value: number; // rupees before GST (items + paper tube surcharge)
}

export const toPaise = (v: number | string | null | undefined) => Math.round(Number(v || 0) * 100);
export const partyKey = (name: string | null | undefined) => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const cmp = (a: string, b: string) => a.localeCompare(b);
const numCmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export interface InvoiceView extends Omit<LedgerInvoiceRow, 'amount'> {
  amt: number;
  paid: number;
  credited: number;
  rem: number;
  status: 'paid' | 'partial' | 'unpaid';
  overdue: boolean;
  challans: ChallanView[];
  challanSum: number;
  partyKey: string;
}

export interface PaymentView extends Omit<LedgerPaymentRow, 'amount'> {
  amt: number;
  isCredit: boolean;
  applied: string;
  partyKey: string;
}

export interface ChallanView extends LedgerChallanInput {
  amt: number;
  partyKey: string;
  state: ChallanState;
  invoices: InvoiceView[];
  ageDays: number;
}

export interface PartyView {
  key: string;
  name: string;
  invoices: InvoiceView[];
  payments: PaymentView[];
  billed: number;
  received: number;
  credit: number;
  due: number; // billed - received - credit (negative = advance)
  overdue: number;
  pending: ChallanView[];
  pendingValue: number;
}

export interface LedgerResult {
  parties: PartyView[];
  byKey: Map<string, PartyView>;
  invoices: InvoiceView[];
  payments: PaymentView[];
  challans: ChallanView[];
  totals: {
    billed: number;
    received: number;
    credit: number;
    due: number;
    overdue: number;
    pendingCount: number;
    pendingValue: number;
  };
}

function daysBetween(fromIso: string, today: string): number {
  if (!fromIso) return 0;
  const [y, m, d] = fromIso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d);
  return Math.max(0, Math.floor(ms / 864e5));
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function computeLedger(input: {
  invoices: LedgerInvoiceRow[];
  payments: LedgerPaymentRow[];
  challans: LedgerChallanInput[];
  overrides: Record<string, ChallanOverride>;
  /** Extra names (e.g. every client) so the first-seen spelling wins for display. */
  knownParties?: string[];
  today?: string;
}): LedgerResult {
  const today = input.today ?? todayIso();

  // Display name per party key: known client spelling first, otherwise first seen.
  const names = new Map<string, string>();
  const see = (n: string | null | undefined) => {
    const k = partyKey(n);
    if (k && !names.has(k)) names.set(k, String(n).trim().replace(/\s+/g, ' '));
  };
  (input.knownParties || []).forEach(see);
  input.invoices.forEach(i => see(i.party));
  input.payments.forEach(p => see(p.party));
  input.challans.forEach(c => see(c.party));

  const parties = new Map<string, PartyView>();
  const get = (k: string) => {
    let p = parties.get(k);
    if (!p) {
      p = { key: k, name: names.get(k) || k, invoices: [], payments: [], billed: 0, received: 0, credit: 0, due: 0, overdue: 0, pending: [], pendingValue: 0 };
      parties.set(k, p);
    }
    return p;
  };

  const invoices: InvoiceView[] = input.invoices.map(i => {
    const view: InvoiceView = {
      ...i, amt: toPaise(i.amount), paid: 0, credited: 0, rem: 0, status: 'unpaid', overdue: false,
      challans: [], challanSum: 0, partyKey: partyKey(i.party),
    };
    const p = get(view.partyKey);
    p.invoices.push(view);
    p.billed += view.amt;
    return view;
  });

  const payments: PaymentView[] = input.payments.map(x => {
    const view: PaymentView = {
      ...x, amt: toPaise(x.amount), isCredit: x.mode === CREDIT_NOTE, applied: 'On account', partyKey: partyKey(x.party),
    };
    const p = get(view.partyKey);
    p.payments.push(view);
    if (view.isCredit) p.credit += view.amt;
    else p.received += view.amt;
    return view;
  });

  const invById = new Map<string, InvoiceView>();
  const totals = { billed: 0, received: 0, credit: 0, due: 0, overdue: 0, pendingCount: 0, pendingValue: 0 };

  parties.forEach(p => {
    p.invoices.sort((a, b) => cmp(a.invoice_date || '', b.invoice_date || '') || cmp(a.created_at || '', b.created_at || ''));
    p.payments.sort((a, b) => cmp(a.paid_on || '', b.paid_on || '') || cmp(a.created_at || '', b.created_at || ''));
    const byId = new Map<string, InvoiceView>();
    p.invoices.forEach(i => { byId.set(i.id, i); invById.set(i.id, i); });

    let pool = 0;
    p.payments.forEach(x => {
      const inv = x.invoice_id ? byId.get(x.invoice_id) : undefined;
      if (inv) {
        const take = Math.min(x.amt, inv.amt - inv.paid);
        inv.paid += take;
        if (x.isCredit) inv.credited += take;
        pool += x.amt - take;
        x.applied = (x.isCredit ? 'Credit note against invoice ' : 'Invoice ') + inv.invoice_no;
      } else pool += x.amt;
    });
    p.invoices.forEach(i => {
      const take = Math.min(pool, i.amt - i.paid);
      i.paid += take;
      pool -= take;
    });
    p.invoices.forEach(i => {
      i.rem = i.amt - i.paid;
      i.status = i.rem === 0 ? 'paid' : i.paid > 0 ? 'partial' : 'unpaid';
      i.overdue = i.rem > 0 && !!i.due_date && i.due_date < today;
      if (i.overdue) p.overdue += i.rem;
    });
    p.due = p.billed - p.received - p.credit;
    totals.billed += p.billed;
    totals.received += p.received;
    totals.credit += p.credit;
    totals.overdue += p.overdue;
    if (p.due > 0) totals.due += p.due;
  });

  // challans
  const challans: ChallanView[] = input.challans.map(c => ({
    ...c, amt: toPaise(c.value), partyKey: partyKey(c.party), state: 'pending' as ChallanState, invoices: [], ageDays: 0,
  }));
  const chById = new Map(challans.map(c => [c.id, c]));
  const linkedBy = new Map<string, InvoiceView[]>();
  invById.forEach(i => (i.challan_ids || []).forEach(id => {
    const l = linkedBy.get(id) || [];
    l.push(i);
    linkedBy.set(id, l);
  }));
  challans.forEach(c => {
    c.invoices = linkedBy.get(c.id) || [];
    const ov = input.overrides[c.id];
    if (c.invoices.length) c.state = 'invoiced';
    else if (ov) c.state = ov;
    else c.state = c.kind === 'edy' ? 'exempt' : 'pending';
    c.ageDays = daysBetween(c.date, today);
    if (c.state === 'pending') {
      const p = get(c.partyKey);
      p.pending.push(c);
      p.pendingValue += c.amt;
      totals.pendingCount++;
      totals.pendingValue += c.amt;
    }
  });
  invoices.forEach(i => (i.challan_ids || []).forEach(id => {
    const c = chById.get(id);
    if (c) { i.challans.push(c); i.challanSum += c.amt; }
  }));

  const byDateNo = (a: ChallanView, b: ChallanView) => cmp(a.date || '', b.date || '') || numCmp(a.no, b.no);
  challans.sort(byDateNo);
  parties.forEach(p => p.pending.sort(byDateNo));

  const list = Array.from(parties.values()).sort(
    (a, b) => b.due - a.due || b.pendingValue - a.pendingValue || a.name.localeCompare(b.name),
  );
  return { parties: list, byKey: parties, invoices, payments, challans, totals };
}

/** "₹1,23,456.00" from paise; trim drops ".00". */
export function fmtPaise(p: number, trim = false): string {
  const neg = p < 0;
  const a = Math.abs(p);
  const whole = a % 100 === 0;
  const s = (a / 100).toLocaleString('en-IN', {
    minimumFractionDigits: trim && whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return (neg ? '−' : '') + '₹' + s;
}
