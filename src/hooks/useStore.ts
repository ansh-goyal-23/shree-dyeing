import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import type {
  StoreItem,
  StoreRack,
  StoreStockTransaction,
  StoreCurrentStockRow,
  StoreItemCategory,
  StoreStockInward,
  StoreStockInwardLineInput,
} from '@/types/store';

// Re-use the project's supabase client
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

// ---------- Items ----------

export const useStoreItems = (opts?: { activeOnly?: boolean }) =>
  useQuery({
    queryKey: ['store_items', opts?.activeOnly ?? true],
    queryFn: async () => {
      let q = sb.from('store_items').select('*').order('item_name', { ascending: true });
      if (opts?.activeOnly !== false) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StoreItem[];
    },
  });

export const useCreateStoreItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<StoreItem, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await sb.from('store_items').insert(payload).select().single();
      if (error) throw error;
      return data as StoreItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store_items'] }),
  });
};

export const useUpdateStoreItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<StoreItem> & { id: string }) => {
      const { data, error } = await sb.from('store_items').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as StoreItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store_items'] }),
  });
};

// ---------- Racks ----------

export const useStoreRacks = () =>
  useQuery({
    queryKey: ['store_racks'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_racks')
        .select('*')
        .order('rack_code', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoreRack[];
    },
  });

export const useCreateStoreRack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<StoreRack, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await sb.from('store_racks').insert(payload).select().single();
      if (error) throw error;
      return data as StoreRack;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store_racks'] }),
  });
};

// ---------- Transactions ----------

export const useStoreTransactions = (limit = 200) =>
  useQuery({
    queryKey: ['store_transactions', limit],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_stock_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as StoreStockTransaction[];
    },
  });

// ---------- Current Stock view ----------

export const useStoreCurrentStock = () =>
  useQuery({
    queryKey: ['store_current_stock'],
    queryFn: async () => {
      const { data, error } = await sb.from('store_current_stock').select('*');
      if (error) throw error;
      return (data ?? []) as StoreCurrentStockRow[];
    },
  });

// ---------- Categories (UI labels) ----------

export const STORE_CATEGORY_LABEL: Record<StoreItemCategory, string> = {
  raw_material: 'Raw Materials',
  office_utility: 'Office Utilities',
  tool_equipment: 'Tools & Equipment',
  finished_good: 'Finished Goods',
  external_dyed_yarn: 'External Dyed Yarn',
};

export const STORE_CATEGORIES: { value: StoreItemCategory; label: string }[] = [
  { value: 'raw_material', label: 'Raw Materials' },
  { value: 'office_utility', label: 'Office Utilities' },
  { value: 'tool_equipment', label: 'Tools & Equipment' },
  { value: 'finished_good', label: 'Finished Goods' },
  { value: 'external_dyed_yarn', label: 'External Dyed Yarn' },
];

export const RAW_MATERIAL_SUBCATEGORIES: { value: string; label: string }[] = [
  { value: 'grey_yarn', label: 'Grey Yarn' },
  { value: 'dye', label: 'Dyes' },
  { value: 'chemical', label: 'Chemicals' },
  { value: 'oil', label: 'Oil' },
  { value: 'paper_tube', label: 'Paper Tubes' },
  { value: 'packaging_material', label: 'Packaging' },
];

export const STORE_UNITS = ['kg', 'gm', 'mg', 'ltr', 'ml', 'pcs', 'mtr', 'set', 'box', 'roll'];
