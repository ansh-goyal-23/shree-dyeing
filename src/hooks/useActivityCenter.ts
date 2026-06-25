import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessEventRow {
  id: string;
  event_timestamp: string;
  module: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  reference_number: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  change_summary: Array<{ field: string; before: unknown; after: unknown }> | null;
  created_at: string;
}

export interface BusinessEventFilters {
  from?: string;
  to?: string;
  modules?: string[];
  eventTypes?: string[];
  userId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useBusinessEvents(f: BusinessEventFilters) {
  const pageSize = f.pageSize ?? 100;
  const page = f.page ?? 0;
  return useQuery({
    queryKey: ['business_events', f],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from('business_events')
        .select('*', { count: 'exact' })
        .order('event_timestamp', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (f.from) q = q.gte('event_timestamp', f.from);
      if (f.to) q = q.lte('event_timestamp', f.to);
      if (f.modules?.length) q = q.in('module', f.modules);
      if (f.eventTypes?.length) q = q.in('event_type', f.eventTypes);
      if (f.userId) q = q.eq('user_id', f.userId);
      if (f.search) {
        const s = f.search.replace(/[,()]/g, ' ').trim();
        q = q.or(`summary.ilike.%${s}%,entity_name.ilike.%${s}%,reference_number.ilike.%${s}%`);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as BusinessEventRow[], total: count ?? 0 };
    },
  });
}

export function useBusinessEventsForEntity(entityType: string | null, entityId: string | null) {
  return useQuery({
    queryKey: ['business_events_entity', entityType, entityId],
    enabled: !!entityType && !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_events')
        .select('*')
        .eq('entity_type', entityType!)
        .eq('entity_id', entityId!)
        .order('event_timestamp', { ascending: true });
      if (error) throw error;
      return (data || []) as BusinessEventRow[];
    },
  });
}

export function useBusinessEventFacets() {
  return useQuery({
    queryKey: ['business_event_facets'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_events')
        .select('module,event_type,user_id,user_name,user_role')
        .order('event_timestamp', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const modules = new Set<string>();
      const eventTypes = new Set<string>();
      const users = new Map<string, { id: string; name: string; role: string | null }>();
      const roles = new Set<string>();
      for (const r of data || []) {
        if (r.module) modules.add(r.module);
        if (r.event_type) eventTypes.add(r.event_type);
        if (r.user_id) users.set(r.user_id, { id: r.user_id, name: r.user_name || r.user_id, role: r.user_role });
        if (r.user_role) roles.add(r.user_role);
      }
      return {
        modules: Array.from(modules).sort(),
        eventTypes: Array.from(eventTypes).sort(),
        users: Array.from(users.values()).sort((a, b) => a.name.localeCompare(b.name)),
        roles: Array.from(roles).sort(),
      };
    },
  });
}

// ---------- USER ACTIVITY ----------
export interface UserActivityRow {
  id: string;
  user_id: string;
  user_name: string | null;
  role: string | null;
  login_time: string;
  logout_time: string | null;
  last_activity: string;
  session_duration_seconds: number | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  modules_accessed: string[];
  actions_count: number;
}

export function useUserSessions(opts: { from?: string; to?: string; userId?: string; role?: string } = {}) {
  return useQuery({
    queryKey: ['user_activity', opts],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from('user_activity')
        .select('*')
        .order('login_time', { ascending: false })
        .limit(500);
      if (opts.from) q = q.gte('login_time', opts.from);
      if (opts.to) q = q.lte('login_time', opts.to);
      if (opts.userId) q = q.eq('user_id', opts.userId);
      if (opts.role) q = q.eq('role', opts.role);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as UserActivityRow[];
    },
  });
}

// ---------- SYSTEM EVENTS ----------
export interface SystemEventRow {
  id: string;
  ts: string;
  severity: 'information' | 'warning' | 'error' | 'critical';
  event_type: string;
  module: string | null;
  description: string;
  technical_details: Record<string, unknown> | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
}

export function useSystemEvents(opts: { from?: string; to?: string; severity?: string; resolved?: boolean | null } = {}) {
  return useQuery({
    queryKey: ['system_events', opts],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from('system_events')
        .select('*')
        .order('ts', { ascending: false })
        .limit(500);
      if (opts.from) q = q.gte('ts', opts.from);
      if (opts.to) q = q.lte('ts', opts.to);
      if (opts.severity) q = q.eq('severity', opts.severity);
      if (opts.resolved === true || opts.resolved === false) q = q.eq('resolved', opts.resolved);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as SystemEventRow[];
    },
  });
}

export function useResolveSystemEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('system_events')
        .update({ resolved: true, resolved_by: u?.user?.id || null, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system_events'] }),
  });
}
