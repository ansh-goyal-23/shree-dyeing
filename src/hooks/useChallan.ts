import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Challan, ChallanItem } from '@/types/challan';

const mapChallan = (r: any): Challan => ({
  id: r.id,
  challan_number: r.challan_number,
  date: r.date,
  client_id: r.client_id,
  client_name: r.clients?.client_name || '',
  notes: r.notes || '',
  prepared_by_name: r.prepared_by_name || '',
  receiver_name: r.receiver_name || '',
  receiver_contact_number: r.receiver_contact_number || '',
  created_at: r.created_at,
  created_by: r.created_by || null,
});

const mapItem = (r: any): ChallanItem => ({
  id: r.id,
  challan_id: r.challan_id,
  lot_no: r.lot_no,
  shade_number: r.shade_number || '',
  color_name: r.color_name || '',
  packaging_type: r.packaging_type || 'paper_tube',
  gross_weight: Number(r.gross_weight) || 0,
  num_of_units: Number(r.num_of_units) ?? Number(r.num_of_paper_tubes) ?? 0,
  net_weight: Number(r.net_weight) || 0,
  rate: Number(r.rate) || 0,
  amount: Number(r.amount) || 0,
  created_by: r.created_by || null,
});

export function useChallans() {
  return useQuery({
    queryKey: ['challans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challans')
        .select('*, clients(client_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapChallan);
    },
  });
}

export function useChallan(id: string) {
  return useQuery({
    queryKey: ['challans', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challans')
        .select('*, clients(client_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return mapChallan(data);
    },
    enabled: !!id,
  });
}

export function useChallanItems(challanId: string) {
  return useQuery({
    queryKey: ['challan_items', challanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challan_items')
        .select('*')
        .eq('challan_id', challanId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapItem);
    },
    enabled: !!challanId,
  });
}

export function useCreateChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      challan_number: string;
      date: string;
      client_id: string;
      notes: string;
      prepared_by_name: string;
      receiver_name: string;
      receiver_contact_number: string;
      items: Omit<ChallanItem, 'id' | 'challan_id'>[];
    }) => {
      const { data: challan, error: cErr } = await supabase
        .from('challans')
        .insert({
          challan_number: payload.challan_number,
          date: payload.date,
          client_id: payload.client_id,
          notes: payload.notes,
          prepared_by_name: payload.prepared_by_name,
          receiver_name: payload.receiver_name,
          receiver_contact_number: payload.receiver_contact_number,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      if (payload.items.length > 0) {
        const { error: iErr } = await supabase.from('challan_items').insert(
          payload.items.map(item => ({
            challan_id: challan.id,
            lot_no: item.lot_no,
            shade_number: item.shade_number,
            color_name: item.color_name,
            packaging_type: item.packaging_type,
            gross_weight: item.gross_weight,
            num_of_units: item.num_of_units,
            net_weight: item.net_weight,
            rate: item.rate,
            amount: item.amount,
          }))
        );
        if (iErr) throw iErr;
      }
      return challan;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challans'] }),
  });
}

export function useUpdateChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      challan_number: string;
      date: string;
      client_id: string;
      notes: string;
      prepared_by_name: string;
      receiver_name: string;
      receiver_contact_number: string;
      items: Omit<ChallanItem, 'id' | 'challan_id'>[];
    }) => {
      const { error: cErr } = await supabase
        .from('challans')
        .update({
          challan_number: payload.challan_number,
          date: payload.date,
          client_id: payload.client_id,
          notes: payload.notes,
          prepared_by_name: payload.prepared_by_name,
          receiver_name: payload.receiver_name,
          receiver_contact_number: payload.receiver_contact_number,
        })
        .eq('id', payload.id);
      if (cErr) throw cErr;

      await supabase.from('challan_items').delete().eq('challan_id', payload.id);
      if (payload.items.length > 0) {
        const { error: iErr } = await supabase.from('challan_items').insert(
          payload.items.map(item => ({
            challan_id: payload.id,
            lot_no: item.lot_no,
            shade_number: item.shade_number,
            color_name: item.color_name,
            packaging_type: item.packaging_type,
            gross_weight: item.gross_weight,
            num_of_units: item.num_of_units,
            net_weight: item.net_weight,
            rate: item.rate,
            amount: item.amount,
          }))
        );
        if (iErr) throw iErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challans'] }),
  });
}

export function useDeleteChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('challan_items').delete().eq('challan_id', id);
      const { error } = await supabase.from('challans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challans'] }),
  });
}
