import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, ClipboardList } from 'lucide-react';

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

const PAGE_SIZE = 200;

export default function InventoryLogs() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<string>('all');
  const [section, setSection] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory_change_logs'],
    queryFn: async () => {
      // Best-effort purge of entries older than 1 month before reading.
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

  const actions = Array.from(new Set((data || []).map(r => r.action))).sort();
  const sections = Array.from(new Set((data || []).map(r => r.section))).sort();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">Activity & Inventory Logs</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Inventory adjustments, expense changes and status updates are recorded automatically.
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
        <div className="text-sm text-muted-foreground ml-auto">{filtered.length} rows</div>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error && (
        <div className="text-destructive text-sm">
          Failed to load logs: {(error as any)?.message || String(error)}
        </div>
      )}

      {!isLoading && !error && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium whitespace-nowrap">When</th>
                <th className="text-left p-2 font-medium">User</th>
                <th className="text-left p-2 font-medium">Action</th>
                <th className="text-left p-2 font-medium">Reference</th>
                <th className="text-left p-2 font-medium">Section</th>
                <th className="text-left p-2 font-medium">Item</th>
                <th className="text-right p-2 font-medium">Previous</th>
                <th className="text-right p-2 font-medium">Change</th>
                <th className="text-right p-2 font-medium">New</th>
                <th className="text-left p-2 font-medium">Unit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={`border-t ${r.warn ? 'bg-destructive/5' : ''}`}>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('en-IN')}
                  </td>
                  <td className="p-2">{r.user_email || r.user_id?.slice(0, 8) || '—'}</td>
                  <td className="p-2">{r.action}</td>
                  <td className="p-2 font-mono text-xs">
                    {r.reference_type}: {r.reference_id}
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
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No log entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
