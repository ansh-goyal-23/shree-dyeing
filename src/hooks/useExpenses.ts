import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Expense, ExpenseItem, ExpenseDocument, InventoryEntry } from '@/types/expense';

export function useExpenseItems() {
  return useQuery({
    queryKey: ['expense_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_items')
        .select('*')
        .eq('is_active', true)
        .order('item_name');
      if (error) throw error;
      return (data || []) as ExpenseItem[];
    },
  });
}

export function useCreateExpenseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<ExpenseItem, 'id' | 'is_active'>) => {
      const { data, error } = await supabase
        .from('expense_items')
        .insert({ ...item, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data as ExpenseItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_items'] }),
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_items(item_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any): Expense => ({
        id: r.id,
        date: r.date,
        expense_type: r.expense_type,
        item_id: r.item_id,
        item_name: r.expense_items?.item_name || '',
        category: r.category || '',
        quantity: r.quantity != null ? Number(r.quantity) : null,
        unit: r.unit || null,
        rate: r.rate != null ? Number(r.rate) : null,
        total_amount: Number(r.total_amount) || 0,
        supplier_name: r.supplier_name || '',
        linked_lot_no: r.linked_lot_no || '',
        payment_status: r.payment_status || 'Unpaid',
        notes: r.notes || '',
        created_at: r.created_at,
      }));
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      date: string;
      expense_type: string;
      item_id: string | null;
      category: string;
      quantity: number | null;
      unit: string | null;
      rate: number | null;
      total_amount: number;
      supplier_name: string;
      linked_lot_no: string;
      payment_status: string;
      notes: string;
      files?: File[];
    }) => {
      const { files, ...expenseData } = payload;
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single();
      if (error) throw error;

      // Upload files if any
      if (files && files.length > 0) {
        for (const file of files) {
          const filePath = `${expense.id}/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('expense-bills')
            .upload(filePath, file);
          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from('expense-bills')
              .getPublicUrl(filePath);
            await supabase.from('expense_documents').insert({
              expense_id: expense.id,
              file_url: urlData.publicUrl,
              file_name: file.name,
            });
          }
        }
      }

      // Update inventory for Purchase / Asset
      if (payload.expense_type !== 'Direct Expense' && payload.item_id && payload.quantity) {
        const { data: existing } = await supabase
          .from('inventory')
          .select('*')
          .eq('item_id', payload.item_id)
          .single();

        if (existing) {
          await supabase.from('inventory')
            .update({
              quantity: Number(existing.quantity) + payload.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('inventory').insert({
            item_id: payload.item_id,
            quantity: payload.quantity,
            unit: payload.unit || '',
            item_type: payload.expense_type === 'Asset' ? 'Asset' : 'Consumable',
          });
        }
      }

      return expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('expense_documents').delete().eq('expense_id', id);
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useExpenseDocuments(expenseId: string) {
  return useQuery({
    queryKey: ['expense_documents', expenseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_documents')
        .select('*')
        .eq('expense_id', expenseId);
      if (error) throw error;
      return (data || []) as ExpenseDocument[];
    },
    enabled: !!expenseId,
  });
}

export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, expense_items(item_name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any): InventoryEntry => ({
        id: r.id,
        item_id: r.item_id,
        item_name: r.expense_items?.item_name || '',
        quantity: Number(r.quantity) || 0,
        unit: r.unit || '',
        item_type: r.item_type || 'Consumable',
        updated_at: r.updated_at,
      }));
    },
  });
}
