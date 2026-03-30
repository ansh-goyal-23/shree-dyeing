import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { InventoryStock, InventoryTransaction } from '@/types/inventory';

export function useInventoryStock() {
  return useQuery({
    queryKey: ['inventory_stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select('*, expense_items(item_name, expense_categories(category_name))')
        .order('last_updated', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any): InventoryStock => ({
        id: r.id,
        item_id: r.item_id,
        item_name: r.expense_items?.item_name || '',
        category_name: r.expense_items?.expense_categories?.category_name || '',
        current_stock: Number(r.current_stock) || 0,
        unit: r.unit || '',
        item_type: r.item_type || 'Consumable',
        minimum_stock_level: Number(r.minimum_stock_level) || 0,
        last_updated: r.last_updated,
      }));
    },
  });
}

export function useInventoryTransactions(itemId?: string) {
  return useQuery({
    queryKey: ['inventory_transactions', itemId],
    queryFn: async () => {
      let q = supabase
        .from('inventory_transactions')
        .select('*, expense_items(item_name)')
        .order('date', { ascending: false });
      if (itemId) q = q.eq('item_id', itemId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((r: any): InventoryTransaction => ({
        id: r.id,
        item_id: r.item_id,
        item_name: r.expense_items?.item_name || '',
        type: r.type,
        source: r.source,
        quantity: Number(r.quantity) || 0,
        reference_id: r.reference_id || '',
        date: r.date,
        notes: r.notes || '',
        created_at: r.created_at,
      }));
    },
    enabled: itemId !== undefined ? !!itemId : true,
  });
}

export function useAddOpeningStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { item_id: string; quantity: number; unit: string; notes: string }[]) => {
      const today = new Date().toISOString().split('T')[0];

      for (const item of items) {
        // Create transaction
        const { error: txErr } = await supabase.from('inventory_transactions').insert({
          item_id: item.item_id,
          type: 'IN',
          source: 'Opening Stock',
          quantity: item.quantity,
          reference_id: '',
          date: today,
          notes: item.notes || 'Opening stock entry',
        });
        if (txErr) throw txErr;

        // Upsert stock
        const { data: existing } = await supabase
          .from('inventory_stock')
          .select('*')
          .eq('item_id', item.item_id)
          .single();

        if (existing) {
          const { error } = await supabase
            .from('inventory_stock')
            .update({
              current_stock: Number(existing.current_stock) + item.quantity,
              last_updated: new Date().toISOString(),
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('inventory_stock').insert({
            item_id: item.item_id,
            current_stock: item.quantity,
            unit: item.unit,
            item_type: 'Consumable',
            minimum_stock_level: 0,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory_stock'] });
      qc.invalidateQueries({ queryKey: ['inventory_transactions'] });
    },
  });
}


  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      item_id: string;
      quantity: number; // positive = IN, negative = OUT
      reason: string;
    }) => {
      const { item_id, quantity, reason } = payload;
      const type = quantity >= 0 ? 'IN' : 'OUT';
      const absQty = Math.abs(quantity);

      // Create transaction
      const { error: txErr } = await supabase.from('inventory_transactions').insert({
        item_id,
        type,
        source: 'Adjustment',
        quantity: absQty,
        reference_id: '',
        date: new Date().toISOString().split('T')[0],
        notes: reason,
      });
      if (txErr) throw txErr;

      // Update stock
      const { data: existing } = await supabase
        .from('inventory_stock')
        .select('*')
        .eq('item_id', item_id)
        .single();

      if (existing) {
        const newStock = Math.max(0, Number(existing.current_stock) + quantity);
        const { error } = await supabase
          .from('inventory_stock')
          .update({ current_stock: newStock, last_updated: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Only allow positive adjustments for new items
        if (quantity <= 0) throw new Error('Cannot reduce stock for item not in inventory');
        const { error } = await supabase.from('inventory_stock').insert({
          item_id,
          current_stock: quantity,
          unit: '',
          item_type: 'Consumable',
          minimum_stock_level: 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory_stock'] });
      qc.invalidateQueries({ queryKey: ['inventory_transactions'] });
    },
  });
}

export function useUpdateMinStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, minimum_stock_level }: { id: string; minimum_stock_level: number }) => {
      const { error } = await supabase
        .from('inventory_stock')
        .update({ minimum_stock_level })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory_stock'] }),
  });
}
