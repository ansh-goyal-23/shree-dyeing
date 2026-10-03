import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useChallans, useBulkMarkChallansPaid } from '@/hooks/useChallan';
import { paymentState, lineTotal } from '@/types/challan';
import type { PaymentState } from '@/types/challan';
import { useRole } from '@/context/RoleContext';
import { toast } from 'sonner';
import { PlusCircle, FileText, Loader2, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, X, IndianRupee, FileSpreadsheet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { formatYmdLocal } from '@/lib/formatDate';
import * as XLSX from 'xlsx';

const PAY_BADGE: Record<PaymentState, string> = {
  Paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  'Partially Paid': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  Unpaid: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};


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
  const [paymentFilter, setPaymentFilter] = useState<'' | PaymentState>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { isAdmin } = useRole();
  const bulkPay = useBulkMarkChallansPaid();

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

  const hasActiveFilters = !!(clientFilter || dateFrom || dateTo || paymentFilter);

  const clearFilters = () => {
    setClientFilter('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setPaymentFilter('');
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
    const map: Record<string, { totalItems: number; totalNetWeight: number; totalAmount: number; types: string[] }> = {};
    allItems.forEach((i: any) => {
      if (!map[i.challan_id]) map[i.challan_id] = { totalItems: 0, totalNetWeight: 0, totalAmount: 0, types: [] };
      map[i.challan_id].totalItems += 1;
      map[i.challan_id].totalNetWeight += Number(i.net_weight) || 0;
      map[i.challan_id].totalAmount += lineTotal(i);
      if (i.lot_type && !map[i.challan_id].types.includes(i.lot_type)) {
        map[i.challan_id].types.push(i.lot_type);
      }
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

    // Normalize challan date string (YYYY-MM-DD or ISO) to a local Date at start-of-day
    // to avoid timezone off-by-one issues when comparing against calendar-picked dates.
    const toLocalDay = (s: string): Date => {
      const datePart = s.includes('T') ? s.split('T')[0] : s;
      const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
      const d = new Date(s);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    if (dateFrom) {
      const from = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
      list = list.filter(c => toLocalDay(c.date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999);
      list = list.filter(c => toLocalDay(c.date) <= to);
    }

    if (paymentFilter) {
      list = list.filter(c => {
        const total = itemSummaryMap[c.id]?.totalAmount || 0;
        return paymentState(total, c.amount_received) === paymentFilter;
      });
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
  }, [challans, search, clientFilter, dateFrom, dateTo, paymentFilter, sortField, sortDir, allItems, itemSummaryMap]);

  const totals = useMemo(() => {
    let totalNetWeight = 0;
    let totalAmount = 0;
    let totalReceived = 0;
    filtered.forEach(c => {
      const s = itemSummaryMap[c.id];
      if (s) {
        totalNetWeight += s.totalNetWeight;
        totalAmount += s.totalAmount;
      }
      totalReceived += Math.min(c.amount_received, s?.totalAmount ?? c.amount_received);
    });
    return { totalNetWeight, totalAmount, totalReceived, outstanding: totalAmount - totalReceived };
  }, [filtered, itemSummaryMap]);

  const selectableIds = useMemo(
    () => filtered.filter(c => {
      const total = itemSummaryMap[c.id]?.totalAmount || 0;
      return total > 0 && paymentState(total, c.amount_received) !== 'Paid';
    }).map(c => c.id),
    [filtered, itemSummaryMap],
  );

  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds));

  const handleBulkPaid = async () => {
    const rows = filtered
      .filter(c => selected.has(c.id))
      .map(c => ({
        id: c.id,
        challan_number: c.challan_number,
        total: itemSummaryMap[c.id]?.totalAmount || 0,
        amount_received: itemSummaryMap[c.id]?.totalAmount || 0,
        prev_received: c.amount_received,
      }))
      .filter(r => r.total > 0);
    if (rows.length === 0) { toast.error('No payable challans selected.'); return; }
    try {
      await bulkPay.mutateAsync(rows);
      toast.success(`${rows.length} challan(s) marked Paid.`);
      setSelected(new Set());
    } catch {
      toast.error('Failed to update payments.');
    }
  };

  const handleExportExcel = () => {
    if (!filtered.length) {
      toast.error('No challans match the selected filters.');
      return;
    }

    const reportRows = filtered.map(c => {
      const summary = itemSummaryMap[c.id] || { totalItems: 0, totalNetWeight: 0, totalAmount: 0, types: [] };
      const isEDY = c.challan_kind === 'edy';
      const items = allItems.filter((item: any) => item.challan_id === c.id);
      const grossWeight = items.reduce((sum: number, item: any) => sum + (Number(item.gross_weight) || 0), 0);

      return {
        challan: c,
        summary,
        items,
        grossWeight,
        isEDY,
        payment: summary.totalAmount > 0 ? paymentState(summary.totalAmount, c.amount_received) : '—',
      };
    });

    const summaryRows = reportRows.map(({ challan: c, summary, grossWeight, isEDY, payment }) => ({
      'Challan #': c.challan_number,
      'Challan Type': isEDY ? 'EDY' : 'Normal',
      Date: c.date,
      Client: c.client_name,
      'Item Types': summary.types
        .map(type => type === 'production' ? 'Production' : type === 'sampling' ? 'Sampling' : type)
        .join(' + ') || (isEDY ? 'EDY' : 'Production'),
      'No. of Items': summary.totalItems,
      'Net Weight (kg)': isEDY ? '' : Number(summary.totalNetWeight.toFixed(3)),
      'Gross Weight (kg)': isEDY ? Number(grossWeight.toFixed(3)) : '',
      'Total Amount (Rs.)': isEDY ? '' : Number(summary.totalAmount.toFixed(2)),
      'Amount Received (Rs.)': isEDY ? '' : Number(Math.min(c.amount_received, summary.totalAmount).toFixed(2)),
      'Payment Status': payment,
      Notes: c.notes,
    }));

    const detailRows = reportRows.flatMap(({ challan: c, items, isEDY, payment }) => items.map((item: any, index: number) => ({
      'Challan #': c.challan_number,
      'Challan Type': isEDY ? 'EDY' : 'Normal',
      Date: c.date,
      Client: c.client_name,
      'Item #': index + 1,
      'Lot #': item.lot_no || '',
      'Reference No.': item.ref_no || '',
      'Shade #': item.shade_number || '',
      'Colour': item.color_name || '',
      Denier: item.denier || '',
      'Lot Type': item.lot_type || '',
      'Packaging': item.packaging_type || '',
      'Gross Weight (kg)': Number(item.gross_weight) || 0,
      'No. of Cones': Number(item.num_of_units) || 0,
      'Net Weight (kg)': Number(item.net_weight) || 0,
      'Rate (Rs.)': Number(item.rate) || 0,
      'Amount (Rs.)': Number(item.amount) || 0,
      'Payment Status': payment,
      'Extra Cones': Number((item as any).extra_cones) || 0,
      'Paper Tube Surcharge (Rs.)': Number(item.paper_tube_surcharge) || 0,
    })));

    const totals = reportRows.reduce((acc, row) => {
      acc.items += row.summary.totalItems;
      acc.netWeight += row.isEDY ? 0 : row.summary.totalNetWeight;
      acc.grossWeight += row.grossWeight;
      acc.amount += row.summary.totalAmount;
      acc.received += row.isEDY ? 0 : Math.min(row.challan.amount_received, row.summary.totalAmount);
      return acc;
    }, { items: 0, netWeight: 0, grossWeight: 0, amount: 0, received: 0 });

    const criteriaRows = [
      { 'Report Detail': 'Client', Value: clientFilter || 'All Clients' },
      { 'Report Detail': 'Date From', Value: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : 'All dates' },
      { 'Report Detail': 'Date To', Value: dateTo ? format(dateTo, 'yyyy-MM-dd') : 'All dates' },
      { 'Report Detail': 'Challans Included', Value: reportRows.length },
      { 'Report Detail': 'Items Included', Value: totals.items },
      { 'Report Detail': 'Total Net Weight (kg)', Value: Number(totals.netWeight.toFixed(3)) },
      { 'Report Detail': 'Total Gross Weight (kg)', Value: Number(totals.grossWeight.toFixed(3)) },
      { 'Report Detail': 'Total Amount (Rs.)', Value: Number(totals.amount.toFixed(2)) },
      { 'Report Detail': 'Total Received (Rs.)', Value: Number(totals.received.toFixed(2)) },
    ];

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    const criteriaSheet = XLSX.utils.json_to_sheet(criteriaRows);

    summarySheet['!cols'] = [
      { wch: 16 }, { wch: 14 }, { wch: 13 }, { wch: 24 }, { wch: 20 }, { wch: 13 },
      { wch: 18 }, { wch: 19 }, { wch: 20 }, { wch: 23 }, { wch: 17 }, { wch: 36 },
    ];
    detailSheet['!cols'] = [
      { wch: 16 }, { wch: 14 }, { wch: 13 }, { wch: 24 }, { wch: 9 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
      { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 15 }, { wch: 16 }, { wch: 15 },
    ];
    criteriaSheet['!cols'] = [{ wch: 28 }, { wch: 24 }];
    summarySheet['!autofilter'] = { ref: summarySheet['!ref'] || 'A1:L1' };
    detailSheet['!autofilter'] = { ref: detailSheet['!ref'] || 'A1:Q1' };
    summarySheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    detailSheet['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(workbook, criteriaSheet, 'Report Info');
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Challan Summary');
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'All Items');

    const clientPart = clientFilter ? clientFilter.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') : 'all-clients';
    const datePart = dateFrom || dateTo ? `${dateFrom ? format(dateFrom, 'yyyyMMdd') : 'start'}-to-${dateTo ? format(dateTo, 'yyyyMMdd') : 'end'}` : 'all-dates';
    XLSX.writeFile(workbook, `challan-report-${clientPart}-${datePart}.xlsx`);
    toast.success(`Excel report generated with ${reportRows.length} challan(s).`);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dispatch — Challans</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={isLoading || filtered.length === 0}>
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </Button>
          <Link to="/dispatch/create"
            className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
            <PlusCircle className="w-4 h-4" /> New Challan
          </Link>
          <Link to="/dispatch/create-edy"
            className="inline-flex items-center gap-2 px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring">
            <PlusCircle className="w-4 h-4" /> New EDY Challan
          </Link>
        </div>
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Payment</label>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as any)} className="input-industrial w-40">
              <option value="">All</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="w-3 h-3 mr-1" /> Clear all
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isLoading || filtered.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Generate Excel Report
          </Button>
        </div>
      )}

      {/* Results count */}
      {(search || hasActiveFilters) && !isLoading && (
        <p className="text-sm text-muted-foreground">{filtered.length} challan{filtered.length !== 1 ? 's' : ''} found</p>
      )}

      {/* Bulk payment bar */}
      {isAdmin && selected.size > 0 && (
        <div className="sticky top-2 z-20 card-industrial p-3 flex flex-wrap items-center gap-3 border-primary/60">
          <span className="text-sm font-medium">{selected.size} challan(s) selected</span>
          <Button size="sm" onClick={handleBulkPaid} disabled={bulkPay.isPending}>
            {bulkPay.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <IndianRupee className="w-4 h-4 mr-1" />}
            Mark as Paid
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
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
                {isAdmin && (
                  <th className="p-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      disabled={selectableIds.length === 0} className="accent-primary w-4 h-4" aria-label="Select all unpaid challans" />
                  </th>
                )}
                <SortHeader label="Challan #" field="challan" current={sortField} dir={sortDir} onSort={handleSort} />
                <th className="p-3 font-medium">Type</th>
                <SortHeader label="Date" field="date" current={sortField} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Client" field="client" current={sortField} dir={sortDir} onSort={handleSort} />
                <th className="p-3 font-medium text-right">Items</th>
                <SortHeader label="Net Weight (kg)" field="net_weight" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                <SortHeader label="Amount" field="amount" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                <th className="p-3 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const s = itemSummaryMap[c.id] || { totalItems: 0, totalNetWeight: 0, totalAmount: 0, types: [] };
                const isEDY = c.challan_kind === 'edy';
                // For EDY challans, "net weight" isn't tracked — show gross weight sum instead.
                const edyGross = isEDY
                  ? allItems.filter((i: any) => i.challan_id === c.id).reduce((sum: number, i: any) => sum + (Number(i.gross_weight) || 0), 0)
                  : 0;
                const state = paymentState(s.totalAmount, c.amount_received);
                const balance = Math.max(s.totalAmount - c.amount_received, 0);
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-secondary/30 btn-transition">
                    {isAdmin && (
                      <td className="p-3">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)}
                          disabled={s.totalAmount <= 0 || state === 'Paid'} className="accent-primary w-4 h-4"
                          aria-label={`Select challan ${c.challan_number}`} />
                      </td>
                    )}
                    <td className="p-3">
                      <Link to={`/dispatch/${c.id}`} className="text-primary font-medium hover:underline">{c.challan_number}</Link>
                    </td>
                    <td className="p-3">
                      {isEDY ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">EDY</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                          {(s.types.length ? s.types : ['production'])
                            .map(t => t === 'production' ? 'Production' : t === 'sampling' ? 'Sampling' : t)
                            .join(' + ')}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{formatYmdLocal(c.date)}</td>
                    <td className="p-3">{c.client_name}</td>
                    <td className="p-3 text-right">{s.totalItems}</td>
                    <td className="p-3 text-right">
                      {isEDY ? `${edyGross.toFixed(3)} kg (gross)` : `${s.totalNetWeight.toFixed(3)} kg`}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {isEDY ? '—' : `₹${s.totalAmount.toFixed(2)}`}
                    </td>
                    <td className="p-3">
                      {s.totalAmount <= 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          <span className={cn('text-xs px-2 py-0.5 rounded', PAY_BADGE[state])}>{state}</span>
                          {state !== 'Paid' && (
                            <p className="text-xs text-muted-foreground mt-0.5">Bal ₹{balance.toFixed(2)}</p>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-semibold">
                <td className="p-3" colSpan={isAdmin ? 6 : 5}>Total ({filtered.length} challans)</td>
                <td className="p-3 text-right">{totals.totalNetWeight.toFixed(3)} kg</td>
                <td className="p-3 text-right">₹{totals.totalAmount.toFixed(2)}</td>
                <td className="p-3 text-xs">
                  <p>Received ₹{totals.totalReceived.toFixed(2)}</p>
                  <p className="text-muted-foreground">Outstanding ₹{Math.max(totals.outstanding, 0).toFixed(2)}</p>
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ChallanList;
