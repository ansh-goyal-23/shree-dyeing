import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';

interface LogRow {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  reference_type: string;
  reference_id: string;
  section: string;
  item_label: string;
  unit: string | null;
  prev_stock: string | null;
  change: string | null;
  new_stock: string | null;
  warn: boolean;
}

interface EventGroup {
  key: string;
  action: string;
  referenceType: string;
  referenceId: string;
  userEmail: string | null;
  userId: string | null;
  timestamp: string;     // earliest in group
  rows: LogRow[];
}

const PAGE_SIZE = 500;
// rows created within this many ms of each other for the same (user, action, reference)
// are considered the same event.
const GROUP_WINDOW_MS = 10_000;

export default function InventoryLogs() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<string>('all');
  const [section, setSection] = useState<string>('all');
  const [openEvents, setOpenEvents] = useState<Record<string, boolean>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory_change_logs'],
    queryFn: async () => {
      try { await supabase.rpc('purge_old_inventory_logs'); } catch { /* ignore */ }
      const { data, error } = await supabase
        .from('inventory_change_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      return (data || []) as LogRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter(r => {
      if (action !== 'all' && r.action !== action) return false;
      if (section !== 'all' && r.section !== section) return false;
      if (!q) return true;
      return (
        r.user_email?.toLowerCase().includes(q) ||
        r.item_label.toLowerCase().includes(q) ||
        r.reference_id.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q)
      );
    });
  }, [data, search, action, section]);

  // Group rows that belong to the same action occurrence.
  // Same (user, action, reference_type, reference_id) AND created within GROUP_WINDOW_MS of each other.
  const events = useMemo<EventGroup[]>(() => {
    // Sort ascending by time so we can window-merge, then reverse at the end.
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const buckets = new Map<string, EventGroup>();
    const result: EventGroup[] = [];

    for (const r of sorted) {
      const baseKey = `${r.user_id || 'anon'}|${r.action}|${r.reference_type}|${r.reference_id}`;
      const existing = buckets.get(baseKey);
      const t = new Date(r.created_at).getTime();
      if (existing) {
        const lastT = new Date(existing.rows[existing.rows.length - 1].created_at).getTime();
        if (t - lastT <= GROUP_WINDOW_MS) {
          existing.rows.push(r);
          continue;
        }
      }
      const group: EventGroup = {
        key: `${baseKey}|${r.id}`,
        action: r.action,
        referenceType: r.reference_type,
        referenceId: r.reference_id,
        userEmail: r.user_email,
        userId: r.user_id,
        timestamp: r.created_at,
        rows: [r],
      };
      buckets.set(baseKey, group);
      result.push(group);
    }
    // newest first
    return result.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [filtered]);

  const actions = Array.from(new Set((data || []).map(r => r.action))).sort();
  const sections = Array.from(new Set((data || []).map(r => r.section))).sort();

  const toggleEvent = (key: string) => {
    setOpenEvents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">Activity & Inventory Logs</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Inventory adjustments, expense changes and status updates are recorded automatically.
        Each card below is one action; all inventory changes from that action are grouped under it.
        Entries older than 1 month are purged. Showing latest {PAGE_SIZE} entries.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search user, item, lot/challan…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-auto">
          {events.length} events • {filtered.length} rows
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-destructive text-sm">
          Failed to load logs: {(error as any)?.message || String(error)}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-3">
          {events.map(ev => {
            const isOpen = openEvents[ev.key] !== false;
            const warningCount = ev.rows.filter(r => r.warn).length;
            return (
              <div key={ev.key} className="rounded-md border bg-card">
                <button
                  onClick={() => toggleEvent(ev.key)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent/40 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-semibold text-sm">{ev.action}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {ev.referenceType}: {ev.referenceId}
                  </span>
                  <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                    {ev.rows.length} change{ev.rows.length > 1 ? 's' : ''}
                  </span>
                  {warningCount > 0 && (
                    <span className="ml-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {warningCount}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {ev.userEmail || ev.userId?.slice(0, 8) || '—'} • {new Date(ev.timestamp).toLocaleString('en-IN')}
                  </span>
                </button>
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium whitespace-nowrap">When</th>
                          <th className="text-left p-2 font-medium">Section</th>
                          <th className="text-left p-2 font-medium">Item</th>
                          <th className="text-right p-2 font-medium">Previous</th>
                          <th className="text-right p-2 font-medium">Change</th>
                          <th className="text-right p-2 font-medium">New</th>
                          <th className="text-left p-2 font-medium">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ev.rows.map(r => (
                          <tr key={r.id} className={`border-t ${r.warn ? 'bg-destructive/5' : ''}`}>
                            <td className="p-2 whitespace-nowrap text-muted-foreground">
                              {new Date(r.created_at).toLocaleTimeString('en-IN')}
                            </td>
                            <td className="p-2">{r.section}</td>
                            <td className="p-2">
                              <span className="inline-flex items-center gap-1.5">
                                {r.warn && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                                {r.item_label}
                              </span>
                            </td>
                            <td className="p-2 text-right font-mono">{r.prev_stock}</td>
                            <td className="p-2 text-right font-mono font-semibold">{r.change}</td>
                            <td className={`p-2 text-right font-mono ${r.warn ? 'text-destructive font-semibold' : ''}`}>
                              {r.new_stock}
                            </td>
                            <td className="p-2 text-muted-foreground">{r.unit || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="text-center text-muted-foreground py-8">No log entries.</div>
          )}
        </div>
      )}
    </div>
  );
}
