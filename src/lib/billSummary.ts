// Builds the "sample bill" table (Line / Item / Qty / Rate / Amount) the
// accountant uses to raise the real GST invoice.
//
// Challans are rolled up rate-wise: every challan line with the same denier
// AND the same rate becomes one bill line, exactly like the final invoice
// (e.g. "Polyester Yarn 150/0 Dyed Yarn  67.34 kg @ 250.00"). Amounts are the
// snapshotted challan-line amounts (never re-derived), so the bill always
// reconciles with the challans. Paper-tube cone surcharge is kept as its own
// line because it is never folded into rate/amount (see lineTotal()).
//
// Return challans against the selected challans can be netted in as negative
// quantity/amount, mirroring the negative rows in the Excel export.

export interface BillLine {
  line: number;
  item: string;
  denier: string;
  /** Qty in kg. Null for the surcharge line. */
  qty: number | null;
  /** Null for the surcharge line. */
  rate: number | null;
  amount: number;
  challans: string[];
}

export interface BillSummary {
  lines: BillLine[];
  totalQty: number;
  /** Taxable value, i.e. before GST / round-off. */
  subtotal: number;
}

interface SrcItem {
  challan_id: string;
  denier?: string | null;
  net_weight?: number | string | null;
  rate?: number | string | null;
  amount?: number | string | null;
  paper_tube_surcharge?: number | string | null;
}

interface SrcReturnItem {
  original_challan_id: string;
  denier?: string | null;
  returned_net_weight?: number | string | null;
  rate?: number | string | null;
  amount?: number | string | null;
  paper_tube_surcharge?: number | string | null;
}

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function buildBill(
  items: SrcItem[],
  returnItems: SrcReturnItem[],
  challanNumberById: Map<string, string>,
): BillSummary {
  const groups = new Map<string, { denier: string; rate: number; qty: number; amount: number; challans: Set<string> }>();
  let surcharge = 0;

  const add = (denier: string, rate: number, qty: number, amount: number, challanId: string | null) => {
    const key = `${denier}|${rate}`;
    const g = groups.get(key) || { denier, rate, qty: 0, amount: 0, challans: new Set<string>() };
    g.qty += qty;
    g.amount += amount;
    if (challanId) {
      const num = challanNumberById.get(challanId);
      if (num) g.challans.add(num);
    }
    groups.set(key, g);
  };

  for (const i of items) {
    add((i.denier || '').trim(), n(i.rate), n(i.net_weight), n(i.amount), i.challan_id);
    surcharge += n(i.paper_tube_surcharge);
  }
  // Returns net out against the same denier+rate group; they never add a
  // challan number to the group's "Ch. No." list.
  for (const r of returnItems) {
    add((r.denier || '').trim(), n(r.rate), -n(r.returned_net_weight), -n(r.amount), null);
    surcharge -= n(r.paper_tube_surcharge);
  }

  const sorted = [...groups.values()]
    .filter(g => Math.abs(g.qty) > 0.0005 || Math.abs(g.amount) > 0.005)
    .sort((a, b) => a.denier.localeCompare(b.denier, undefined, { numeric: true }) || a.rate - b.rate);

  const lines: BillLine[] = sorted.map((g, idx) => ({
    line: idx + 1,
    item: g.denier ? `Polyester Yarn — ${g.denier} Dyed Yarn` : 'Polyester Yarn',
    denier: g.denier,
    qty: r3(g.qty),
    rate: g.rate,
    amount: r2(g.amount),
    challans: [...g.challans].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  }));

  if (Math.abs(surcharge) > 0.005) {
    lines.push({
      line: lines.length + 1,
      item: 'Paper tube extra cone surcharge',
      denier: '',
      qty: null,
      rate: null,
      amount: r2(surcharge),
      challans: [],
    });
  }

  return {
    lines,
    totalQty: r3(lines.reduce((s, l) => s + (l.qty ?? 0), 0)),
    subtotal: r2(lines.reduce((s, l) => s + l.amount, 0)),
  };
}
