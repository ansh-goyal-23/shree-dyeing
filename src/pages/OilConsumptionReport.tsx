import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, Droplet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { formatYmdLocal } from '@/lib/formatDate';

interface LotRow {
  lot_no: string;
  shade_number: string;
  color_name: string;
  total_dispatched_cones: number;
  total_dispatch_net_weight: number;
  lot_net_weight: number;
  number_of_chesses: number;
  oil_used: number;
  fully_dispatched: boolean;
}

const toYmd = (d: Date) => format(d, 'yyyy-MM-dd');

const OilConsumptionReport: React.FC = () => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [applied, setApplied] = useState<{ from?: string; to?: string }>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['oil-consumption-report', applied.from, applied.to],
    enabled: !!(applied.from && applied.to),
    queryFn: async (): Promise<LotRow[]> => {
      // 1. Fetch challans in range
      const { data: challans, error: cErr } = await supabase
        .from('challans')
        .select('id, date')
        .gte('date', applied.from!)
        .lte('date', applied.to!);
      if (cErr) throw cErr;
      const ids = (challans || []).map(c => c.id);
      if (ids.length === 0) return [];

      // 2. Fetch all items for those challans
      const { data: items, error: iErr } = await supabase
        .from('challan_items')
        .select('lot_no, shade_number, color_name, num_of_units, net_weight')
        .in('challan_id', ids);
      if (iErr) throw iErr;

      // 3. Group by lot_no
      const grouped = new Map<string, { cones: number; net: number; shade_number: string; color_name: string }>();
      for (const it of items || []) {
        const lot = (it as any).lot_no as string;
        if (!lot) continue;
        const cones = Number((it as any).num_of_units ?? 0) || 0;
        const net = Number((it as any).net_weight) || 0;
        const cur = grouped.get(lot) || { cones: 0, net: 0, shade_number: '', color_name: '' };
        cur.cones += cones;
        cur.net += net;
        if (!cur.shade_number) cur.shade_number = (it as any).shade_number || '';
        if (!cur.color_name) cur.color_name = (it as any).color_name || '';
        grouped.set(lot, cur);
      }

      const lotNos = [...grouped.keys()];
      if (lotNos.length === 0) return [];

      // 4. Fetch lot master info
      const { data: lots, error: lErr } = await supabase
        .from('lots')
        .select('lot_no, net_weight, number_of_chesses, shade_number, color_name')
        .in('lot_no', lotNos);
      if (lErr) throw lErr;
      const lotMap = new Map<string, any>();
      for (const l of lots || []) lotMap.set((l as any).lot_no, l);

      // 5. Compute oil
      const rows: LotRow[] = lotNos.map(lot => {
        const g = grouped.get(lot)!;
        const m = lotMap.get(lot);
        const lot_net_weight = Number(m?.net_weight) || 0;
        const number_of_chesses = Number(m?.number_of_chesses) || 0;
        const fully = number_of_chesses > 0 && g.cones === number_of_chesses;
        let oil_used: number;
        if (fully) {
          oil_used = g.net - lot_net_weight;
        } else if (number_of_chesses > 0) {
          oil_used = g.net - (lot_net_weight / number_of_chesses) * g.cones;
        } else {
          oil_used = 0;
        }
        return {
          lot_no: lot,
          shade_number: m?.shade_number || g.shade_number,
          color_name: m?.color_name || g.color_name,
          total_dispatched_cones: g.cones,
          total_dispatch_net_weight: g.net,
          lot_net_weight,
          number_of_chesses,
          oil_used: parseFloat(oil_used.toFixed(3)),
          fully_dispatched: fully,
        };
      }).sort((a, b) => a.lot_no.localeCompare(b.lot_no));

      return rows;
    },
  });

  const totals = useMemo(() => {
    const rows = data || [];
    const lotNet = rows.reduce((s, r) => s + r.lot_net_weight, 0);
    const oil = rows.reduce((s, r) => s + r.oil_used, 0);
    return {
      lots: rows.length,
      cones: rows.reduce((s, r) => s + r.total_dispatched_cones, 0),
      dispatchNet: rows.reduce((s, r) => s + r.total_dispatch_net_weight, 0),
      lotNet,
      oil,
      oilPct: lotNet > 0 ? (oil / lotNet) * 100 : 0,
    };
  }, [data]);

  const apply = () => {
    if (dateFrom && dateTo) {
      setApplied({ from: toYmd(dateFrom), to: toYmd(dateTo) });
    }
  };

  const clear = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setApplied({});
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Droplet className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Oil Consumption Report</h1>
      </div>

      {/* Filters */}
      <div className="card-industrial p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs uppercase text-muted-foreground mb-1">From Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[180px] justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
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
              <Button variant="outline" className={cn('w-[180px] justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'dd MMM yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn('p-3 pointer-events-auto')} />
            </PopoverContent>
          </Popover>
        </div>
        <Button onClick={apply} disabled={!dateFrom || !dateTo}>Generate Report</Button>
        {(dateFrom || dateTo || applied.from) && (
          <Button variant="ghost" onClick={clear}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
        {applied.from && applied.to && (
          <div className="ml-auto text-sm text-muted-foreground">
            Range: <span className="font-medium text-foreground">{formatYmdLocal(applied.from)}</span> – <span className="font-medium text-foreground">{formatYmdLocal(applied.to)}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {!applied.from && (
        <div className="text-center text-muted-foreground py-12">Select a date range and click <span className="font-medium">Generate Report</span>.</div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      )}

      {error && (
        <div className="card-industrial p-4 text-destructive text-sm">Error: {(error as Error).message}</div>
      )}

      {applied.from && !isLoading && data && data.length === 0 && (
        <div className="text-center text-muted-foreground py-12">No dispatch records found in the selected range.</div>
      )}

      {data && data.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card-industrial p-4">
              <div className="text-xs uppercase text-muted-foreground">Lots</div>
              <div className="text-2xl font-bold mt-1">{totals.lots}</div>
            </div>
            <div className="card-industrial p-4">
              <div className="text-xs uppercase text-muted-foreground">Total Cones Dispatched</div>
              <div className="text-2xl font-bold mt-1">{totals.cones}</div>
            </div>
            <div className="card-industrial p-4">
              <div className="text-xs uppercase text-muted-foreground">Total Dispatch Net (kg)</div>
              <div className="text-2xl font-bold mt-1">{totals.dispatchNet.toFixed(3)}</div>
            </div>
            <div className="card-industrial p-4 bg-primary/5 border-primary/30">
              <div className="text-xs uppercase text-muted-foreground">Total Oil Consumption (kg)</div>
              <div className="text-2xl font-bold mt-1 text-primary">{totals.oil.toFixed(3)}</div>
            </div>
          </div>

          {/* Per-lot table */}
          <div className="card-industrial overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Lot No.</th>
                    <th className="p-3 text-left">Shade</th>
                    <th className="p-3 text-left">Color</th>
                    <th className="p-3 text-right">Lot Chesses</th>
                    <th className="p-3 text-right">Dispatched Cones</th>
                    <th className="p-3 text-right">Lot Net (kg)</th>
                    <th className="p-3 text-right">Dispatch Net (kg)</th>
                    <th className="p-3 text-right">Oil Used (kg)</th>
                    <th className="p-3 text-right">Oil %</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(r => {
                    const oilPct = r.lot_net_weight > 0 ? (r.oil_used / r.lot_net_weight) * 100 : 0;
                    return (
                    <tr key={r.lot_no} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-medium">{r.lot_no}</td>
                      <td className="p-3">{r.shade_number || '-'}</td>
                      <td className="p-3">{r.color_name || '-'}</td>
                      <td className="p-3 text-right">{r.number_of_chesses}</td>
                      <td className="p-3 text-right">{r.total_dispatched_cones}</td>
                      <td className="p-3 text-right">{r.lot_net_weight.toFixed(3)}</td>
                      <td className="p-3 text-right">{r.total_dispatch_net_weight.toFixed(3)}</td>
                      <td className={cn('p-3 text-right font-semibold', r.oil_used > 0 ? 'text-primary' : 'text-muted-foreground')}>
                        {r.oil_used.toFixed(3)}
                      </td>
                      <td className={cn('p-3 text-right font-semibold', oilPct > 0 ? 'text-primary' : 'text-muted-foreground')}>
                        {oilPct.toFixed(2)}%
                      </td>
                      <td className="p-3 text-center">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded text-xs',
                          r.fully_dispatched ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        )}>
                          {r.fully_dispatched ? 'Full' : 'Partial'}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/40 font-semibold">
                  <tr className="border-t-2 border-border">
                    <td className="p-3" colSpan={4}>Total</td>
                    <td className="p-3 text-right">{totals.cones}</td>
                    <td className="p-3 text-right">{totals.lotNet.toFixed(3)}</td>
                    <td className="p-3 text-right">{totals.dispatchNet.toFixed(3)}</td>
                    <td className="p-3 text-right text-primary">{totals.oil.toFixed(3)}</td>
                    <td className="p-3 text-right text-primary">{totals.oilPct.toFixed(2)}%</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OilConsumptionReport;
