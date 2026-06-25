import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useSystemEvents, useResolveSystemEvent, SystemEventRow } from '@/hooks/useActivityCenter';
import SeverityBadge from './SeverityBadge';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, Database } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ALL = '__all__';

export const SystemEventsTab: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [severity, setSeverity] = useState(ALL);
  const [resolvedFilter, setResolvedFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selected, setSelected] = useState<SystemEventRow | null>(null);

  const { data, isLoading } = useSystemEvents({
    from: from ? `${from}T00:00:00` : undefined,
    to: to ? `${to}T23:59:59` : undefined,
    severity: severity !== ALL ? severity : undefined,
    resolved: resolvedFilter === 'open' ? false : resolvedFilter === 'resolved' ? true : null,
  });

  const resolveMut = useResolveSystemEvent();
  const rows = data || [];

  const stats = useMemo(() => {
    const now = Date.now();
    const last24 = rows.filter(r => now - new Date(r.ts).getTime() < 24 * 3600_000).length;
    const pending = rows.filter(r => !r.resolved).length;
    const resolved = rows.filter(r => r.resolved).length;
    const critical = rows.filter(r => r.severity === 'critical' && !r.resolved).length;
    return { last24, pending, resolved, critical };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="h-4 w-4" />Database</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600">Online</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-4 w-4" />Errors (24h)</div>
          <div className="text-2xl font-semibold mt-1">{stats.last24}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle className="h-4 w-4" />Pending</div>
          <div className={`text-2xl font-semibold mt-1 ${stats.pending > 0 ? 'text-orange-600' : ''}`}>{stats.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Resolved</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600">{stats.resolved}</div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div><div className="text-xs text-muted-foreground mb-1">From</div><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" /></div>
          <div><div className="text-xs text-muted-foreground mb-1">To</div><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" /></div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Severity</div>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                <SelectItem value="information">Information</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <Select value={resolvedFilter} onValueChange={(v) => setResolvedFilter(v as 'all' | 'open' | 'resolved')}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Timestamp</TableHead>
              <TableHead className="w-28">Severity</TableHead>
              <TableHead className="w-40">Module</TableHead>
              <TableHead className="w-48">Event</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No system events recorded.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(r)}>
                <TableCell className="text-xs">{format(new Date(r.ts), 'dd MMM yyyy HH:mm:ss')}</TableCell>
                <TableCell><SeverityBadge severity={r.severity} /></TableCell>
                <TableCell className="text-sm">{r.module || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{r.event_type}</TableCell>
                <TableCell className="text-sm max-w-md truncate">{r.description}</TableCell>
                <TableCell>{r.resolved ? <span className="text-xs text-emerald-600">Resolved</span> : <span className="text-xs text-orange-600">Open</span>}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {!r.resolved && (
                    <Button size="sm" variant="outline" onClick={() => resolveMut.mutate(r.id, { onSuccess: () => toast({ title: 'Marked resolved' }) })}>
                      Resolve
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">{selected.event_type}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 text-xs">
                  <SeverityBadge severity={selected.severity} />
                  <span>{format(new Date(selected.ts), 'dd MMM yyyy HH:mm:ss')}</span>
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div><div className="text-xs text-muted-foreground">Module</div><div>{selected.module || '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">Description</div><div>{selected.description}</div></div>
                {selected.technical_details && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Technical Details</div>
                    <pre className="bg-muted/50 rounded p-3 text-xs overflow-x-auto">{JSON.stringify(selected.technical_details, null, 2)}</pre>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Status: {selected.resolved ? `Resolved ${selected.resolved_at ? format(new Date(selected.resolved_at), 'dd MMM HH:mm') : ''}` : 'Open'}
                </div>
                {!selected.resolved && (
                  <Button onClick={() => resolveMut.mutate(selected.id, { onSuccess: () => { toast({ title: 'Marked resolved' }); setSelected(null); } })}>
                    Mark as Resolved
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SystemEventsTab;
