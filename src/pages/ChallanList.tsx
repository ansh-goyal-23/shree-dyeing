import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useChallans } from '@/hooks/useChallan';
import { PlusCircle, FileText, Loader2, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type SortField = 'challan' | 'date' | 'client' | 'net_weight' | 'amount';
type SortDir = 'asc' | 'desc';

const SortHeader: React.FC<{
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}> = ({ label, field, current, dir, onSort, className }) => (
  <th
    className={cn("p-3 font-medium cursor-pointer select-none hover:text-foreground transition-colors", className)}
    onClick={() => onSort(field)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {current === field ? (
        dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-30" />
      )}
    </span>
  </th>
);

const ChallanList: React.FC = () => {
  const { data: challans = [], isLoading } = useChallans();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('challan');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: allItems = [] } = useQuery({
    queryKey: ['all_challan_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('challan_items').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const uniqueClients = useMemo(() => {
    return [...new Set(challans.map(c => c.client_name))].filter(Boolean).sort();
  }, [challans]);

  const hasActiveFilters = !!(clientFilter || dateFrom || dateTo);

  const clearFilters = () => {
    setClientFilter('');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'challan' ? 'desc' : 'asc');
    }
  };

  // Build a map of challanId -> item summary for performance
  const itemSummaryMap = useMemo(() => {
    const map: Record<string, { totalItems: number; totalNetWeight: number; totalAmount: number }> = {};
    allItems.forEach((i: any) => {
      if (!map[i.challan_id]) map[i.challan_id] = { totalItems: 0, totalNetWeight: 0, totalAmount: 0 };
      map[i.challan_id].totalItems += 1;
      map[i.challan_id].totalNetWeight += Number(i.net_weight) || 0;
      map[i.challan_id].totalAmount += Number(i.amount) || 0;
    });
    return map;
  }, [allItems]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = challans;

    if (q) {
      const challanIdsWithMatchingItems = new Set(
        allItems
          .filter((i: any) =>
            i.lot_no?.toLowerCase().includes(q) ||
            i.shade_number?.toLowerCase().includes(q) ||
            i.color_name?.toLowerCase().includes(q)
          )
          .map((i: any) => i.challan_id)
      );
      list = list.filter(c =>
        c.challan_number.toLowerCase().includes(q) ||
        c.client_name.toLowerCase().includes(q) ||
        challanIdsWithMatchingItems.has(c.id)
      );
    }

    if (clientFilter) list = list.filter(c => c.client_name === clientFilter);
    if (dateFrom) list = list.filter(c => new Date(c.date) >= dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      list = list.filter(c => new Date(c.date) <= end);
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      const sA = itemSummaryMap[a.id] || { totalNetWeight: 0, totalAmount: 0 };
      const sB = itemSummaryMap[b.id] || { totalNetWeight: 0, totalAmount: 0 };
      switch (sortField) {
        case 'challan':
          cmp = a.challan_number.localeCompare(b.challan_number, undefined, { numeric: true });
          break;
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'client':
          cmp = a.client_name.localeCompare(b.client_name);
          break;
        case 'net_weight':
          cmp = sA.totalNetWeight - sB.totalNetWeight;
          break;
        case 'amount':
          cmp = sA.totalAmount - sB.totalAmount;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [challans, search, clientFilter, dateFrom, dateTo, sortField, sortDir, allItems, itemSummaryMap]);

  const totals = useMemo(() => {
    let totalNetWeight = 0;
    let totalAmount = 0;
    filtered.forEach(c => {
      const s = itemSummaryMap[c.id];
      if (s) {
        totalNetWeight += s.totalNetWeight;
        totalAmount += s.totalAmount;
      }
    });
    return { totalNetWeight, totalAmount };
  }, [filtered, itemSummaryMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dispatch — Challans</h1>
        <Link to="/dispatch/create"
          className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
          <PlusCircle className="w-4 h-4" /> New Challan
        </Link>
      </div>

      {/* Search + Filter toggle */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search challan, client, lot, shade, color..." value={search} onChange={e => setSearch(e.target.value)}
            className="input-industrial w-full pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} className="relative">
          <Filter className="w-4 h-4 mr-1" /> Filters
          {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />}
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card-industrial p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Client</label>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="input-industrial w-48">
              <option value="">All Clients</option>
              {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="w-3 h-3 mr-1" /> Clear all
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      {(search || hasActiveFilters) && !isLoading && (
        <p className="text-sm text-muted-foreground">{filtered.length} challan{filtered.length !== 1 ? 's' : ''} found</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{search || hasActiveFilters ? 'No matching challans.' : 'No challans yet.'}</p>
        </div>
      ) : (
        <div className="card-industrial overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <SortHeader label="Challan #" field="challan" current={sortField} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Date" field="date" current={sortField} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Client" field="client" current={sortField} dir={sortDir} onSort={handleSort} />
                <th className="p-3 font-medium text-right">Items</th>
                <SortHeader label="Net Weight (kg)" field="net_weight" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                <SortHeader label="Amount" field="amount" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const s = itemSummaryMap[c.id] || { totalItems: 0, totalNetWeight: 0, totalAmount: 0 };
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
                <td className="p-3" colSpan={4}>Total ({filtered.length} challans)</td>
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
