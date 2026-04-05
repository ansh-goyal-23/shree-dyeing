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
