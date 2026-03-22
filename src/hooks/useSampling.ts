import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Client, IntakeEntry, IntakeItem } from '@/types/sampling';

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

// ── Intake Entries ──

const mapEntry = (r: any): IntakeEntry => ({
  id: r.id, intake_type: r.intake_type, received_date: r.received_date,
  sheet_date: r.sheet_date, client_id: r.client_id,
  client_name: r.clients?.client_name || '', notes: r.notes || '',
  reference_photo_path: r.reference_photo_path, created_at: r.created_at, user_id: r.user_id,
});

export function useIntakeEntries() {
  return useQuery({
    queryKey: ['intake_entries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_entries').select('*, clients(client_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapEntry);
    },
  });
}

export function useIntakeEntry(id: string) {
  return useQuery({
    queryKey: ['intake_entries', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_entries').select('*, clients(client_name)').eq('id', id).single();
      if (error) throw error;
      return mapEntry(data);
    },
    enabled: !!id,
  });
}

export function useCreateIntakeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { intake_type: string; received_date: string; sheet_date: string | null; client_id: string; notes: string; reference_photo_path: string | null }) => {
      const { data, error } = await supabase.from('intake_entries').insert(entry).select('*, clients(client_name)').single();
      if (error) throw error;
      return mapEntry(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intake_entries'] }),
  });
}

// ── Intake Items (samples + orders) ──

const mapItem = (r: any): IntakeItem => ({
  id: r.id, intake_id: r.intake_id, sample_identifier: r.sample_identifier || '',
  shade_reference: r.shade_reference || '', yarn_type: r.yarn_type || '',
  product_type: r.product_type || '', order_quantity: r.order_quantity || '',
  notes: r.notes || '', sample_photo_path: r.sample_photo_path,
  linked_lot_no: r.linked_lot_no, status: r.status,
  is_direct_order: r.is_direct_order || false,
  client_id: r.client_id,
  client_name: r.clients?.client_name || '',
  created_at: r.created_at,
});

export function useIntakeItems(intakeId: string) {
  return useQuery({
    queryKey: ['intake_items', intakeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_items').select('*, clients(client_name)').eq('intake_id', intakeId).order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapItem);
    },
    enabled: !!intakeId,
  });
}

export function useDirectOrders() {
  return useQuery({
    queryKey: ['direct_orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_items').select('*, clients(client_name)').eq('is_direct_order', true).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapItem);
    },
  });
}

export function useAllOrders() {
  return useQuery({
    queryKey: ['all_orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_items').select('*, clients(client_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapItem);
    },
  });
}

export function useOrdersForLot(lotNo: string) {
  return useQuery({
    queryKey: ['orders_for_lot', lotNo],
    queryFn: async () => {
      const { data, error } = await supabase.from('intake_items').select('*, clients(client_name)').eq('linked_lot_no', lotNo).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapItem);
    },
    enabled: !!lotNo,
  });
}

export function useCreateIntakeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('intake_items').insert(item).select('*, clients(client_name)').single();
      if (error) throw error;
      return mapItem(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intake_items'] });
      qc.invalidateQueries({ queryKey: ['direct_orders'] });
      qc.invalidateQueries({ queryKey: ['all_orders'] });
    },
  });
}

export function useUpdateIntakeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<IntakeItem> & { id: string }) => {
      const { error } = await supabase.from('intake_items').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intake_items'] });
      qc.invalidateQueries({ queryKey: ['direct_orders'] });
      qc.invalidateQueries({ queryKey: ['all_orders'] });
      qc.invalidateQueries({ queryKey: ['orders_for_lot'] });
    },
  });
}

export function useDeleteIntakeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('intake_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intake_items'] });
      qc.invalidateQueries({ queryKey: ['direct_orders'] });
      qc.invalidateQueries({ queryKey: ['all_orders'] });
    },
  });
}

export function getPhotoUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
