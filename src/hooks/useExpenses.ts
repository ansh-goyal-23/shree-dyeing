import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Expense, ExpenseItem, ExpenseDocument, Supplier, ExpenseCategory, ExpenseLineItem, Company } from '@/types/expense';
import { logActivity } from '@/lib/activityLog';

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

// ── Companies ──
export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_master')
        .select('*')
        .order('company_name');
      if (error) throw error;
      return (data || []) as Company[];
    },
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { company_name: string }) => {
      const { data, error } = await supabase.from('company_master').insert(c).select().single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

// ── Items ──
const buildCompanyNameMap = async (rows: Array<{ company_id?: string | null }>) => {
  const companyIds = Array.from(
    new Set(rows.map(r => r.company_id).filter((id): id is string => Boolean(id)))
  );

  if (companyIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from('company_master')
    .select('id, company_name')
    .in('id', companyIds);

  if (error) {
    console.warn('Failed to load company names for expense items:', error);
    return new Map<string, string>();
  }

  return new Map((data || []).map(c => [c.id, c.company_name]));
};

const mapExpenseItemRow = (r: any, companyNameMap: Map<string, string>): ExpenseItem => ({
  id: r.id,
  item_name: r.item_name,
  category_id: r.category_id,
  category_name: r.expense_categories?.category_name || '',
  expense_type: r.expense_type || '',
  unit: r.unit,
  item_type: r.item_type,
  is_active: r.is_active,
  company_id: r.company_id,
  company_name: (r.company_id && companyNameMap.get(r.company_id)) || '',
});

export function useExpenseItems(categoryId?: string, expenseType?: string) {
  return useQuery({
    queryKey: ['expense_items', categoryId, expenseType],
    queryFn: async () => {
      let q = supabase
        .from('expense_items')
        .select('*, expense_categories(category_name)')
        .eq('is_active', true)
        .order('item_name');

      if (categoryId && categoryId.length > 0) q = q.eq('category_id', categoryId);
      if (expenseType && expenseType.length > 0) q = q.eq('expense_type', expenseType);

      const { data, error } = await q;
      if (error) throw error;

      const rows = data || [];
      const companyNameMap = await buildCompanyNameMap(rows);

      return rows.map((r: any): ExpenseItem => mapExpenseItemRow(r, companyNameMap));
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

      const rows = data || [];
      const companyNameMap = await buildCompanyNameMap(rows);

      return rows.map((r: any): ExpenseItem => mapExpenseItemRow(r, companyNameMap));
    },
  });
}

export function useCreateExpenseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { item_name: string; category_id: string | null; expense_type: string; unit: string; item_type: 'Consumable' | 'Asset'; company_id?: string | null }) => {
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
    mutationFn: async (item: { id: string; item_name: string; category_id: string | null; expense_type: string; unit: string; item_type: 'Consumable' | 'Asset'; is_active: boolean; company_id?: string | null }) => {
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
        freight: Number(r.freight) || 0,
        total_amount: Number(r.total_amount) || 0,
        linked_lot_no: r.linked_lot_no || '',
        payment_status: r.payment_status || 'Unpaid',
        notes: r.notes || '',
        created_at: r.created_at,
        created_by: r.created_by || null,
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
      freight: number;
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
        // Fetch category name once (for Coning Oil → oil_inventory routing)
        let categoryName = '';
        if (payload.category_id) {
          const { data: cat } = await supabase
            .from('expense_categories')
            .select('category_name')
            .eq('id', payload.category_id)
            .maybeSingle();
          categoryName = (cat?.category_name || '').trim();
        }
        const isOilsCategory = categoryName.toLowerCase() === 'oils & auxiliaries';

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

          // Auto-adjust Oil Inventory when item is "Coning Oil" in "Oils & Auxiliaries"
          const isConingOil = li.item_name.trim().toLowerCase() === 'coning oil';
          if (isOilsCategory && isConingOil) {
            const { data: oilRow } = await supabase
              .from('oil_inventory')
              .select('*')
              .limit(1)
              .maybeSingle();
            const prevOil = Number(oilRow?.current_stock || 0);
            const newOil = prevOil + Number(li.quantity);
            if (oilRow) {
              await supabase.from('oil_inventory')
                .update({ current_stock: newOil, last_updated: new Date().toISOString() })
                .eq('id', oilRow.id);
            } else {
              await supabase.from('oil_inventory').insert({ current_stock: newOil });
            }
            await supabase.from('inventory_transactions_v2').insert({
              inventory_kind: 'oil',
              ref_key: 'OIL',
              delta: Number(li.quantity),
              source: 'Expense Purchase',
              reference_id: expense.id,
              notes: `Coning Oil purchase via expense (${li.quantity} ${li.unit || 'kg'})`,
            });
            await logActivity({
              action: 'Expense Create',
              referenceType: 'expense',
              referenceId: expense.id,
              section: 'Oil',
              itemLabel: 'Coning Oil',
              unit: li.unit || 'kg',
              prev: prevOil,
              next: newOil,
            });
          }
        }
      }

      await logActivity({
        action: 'Expense Create',
        referenceType: 'expense',
        referenceId: expense.id,
        section: 'Expense',
        itemLabel: `${payload.expense_type} • ${payload.line_items.length} item(s)`,
        prev: null,
        next: `₹${payload.total_amount.toFixed(2)} • ${payload.payment_status}`,
      });

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
      const { data: prev } = await supabase.from('expenses').select('payment_status, total_amount').eq('id', id).single();
      const { error } = await supabase.from('expenses').update({ payment_status }).eq('id', id);
      if (error) throw error;
      await logActivity({
        action: 'Status Change',
        referenceType: 'expense',
        referenceId: id,
        section: 'Payment',
        itemLabel: `Expense payment${prev?.total_amount ? ` (₹${Number(prev.total_amount).toFixed(2)})` : ''}`,
        prev: prev?.payment_status || null,
        next: payment_status,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: prev } = await supabase.from('expenses').select('expense_type, total_amount, payment_status').eq('id', id).single();
      await supabase.from('expense_line_items').delete().eq('expense_id', id);
      await supabase.from('expense_documents').delete().eq('expense_id', id);
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      await logActivity({
        action: 'Expense Delete',
        referenceType: 'expense',
        referenceId: id,
        section: 'Expense',
        itemLabel: `${prev?.expense_type || 'Expense'} deleted`,
        prev: prev ? `₹${Number(prev.total_amount).toFixed(2)} • ${prev.payment_status}` : null,
        next: 'deleted',
        warn: true,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useExpenseDetail(expenseId: string | null) {
  return useQuery({
    queryKey: ['expense_detail', expenseId],
    queryFn: async () => {
      if (!expenseId) return null;
      const [expenseRes, lineItemsRes, docsRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('*, suppliers(supplier_name), expense_categories(category_name)')
          .eq('id', expenseId)
          .single(),
        supabase
          .from('expense_line_items')
          .select('*')
          .eq('expense_id', expenseId),
        supabase
          .from('expense_documents')
          .select('*')
          .eq('expense_id', expenseId),
      ]);
      if (expenseRes.error) throw expenseRes.error;
      const r: any = expenseRes.data;
      const expense: Expense = {
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
        freight: Number(r.freight) || 0,
        total_amount: Number(r.total_amount) || 0,
        linked_lot_no: r.linked_lot_no || '',
        payment_status: r.payment_status || 'Unpaid',
        notes: r.notes || '',
        created_at: r.created_at,
        created_by: r.created_by || null,
        line_items: (lineItemsRes.data || []).map((li: any): ExpenseLineItem => ({
          id: li.id,
          expense_id: li.expense_id,
          item_id: li.item_id,
          item_name: li.item_name,
          quantity: Number(li.quantity) || 0,
          unit: li.unit || '',
          rate: Number(li.rate) || 0,
          amount: Number(li.amount) || 0,
        })),
      };
      return { expense, documents: (docsRes.data || []) as ExpenseDocument[] };
    },
    enabled: !!expenseId,
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

