import React, { useMemo, useState } from 'react';
import { useBusinessEvents, useBusinessEventFacets, BusinessEventRow } from '@/hooks/useActivityCenter';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import ModuleIcon from './ModuleIcon';
import SeverityBadge from './SeverityBadge';
import EventDrawer from './EventDrawer';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

const ALL = '__all__';

export const BusinessEventsTab: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [module, setModule] = useState(ALL);
  const [eventType, setEventType] = useState(ALL);
  const [userId, setUserId] = useState(ALL);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<BusinessEventRow | null>(null);

  const facets = useBusinessEventFacets();
  const filters = useMemo(() => ({
    from: from ? `${from}T00:00:00` : undefined,
    to: to ? `${to}T23:59:59` : undefined,
    modules: module !== ALL ? [module] : undefined,
    eventTypes: eventType !== ALL ? [eventType] : undefined,
    userId: userId !== ALL ? userId : undefined,
    search: search || undefined,
    page,
    pageSize: 100,
  }), [from, to, module, eventType, userId, search, page]);

  const { data, isLoading } = useBusinessEvents(filters);
  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pageCount = Math.max(1, Math.ceil(total / 100));

  const reset = () => {
    setFrom(''); setTo(''); setModule(ALL); setEventType(ALL); setUserId(ALL); setSearch(''); setPage(0);
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 sticky top-0 z-10 bg-card">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">From</div>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="h-9 w-40" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">To</div>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="h-9 w-40" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Module</div>
            <Select value={module} onValueChange={(v) => { setModule(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Modules</SelectItem>
                {facets.data?.modules.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Event</div>
            <Select value={eventType} onValueChange={(v) => { setEventType(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Events</SelectItem>
                {facets.data?.eventTypes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">User</div>
            <Select value={userId} onValueChange={(v) => { setUserId(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Users</SelectItem>
                {facets.data?.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Summary, lot, reference…" className="h-9 pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset}><X className="h-4 w-4 mr-1" />Clear</Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Date</TableHead>
              <TableHead className="w-20">Time</TableHead>
              <TableHead className="w-40">User</TableHead>
              <TableHead className="w-36">Module</TableHead>
              <TableHead className="w-48">Event</TableHead>
              <TableHead className="w-40">Reference</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No business events yet. Events will appear here as they happen.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(r)}>
                <TableCell className="text-xs">{format(new Date(r.event_timestamp), 'dd MMM yyyy')}</TableCell>
                <TableCell className="text-xs">{format(new Date(r.event_timestamp), 'HH:mm:ss')}</TableCell>
                <TableCell className="text-sm">{r.user_name || '—'}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                    <ModuleIcon module={r.module} className="h-3.5 w-3.5" />{r.module}
                  </span>
                </TableCell>
                <TableCell><Badge variant="outline" className="font-mono text-xs">{r.event_type}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.reference_number || '—'}</TableCell>
                <TableCell className="text-sm">{r.summary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between p-3 border-t">
          <div className="text-xs text-muted-foreground">{total.toLocaleString()} events</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-xs">Page {page + 1} / {pageCount}</div>
            <Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default BusinessEventsTab;
