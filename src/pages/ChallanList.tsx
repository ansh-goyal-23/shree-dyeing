import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useChallans } from '@/hooks/useChallan';
import { PlusCircle, FileText, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ChallanList: React.FC = () => {
  const { data: challans = [], isLoading } = useChallans();

  const { data: allItems = [] } = useQuery({
    queryKey: ['all_challan_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('challan_items').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const sorted = useMemo(() => {
    return [...challans].sort((a, b) =>
      b.challan_number.localeCompare(a.challan_number, undefined, { numeric: true })
    );
  }, [challans]);

  const totals = useMemo(() => {
    let totalNetWeight = 0;
    let totalAmount = 0;
    sorted.forEach(c => {
      const items = allItems.filter((i: any) => i.challan_id === c.id);
      totalNetWeight += items.reduce((s: number, i: any) => s + (Number(i.net_weight) || 0), 0);
      totalAmount += items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
    });
    return { totalNetWeight, totalAmount };
  }, [sorted, allItems]);

  const getItemsSummary = (challanId: string) => {
    const items = allItems.filter((i: any) => i.challan_id === challanId);
    const totalItems = items.length;
    const totalNetWeight = items.reduce((s: number, i: any) => s + (Number(i.net_weight) || 0), 0);
    const totalAmount = items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
    return { totalItems, totalNetWeight, totalAmount };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dispatch — Challans</h1>
        <Link to="/dispatch/create"
          className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
          <PlusCircle className="w-4 h-4" /> New Challan
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No challans yet.</p>
        </div>
      ) : (
        <div className="card-industrial overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Challan #</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Client</th>
                <th className="p-3 font-medium text-right">Items</th>
                <th className="p-3 font-medium text-right">Net Weight (kg)</th>
                <th className="p-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const s = getItemsSummary(c.id);
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-secondary/30 btn-transition">
                    <td className="p-3">
                      <Link to={`/dispatch/${c.id}`} className="text-primary font-medium hover:underline">{c.challan_number}</Link>
                    </td>
                    <td className="p-3">{new Date(c.date).toLocaleDateString()}</td>
                    <td className="p-3">{c.client_name}</td>
                    <td className="p-3 text-right">{s.totalItems}</td>
                    <td className="p-3 text-right">{s.totalNetWeight.toFixed(3)} kg</td>
                    <td className="p-3 text-right font-medium">₹{s.totalAmount.toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-semibold">
                <td className="p-3" colSpan={4}>Total ({sorted.length} challans)</td>
                <td className="p-3 text-right">{totals.totalNetWeight.toFixed(3)} kg</td>
                <td className="p-3 text-right">₹{totals.totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ChallanList;
