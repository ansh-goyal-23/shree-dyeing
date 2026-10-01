import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChallans } from '@/hooks/useChallan';
import { format, startOfWeek } from 'date-fns';

// Daily / Weekly Production Report.
//
// Decided with Ansh (1 Oct 2026):
// - "Production qty sent" = sum of net_weight (kg) across challan_items
//   with lot_type = 'Production' (Sampling excluded from this number).
// - "Samples sent" = count of DISTINCT lot_no values among items with
//   lot_type = 'Sampling', distinct per period (a sample lot shipped
//   twice in the same week counts once for that week).
// - EDY challans are excluded entirely -- their items track gross
//   weight, not net weight/rate the same way Production/Sampling lines
//   do, so folding them in would silently mix two different units.
// - Grouped by the challan's own `date` field (not created_at), weeks
//   start Monday -- same convention as the existing Consumption Report.

export interface ProductionPeriodRow {
  key: string;   // sort key (yyyy-MM-dd of the day, or the week's Monday)
  label: string; // display label
  productionQty: number; // kg
  sampleLots: number;    // distinct lot count
}

const toLocalDay = (s: string): Date => {
  const datePart = s.includes('T') ? s.split('T')[0] : s;
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const normalizeLotType = (t: unknown) => (t === 'Sampling' ? 'Sampling' : 'Production');

export function useProductionReport() {
  const { data: challans = [], isLoading: challansLoading } = useChallans();
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['all_challan_items_for_production_report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challan_items')
        .select('challan_id, lot_no, lot_type, net_weight');
      if (error) throw error;
      return data || [];
    },
  });

  const result = useMemo(() => {
    const challanById = new Map(challans.map(c => [c.id, c]));
    const dailyMap = new Map<string, { date: Date; productionQty: number; sampleLotSet: Set<string> }>();
    const weeklyMap = new Map<string, { weekStart: Date; productionQty: number; sampleLotSet: Set<string> }>();

    for (const item of items as any[]) {
      const challan = challanById.get(item.challan_id);
      if (!challan) continue;
      if (challan.challan_kind === 'edy') continue; // excluded per decision

      const day = toLocalDay(challan.date);
      const dayKey = format(day, 'yyyy-MM-dd');
      const weekStart = startOfWeek(day, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      if (!dailyMap.has(dayKey)) dailyMap.set(dayKey, { date: day, productionQty: 0, sampleLotSet: new Set() });
      if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, { weekStart, productionQty: 0, sampleLotSet: new Set() });

      const d = dailyMap.get(dayKey)!;
      const w = weeklyMap.get(weekKey)!;
      const lotType = normalizeLotType(item.lot_type);

      if (lotType === 'Production') {
        const qty = Number(item.net_weight) || 0;
        d.productionQty += qty;
        w.productionQty += qty;
      } else if (item.lot_no) {
        d.sampleLotSet.add(item.lot_no);
        w.sampleLotSet.add(item.lot_no);
      }
    }

    const daily: ProductionPeriodRow[] = [...dailyMap.entries()]
      .map(([key, v]) => ({
        key, label: format(v.date, 'dd MMM yyyy'),
        productionQty: v.productionQty, sampleLots: v.sampleLotSet.size,
      }))
      .sort((a, b) => b.key.localeCompare(a.key));

    const weekly: ProductionPeriodRow[] = [...weeklyMap.entries()]
      .map(([key, v]) => ({
        key, label: `Week of ${format(v.weekStart, 'dd MMM yyyy')}`,
        productionQty: v.productionQty, sampleLots: v.sampleLotSet.size,
      }))
      .sort((a, b) => b.key.localeCompare(a.key));

    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const thisWeekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const today = dailyMap.get(todayKey);
    const thisWeek = weeklyMap.get(thisWeekKey);

    return {
      daily,
      weekly,
      today: { productionQty: today?.productionQty || 0, sampleLots: today?.sampleLotSet.size || 0 },
      thisWeek: { productionQty: thisWeek?.productionQty || 0, sampleLots: thisWeek?.sampleLotSet.size || 0 },
    };
  }, [challans, items]);

  return { ...result, isLoading: challansLoading || itemsLoading };
}
