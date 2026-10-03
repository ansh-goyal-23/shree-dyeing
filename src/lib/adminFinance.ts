// Admin Dashboard maths: monthly revenue vs raw yarn cost.
//
//   Revenue                = dispatched challan amounts (incl. paper-tube
//                            surcharge), by challan date, less returns
//   Raw material (yarn)    = net kg x yarn cost/kg
//   Overhead + profit      = Revenue - raw material (yarn) cost
//
// Yarn cost/kg comes from, in order: the cost snapshotted on a tiered
// client's challan line (what was actually quoted), else the effective-dated
// yarn_cost_master for that denier and month. Months that had to fall back
// to the earliest known cost are flagged "estimated"; deniers with no cost
// at all are listed so the dashboard can warn instead of silently
// overstating profit.

import { lineTotal } from '@/types/challan';
import { returnLineTotal } from '@/types/challanReturn';

export interface YarnCostRow { denier: string; effective_from: string; cost_per_kg: number }

export interface MonthRow {
  month: string;          // YYYY-MM
  revenue: number;
  kg: number;
  yarnCost: number;
  margin: number;         // overhead + profit
  marginPct: number;      // margin / revenue * 100
  estimated: boolean;     // some yarn cost came from the earliest-known fallback
  missingDeniers: string[]; // deniers with no cost anywhere (cost counted as 0)
}

export const normDenier = (d?: string | null) => (d || '').trim().toLowerCase();
export const monthKey = (dateStr: string) => (dateStr || '').slice(0, 7);

export function buildCostLookup(rows: YarnCostRow[]) {
  const byDenier = new Map<string, YarnCostRow[]>();
  for (const r of rows) {
    const k = normDenier(r.denier);
    const arr = byDenier.get(k) || [];
    arr.push({ ...r, cost_per_kg: Number(r.cost_per_kg) || 0 });
    byDenier.set(k, arr);
  }
  for (const arr of byDenier.values()) arr.sort((a, b) => a.effective_from.localeCompare(b.effective_from));

  return (denier: string, month: string): { cost: number | null; estimated: boolean } => {
    const arr = byDenier.get(normDenier(denier));
    if (!arr || arr.length === 0) return { cost: null, estimated: false };
    const start = `${month}-01`;
    let found: YarnCostRow | undefined;
    for (const r of arr) if (r.effective_from <= start) found = r;
    if (found) return { cost: found.cost_per_kg, estimated: false };
    return { cost: arr[0].cost_per_kg, estimated: true };
  };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function computeMonthly(
  challans: { id: string; date: string; challan_kind?: string }[],
  items: any[],
  returns: { id: string; date: string }[],
  returnItems: any[],
  costRows: YarnCostRow[],
): MonthRow[] {
  const lookup = buildCostLookup(costRows);
  const acc = new Map<string, { revenue: number; kg: number; yarnCost: number; estimated: boolean; missing: Set<string> }>();
  const get = (m: string) => {
    let a = acc.get(m);
    if (!a) { a = { revenue: 0, kg: 0, yarnCost: 0, estimated: false, missing: new Set() }; acc.set(m, a); }
    return a;
  };

  const challanById = new Map(challans.map(c => [c.id, c]));
  for (const it of items) {
    const c = challanById.get(it.challan_id);
    if (!c || c.challan_kind === 'edy') continue;
    const m = monthKey(c.date);
    if (!m) continue;
    const a = get(m);
    const kg = Number(it.net_weight) || 0;
    a.revenue += lineTotal(it);
    a.kg += kg;
    const snap = Number(it.yarn_cost) || 0;
    if (snap > 0) { a.yarnCost += kg * snap; continue; }
    const { cost, estimated } = lookup(it.denier, m);
    if (cost === null) { if (kg > 0) a.missing.add((it.denier || '(blank)').trim() || '(blank)'); }
    else { a.yarnCost += kg * cost; if (estimated) a.estimated = true; }
  }

  const returnById = new Map(returns.map(r => [r.id, r]));
  for (const it of returnItems) {
    const r = returnById.get(it.return_id);
    if (!r) continue;
    const m = monthKey(r.date);
    if (!m) continue;
    const a = get(m);
    const kg = Number(it.returned_net_weight) || 0;
    a.revenue -= returnLineTotal({ amount: it.amount, paper_tube_surcharge: it.paper_tube_surcharge });
    a.kg -= kg;
    const { cost, estimated } = lookup(it.denier, m);
    if (cost === null) { if (kg > 0) a.missing.add((it.denier || '(blank)').trim() || '(blank)'); }
    else { a.yarnCost -= kg * cost; if (estimated) a.estimated = true; }
  }

  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, a]) => {
      const revenue = r2(a.revenue);
      const yarnCost = r2(a.yarnCost);
      const margin = r2(revenue - yarnCost);
      return {
        month, revenue, kg: Math.round(a.kg * 1000) / 1000, yarnCost, margin,
        marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
        estimated: a.estimated,
        missingDeniers: [...a.missing].sort(),
      };
    });
}

export function sumMonths(rows: MonthRow[]) {
  const revenue = r2(rows.reduce((s, r) => s + r.revenue, 0));
  const yarnCost = r2(rows.reduce((s, r) => s + r.yarnCost, 0));
  const margin = r2(revenue - yarnCost);
  return {
    revenue, yarnCost, margin,
    kg: Math.round(rows.reduce((s, r) => s + r.kg, 0) * 1000) / 1000,
    marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
  };
}
