import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Order, OrderWithStatus, OrderInput } from '@/types/order';
import { logActivity } from '@/lib/activityLog';
import { logBusinessEvent } from '@/lib/activityCenter';

const mapOrder = (r: any): OrderWithStatus => ({
  id: r.id,
  client_name: r.client_name,
  poc: r.poc || '',
  order_date: r.order_date,
  color_name: r.color_name,
  yarn_type: r.yarn_type || '',
  sample_type: r.sample_type || '',
  shade_no: r.shade_no || '',
  order_qty: Number(r.order_qty) || 0,
  uom: r.uom || 'KG',
  notes: r.notes || '',
  is_cancelled: !!r.is_cancelled,
  created_at: r.created_at,
  updated_at: r.updated_at,
  created_by: r.created_by || null,
  qty_sent: Number(r.qty_sent) || 0,
  balance_qty: Number(r.balance_qty) || 0,
  status: r.status,
});

// Orders list, joined client-side with the "possible duplicate" flag (two
// open, shade-less orders sharing client+colour+yarn type -- the one case
// the automatic challan-matching logic in the DB view can't tell apart).
export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const [ordersRes, dupesRes] = await Promise.all([
        supabase.from('orders_with_status').select('*').order('order_date', { ascending: false }),
        supabase.from('orders_possible_duplicates').select('id'),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (dupesRes.error) console.warn('possible-duplicates check failed:', dupesRes.error);

      const dupeIds = new Set((dupesRes.data || []).map((d: any) => d.id));
      return (ordersRes.data || []).map((r: any) => ({
        ...mapOrder(r),
        possibleDuplicate: dupeIds.has(r.id),
      }));
    },
  });
}

export function useClientNames() {
  return useQuery({
    queryKey: ['orders_client_names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('client_name').order('client_name');
      if (error) throw error;
      return (data || []).map((c: any) => c.client_name as string);
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OrderInput) => {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          client_name: input.client_name.trim(),
          poc: input.poc?.trim() || null,
          order_date: input.order_date,
          color_name: input.color_name.trim(),
          yarn_type: input.yarn_type?.trim() || null,
          sample_type: input.sample_type?.trim() || null,
          shade_no: input.shade_no?.trim() || null,
          order_qty: input.order_qty,
          uom: input.uom || 'KG',
          notes: input.notes?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      await logActivity({
        action: 'Order Create',
        referenceType: 'order',
        referenceId: data.id,
        section: 'Orders',
        itemLabel: `${input.client_name} • ${input.color_name}`,
        prev: null,
        next: `${input.order_qty} ${input.uom || 'KG'}`,
      });
      logBusinessEvent({
        module: 'orders', eventType: 'order.created', severity: 'success',
        entityType: 'order', entityId: data.id,
        entityName: `${input.client_name} • ${input.color_name}`,
        summary: `New order: ${input.client_name} — ${input.color_name} (${input.order_qty} ${input.uom || 'KG'})`,
        details: { shade_no: input.shade_no || null, yarn_type: input.yarn_type || null },
      });

      return data as Order;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: OrderInput & { id: string }) => {
      const { data, error } = await supabase
        .from('orders')
        .update({
          client_name: input.client_name.trim(),
          poc: input.poc?.trim() || null,
          order_date: input.order_date,
          color_name: input.color_name.trim(),
          yarn_type: input.yarn_type?.trim() || null,
          sample_type: input.sample_type?.trim() || null,
          shade_no: input.shade_no?.trim() || null,
          order_qty: input.order_qty,
          uom: input.uom || 'KG',
          notes: input.notes?.trim() || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      await logActivity({
        action: 'Order Update',
        referenceType: 'order',
        referenceId: id,
        section: 'Orders',
        itemLabel: `${input.client_name} • ${input.color_name}`,
        prev: null,
        next: `${input.order_qty} ${input.uom || 'KG'}${input.shade_no ? ` • shade ${input.shade_no}` : ''}`,
      });

      return data as Order;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useSetOrderCancelled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_cancelled }: { id: string; is_cancelled: boolean }) => {
      const { error } = await supabase.from('orders').update({ is_cancelled }).eq('id', id);
      if (error) throw error;
      await logActivity({
        action: 'Status Change',
        referenceType: 'order',
        referenceId: id,
        section: 'Orders',
        itemLabel: 'Order',
        prev: is_cancelled ? 'Open' : 'Cancelled',
        next: is_cancelled ? 'Cancelled' : 'Open',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: prev } = await supabase.from('orders').select('client_name, color_name').eq('id', id).single();
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      await logActivity({
        action: 'Order Delete',
        referenceType: 'order',
        referenceId: id,
        section: 'Orders',
        itemLabel: prev ? `${prev.client_name} • ${prev.color_name}` : 'Order',
        prev: null,
        next: 'deleted',
        warn: true,
      });
      logBusinessEvent({
        module: 'orders', eventType: 'order.deleted', severity: 'warning',
        entityType: 'order', entityId: id,
        summary: prev ? `Deleted order: ${prev.client_name} — ${prev.color_name}` : 'Deleted order',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}
