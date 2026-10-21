import { describe, it, expect } from 'vitest';
import { computeLedger, fmtPaise, type LedgerInvoiceRow, type LedgerPaymentRow, type LedgerChallanInput } from '@/lib/partyLedger';

const inv = (o: Partial<LedgerInvoiceRow> & { id: string; party: string; invoice_no: string; amount: number; invoice_date: string }): LedgerInvoiceRow => ({
  due_date: null, note: null, file_path: null, file_name: null, challan_ids: [], created_at: o.invoice_date, ...o,
});
const pay = (o: Partial<LedgerPaymentRow> & { id: string; party: string; amount: number; paid_on: string }): LedgerPaymentRow => ({
  mode: 'UPI', reference: null, invoice_id: null, note: null, created_at: o.paid_on, ...o,
});
const ch = (id: string, no: string, party: string, value: number, extra: Partial<LedgerChallanInput> = {}): LedgerChallanInput => ({
  id, no, date: '2026-07-01', party, kind: 'production', kg: 10, value, ...extra,
});

const run = (i: LedgerInvoiceRow[], p: LedgerPaymentRow[], c: LedgerChallanInput[] = [], overrides = {}) =>
  computeLedger({ invoices: i, payments: p, challans: c, overrides, today: '2026-10-14' });

describe('party ledger', () => {
  it('unlinked payments settle the oldest invoice first', () => {
    const r = run(
      [inv({ id: 'a', party: 'KSP', invoice_no: '1', amount: 1000, invoice_date: '2026-01-01' }),
       inv({ id: 'b', party: 'KSP', invoice_no: '2', amount: 500, invoice_date: '2026-02-01' })],
      [pay({ id: 'p', party: 'ksp', amount: 1200, paid_on: '2026-03-01' })],
    );
    const p = r.byKey.get('ksp')!;
    expect(p.due).toBe(300 * 100);
    expect(p.invoices.map(i => i.status)).toEqual(['paid', 'partial']);
    expect(p.invoices[1].rem).toBe(300 * 100);
  });

  it('a payment linked to an invoice settles that invoice, overflow goes to the oldest', () => {
    const r = run(
      [inv({ id: 'a', party: 'X', invoice_no: '1', amount: 1000, invoice_date: '2026-01-01' }),
       inv({ id: 'b', party: 'X', invoice_no: '2', amount: 500, invoice_date: '2026-02-01' })],
      [pay({ id: 'p', party: 'X', amount: 700, paid_on: '2026-03-01', invoice_id: 'b' })],
    );
    const [a, b] = r.byKey.get('x')!.invoices;
    expect(b.status).toBe('paid');
    expect(a.paid).toBe(200 * 100);
  });

  it('a credit note reduces billed, is not counted as received, and shows as credited', () => {
    const r = run(
      [inv({ id: 'm', party: 'KSP', invoice_no: '381', amount: 37869, invoice_date: '2026-07-15' }),
       inv({ id: 'n', party: 'KSP', invoice_no: '437', amount: 19257, invoice_date: '2026-07-31' })],
      [pay({ id: 'c', party: 'KSP', amount: 37869, paid_on: '2026-08-07', mode: 'Credit note', invoice_id: 'm' })],
    );
    const p = r.byKey.get('ksp')!;
    expect(p.credit).toBe(3786900);
    expect(p.received).toBe(0);
    expect(p.due).toBe(1925700);
    expect(r.totals.received).toBe(0);
    const m = p.invoices.find(i => i.id === 'm')!;
    expect(m.rem).toBe(0);
    expect(m.credited).toBe(m.amt);
    expect(p.invoices.find(i => i.id === 'n')!.rem).toBe(1925700);
  });

  it('flags overdue invoices only when a balance remains', () => {
    const r = run(
      [inv({ id: 'a', party: 'X', invoice_no: '1', amount: 100, invoice_date: '2026-01-01', due_date: '2026-02-01' }),
       inv({ id: 'b', party: 'X', invoice_no: '2', amount: 100, invoice_date: '2026-01-02', due_date: '2026-02-01' })],
      [pay({ id: 'p', party: 'X', amount: 100, paid_on: '2026-01-10', invoice_id: 'a' })],
    );
    expect(r.invoices.find(i => i.id === 'a')!.overdue).toBe(false);
    expect(r.invoices.find(i => i.id === 'b')!.overdue).toBe(true);
    expect(r.totals.overdue).toBe(100 * 100);
  });

  it('extra payment becomes an advance (negative due)', () => {
    const r = run(
      [inv({ id: 'a', party: 'X', invoice_no: '1', amount: 100, invoice_date: '2026-01-01' })],
      [pay({ id: 'p', party: 'X', amount: 150, paid_on: '2026-01-10' })],
    );
    expect(r.byKey.get('x')!.due).toBe(-50 * 100);
    expect(r.totals.due).toBe(0);
  });

  it('challan states: invoiced / earlier / exempt / pending, EDY defaults to exempt', () => {
    const r = run(
      [inv({ id: 'a', party: 'X', invoice_no: '1', amount: 100, invoice_date: '2026-01-01', challan_ids: ['c1'] })],
      [],
      [ch('c1', '10', 'X', 80), ch('c2', '11', 'X', 50), ch('c3', '12', 'X', 60), ch('c4', '13', 'X', 70, { kind: 'edy' }), ch('c5', '14', 'x', 90)],
      { c2: 'earlier', c3: 'exempt' },
    );
    const st = Object.fromEntries(r.challans.map(c => [c.id, c.state]));
    expect(st).toEqual({ c1: 'invoiced', c2: 'earlier', c3: 'exempt', c4: 'exempt', c5: 'pending' });
    expect(r.totals.pendingCount).toBe(1);
    expect(r.totals.pendingValue).toBe(90 * 100);
    expect(r.byKey.get('x')!.pending.map(c => c.id)).toEqual(['c5']);
    expect(r.invoices[0].challanSum).toBe(80 * 100);
  });

  it('an invoice listing a challan beats a status override', () => {
    const r = run(
      [inv({ id: 'a', party: 'X', invoice_no: '1', amount: 100, invoice_date: '2026-01-01', challan_ids: ['c1'] })],
      [], [ch('c1', '10', 'X', 80)], { c1: 'exempt' },
    );
    expect(r.challans[0].state).toBe('invoiced');
  });

  it('formats rupees in Indian grouping', () => {
    expect(fmtPaise(12948300)).toBe('₹1,29,483.00');
    expect(fmtPaise(12948300, true)).toBe('₹1,29,483');
    expect(fmtPaise(-5000)).toBe('−₹50.00');
  });
});
