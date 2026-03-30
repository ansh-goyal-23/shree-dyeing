import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Expense, ExpenseItem, ExpenseDocument, InventoryEntry, Supplier, ExpenseCategory, ExpenseLineItem } from '@/types/expense';

// ── Suppliers ──
export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('supplier_name');
      if (error) throw error;
      return (data || []) as Supplier[];
    },
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { supplier_name: string; contact?: string; notes?: string }) => {
      const { data, error } = await supabase.from('suppliers').insert(s).select().single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

// ── Categories ──
export function useExpenseCategories(expenseType?: string) {
  return useQuery({
    queryKey: ['expense_categories', expenseType],
    queryFn: async () => {
      let q = supabase.from('expense_categories').select('*').order('category_name');
      if (expenseType) q = q.eq('expense_type', expenseType);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ExpenseCategory[];
    },
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { category_name: string; expense_type: string }) => {
      const { data, error } = await supabase.from('expense_categories').insert(c).select().single();
      if (error) throw error;
      return data as ExpenseCategory;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_categories'] }),
  });
}

// ── Items ──
export function useExpenseItems(categoryId?: string, expenseType?: string) {
  return useQuery({
    queryKey: ['expense_items', categoryId, expenseType],
    queryFn: async () => {
      let q = supabase.from('expense_items').select('*, expense_categories(category_name)').eq('is_active', true).order('item_name');
      if (categoryId) q = q.eq('category_id', categoryId);
      if (expenseType) q = q.eq('expense_type', expenseType);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((r: any): ExpenseItem => ({
        id: r.id,
        item_name: r.item_name,
        category_id: r.category_id,
        category_name: r.expense_categories?.category_name || '',
        expense_type: r.expense_type || '',
        unit: r.unit,
        item_type: r.item_type,
        is_active: r.is_active,
      }));
    },
  });
}

export function useAllExpenseItems() {
  return useQuery({
    queryKey: ['expense_items', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_items')
        .select('*, expense_categories(category_name)')
        .order('item_name');
      if (error) throw error;
      return (data || []).map((r: any): ExpenseItem => ({
        id: r.id,
        item_name: r.item_name,
        category_id: r.category_id,
        category_name: r.expense_categories?.category_name || '',
        expense_type: r.expense_type || '',
        unit: r.unit,
        item_type: r.item_type,
        is_active: r.is_active,
      }));
    },
  });
}

export function useCreateExpenseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { item_name: string; category_id: string | null; expense_type: string; unit: string; item_type: 'Consumable' | 'Asset' }) => {
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

export function useUpdateExpenseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { id: string; item_name: string; category_id: string | null; expense_type: string; unit: string; item_type: 'Consumable' | 'Asset'; is_active: boolean }) => {
      const { id, ...rest } = item;
      const { data, error } = await supabase
        .from('expense_items')
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ExpenseItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_items'] }),
  });
}

// ── Expenses ──
export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, suppliers(supplier_name), expense_categories(category_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any): Expense => ({
        id: r.id,
        date: r.date,
        expense_type: r.expense_type,
        category_id: r.category_id,
        category_name: r.expense_categories?.category_name || '',
        supplier_id: r.supplier_id,
        supplier_name: r.suppliers?.supplier_name || '',
        subtotal: Number(r.subtotal) || 0,
        gst_percent: Number(r.gst_percent) || 0,
        gst_amount: Number(r.gst_amount) || 0,
        total_amount: Number(r.total_amount) || 0,
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
      category_id: string | null;
      supplier_id: string | null;
      subtotal: number;
      gst_percent: number;
      gst_amount: number;
      total_amount: number;
      linked_lot_no: string;
      payment_status: string;
      notes: string;
      line_items: { item_id: string | null; item_name: string; quantity: number; unit: string; rate: number; amount: number }[];
      files?: File[];
    }) => {
      const { line_items, files, ...expenseData } = payload;

      const { data: expense, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single();
      if (error) throw error;

      // Insert line items
      if (line_items.length > 0) {
        const rows = line_items.map(li => ({ ...li, expense_id: expense.id }));
        const { error: liErr } = await supabase.from('expense_line_items').insert(rows);
        if (liErr) console.error('Line items error:', liErr);
      }

      // Upload files
      if (files && files.length > 0) {
        for (const file of files) {
          const filePath = `${expense.id}/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage.from('expense-bills').upload(filePath, file);
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('expense-bills').getPublicUrl(filePath);
            await supabase.from('expense_documents').insert({
              expense_id: expense.id,
              file_url: urlData.publicUrl,
              file_name: file.name,
            });
          }
        }
      }

      // Update inventory_stock + create inventory_transactions for Purchase / Asset
      if (payload.expense_type !== 'Direct Expense') {
        for (const li of line_items) {
          if (!li.item_id || !li.quantity) continue;

          // Create transaction record
          await supabase.from('inventory_transactions').insert({
            item_id: li.item_id,
            type: 'IN',
            source: 'Purchase',
            quantity: li.quantity,
            reference_id: expense.id,
            date: payload.date,
            notes: `From expense bill`,
          });

          // Update stock level
          const { data: existing } = await supabase
            .from('inventory_stock')
            .select('*')
            .eq('item_id', li.item_id)
            .single();

          if (existing) {
            await supabase.from('inventory_stock')
              .update({
                current_stock: Number(existing.current_stock) + li.quantity,
                last_updated: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('inventory_stock').insert({
              item_id: li.item_id,
              current_stock: li.quantity,
              unit: li.unit || '',
              item_type: payload.expense_type === 'Asset' ? 'Asset' : 'Consumable',
              minimum_stock_level: 0,
            });
          }
        }
      }

      return expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['inventory_stock'] });
      qc.invalidateQueries({ queryKey: ['inventory_transactions'] });
    },
  });
}

export function useUpdateExpensePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: string }) => {
      const { error } = await supabase.from('expenses').update({ payment_status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('expense_line_items').delete().eq('expense_id', id);
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

