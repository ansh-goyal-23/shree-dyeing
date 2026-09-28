import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientRate {
  id: string;
  client_id: string;
  yarn_type: string;
  sampling_rate: number;
  production_rate: number;
  same_rate: boolean;
  created_at: string;
}

const mapRate = (r: any): ClientRate => ({
  id: r.id,
  client_id: r.client_id,
  yarn_type: r.yarn_type || '',
  sampling_rate: Number(r.sampling_rate) || 0,
  production_rate: Number(r.production_rate) || 0,
  same_rate: r.same_rate ?? false,
  created_at: r.created_at,
});

export function useClientRates(clientId?: string) {
  return useQuery({
    queryKey: ['client_rates', clientId],
    queryFn: async () => {
      let query = supabase.from('client_rate_master').select('*');
      if (clientId) query = query.eq('client_id', clientId);
      const { data, error } = await query.order('yarn_type');
      if (error) throw error;
      return (data || []).map(mapRate);
    },
  });
}

export function useAllClientRates() {
  return useQuery({
    queryKey: ['client_rates_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_rate_master')
        .select('*')
        .order('yarn_type');
      if (error) throw error;
      return (data || []).map(mapRate);
    },
  });
}

export function useUpsertClientRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      client_id: string;
      yarn_type: string;
      sampling_rate: number;
      production_rate: number;
      same_rate: boolean;
    }) => {
      const row = {
        client_id: payload.client_id,
        yarn_type: payload.yarn_type.trim(),
        sampling_rate: payload.sampling_rate,
        production_rate: payload.same_rate ? payload.sampling_rate : payload.production_rate,
        same_rate: payload.same_rate,
      };
      if (payload.id) {
        const { error } = await supabase.from('client_rate_master').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('client_rate_master').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_rates'] });
      qc.invalidateQueries({ queryKey: ['client_rates_all'] });
    },
  });
}

export function useDeleteClientRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_rate_master').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_rates'] });
      qc.invalidateQueries({ queryKey: ['client_rates_all'] });
    },
  });
}

export function lookupRate(
  rates: ClientRate[],
  clientId: string,
  yarnType: string,
  lotStatus: string
): number | null {
  const match = rates.find(
    r => r.client_id === clientId && r.yarn_type.toLowerCase() === yarnType.toLowerCase()
  );
  if (!match) return null;
  if (match.same_rate) return match.sampling_rate;
  return lotStatus === 'Production' ? match.production_rate : match.sampling_rate;
}

// ---------------------------------------------------------------------
// Tiered rate system (2026-09-28): yarn cost per (client, yarn type) +
// quantity-based overhead tiers per client. Used only by clients with
// rate_mode === 'tiered' (see src/types/client.ts) -- flat-rate clients
// above are completely unaffected by any of this.
// ---------------------------------------------------------------------

export interface ClientYarnCost {
  id: string;
  client_id: string;
  yarn_type: string;
  rate_per_kg: number;
  created_at: string;
}

export interface ClientRateTier {
  id: string;
  client_id: string;
  min_qty: number;
  max_qty: number | null; // null = "and above"
  overhead_rate: number;
  label: string;
  sort_order: number;
  created_at: string;
}

const mapYarnCost = (r: any): ClientYarnCost => ({
  id: r.id,
  client_id: r.client_id,
  yarn_type: r.yarn_type || '',
  rate_per_kg: Number(r.rate_per_kg) || 0,
  created_at: r.created_at,
});

const mapRateTier = (r: any): ClientRateTier => ({
  id: r.id,
  client_id: r.client_id,
  min_qty: Number(r.min_qty) || 0,
  max_qty: r.max_qty != null ? Number(r.max_qty) : null,
  overhead_rate: Number(r.overhead_rate) || 0,
  label: r.label || '',
  sort_order: Number(r.sort_order) || 0,
  created_at: r.created_at,
});

export function useClientYarnCosts(clientId?: string) {
  return useQuery({
    queryKey: ['client_yarn_costs', clientId],
    queryFn: async () => {
      let query = supabase.from('client_yarn_costs').select('*');
      if (clientId) query = query.eq('client_id', clientId);
      const { data, error } = await query.order('yarn_type');
      if (error) throw error;
      return (data || []).map(mapYarnCost);
    },
  });
}

export function useAllClientYarnCosts() {
  return useQuery({
    queryKey: ['client_yarn_costs_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_yarn_costs').select('*').order('yarn_type');
      if (error) throw error;
      return (data || []).map(mapYarnCost);
    },
  });
}

export function useUpsertClientYarnCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; client_id: string; yarn_type: string; rate_per_kg: number }) => {
      const row = {
        client_id: payload.client_id,
        yarn_type: payload.yarn_type.trim(),
        rate_per_kg: payload.rate_per_kg,
      };
      if (payload.id) {
        const { error } = await supabase.from('client_yarn_costs').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('client_yarn_costs').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_yarn_costs'] });
      qc.invalidateQueries({ queryKey: ['client_yarn_costs_all'] });
    },
  });
}

export function useDeleteClientYarnCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_yarn_costs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_yarn_costs'] });
      qc.invalidateQueries({ queryKey: ['client_yarn_costs_all'] });
    },
  });
}

export function useClientRateTiers(clientId?: string) {
  return useQuery({
    queryKey: ['client_rate_tiers', clientId],
    queryFn: async () => {
      let query = supabase.from('client_rate_tiers').select('*');
      if (clientId) query = query.eq('client_id', clientId);
      const { data, error } = await query.order('sort_order');
      if (error) throw error;
      return (data || []).map(mapRateTier);
    },
  });
}

export function useAllClientRateTiers() {
  return useQuery({
    queryKey: ['client_rate_tiers_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_rate_tiers').select('*').order('sort_order');
      if (error) throw error;
      return (data || []).map(mapRateTier);
    },
  });
}

export function useUpsertClientRateTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      client_id: string;
      min_qty: number;
      max_qty: number | null;
      overhead_rate: number;
      label: string;
      sort_order: number;
    }) => {
      const row = {
        client_id: payload.client_id,
        min_qty: payload.min_qty,
        max_qty: payload.max_qty,
        overhead_rate: payload.overhead_rate,
        label: payload.label.trim(),
        sort_order: payload.sort_order,
      };
      if (payload.id) {
        const { error } = await supabase.from('client_rate_tiers').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('client_rate_tiers').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_rate_tiers'] });
      qc.invalidateQueries({ queryKey: ['client_rate_tiers_all'] });
    },
  });
}

export function useDeleteClientRateTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_rate_tiers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_rate_tiers'] });
      qc.invalidateQueries({ queryKey: ['client_rate_tiers_all'] });
    },
  });
}

/** Yarn cost for a (client, yarn type) pair, or null if not configured. */
export function lookupYarnCost(
  costs: ClientYarnCost[],
  clientId: string,
  yarnType: string,
): number | null {
  const match = costs.find(
    c => c.client_id === clientId && c.yarn_type.toLowerCase() === (yarnType || '').toLowerCase()
  );
  return match ? match.rate_per_kg : null;
}
