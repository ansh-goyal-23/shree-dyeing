import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarIcon, Loader2, FlaskConical, X, Download, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek } from 'date-fns';
import { formatYmdLocal } from '@/lib/formatDate';

type PeriodMode = 'monthly' | 'weekly' | 'range';
type TypeFilter = 'all' | 'dye' | 'chemical';

const toYmd = (d: Date) => format(d, 'yyyy-MM-dd');

const parseYmd = (s: string) => {
  const [y, m, d] = (s.includes('T') ? s.split('T')[0] : s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const chunk = <T,>(arr: T[], size = 200): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fetchIn = async (table: string, columns: string, column: string, values: string[]) => {
  const rows: any[] = [];
  for (const part of chunk(values)) {
    const { data, error } = await supabase.from(table as any).select(columns).in(column, part);
    if (error) throw error;
    rows.push(...((data as any[]) || []));
  }
  return rows;
};

interface UsageRecord {
  itemId: string;
  type: 'dye' | 'chemical';
  qty: number;
  lotNo: string;
  date: string;
}

interface ReportData {
  usage: UsageRecord[];
  lots: { lot_no: string; date: string; net_weight: number }[];
  items: Record<string, { name: string; short_name: string; type: string; company: string; unit: string }>;
}

interface ItemRow {
  itemId: string;
  label: string;
  type: 'dye' | 'chemical';
  company: string;
  unit: string;
  totalQty: number;
  lots: number;
  netWeight: number;
  perKg: number;
  share: number;
}

const ConsumptionReport: React.FC = () => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({});
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['consumption-report', applied.from, applied.to],
    enabled: !!(applied.from && applied.to),
    queryFn: async (): Promise<ReportData> => {
      const { data: lots, error: lErr } = await supabase
        .from('lots')
        .select('lot_no, date, net_weight')
        .gte('date', applied.from!)
        .lte('date', applied.to!);
      if (lErr) throw lErr;

      const lotRows = (lots || []).map(l => ({
        lot_no: (l as any).lot_no as string,
        date: (l as any).date as string,
        net_weight: Number((l as any).net_weight) || 0,
      }));
      const lotNos = lotRows.map(l => l.lot_no);
      if (!lotNos.length) return { usage: [], lots: [], items: {} };
      const lotDate = new Map(lotRows.map(l => [l.lot_no, l.date]));

      const [recipeDyes, recipeChems, steps] = await Promise.all([
        fetchIn('recipe_dyes', 'lot_no, dye_id, qty_grams', 'lot_no', lotNos),
        fetchIn('recipe_chemicals', 'lot_no, chemical_id, qty', 'lot_no', lotNos),
        fetchIn('process_steps', 'id, lot_no', 'lot_no', lotNos),
      ]);

      const stepLot = new Map<string, string>(steps.map(s => [s.id as string, s.lot_no as string]));
      const stepIds = [...stepLot.keys()];
      const [stepDyes, stepChems] = await Promise.all([
        stepIds.length ? fetchIn('step_dyes', 'step_id, dye_id, qty_grams', 'step_id', stepIds) : Promise.resolve([]),
        stepIds.length ? fetchIn('step_chemicals', 'step_id, chemical_id, qty', 'step_id', stepIds) : Promise.resolve([]),
      ]);

      const usage: UsageRecord[] = [];
      const push = (itemId: string, type: 'dye' | 'chemical', qty: number, lotNo?: string) => {
        if (!itemId || !lotNo) return;
        usage.push({ itemId, type, qty: Number(qty) || 0, lotNo, date: lotDate.get(lotNo) || '' });
      };
      recipeDyes.forEach(r => push(r.dye_id, 'dye', r.qty_grams, r.lot_no));
      recipeChems.forEach(r => push(r.chemical_id, 'chemical', r.qty, r.lot_no));
      stepDyes.forEach(r => push(r.dye_id, 'dye', r.qty_grams, stepLot.get(r.step_id)));
      stepChems.forEach(r => push(r.chemical_id, 'chemical', r.qty, stepLot.get(r.step_id)));

      const { data: masters, error: mErr } = await supabase
        .from('master_items')
        .select('id, name, short_name, type, company, unit');
      if (mErr) throw mErr;
      const items: ReportData['items'] = {};
      for (const m of masters || []) {
        items[(m as any).id] = {
          name: (m as any).name || '',
          short_name: (m as any).short_name || '',
          type: (m as any).type || '',
          company: (m as any).company || '',
          unit: (m as any).unit || '',
        };
      }

      return { usage, lots: lotRows, items };
    },
  });

  const periodKey = (dateStr: string) => {
    if (periodMode === 'range') return 'Selected Range';
    if (!dateStr) return 'Unknown';
    const d = parseYmd(dateStr);
    if (periodMode === 'monthly') return format(d, 'MMM yyyy');
    return `Week of ${format(startOfWeek(d, { weekStartsOn: 1 }), 'dd MMM yyyy')}`;
  };

  const periodSort = (dateStr: string) => {
    if (periodMode === 'range' || !dateStr) return '';
    const d = parseYmd(dateStr);
    return periodMode === 'monthly'
      ? format(d, 'yyyy-MM')
      : format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  };

  const filteredUsage = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.usage.filter(u => {
      if (typeFilter !== 'all' && u.type !== typeFilter) return false;
      if (!q) return true;
      const m = data.items[u.itemId];
      return `${m?.name || ''} ${m?.short_name || ''}`.toLowerCase().includes(q);
    });
  }, [data, typeFilter, search]);

  const lotNet = useMemo(
    () => new Map((data?.lots || []).map(l => [l.lot_no, l.net_weight])),
    [data]
  );

  const buildItemRows = (records: UsageRecord[]): ItemRow[] => {
    const map = new Map<string, { qty: number; lots: Set<string>; type: 'dye' | 'chemical' }>();
    for (const r of records) {
      const cur = map.get(r.itemId) || { qty: 0, lots: new Set<string>(), type: r.type };
      cur.qty += r.qty;
      cur.lots.add(r.lotNo);
      map.set(r.itemId, cur);
    }
    const rows: ItemRow[] = [];
    let dyeTotal = 0;
    let chemTotal = 0;
    map.forEach(v => { if (v.type === 'dye') dyeTotal += v.qty; else chemTotal += v.qty; });
    map.forEach((v, itemId) => {
      const m = data?.items[itemId];
      const netWeight = [...v.lots].reduce((s, lot) => s + (lotNet.get(lot) || 0), 0);
      const denom = v.type === 'dye' ? dyeTotal : chemTotal;
      rows.push({
        itemId,
        label: m?.short_name || m?.name || itemId,
        type: v.type,
        company: m?.company || '',
        unit: v.type === 'dye' ? 'g' : (m?.unit || ''),
        totalQty: v.qty,
        lots: v.lots.size,
        netWeight,
        perKg: netWeight > 0 ? v.qty / netWeight : 0,
        share: denom > 0 ? (v.qty / denom) * 100 : 0,
      });
    });
    return rows.sort((a, b) => b.totalQty - a.totalQty);
  };

  const itemRows = useMemo(() => buildItemRows(filteredUsage), [filteredUsage, data, lotNet]);

  const periodRows = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, {
      sort: string; label: string; lots: Set<string>; dye: number; chem: number; records: UsageRecord[];
    }>();
    for (const r of filteredUsage) {
      const label = periodKey(r.date);
      const cur = map.get(label) || { sort: periodSort(r.date), label, lots: new Set<string>(), dye: 0, chem: 0, records: [] };
      if (r.type === 'dye') cur.dye += r.qty; else cur.chem += r.qty;
      cur.lots.add(r.lotNo);
      cur.records.push(r);
      map.set(label, cur);
    }
    return [...map.values()]
      .map(p => {
        const netWeight = [...p.lots].reduce((s, lot) => s + (lotNet.get(lot) || 0), 0);
        return {
          label: p.label,
          sort: p.sort,
          lotCount: p.lots.size,
          netWeight,
          dye: p.dye,
          chem: p.chem,
          dyePerKg: netWeight > 0 ? p.dye / netWeight : 0,
          chemPerKg: netWeight > 0 ? p.chem / netWeight : 0,
          records: p.records,
        };
      })
      .sort((a, b) => b.sort.localeCompare(a.sort));
  }, [filteredUsage, data, lotNet, periodMode]);

  const totals = useMemo(() => {
    const lotsUsed = new Set(filteredUsage.map(u => u.lotNo));
    const netWeight = [...lotsUsed].reduce((s, lot) => s + (lotNet.get(lot) || 0), 0);
    const dye = filteredUsage.filter(u => u.type === 'dye').reduce((s, u) => s + u.qty, 0);
    const chem = filteredUsage.filter(u => u.type === 'chemical').reduce((s, u) => s + u.qty, 0);
    return {
      lots: lotsUsed.size,
      netWeight,
      dye,
      chem,
      dyePerKg: netWeight > 0 ? dye / netWeight : 0,
      chemPerKg: netWeight > 0 ? chem / netWeight : 0,
    };
  }, [filteredUsage, lotNet]);

  const apply = () => {
    if (dateFrom && dateTo) setApplied({ from: toYmd(dateFrom), to: toYmd(dateTo) });
  };

  const clear = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setApplied({});
    setSearch('');
    setTypeFilter('all');
  };

  const exportCsv = (mode: 'items' | 'periods') => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let csv = '';
    if (mode === 'items') {
      csv = ['Item,Type,Company,Total Qty,Unit,Lots,Net Weight (kg),Avg per kg,Share %']
        .concat(itemRows.map(r => [
          esc(r.label), r.type === 'dye' ? 'Dye' : 'Chemical', esc(r.company),
          r.totalQty.toFixed(3), esc(r.unit), r.lots, r.netWeight.toFixed(3),
          r.perKg.toFixed(3), r.share.toFixed(2),
        ].join(','))).join('\n');
    } else {
      csv = ['Period,Lots,Net Weight (kg),Dye Total (g),Dye g/kg,Chemical Total,Chemical qty/kg']
        .concat(periodRows.map(p => [
          esc(p.label), p.lotCount, p.netWeight.toFixed(3), p.dye.toFixed(3),
          p.dyePerKg.toFixed(3), p.chem.toFixed(3), p.chemPerKg.toFixed(3),
        ].join(','))).join('\n');
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `consumption-${mode}-${applied.from}-to-${applied.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const hasData = !!data && filteredUsage.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FlaskConical className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Dye &amp; Chemical Usage Report</h1>
      </div>

      {/* Filters */}
      <div className="card-industrial p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs uppercase text-muted-foreground mb-1">From Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[170px] justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col">
          <label className="text-xs uppercase text-muted-foreground mb-1">To Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[170px] justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'dd MMM yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn('p-3 pointer-events-auto')} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col">
          <label className="text-xs uppercase text-muted-foreground mb-1">Group By</label>
          <div className="flex rounded-md border border-input overflow-hidden">
            {(['monthly', 'weekly', 'range'] as PeriodMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setPeriodMode(m)}
                className={cn('px-3 py-2 text-sm capitalize', periodMode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
              >
                {m === 'range' ? 'Whole Range' : m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs uppercase text-muted-foreground mb-1">Item Type</label>
          <div className="flex rounded-md border border-input overflow-hidden">
            {(['all', 'dye', 'chemical'] as TypeFilter[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={cn('px-3 py-2 text-sm capitalize', typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
              >
                {t === 'all' ? 'All' : t === 'dye' ? 'Dyes' : 'Chemicals'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs uppercase text-muted-foreground mb-1">Search Item</label>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Dye / chemical name" className="w-[200px]" />
        </div>

        <Button onClick={apply} disabled={!dateFrom || !dateTo}>Generate Report</Button>
        {(dateFrom || dateTo || applied.from) && (
          <Button variant="ghost" onClick={clear}><X className="w-4 h-4 mr-1" /> Clear</Button>
        )}
        {applied.from && applied.to && (
          <div className="ml-auto text-sm text-muted-foreground">
            Range: <span className="font-medium text-foreground">{formatYmdLocal(applied.from)}</span> – <span className="font-medium text-foreground">{formatYmdLocal(applied.to)}</span>
          </div>
        )}
      </div>

      {!applied.from && (
        <div className="text-center text-muted-foreground py-12">
          Select a date range and click <span className="font-medium">Generate Report</span>.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      )}

      {error && <div className="card-industrial p-4 text-destructive text-sm">Error: {(error as Error).message}</div>}

      {applied.from && !isLoading && data && !hasData && (
        <div className="text-center text-muted-foreground py-12">No dye or chemical usage found for the selected filters.</div>
      )}

      {hasData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="card-industrial p-4">
              <div className="text-xs uppercase text-muted-foreground">Lots</div>
              <div className="text-2xl font-bold mt-1">{totals.lots}</div>
            </div>
            <div className="card-industrial p-4">
              <div className="text-xs uppercase text-muted-foreground">Net Weight (kg)</div>
              <div className="text-2xl font-bold mt-1">{totals.netWeight.toFixed(3)}</div>
            </div>
            <div className="card-industrial p-4 bg-primary/5 border-primary/30">
              <div className="text-xs uppercase text-muted-foreground">Total Dyes (g)</div>
              <div className="text-2xl font-bold mt-1 text-primary">{totals.dye.toFixed(3)}</div>
            </div>
            <div className="card-industrial p-4 bg-primary/5 border-primary/30">
              <div className="text-xs uppercase text-muted-foreground">Dye Avg (g/kg)</div>
              <div className="text-2xl font-bold mt-1 text-primary">{totals.dyePerKg.toFixed(3)}</div>
            </div>
            <div className="card-industrial p-4">
              <div className="text-xs uppercase text-muted-foreground">Total Chemicals</div>
              <div className="text-2xl font-bold mt-1">{totals.chem.toFixed(3)}</div>
            </div>
            <div className="card-industrial p-4">
              <div className="text-xs uppercase text-muted-foreground">Chem Avg (per kg)</div>
              <div className="text-2xl font-bold mt-1">{totals.chemPerKg.toFixed(3)}</div>
            </div>
          </div>

          <Tabs defaultValue="items">
            <div className="flex items-center gap-3">
              <TabsList>
                <TabsTrigger value="items">Item Summary</TabsTrigger>
                <TabsTrigger value="periods">Period Trend</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="items" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => exportCsv('items')}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
              {(['dye', 'chemical'] as const)
                .filter(t => typeFilter === 'all' || typeFilter === t)
                .map(t => {
                  const rows = itemRows.filter(r => r.type === t);
                  if (!rows.length) return null;
                  return (
                    <div key={t} className="card-industrial overflow-hidden">
                      <div className="px-4 py-3 border-b border-border font-semibold">
                        {t === 'dye' ? 'Dyes' : 'Chemicals'} <span className="text-muted-foreground font-normal">({rows.length})</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="p-3 text-left">Item</th>
                              <th className="p-3 text-left">Company</th>
                              <th className="p-3 text-right">Total Used</th>
                              <th className="p-3 text-left">Unit</th>
                              <th className="p-3 text-right">Lots</th>
                              <th className="p-3 text-right">Net Wt (kg)</th>
                              <th className="p-3 text-right">Avg / kg</th>
                              <th className="p-3 text-right">Share %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(r => (
                              <tr key={r.itemId} className="border-t border-border hover:bg-muted/30">
                                <td className="p-3 font-medium">{r.label}</td>
                                <td className="p-3">{r.company || '-'}</td>
                                <td className="p-3 text-right">{r.totalQty.toFixed(3)}</td>
                                <td className="p-3">{r.unit || '-'}</td>
                                <td className="p-3 text-right">{r.lots}</td>
                                <td className="p-3 text-right">{r.netWeight.toFixed(3)}</td>
                                <td className="p-3 text-right font-medium">{r.perKg.toFixed(3)}</td>
                                <td className="p-3 text-right">{r.share.toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </TabsContent>

            <TabsContent value="periods" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => exportCsv('periods')}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="card-industrial overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left w-8"></th>
                        <th className="p-3 text-left">Period</th>
                        <th className="p-3 text-right">Lots</th>
                        <th className="p-3 text-right">Net Wt (kg)</th>
                        <th className="p-3 text-right">Dyes (g)</th>
                        <th className="p-3 text-right">Dye g/kg</th>
                        <th className="p-3 text-right">Chemicals</th>
                        <th className="p-3 text-right">Chem /kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodRows.map(p => {
                        const open = expanded === p.label;
                        const breakdown = open ? buildItemRows(p.records) : [];
                        return (
                          <React.Fragment key={p.label}>
                            <tr
                              className="border-t border-border hover:bg-muted/30 cursor-pointer"
                              onClick={() => setExpanded(open ? null : p.label)}
                            >
                              <td className="p-3">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                              <td className="p-3 font-medium">{p.label}</td>
                              <td className="p-3 text-right">{p.lotCount}</td>
                              <td className="p-3 text-right">{p.netWeight.toFixed(3)}</td>
                              <td className="p-3 text-right">{p.dye.toFixed(3)}</td>
                              <td className="p-3 text-right font-medium">{p.dyePerKg.toFixed(3)}</td>
                              <td className="p-3 text-right">{p.chem.toFixed(3)}</td>
                              <td className="p-3 text-right">{p.chemPerKg.toFixed(3)}</td>
                            </tr>
                            {open && (
                              <tr className="bg-muted/20 border-t border-border">
                                <td colSpan={8} className="p-3">
                                  <table className="w-full text-xs">
                                    <thead className="text-muted-foreground uppercase">
                                      <tr>
                                        <th className="p-2 text-left">Item</th>
                                        <th className="p-2 text-left">Type</th>
                                        <th className="p-2 text-right">Total Used</th>
                                        <th className="p-2 text-left">Unit</th>
                                        <th className="p-2 text-right">Lots</th>
                                        <th className="p-2 text-right">Avg / kg</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {breakdown.map(b => (
                                        <tr key={b.itemId} className="border-t border-border/60">
                                          <td className="p-2 font-medium">{b.label}</td>
                                          <td className="p-2">{b.type === 'dye' ? 'Dye' : 'Chemical'}</td>
                                          <td className="p-2 text-right">{b.totalQty.toFixed(3)}</td>
                                          <td className="p-2">{b.unit || '-'}</td>
                                          <td className="p-2 text-right">{b.lots}</td>
                                          <td className="p-2 text-right">{b.perKg.toFixed(3)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default ConsumptionReport;
