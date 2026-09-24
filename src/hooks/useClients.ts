import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Client } from '@/types/client';

// ── Clients ──

const mapClient = (r: any): Client => ({
  id: r.id, client_name: r.client_name, contact_person: r.contact_person || '',
  phone_number: r.phone_number || '', notes: r.notes || '', created_at: r.created_at,
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
