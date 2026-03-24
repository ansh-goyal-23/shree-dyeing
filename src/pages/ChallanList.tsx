import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useChallans } from '@/hooks/useChallan';
import { useChallanItems } from '@/hooks/useChallan';
import { PlusCircle, Search, FileText, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ChallanList: React.FC = () => {
  const { data: challans = [], isLoading } = useChallans();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'client' | 'challan'>('date');

  // Fetch all items for summary
  const { data: allItems = [] } = useQuery({
    queryKey: ['all_challan_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('challan_items').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const uniqueClients = useMemo(() => {
    const names = [...new Set(challans.map(c => c.client_name))].filter(Boolean).sort();
    return names;
  }, [challans]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = challans;

    if (q) {
      // Also check items for lot_no, shade_number, color_name
      const challanIdsWithMatchingItems = new Set(
        allItems
          .filter(i =>
            i.lot_no?.toLowerCase().includes(q) ||
            i.shade_number?.toLowerCase().includes(q) ||
            i.color_name?.toLowerCase().includes(q)
          )
          .map(i => i.challan_id)
      );

      list = list.filter(c =>
        c.challan_number.toLowerCase().includes(q) ||
        c.client_name.toLowerCase().includes(q) ||
        challanIdsWithMatchingItems.has(c.id)
      );
    }

    if (clientFilter) {
      list = list.filter(c => c.client_name === clientFilter);
    }

    list = [...list].sort((a, b) => {
      if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'client') return a.client_name.localeCompare(b.client_name);
      return a.challan_number.localeCompare(b.challan_number);
    });

    return list;
  }, [challans, search, clientFilter, sortBy, allItems]);

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

      {/* Search, Filter, Sort */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search challan, client, lot, shade, color..." value={search} onChange={e => setSearch(e.target.value)}
            className="input-industrial w-full pl-10" />
        </div>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="input-industrial w-44">
          <option value="">All Clients</option>
          {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input-industrial w-36">
          <option value="date">Sort: Date</option>
          <option value="client">Sort: Client</option>
          <option value="challan">Sort: Challan #</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{search || clientFilter ? 'No matching challans.' : 'No challans yet.'}</p>
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
                <th className="p-3 font-medium text-right">Net Weight</th>
                <th className="p-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ChallanList;
