import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { IntakeEntry, IntakeItem } from '@/types/sampling';

const mapEntry = (r: any): IntakeEntry => ({
  id: r.id, intake_type: r.intake_type, received_date: r.received_date,
  sheet_date: r.sheet_date, client_name: r.client_name, notes: r.notes || '',
  reference_photo_path: r.reference_photo_path, created_at: r.created_at, user_id: r.user_id,
});

const mapItem = (r: any): IntakeItem => ({
  id: r.id, intake_id: r.intake_id, sample_identifier: r.sample_identifier,
  shade_reference: r.shade_reference || '', yarn_type: r.yarn_type || '',
  product_type: r.product_type || '', order_quantity: r.order_quantity || '',
  notes: r.notes || '', sample_photo_path: r.sample_photo_path,
  linked_lot_no: r.linked_lot_no, status: r.status, created_at: r.created_at,
});

export function useIntakeEntries() {
  return useQuery({
    queryKey: ['intake_entries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_entries').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapEntry);
    },
  });
}

export function useIntakeEntry(id: string) {
  return useQuery({
    queryKey: ['intake_entries', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_entries').select('*').eq('id', id).single();
      if (error) throw error;
      return mapEntry(data);
    },
    enabled: !!id,
  });
}

export function useIntakeItems(intakeId: string) {
  return useQuery({
    queryKey: ['intake_items', intakeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_items').select('*').eq('intake_id', intakeId).order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapItem);
    },
    enabled: !!intakeId,
  });
}

export function useCreateIntakeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<IntakeEntry, 'id' | 'created_at' | 'user_id'>) => {
      const { data, error } = await supabase.from('intake_entries').insert(entry).select().single();
      if (error) throw error;
      return mapEntry(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intake_entries'] }),
  });
}

export function useCreateIntakeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<IntakeItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('intake_items').insert(item).select().single();
      if (error) throw error;
      return mapItem(data);
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['intake_items', vars.intake_id] }),
  });
}

export function useUpdateIntakeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<IntakeItem> & { id: string }) => {
      const { error } = await supabase.from('intake_items').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intake_items'] }),
  });
}

export function useDeleteIntakeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('intake_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intake_items'] }),
  });
}

export function getPhotoUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
