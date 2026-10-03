import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { YarnCostRow } from '@/lib/adminFinance';

const sb = supabase as any;

export interface YarnCostMasterRow extends YarnCostRow { id: string }

// Admin-only table (enforced by RLS) -- non-admins simply get an error/empty.
export function useYarnCostMaster() {
  return useQuery({
    queryKey: ['yarn_cost_master'],
    queryFn: async (): Promise<YarnCostMasterRow[]> => {
      const { data, error } = await sb.from('yarn_cost_master').select('*').order('effective_from', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id, denier: r.denier, effective_from: r.effective_from, cost_per_kg: Number(r.cost_per_kg) || 0,
      }));
    },
  });
}

export function useSaveYarnCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { denier: string; effective_from: string; cost_per_kg: number }) => {
      const { error } = await sb.from('yarn_cost_master').upsert(
        { denier: input.denier.trim(), effective_from: input.effective_from, cost_per_kg: input.cost_per_kg },
        { onConflict: 'denier,effective_from' },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yarn_cost_master'] }),
  });
}

export function useDeleteYarnCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('yarn_cost_master').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yarn_cost_master'] }),
  });
}
