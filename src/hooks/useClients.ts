import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Client, ClientRateMode } from '@/types/client';

// ── Clients ──

const mapClient = (r: any): Client => ({
  id: r.id, client_name: r.client_name, contact_person: r.contact_person || '',
  phone_number: r.phone_number || '', notes: r.notes || '', created_at: r.created_at,
  rate_mode: (r.rate_mode === 'tiered' ? 'tiered' : 'flat'),
  paper_tube_baseline_kg_per_cone: r.paper_tube_baseline_kg_per_cone != null ? Number(r.paper_tube_baseline_kg_per_cone) : null,
  paper_tube_extra_cone_surcharge: r.paper_tube_extra_cone_surcharge != null ? Number(r.paper_tube_extra_cone_surcharge) : null,
});

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('client_name');
      if (error) throw error;
      return (data || []).map(mapClient);
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('clients').insert(client).select().single();
      if (error) throw error;
      return mapClient(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

// Rate-mode + paper-tube cone surcharge config, edited from Client Rate
// Master (2026-09-28). Kept separate from useCreateClient/general client
// edits since this is specifically the rates feature's own configuration.
export function useUpdateClientRateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      client_id: string;
      rate_mode: ClientRateMode;
      paper_tube_baseline_kg_per_cone: number | null;
      paper_tube_extra_cone_surcharge: number | null;
    }) => {
      const { error } = await supabase
        .from('clients')
        .update({
          rate_mode: payload.rate_mode,
          paper_tube_baseline_kg_per_cone: payload.paper_tube_baseline_kg_per_cone,
          paper_tube_extra_cone_surcharge: payload.paper_tube_extra_cone_surcharge,
        })
        .eq('id', payload.client_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}
