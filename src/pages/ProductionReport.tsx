import React, { useState, useMemo } from 'react';
import { Truck, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProductionReport } from '@/hooks/useProductionReport';

type PeriodMode = 'daily' | 'weekly';

const ProductionReport: React.FC = () => {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('daily');
  const { daily, weekly, today, thisWeek, isLoading } = useProductionReport();

  const rows = periodMode === 'daily' ? daily : weekly;
  const totals = useMemo(() => rows.reduce((acc, r) => ({
    productionQty: acc.productionQty + r.productionQty,
    sampleLots: acc.sampleLots + r.sampleLots,
  }), { productionQty: 0, sampleLots: 0 }), [rows]);

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [`${periodMode === 'daily' ? 'Date' : 'Week'},Production Qty Sent (kg),Samples Sent (distinct lots)`]
      .concat(rows.map(r => [esc(r.label), r.productionQty.toFixed(3), r.sampleLots].join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `production-report-${periodMode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Production Report</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Production Qty Sent is the net weight (kg) of Production-type lines dispatched on normal challans.
        Samples Sent counts distinct lot numbers dispatched as Sampling-type lines, per period. EDY challans
        are not included (they track gross weight, not net weight/rate the same way).
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-industrial p-4 flex items-center gap-3">
          <Truck className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Qty Sent — Today</p>
            <p className="text-2xl font-semibold font-data">{today.productionQty.toFixed(2)} kg</p>
          </div>
        </div>
        <div className="card-industrial p-4 flex items-center gap-3">
          <Truck className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Qty Sent — This Week</p>
            <p className="text-2xl font-semibold font-data">{thisWeek.productionQty.toFixed(2)} kg</p>
          </div>
        </div>
        <div className="card-industrial p-4 flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-correction" />
          <div>
            <p className="text-sm text-muted-foreground">Samples Sent — Today</p>
            <p className="text-2xl font-semibold font-data">{today.sampleLots}</p>
          </div>
        </div>
        <div className="card-industrial p-4 flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-correction" />
          <div>
            <p className="text-sm text-muted-foreground">Samples Sent — This Week</p>
            <p className="text-2xl font-semibold font-data">{thisWeek.sampleLots}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-md border border-input overflow-hidden">
          {(['daily', 'weekly'] as PeriodMode[]).map(m => (
            <button key={m} type="button" onClick={() => setPeriodMode(m)}
              className={cn('px-3 py-2 text-sm capitalize btn-transition', periodMode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
              {m}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || rows.length === 0}>
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No dispatch data yet.</div>
      ) : (
        <div className="card-industrial overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">{periodMode === 'daily' ? 'Date' : 'Week'}</th>
                <th className="p-3 font-medium text-right">Production Qty Sent (kg)</th>
                <th className="p-3 font-medium text-right">Samples Sent (distinct lots)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="p-3">{r.label}</td>
                  <td className="p-3 text-right font-data">{r.productionQty.toFixed(3)}</td>
                  <td className="p-3 text-right font-data">{r.sampleLots}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-semibold">
                <td className="p-3">Total ({rows.length} {periodMode === 'daily' ? 'day(s)' : 'week(s)'})</td>
                <td className="p-3 text-right">{totals.productionQty.toFixed(3)}</td>
                <td className="p-3 text-right">{totals.sampleLots}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProductionReport;
