import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useChallans } from '@/hooks/useChallan';
import { useChallanReturns, useAllChallanReturnItems } from '@/hooks/useChallanReturn';
import { useYarnCostMaster, useSaveYarnCost, useDeleteYarnCost } from '@/hooks/useYarnCostMaster';
import { computeMonthly, sumMonths, normDenier, type MonthRow } from '@/lib/adminFinance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Two-series palette (colorblind-safe pair); identity also carried by the
// legend and the table below, never by colour alone.
const C_YARN = '#4C78A8';
const C_MARGIN = '#F58518';

const inr = (v: number) => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const inr2 = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (a >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (a >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
};
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

const Tile: React.FC<{ label: string; value: string; sub?: string; swatch?: string }> = ({ label, value, sub, swatch }) => (
  <div className="card-industrial p-4">
    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
      {swatch && <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: swatch }} />}
      {label}
    </div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

const ChartTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const r: MonthRow = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-md p-3 text-xs space-y-1">
      <div className="font-semibold text-sm">{monthLabel(r.month)}</div>
      <div>Revenue: <b>{inr(r.revenue)}</b></div>
      <div><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: C_YARN }} />Raw yarn cost: <b>{inr(r.yarnCost)}</b></div>
      <div><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: C_MARGIN }} />Overhead + profit: <b>{inr(r.margin)}</b> ({r.marginPct}%)</div>
      <div className="text-muted-foreground">{r.kg.toFixed(1)} kg dispatched</div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { data: challans = [], isLoading: l1 } = useChallans();
  const { data: items = [], isLoading: l2 } = useQuery({
    queryKey: ['all_challan_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('challan_items').select('*');
      if (error) throw error;
      return data || [];
    },
  });
  const { data: returns = [] } = useChallanReturns();
  const { data: returnItems = [] } = useAllChallanReturnItems();
  const { data: costRows = [], isLoading: l3, error: costErr } = useYarnCostMaster();

  const [range, setRange] = useState<'6' | '12' | 'all'>('12');

  const allMonths = useMemo(
    () => computeMonthly(challans as any[], items as any[], returns as any[], returnItems as any[], costRows),
    [challans, items, returns, returnItems, costRows],
  );
  const months = useMemo(() => (range === 'all' ? allMonths : allMonths.slice(-Number(range))), [allMonths, range]);
  const totals = useMemo(() => sumMonths(months), [months]);
  const missing = useMemo(() => [...new Set(months.flatMap(m => m.missingDeniers))], [months]);
  const anyEstimated = months.some(m => m.estimated);
  const loading = l1 || l2 || l3;

  // ---- Yarn cost tab state ----
  const save = useSaveYarnCost();
  const del = useDeleteYarnCost();
  const [form, setForm] = useState({ denier: '', effective_from: new Date().toISOString().slice(0, 7) + '-01', cost: '' });
  const knownDeniers = useMemo(
    () => [...new Set((items as any[]).map(i => (i.denier || '').trim()).filter(Boolean))].sort(),
    [items],
  );
  const uncosted = knownDeniers.filter(d => !costRows.some(r => normDenier(r.denier) === normDenier(d)));

  const submitCost = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(form.cost);
    if (!form.denier.trim()) { toast.error('Enter a denier.'); return; }
    if (!form.effective_from) { toast.error('Pick an effective date.'); return; }
    if (isNaN(cost) || cost < 0) { toast.error('Enter a valid cost per kg.'); return; }
    try {
      await save.mutateAsync({ denier: form.denier, effective_from: form.effective_from, cost_per_kg: cost });
      toast.success('Yarn cost saved.');
      setForm(f => ({ ...f, denier: '', cost: '' }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to save yarn cost.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Private business figures — visible to admins only.</p>
        </div>
      </div>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">Monthly Revenue &amp; Margin</TabsTrigger>
          <TabsTrigger value="yarn">Yarn Cost</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-5 mt-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Period</Label>
            <select value={range} onChange={e => setRange(e.target.value as any)} className="input-industrial w-44">
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="all">All time</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : months.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No dispatches yet.</p>
          ) : (
            <>
              {costErr && (
                <div className="flex items-start gap-2 text-sm rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Could not read the yarn cost table. Run the <code>20261003_yarn_cost_master</code> SQL first — until then yarn cost shows as 0.</span>
                </div>
              )}
              {missing.length > 0 && (
                <div className="flex items-start gap-2 text-sm rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>No yarn cost set for <b>{missing.join(', ')}</b> — counted as ₹0, so overhead + profit is overstated for those months. Add them in the Yarn Cost tab.</span>
                </div>
              )}
              {anyEstimated && (
                <p className="text-xs text-muted-foreground">
                  Months marked ~ use the earliest known yarn cost, because no cost was recorded as effective that early.
                </p>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Tile label="Total revenue" value={inr(totals.revenue)} sub={`${totals.kg.toFixed(1)} kg dispatched`} />
                <Tile label="Raw material (yarn) cost" value={inr(totals.yarnCost)} swatch={C_YARN} />
                <Tile label="Overhead + profit" value={inr(totals.margin)} swatch={C_MARGIN} sub="Revenue − yarn cost" />
                <Tile label="Margin" value={`${totals.marginPct}%`} sub={totals.kg > 0 ? `${inr2(totals.margin / totals.kg)} per kg` : undefined} />
              </div>

              <div className="card-industrial p-4">
                <h2 className="text-sm font-medium mb-1">Revenue split by month</h2>
                <p className="text-xs text-muted-foreground mb-3">Each bar is the month's revenue: raw yarn cost plus overhead + profit.</p>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                      <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickFormatter={compact} tickLine={false} axisLine={false} fontSize={12} width={56} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="yarnCost" name="Raw yarn cost" stackId="a" fill={C_YARN} stroke="hsl(var(--card))" strokeWidth={2} />
                      <Bar dataKey="margin" name="Overhead + profit" stackId="a" fill={C_MARGIN} stroke="hsl(var(--card))" strokeWidth={2} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card-industrial overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Kg</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Raw yarn cost</TableHead>
                      <TableHead className="text-right">Overhead + profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...months].reverse().map(m => (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium">
                          {monthLabel(m.month)}{m.estimated ? ' ~' : ''}
                          {m.missingDeniers.length > 0 && <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-amber-600" />}
                        </TableCell>
                        <TableCell className="text-right">{m.kg.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{inr2(m.revenue)}</TableCell>
                        <TableCell className="text-right">{inr2(m.yarnCost)}</TableCell>
                        <TableCell className="text-right font-medium">{inr2(m.margin)}</TableCell>
                        <TableCell className="text-right">{m.marginPct}%</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{totals.kg.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{inr2(totals.revenue)}</TableCell>
                      <TableCell className="text-right">{inr2(totals.yarnCost)}</TableCell>
                      <TableCell className="text-right">{inr2(totals.margin)}</TableCell>
                      <TableCell className="text-right">{totals.marginPct}%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Revenue = dispatched challan amounts (incl. paper-tube surcharge) by challan date, less returns by return date; EDY dispatches are not billed so they're excluded.
                Yarn cost = net kg × cost per kg (the cost quoted on the line for tiered clients, otherwise the Yarn Cost table for that month).
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="yarn" className="space-y-5 mt-4">
          <p className="text-sm text-muted-foreground">
            Raw grey-yarn cost per kg by denier. Yarn cost is revised on the 1st of a month — each entry applies from its
            effective date until a newer one replaces it. Saving the same denier + date again updates that entry.
          </p>

          {uncosted.length > 0 && (
            <div className="text-sm rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
              Deniers dispatched with no cost yet:{' '}
              {uncosted.map(d => (
                <button key={d} type="button" onClick={() => setForm(f => ({ ...f, denier: d }))}
                  className="underline font-medium mr-2">{d}</button>
              ))}
            </div>
          )}

          <form onSubmit={submitCost} className="card-industrial p-4 flex flex-wrap items-end gap-3">
            <div>
              <Label>Denier</Label>
              <Input list="denier-options" value={form.denier} onChange={e => setForm(f => ({ ...f, denier: e.target.value }))} className="w-40" placeholder="150/0" />
              <datalist id="denier-options">{knownDeniers.map(d => <option key={d} value={d} />)}</datalist>
            </div>
            <div>
              <Label>Effective from</Label>
              <Input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} className="w-44" />
            </div>
            <div>
              <Label>Cost (₹/kg)</Label>
              <Input type="number" step="0.01" min="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} className="w-32" />
            </div>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </form>

          <div className="card-industrial overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Denier</TableHead>
                  <TableHead>Effective from</TableHead>
                  <TableHead className="text-right">Cost (₹/kg)</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {costRows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No yarn costs yet.</TableCell></TableRow>
                ) : [...costRows].sort((a, b) => a.denier.localeCompare(b.denier) || b.effective_from.localeCompare(a.effective_from)).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.denier}</TableCell>
                    <TableCell>{r.effective_from}</TableCell>
                    <TableCell className="text-right">{r.cost_per_kg.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label="Delete"
                        onClick={async () => {
                          if (!window.confirm(`Delete ${r.denier} from ${r.effective_from}?`)) return;
                          try { await del.mutateAsync(r.id); toast.success('Deleted.'); }
                          catch (err: any) { toast.error(err.message || 'Failed to delete.'); }
                        }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
