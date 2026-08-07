import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';
import { Search, Filter, ArrowUpDown, X, CalendarIcon } from 'lucide-react';
import type { LotStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CYCLE: LotStatus[] = ['In Approval', 'Approved', 'Production', 'Rejected'];

const STATUS_VARIANT: Record<LotStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'Approved': 'default',
  'Production': 'secondary',
  'In Approval': 'outline',
  'Rejected': 'destructive',
};

type SortField = 'lot_no' | 'date' | 'color_name' | 'shade_number' | 'status' | 'net_weight';
type SortDir = 'asc' | 'desc';

const LotList: React.FC = () => {
  const { lots, updateLotStatus } = useApp();
  const [search, setSearch] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<LotStatus | ''>('');
  const [colorFilter, setColorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('lot_no');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const uniqueColors = useMemo(() => {
    const set = new Set<string>();
    lots.forEach(l => { if (l.color_name?.trim()) set.add(l.color_name.trim()); });
    return Array.from(set).sort();
  }, [lots]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'lot_no' ? 'desc' : 'asc');
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setColorFilter('');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = statusFilter || colorFilter || dateFrom || dateTo;

  const filtered = useMemo(() => {
    let result = lots.filter(l => {
      const q = search.toLowerCase();
      const matchesSearch = !q || l.lot_no.toLowerCase().includes(q) ||
        l.shade_number.toLowerCase().includes(q) ||
        l.yarn_company_name.toLowerCase().includes(q) ||
        l.color_name.toLowerCase().includes(q) ||
        (l.remarks || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (statusFilter && l.status !== statusFilter) return false;
      if (colorFilter && l.color_name !== colorFilter) return false;
      if (dateFrom && l.date < format(dateFrom, 'yyyy-MM-dd')) return false;
      if (dateTo && l.date > format(dateTo, 'yyyy-MM-dd')) return false;

      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'lot_no':
          cmp = a.lot_no.localeCompare(b.lot_no, undefined, { numeric: true });
          break;
        case 'date':
          cmp = a.date.localeCompare(b.date);
          break;
        case 'color_name':
          cmp = (a.color_name || '').localeCompare(b.color_name || '');
          break;
        case 'shade_number':
          cmp = a.shade_number.localeCompare(b.shade_number, undefined, { numeric: true });
          break;
        case 'status':
          cmp = STATUS_CYCLE.indexOf(a.status) - STATUS_CYCLE.indexOf(b.status);
          break;
        case 'net_weight':
          cmp = a.net_weight - b.net_weight;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [lots, search, statusFilter, colorFilter, dateFrom, dateTo, sortField, sortDir]);

  const handleToggleStatus = async (lotNo: string, currentStatus: LotStatus) => {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    await updateLotStatus(lotNo, next);
    toast.success(`Lot ${lotNo} → ${next}`);
  };

  const SortHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={cn("px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground btn-transition", className)}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn("w-3 h-3", sortField === field ? 'text-primary' : 'opacity-40')} />
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Lot List</h1>
        <Link
          to="/shade-management/lots/create"
          className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring"
        >
          New Lot
        </Link>
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Lot No, Company, Shade, Color, or Remarks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-industrial w-full pl-10"
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="icon"
          className="h-11 w-11 relative"
          onClick={() => setShowFilters(v => !v)}
        >
          <Filter className="w-4 h-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full" />
          )}
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="card-industrial p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Filters</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1">
                <X className="w-3 h-3" /> Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as LotStatus | '')}
                className="input-industrial w-full text-sm"
              >
                <option value="">All Statuses</option>
                {STATUS_CYCLE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Color Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Color</label>
              <select
                value={colorFilter}
                onChange={e => setColorFilter(e.target.value)}
                className="input-industrial w-full text-sm"
              >
                <option value="">All Colors</option>
                {uniqueColors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 text-sm", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 text-sm", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-xs text-muted-foreground">{filtered.length} lot{filtered.length !== 1 ? 's' : ''} found</p>
      )}

      <div className="card-industrial overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-secondary/50">
              <SortHeader field="lot_no" className="text-left">Lot No</SortHeader>
              <SortHeader field="date" className="text-left">Date</SortHeader>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Denier</th>
              <SortHeader field="color_name" className="text-left">Color</SortHeader>
              <SortHeader field="net_weight" className="text-right">Net Wt (kg)</SortHeader>
              <SortHeader field="shade_number" className="text-left">Shade No</SortHeader>
              <SortHeader field="status" className="text-center">Status</SortHeader>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {search || hasActiveFilters ? 'No lots match your filters.' : 'No lots created yet.'}
                </td>
              </tr>
            ) : (
              filtered.map(lot => (
                <tr key={lot.lot_no} className="row-separator hover:bg-secondary/30 btn-transition">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`/shade-management/lots/${lot.lot_no}`} className="font-data font-semibold text-primary hover:underline">
                      {lot.lot_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-data text-muted-foreground whitespace-nowrap">{lot.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{lot.denier || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{lot.color_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-data whitespace-nowrap">{lot.net_weight}</td>
                  <td className="px-4 py-3 font-data whitespace-nowrap">{lot.shade_number}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <Badge
                      variant={STATUS_VARIANT[lot.status] || 'outline'}
                      className="cursor-pointer select-none"
                      onClick={() => handleToggleStatus(lot.lot_no, lot.status)}
                    >
                      {lot.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default LotList;
