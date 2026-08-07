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
  StoreInternalIssue,
  StoreInternalIssueLineInput,
  StoreFinishedGoodsReceipt,
  StoreFGCurrentStockRow,
  StoreExternalDyedYarnReceipt,
  StoreEDYCurrentStockRow,
  StoreAsset,
  StoreAssetView,
  StoreAssetMovement,
  StoreAssetStatus,
} from '@/types/store';

// Re-use the project's supabase client
import { supabase } from '@/integrations/supabase/client';
import { logBusinessEvent } from '@/lib/activityCenter';



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

export interface StoreCurrentStockByItemRow {
  item_id: string;
  item_code: string;
  item_name: string;
  category: import('@/types/store').StoreItemCategory;
  sub_category: string | null;
  unit: string;
  is_asset: boolean;
  item_created_at: string | null;
  first_received_date: string | null;
  default_rack_id: string | null;
  default_rack_code: string | null;
  default_rack_name: string | null;
  latest_rack_id: string | null;
  latest_rack_code: string | null;
  latest_rack_name: string | null;
  current_quantity: number;
  last_transaction_date: string | null;
  last_transaction_at: string | null;
}

export const useStoreCurrentStockByItem = () =>
  useQuery({
    queryKey: ['store_current_stock_by_item'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_current_stock_by_item')
        .select('*')
        .order('item_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoreCurrentStockByItemRow[];
    },
  });

// ---------- Catalogue helpers (auto-create items from transactions) ----

export interface UpsertCatalogueInput {
  item_name: string;
  category: StoreItemCategory;
  sub_category?: string | null;
  unit: string;
  is_asset?: boolean;
  remarks?: string | null;
  /** Force a specific item_code (used by FG / EDY for deterministic dedupe). */
  item_code?: string | null;
}

/**
 * Find-or-create an inventory catalogue item.
 * Dedupe rules:
 *  - If item_code is provided, dedupe on item_code (exact).
 *  - Otherwise dedupe on (lower(item_name), category).
 * Never throws on duplicate; always returns the existing row's id.
 */
export const upsertCatalogueItem = async (input: UpsertCatalogueInput): Promise<string> => {
  const name = input.item_name.trim();
  if (!name) throw new Error('Item name is required');
  if (!input.unit) throw new Error('Unit is required');

  if (input.item_code) {
    const { data: byCode } = await sb
      .from('store_items')
      .select('id')
      .eq('item_code', input.item_code)
      .maybeSingle();
    if (byCode?.id) return byCode.id as string;
  }

  const { data: byName } = await sb
    .from('store_items')
    .select('id')
    .ilike('item_name', name)
    .eq('category', input.category)
    .limit(1);
  if (byName && byName.length) return byName[0].id as string;

  const code = input.item_code
    || `${input.category.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

  const { data: created, error } = await sb
    .from('store_items')
    .insert({
      item_code: code,
      item_name: name,
      category: input.category,
      sub_category: input.sub_category || null,
      unit: input.unit,
      is_asset: input.is_asset ?? false,
      is_active: true,
      remarks: input.remarks || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return created.id as string;
};

export const useUpsertCatalogueItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCatalogueInput) => upsertCatalogueItem(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_items'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock_by_item'] });
    },
  });
};

/**
 * Find similar existing items by name (fuzzy token match).
 * Used to warn user before creating a near-duplicate item.
 */
export const useFindSimilarItems = (name: string, category?: StoreItemCategory) =>
  useQuery({
    queryKey: ['store_items_similar', name.trim().toLowerCase(), category ?? ''],
    enabled: name.trim().length >= 2,
    queryFn: async () => {
      const tokens = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
      if (!tokens.length) return [] as StoreItem[];
      let q = sb.from('store_items').select('*').eq('is_active', true);
      if (category) q = q.eq('category', category);
      q = q.ilike('item_name', `%${tokens[0]}%`);
      const { data, error } = await q.limit(50);
      if (error) throw error;
      const lcName = name.trim().toLowerCase();
      return ((data ?? []) as StoreItem[])
        .map((it: StoreItem) => {
          const lc = it.item_name.toLowerCase();
          let score = 0;
          for (const t of tokens) if (lc.includes(t)) score++;
          if (lc === lcName) score += 5;
          else if (lc.startsWith(lcName)) score += 2;
          return { it, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(x => x.it);
    },
  });

/** Upload an invoice file to the `inward-bills` bucket. */
export const useUploadInwardBill = () =>
  useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('inward-bills').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = sb.storage.from('inward-bills').getPublicUrl(path);
      return { path, url: data.publicUrl as string };
    },
  });

export const useItemTransactions = (itemId: string | undefined) =>
  useQuery({
    queryKey: ['store_item_transactions', itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_stock_transactions')
        .select('*')
        .eq('item_id', itemId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreStockTransaction[];
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

// ---------- Stock Inward (GRN) ----------

export const useStoreInwardList = () =>
  useQuery({
    queryKey: ['store_inward_list'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_stock_inward')
        .select('*')
        .order('inward_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreStockInward[];
    },
  });

export const useStoreInwardLines = (inwardNumber: string | undefined) =>
  useQuery({
    queryKey: ['store_inward_lines', inwardNumber],
    enabled: !!inwardNumber,
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_stock_transactions')
        .select('*')
        .eq('reference_type', 'stock_inward')
        .eq('reference_number', inwardNumber);
      if (error) throw error;
      return (data ?? []) as StoreStockTransaction[];
    },
  });

export interface StoreInwardLineDetail extends StoreStockTransaction {
  item_name: string;
  item_code: string;
  item_type: string | null;
  rack_code: string | null;
  rack_name: string | null;
}

/** Inward lines enriched with item + rack names, for the expandable list rows. */
export const useStoreInwardLineDetails = (inwardNumber: string | undefined) =>
  useQuery({
    queryKey: ['store_inward_line_details', inwardNumber],
    enabled: !!inwardNumber,
    queryFn: async (): Promise<StoreInwardLineDetail[]> => {
      const { data, error } = await sb
        .from('store_stock_transactions')
        .select('*')
        .eq('reference_type', 'stock_inward')
        .eq('reference_number', inwardNumber)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as StoreStockTransaction[];
      if (!rows.length) return [];

      const itemIds = [...new Set(rows.map(r => r.item_id).filter(Boolean))];
      const rackIds = [...new Set(rows.map(r => r.rack_id).filter(Boolean))] as string[];

      const [itemsRes, racksRes] = await Promise.all([
        itemIds.length
          ? sb.from('store_items').select('id,item_code,item_name,sub_category').in('id', itemIds)
          : Promise.resolve({ data: [], error: null } as any),
        rackIds.length
          ? sb.from('store_racks').select('id,rack_code,rack_name').in('id', rackIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (racksRes.error) throw racksRes.error;

      const itemMap = new Map((itemsRes.data ?? []).map((i: any) => [i.id, i]));
      const rackMap = new Map((racksRes.data ?? []).map((r: any) => [r.id, r]));

      return rows.map(r => {
        const it: any = itemMap.get(r.item_id);
        const rk: any = r.rack_id ? rackMap.get(r.rack_id) : null;
        return {
          ...r,
          item_name: it?.item_name ?? '—',
          item_code: it?.item_code ?? '',
          item_type: it?.sub_category ?? null,
          rack_code: rk?.rack_code ?? null,
          rack_name: rk?.rack_name ?? null,
        };
      });
    },
  });

interface CreateInwardPayload {
  inward_date: string;
  supplier?: string | null;
  invoice_number?: string | null;
  grn_number?: string | null;
  remarks?: string | null;
  bill_url?: string | null;
  bill_path?: string | null;
  lines: (StoreStockInwardLineInput & {
    /** If item_id is empty, create catalogue item from these fields. */
    new_item?: UpsertCatalogueInput;
  })[];
}

export const useCreateStoreInward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateInwardPayload) => {
      if (!payload.lines.length) throw new Error('Add at least one line item');

      // 0. Resolve any new_item entries into store_items rows first.
      const resolvedLines = await Promise.all(payload.lines.map(async (l) => {
        let itemId = l.item_id;
        let unit = l.unit;
        if (!itemId && l.new_item) {
          itemId = await upsertCatalogueItem(l.new_item);
          unit = unit || l.new_item.unit;
        }
        if (!itemId) throw new Error('Each line must reference an item');
        return { ...l, item_id: itemId, unit };
      }));

      // 1. Generate inward number
      const { data: numData, error: numErr } = await sb.rpc('next_store_inward_number');
      if (numErr) throw numErr;
      const inwardNumber: string = numData;

      const totalAmount = resolvedLines.reduce(
        (s, l) => s + Number(l.amount ?? (Number(l.rate || 0) * Number(l.quantity || 0))),
        0,
      );

      // 2. Insert header
      const baseHeader = {
        inward_number: inwardNumber,
        inward_date: payload.inward_date,
        supplier: payload.supplier || null,
        invoice_number: payload.invoice_number || null,
        grn_number: payload.grn_number || null,
        remarks: payload.remarks || null,
        total_amount: totalAmount,
      };

      let { data: header, error: headerErr } = await sb
        .from('store_stock_inward')
        .insert({
          ...baseHeader,
          bill_url: payload.bill_url || null,
          bill_path: payload.bill_path || null,
        })
        .select()
        .single();

      // Fallback: older databases may not have the bill columns yet.
      const msg = String(headerErr?.message || '').toLowerCase();
      if (headerErr && (msg.includes('bill_url') || msg.includes('bill_path'))) {
        const retry = await sb
          .from('store_stock_inward')
          .insert(baseHeader)
          .select()
          .single();
        header = retry.data;
        headerErr = retry.error;
        if (!headerErr) {
          toast({
            title: 'Bill attachment not saved',
            description:
              'Run sql_migrations/20260807_inward_bill_columns.sql to enable bill uploads. The inward entry itself was saved.',
          });
        }
      }
      if (headerErr) throw headerErr;

      // 3. Build transaction rows (positive quantities; stock_in type)
      const txnRows = await Promise.all(
        resolvedLines.map(async (l) => {
          const { data: txnNum, error: txnErr } = await sb.rpc('next_store_txn_number');
          if (txnErr) throw txnErr;
          const amt = l.amount ?? Number(l.rate || 0) * Number(l.quantity || 0);
          return {
            transaction_number: txnNum,
            transaction_date: payload.inward_date,
            transaction_type: 'stock_in',
            item_id: l.item_id,
            quantity: Math.abs(Number(l.quantity)),
            unit: l.unit,
            rack_id: l.rack_id || null,
            reference_type: 'stock_inward',
            reference_number: inwardNumber,
            supplier: payload.supplier || null,
            rate: l.rate ?? null,
            amount: amt || null,
            remarks: l.remarks || null,
          };
        }),
      );

      const { error: txInsErr } = await sb
        .from('store_stock_transactions')
        .insert(txnRows);

      if (txInsErr) {
        // Best-effort cleanup if line insert fails
        await sb.from('store_stock_inward').delete().eq('id', header.id);
        throw txInsErr;
      }

      return header as StoreStockInward;
    },
    onSuccess: (header, vars) => {
      qc.invalidateQueries({ queryKey: ['store_inward_list'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      logBusinessEvent({
        module: 'store', eventType: 'stock.received', severity: 'success',
        entityType: 'inward', entityId: header.id, referenceNumber: header.inward_number,
        summary: `Received Inward ${header.inward_number} — ${vars.lines.length} item(s)${vars.supplier ? ` from ${vars.supplier}` : ''}`,
        details: { lines: vars.lines.length, supplier: vars.supplier, invoice: vars.invoice_number },
      });
    },
  });
};

// ---------- Internal Issues ----------

export const useStoreIssueList = () =>
  useQuery({
    queryKey: ['store_issue_list'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_internal_issues')
        .select('*')
        .order('issue_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreInternalIssue[];
    },
  });

export const useStoreIssue = (id: string | undefined) =>
  useQuery({
    queryKey: ['store_issue', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_internal_issues')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as StoreInternalIssue;
    },
  });

export const useStoreIssueLines = (issueNumber: string | undefined) =>
  useQuery({
    queryKey: ['store_issue_lines', issueNumber],
    enabled: !!issueNumber,
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_stock_transactions')
        .select('*')
        .eq('reference_type', 'internal_issue')
        .eq('reference_number', issueNumber)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoreStockTransaction[];
    },
  });

export interface StoreIssueLineDetail {
  id: string;
  item_id: string;
  item_name: string;
  item_code: string;
  item_type: string | null;
  quantity: number;
  unit: string;
  rack_id: string | null;
  rack_code: string | null;
  rack_name: string | null;
  purpose: string | null;
}

/**
 * Issue lines enriched with item + rack names, for the expandable list rows.
 * Reversal pairs are netted out so only the current effective lines show.
 */
export const useStoreIssueLineDetails = (issueNumber: string | undefined) =>
  useQuery({
    queryKey: ['store_issue_line_details', issueNumber],
    enabled: !!issueNumber,
    queryFn: async (): Promise<StoreIssueLineDetail[]> => {
      const { data, error } = await sb
        .from('store_stock_transactions')
        .select('*')
        .eq('reference_type', 'internal_issue')
        .eq('reference_number', issueNumber)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as StoreStockTransaction[];
      if (!rows.length) return [];

      // Net out per (item, rack): outflows are negative, reversals positive.
      const net = new Map<string, {
        id: string; item_id: string; unit: string; rack_id: string | null;
        purpose: string | null; qty: number;
      }>();
      for (const t of rows) {
        const key = `${t.item_id}::${t.rack_id ?? ''}`;
        const cur = net.get(key) || {
          id: t.id, item_id: t.item_id, unit: t.unit,
          rack_id: t.rack_id, purpose: t.purpose, qty: 0,
        };
        cur.qty += Number(t.quantity);
        if (t.purpose) cur.purpose = t.purpose;
        net.set(key, cur);
      }
      const effective = Array.from(net.values()).filter(l => Number(l.qty) < 0);
      if (!effective.length) return [];

      const itemIds = [...new Set(effective.map(l => l.item_id).filter(Boolean))];
      const rackIds = [...new Set(effective.map(l => l.rack_id).filter(Boolean))] as string[];

      const [itemsRes, racksRes] = await Promise.all([
        itemIds.length
          ? sb.from('store_items').select('id,item_code,item_name,category,sub_category').in('id', itemIds)
          : Promise.resolve({ data: [], error: null } as any),
        rackIds.length
          ? sb.from('store_racks').select('id,rack_code,rack_name').in('id', rackIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (racksRes.error) throw racksRes.error;

      const itemMap = new Map((itemsRes.data ?? []).map((i: any) => [i.id, i]));
      const rackMap = new Map((racksRes.data ?? []).map((r: any) => [r.id, r]));

      return effective.map(l => {
        const it: any = itemMap.get(l.item_id);
        const rk: any = l.rack_id ? rackMap.get(l.rack_id) : null;
        return {
          id: l.id,
          item_id: l.item_id,
          item_name: it?.item_name ?? '—',
          item_code: it?.item_code ?? '',
          item_type: it?.category === 'raw_material' ? (it?.sub_category ?? null) : (it?.category ?? null),
          quantity: Math.abs(Number(l.qty)),
          unit: l.unit,
          rack_id: l.rack_id,
          rack_code: rk?.rack_code ?? null,
          rack_name: rk?.rack_name ?? null,
          purpose: l.purpose,
        };
      });
    },
  });

interface CreateIssuePayload {
  issue_date: string;
  department?: string | null;
  issued_to?: string | null;
  remarks?: string | null;
  lines: StoreInternalIssueLineInput[];
}

const buildIssueTxn = async (
  issueNumber: string,
  issueDate: string,
  l: StoreInternalIssueLineInput,
  issuedTo?: string | null,
  isReversal = false,
) => {
  const { data: txnNum, error: txnErr } = await sb.rpc('next_store_txn_number');
  if (txnErr) throw txnErr;
  const qty = Math.abs(Number(l.quantity));
  return {
    transaction_number: txnNum,
    transaction_date: issueDate,
    transaction_type: 'internal_issue',
    item_id: l.item_id,
    quantity: isReversal ? qty : -qty, // outflow negative; reversal positive
    unit: l.unit,
    rack_id: l.rack_id || null,
    reference_type: 'internal_issue',
    reference_number: issueNumber,
    person: issuedTo || null,
    purpose: l.purpose || null,
    remarks: isReversal ? `Reversal of ${issueNumber}` : null,
  };
};

export const useCreateStoreIssue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateIssuePayload) => {
      if (!payload.lines.length) throw new Error('Add at least one item');

      const { data: numData, error: numErr } = await sb.rpc('next_store_issue_number');
      if (numErr) throw numErr;
      const issueNumber: string = numData;

      const { data: header, error: headerErr } = await sb
        .from('store_internal_issues')
        .insert({
          issue_number: issueNumber,
          issue_date: payload.issue_date,
          department: payload.department || null,
          issued_to: payload.issued_to || null,
          remarks: payload.remarks || null,
        })
        .select()
        .single();
      if (headerErr) throw headerErr;

      const txnRows = await Promise.all(
        payload.lines.map((l) =>
          buildIssueTxn(issueNumber, payload.issue_date, l, payload.issued_to),
        ),
      );

      const { error: txInsErr } = await sb
        .from('store_stock_transactions')
        .insert(txnRows);

      if (txInsErr) {
        await sb.from('store_internal_issues').delete().eq('id', header.id);
        throw txInsErr;
      }

      return header as StoreInternalIssue;
    },
    onSuccess: (header, vars) => {
      qc.invalidateQueries({ queryKey: ['store_issue_list'] });
      qc.invalidateQueries({ queryKey: ['store_issue_line_details'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      logBusinessEvent({
        module: 'store', eventType: 'internal_issue.created', severity: 'success',
        entityType: 'issue', entityId: header.id, referenceNumber: header.issue_number,
        summary: `Issued slip ${header.issue_number} — ${vars.lines.length} item(s)${vars.issued_to ? ` to ${vars.issued_to}` : ''}`,
        details: { lines: vars.lines.length, department: vars.department, issued_to: vars.issued_to },
      });
    },
  });
};

interface UpdateIssuePayload extends CreateIssuePayload {
  id: string;
  issue_number: string;
}

export const useUpdateStoreIssue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateIssuePayload) => {
      if (!payload.lines.length) throw new Error('Add at least one item');

      // 1. Fetch existing outflow lines for this issue (non-reversal)
      const { data: existing, error: exErr } = await sb
        .from('store_stock_transactions')
        .select('*')
        .eq('reference_type', 'internal_issue')
        .eq('reference_number', payload.issue_number);
      if (exErr) throw exErr;

      // Compute net per (item, rack) so a previously edited issue still
      // nets correctly. Only insert reversals for the current net outflow.
      const netMap = new Map<string, { item_id: string; rack_id: string | null; unit: string; qty: number }>();
      for (const t of (existing ?? []) as StoreStockTransaction[]) {
        const key = `${t.item_id}::${t.rack_id ?? ''}`;
        const cur = netMap.get(key) || { item_id: t.item_id, rack_id: t.rack_id, unit: t.unit, qty: 0 };
        cur.qty += Number(t.quantity);
        netMap.set(key, cur);
      }

      const reversalLines: StoreInternalIssueLineInput[] = [];
      for (const v of netMap.values()) {
        if (v.qty < 0) {
          // Outstanding outflow exists -> insert positive reversal
          reversalLines.push({
            item_id: v.item_id,
            rack_id: v.rack_id,
            unit: v.unit,
            quantity: Math.abs(v.qty),
          });
        }
      }

      const reversalRows = await Promise.all(
        reversalLines.map((l) =>
          buildIssueTxn(payload.issue_number, payload.issue_date, l, payload.issued_to, true),
        ),
      );

      const newRows = await Promise.all(
        payload.lines.map((l) =>
          buildIssueTxn(payload.issue_number, payload.issue_date, l, payload.issued_to),
        ),
      );

      // 2. Update header
      const { error: hdrErr } = await sb
        .from('store_internal_issues')
        .update({
          issue_date: payload.issue_date,
          department: payload.department || null,
          issued_to: payload.issued_to || null,
          remarks: payload.remarks || null,
        })
        .eq('id', payload.id);
      if (hdrErr) throw hdrErr;

      // 3. Insert reversals + new lines
      if (reversalRows.length) {
        const { error } = await sb.from('store_stock_transactions').insert(reversalRows);
        if (error) throw error;
      }
      const { error: insErr } = await sb
        .from('store_stock_transactions')
        .insert(newRows);
      if (insErr) throw insErr;

      return { id: payload.id, issue_number: payload.issue_number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_issue_list'] });
      qc.invalidateQueries({ queryKey: ['store_issue'] });
      qc.invalidateQueries({ queryKey: ['store_issue_lines'] });
      qc.invalidateQueries({ queryKey: ['store_issue_line_details'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
    },
  });
};


// ---------- Yarn Receipts: shared row mapper ----------
// Unified table `store_yarn_receipts` stores both Finished Goods and EDY rows.
// The UI still reads `net_weight` / `gross_weight`, so we expose them as aliases
// of the single `received_weight` column.
const mapYarnReceipt = (r: any) => ({
  ...r,
  net_weight: r.received_weight,
  gross_weight: r.received_weight,
});

// ---------- Finished Goods Receipts (lot-based) ----------

export const useLotsForFG = () =>
  useQuery({
    queryKey: ['fg_eligible_lots'],
    queryFn: async () => {
      const [lotsRes, recvRes] = await Promise.all([
        sb.from('lots').select('lot_no, color_name, yarn_company_name, denier, net_weight, status, shade_number').order('lot_no', { ascending: false }),
        sb.from('store_yarn_receipts').select('lot_no').eq('source', 'finished_goods'),
      ]);
      if (lotsRes.error) throw lotsRes.error;
      if (recvRes.error) throw recvRes.error;
      const taken = new Set((recvRes.data ?? []).map((r: any) => r.lot_no));
      return ((lotsRes.data ?? []) as any[]).filter(l => !taken.has(l.lot_no));
    },
  });

export const useFGReceiptList = () =>
  useQuery({
    queryKey: ['fg_receipt_list'],
    queryFn: async () => {
      const [{ data, error }, { data: racks, error: rErr }] = await Promise.all([
        sb.from('store_yarn_receipts').select('*')
          .eq('source', 'finished_goods')
          .order('receipt_date', { ascending: false })
          .order('created_at', { ascending: false }),
        sb.from('store_racks').select('id, rack_code, rack_name'),
      ]);
      if (error) throw error;
      if (rErr) throw rErr;
      const rackMap = new Map<string, any>((racks ?? []).map((r: any) => [r.id, r]));
      return (data ?? []).map((row: any) => {
        const rec = mapYarnReceipt(row) as StoreFinishedGoodsReceipt;
        const rk = row.rack_id ? rackMap.get(row.rack_id) : null;
        (rec as any).rack_code = rk?.rack_code ?? null;
        (rec as any).rack_name = rk?.rack_name ?? null;
        return rec;
      });
    },
  });

export const useFGCurrentStock = () =>
  useQuery({
    queryKey: ['fg_current_stock'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_yarn_receipt_stock')
        .select('*')
        .eq('source', 'finished_goods')
        .order('receipt_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreFGCurrentStockRow[];
    },
  });

interface CreateFGReceiptPayload {
  receipt_date: string;
  lot_no: string;
  shade?: string | null;
  client?: string | null;
  yarn_type?: string | null;
  /** Quantity moved into stock (kg). */
  gross_weight: number;
  cone_count?: number | null;
  rack_id?: string | null;
  remarks?: string | null;
}

export const useCreateFGReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFGReceiptPayload) => {
      if (!payload.lot_no) throw new Error('Select a lot');
      if (!(payload.gross_weight > 0)) throw new Error('Gross weight must be positive');

      const { data: dup } = await sb
        .from('store_yarn_receipts')
        .select('id')
        .eq('source', 'finished_goods')
        .eq('lot_no', payload.lot_no)
        .maybeSingle();
      if (dup) throw new Error(`Lot ${payload.lot_no} has already been received`);

      const itemId = await upsertCatalogueItem({
        item_code: `FG-${payload.lot_no}`,
        item_name: `${payload.lot_no}`,
        category: 'finished_good',
        sub_category: 'Production Lot',
        unit: 'kg',
        remarks: `Auto-created for finished lot ${payload.lot_no}`,
      });

      const { data: rcptNum, error: rcptErr } = await sb.rpc('next_store_fg_number');
      if (rcptErr) throw rcptErr;
      const receiptNumber: string = rcptNum;

      const { data: header, error: headerErr } = await sb
        .from('store_yarn_receipts')
        .insert({
          receipt_number: receiptNumber,
          receipt_date: payload.receipt_date,
          source: 'finished_goods',
          lot_no: payload.lot_no,
          shade: payload.shade || null,
          client: payload.client || null,
          yarn_type: payload.yarn_type || null,
          received_weight: payload.gross_weight,
          cone_count: payload.cone_count ?? null,
          rack_id: payload.rack_id || null,
          item_id: itemId,
          remarks: payload.remarks || null,
        })
        .select()
        .single();
      if (headerErr) throw headerErr;

      const { data: txnNum, error: txnNumErr } = await sb.rpc('next_store_txn_number');
      if (txnNumErr) throw txnNumErr;
      const { error: txnErr } = await sb.from('store_stock_transactions').insert({
        transaction_number: txnNum,
        transaction_date: payload.receipt_date,
        transaction_type: 'finished_lot_receipt',
        item_id: itemId,
        quantity: Math.abs(Number(payload.gross_weight)),
        unit: 'kg',
        rack_id: payload.rack_id || null,
        reference_type: 'fg_receipt',
        reference_number: receiptNumber,
        remarks: payload.remarks || null,
      });
      if (txnErr) {
        await sb.from('store_yarn_receipts').delete().eq('id', header.id);
        throw txnErr;
      }

      return mapYarnReceipt(header) as StoreFinishedGoodsReceipt;
    },
    onSuccess: (header, vars) => {
      qc.invalidateQueries({ queryKey: ['fg_receipt_list'] });
      qc.invalidateQueries({ queryKey: ['fg_current_stock'] });
      qc.invalidateQueries({ queryKey: ['fg_eligible_lots'] });
      qc.invalidateQueries({ queryKey: ['store_items'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      logBusinessEvent({
        module: 'store', eventType: 'finished_lot.received', severity: 'success',
        entityType: 'fg_receipt', entityId: header.id, referenceNumber: header.receipt_number,
        entityName: `Lot ${vars.lot_no}`,
        summary: `Received finished Lot ${vars.lot_no} — ${Number(vars.gross_weight).toFixed(3)} kg`,
        details: { lot_no: vars.lot_no, shade: vars.shade, cones: vars.cone_count },
      });
    },
  });
};

// ---------- External Dyed Yarn Receipts ----------

export const useEDYReceiptList = () =>
  useQuery({
    queryKey: ['edy_receipt_list'],
    queryFn: async () => {
      const [{ data, error }, { data: racks, error: rErr }] = await Promise.all([
        sb.from('store_yarn_receipts').select('*')
          .eq('source', 'external_dyed_yarn')
          .order('receipt_date', { ascending: false })
          .order('created_at', { ascending: false }),
        sb.from('store_racks').select('id, rack_code, rack_name'),
      ]);
      if (error) throw error;
      if (rErr) throw rErr;
      const rackMap = new Map<string, any>((racks ?? []).map((r: any) => [r.id, r]));
      return (data ?? []).map((row: any) => {
        const rec = mapYarnReceipt(row) as StoreExternalDyedYarnReceipt;
        const rk = row.rack_id ? rackMap.get(row.rack_id) : null;
        (rec as any).rack_code = rk?.rack_code ?? null;
        (rec as any).rack_name = rk?.rack_name ?? null;
        return rec;
      });
    },
  });

export const useEDYCurrentStock = () =>
  useQuery({
    queryKey: ['edy_current_stock'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_yarn_receipt_stock')
        .select('*')
        .eq('source', 'external_dyed_yarn')
        .order('receipt_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreEDYCurrentStockRow[];
    },
  });

interface CreateEDYReceiptPayload {
  receipt_date: string;
  supplier?: string | null;
  challan_number?: string | null;
  lot_no?: string | null;
  shade_number?: string | null;
  shade?: string | null;
  yarn_type?: string | null;
  cone_count?: number | null;
  /** Quantity into stock (kg). */
  gross_weight: number;
  rate?: number | null;
  rack_id?: string | null;
  remarks?: string | null;
  challan_pdf_url?: string | null;
  challan_pdf_path?: string | null;
}

export const useCreateEDYReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEDYReceiptPayload) => {
      if (!(payload.gross_weight > 0)) throw new Error('Gross weight must be positive');

      const { data: rcptNum, error: rcptErr } = await sb.rpc('next_store_edy_number');
      if (rcptErr) throw rcptErr;
      const receiptNumber: string = rcptNum;

      const lotLabel = (payload.lot_no || payload.challan_number || receiptNumber).replace(/\s+/g, '');
      const shadeLabel = (payload.shade_number || payload.shade || 'NA').replace(/\s+/g, '');
      const dyerLabel = (payload.supplier || 'Dyer').replace(/\s+/g, '');
      const itemName = `${lotLabel}_${shadeLabel}_${dyerLabel}`;
      const itemId = await upsertCatalogueItem({
        item_code: `EDY-${receiptNumber}`,
        item_name: itemName,
        category: 'external_dyed_yarn',
        sub_category: 'External Production',
        unit: 'kg',
        remarks: `Auto-created for external dyed yarn receipt ${receiptNumber}`,
      });

      const amount =
        payload.rate != null
          ? Number(payload.rate) * Number(payload.gross_weight)
          : null;

      const { data: header, error: headerErr } = await sb
        .from('store_yarn_receipts')
        .insert({
          receipt_number: receiptNumber,
          receipt_date: payload.receipt_date,
          source: 'external_dyed_yarn',
          supplier: payload.supplier || null,
          challan_number: payload.challan_number || null,
          lot_no: payload.lot_no || null,
          shade_number: payload.shade_number || null,
          yarn_type: payload.yarn_type || null,
          shade: payload.shade || null,
          cone_count: payload.cone_count ?? null,
          received_weight: payload.gross_weight,
          rate: payload.rate ?? null,
          amount,
          rack_id: payload.rack_id || null,
          item_id: itemId,
          challan_pdf_url: payload.challan_pdf_url || null,
          challan_pdf_path: payload.challan_pdf_path || null,
          remarks: payload.remarks || null,
        })
        .select()
        .single();
      if (headerErr) throw headerErr;

      const { data: txnNum, error: txnNumErr } = await sb.rpc('next_store_txn_number');
      if (txnNumErr) throw txnNumErr;
      const { error: txnErr } = await sb.from('store_stock_transactions').insert({
        transaction_number: txnNum,
        transaction_date: payload.receipt_date,
        transaction_type: 'external_dyed_yarn_receipt',
        item_id: itemId,
        quantity: Math.abs(Number(payload.gross_weight)),
        unit: 'kg',
        rack_id: payload.rack_id || null,
        reference_type: 'edy_receipt',
        reference_number: receiptNumber,
        supplier: payload.supplier || null,
        rate: payload.rate ?? null,
        amount,
        remarks: payload.remarks || null,
      });
      if (txnErr) {
        await sb.from('store_yarn_receipts').delete().eq('id', header.id);
        throw txnErr;
      }

      return mapYarnReceipt(header) as StoreExternalDyedYarnReceipt;
    },
    onSuccess: (header, vars) => {
      qc.invalidateQueries({ queryKey: ['edy_receipt_list'] });
      qc.invalidateQueries({ queryKey: ['edy_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_items'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      logBusinessEvent({
        module: 'store', eventType: 'external_dyed_yarn.received', severity: 'success',
        entityType: 'edy_receipt', entityId: header.id, referenceNumber: header.receipt_number,
        summary: `Received external dyed yarn ${header.receipt_number} — ${Number(vars.gross_weight).toFixed(3)} kg${vars.supplier ? ` (${vars.supplier})` : ''}`,
        details: { supplier: vars.supplier, lot_no: vars.lot_no, shade_number: vars.shade_number, cones: vars.cone_count },
      });
    },
  });
};

// ---------- Yarn Receipts: shared update / delete (FG + EDY) ----------

export interface UpdateYarnReceiptPayload {
  id: string;
  receipt_number: string;
  item_id: string | null;
  receipt_date: string;
  lot_no?: string | null;
  shade?: string | null;
  shade_number?: string | null;
  yarn_type?: string | null;
  client?: string | null;
  supplier?: string | null;
  challan_number?: string | null;
  cone_count?: number | null;
  received_weight: number;
  rate?: number | null;
  rack_id?: string | null;
  remarks?: string | null;
}

export const useUpdateYarnReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateYarnReceiptPayload) => {
      if (!(payload.received_weight > 0)) throw new Error('Weight must be positive');

      // Guard: cannot reduce below what has already been issued out.
      if (payload.item_id) {
        const { data: txns, error: txErr } = await sb
          .from('store_stock_transactions')
          .select('quantity, reference_number')
          .eq('item_id', payload.item_id);
        if (txErr) throw txErr;
        const currentBalance = (txns ?? []).reduce((s: number, t: any) => s + Number(t.quantity || 0), 0);
        const receiptTxns = (txns ?? []).filter((t: any) => t.reference_number === payload.receipt_number);
        const receiptQty = receiptTxns.reduce((s: number, t: any) => s + Number(t.quantity || 0), 0);
        const otherBalance = currentBalance - receiptQty;
        if (payload.received_weight + otherBalance < 0) {
          throw new Error('Cannot reduce weight below what has already been issued out of stock.');
        }
      }

      const amount = payload.rate != null ? Number(payload.rate) * Number(payload.received_weight) : null;

      const { error: headerErr } = await sb
        .from('store_yarn_receipts')
        .update({
          receipt_date: payload.receipt_date,
          lot_no: payload.lot_no ?? null,
          shade: payload.shade ?? null,
          shade_number: payload.shade_number ?? null,
          yarn_type: payload.yarn_type ?? null,
          client: payload.client ?? null,
          supplier: payload.supplier ?? null,
          challan_number: payload.challan_number ?? null,
          cone_count: payload.cone_count ?? null,
          received_weight: payload.received_weight,
          rate: payload.rate ?? null,
          amount,
          rack_id: payload.rack_id || null,
          remarks: payload.remarks || null,
        })
        .eq('id', payload.id);
      if (headerErr) throw headerErr;

      // Sync the linked receipt transaction (identified by reference_number).
      const { error: txnErr } = await sb
        .from('store_stock_transactions')
        .update({
          transaction_date: payload.receipt_date,
          quantity: Math.abs(Number(payload.received_weight)),
          rack_id: payload.rack_id || null,
          supplier: payload.supplier ?? null,
          rate: payload.rate ?? null,
          amount,
          remarks: payload.remarks || null,
        })
        .eq('reference_number', payload.receipt_number)
        .in('reference_type', ['fg_receipt', 'edy_receipt']);
      if (txnErr) throw txnErr;

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fg_receipt_list'] });
      qc.invalidateQueries({ queryKey: ['fg_current_stock'] });
      qc.invalidateQueries({ queryKey: ['edy_receipt_list'] });
      qc.invalidateQueries({ queryKey: ['edy_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
    },
  });
};

export const useDeleteYarnReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      receipt_number: string;
      item_id: string | null;
      source: 'finished_goods' | 'external_dyed_yarn';
    }) => {
      // Block delete if the item has any transactions beyond the receipt itself
      // (i.e. stock was already issued, dispatched, etc.).
      if (payload.item_id) {
        const { data: txns, error: txErr } = await sb
          .from('store_stock_transactions')
          .select('id, reference_number, reference_type')
          .eq('item_id', payload.item_id);
        if (txErr) throw txErr;
        const others = (txns ?? []).filter(
          (t: any) => !(t.reference_number === payload.receipt_number
            && (t.reference_type === 'fg_receipt' || t.reference_type === 'edy_receipt')),
        );
        if (others.length > 0) {
          throw new Error(
            'Cannot delete: this stock has downstream transactions (issues/dispatches). Reverse those first.',
          );
        }
      }

      // 1. Delete the receipt transaction(s).
      const { error: dTxErr } = await sb
        .from('store_stock_transactions')
        .delete()
        .eq('reference_number', payload.receipt_number)
        .in('reference_type', ['fg_receipt', 'edy_receipt']);
      if (dTxErr) throw dTxErr;

      // 2. Delete the receipt header.
      const { error: dHdrErr } = await sb
        .from('store_yarn_receipts')
        .delete()
        .eq('id', payload.id);
      if (dHdrErr) throw dHdrErr;

      // 3. Best-effort: remove the auto-created catalogue item (ignore errors).
      if (payload.item_id) {
        await sb.from('store_items').delete().eq('id', payload.item_id);
      }
      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fg_receipt_list'] });
      qc.invalidateQueries({ queryKey: ['fg_current_stock'] });
      qc.invalidateQueries({ queryKey: ['fg_eligible_lots'] });
      qc.invalidateQueries({ queryKey: ['edy_receipt_list'] });
      qc.invalidateQueries({ queryKey: ['edy_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_items'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
    },
  });
};

export const useAssetItems = () =>
  useQuery({
    queryKey: ['store_items', 'asset_only'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_items')
        .select('*')
        .eq('is_asset', true)
        .eq('is_active', true)
        .order('item_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoreItem[];
    },
  });

export const useAssets = () =>
  useQuery({
    queryKey: ['store_assets'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_assets_view')
        .select('*')
        .order('asset_id', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoreAssetView[];
    },
  });

export const useAssetMovements = (assetId: string | undefined) =>
  useQuery({
    queryKey: ['store_asset_movements', assetId],
    enabled: !!assetId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_asset_movements')
        .select('*')
        .eq('asset_id', assetId)
        .order('movement_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreAssetMovement[];
    },
  });

interface CreateAssetPayload {
  asset_id?: string | null;
  /** Existing catalogue item; required unless new_item is provided. */
  item_id?: string;
  /** Auto-create the catalogue item (with is_asset=true). */
  new_item?: Omit<UpsertCatalogueInput, 'is_asset' | 'category'> & {
    category?: StoreItemCategory;
  };
  current_holder?: string | null;
  department?: string | null;
  rack_id?: string | null;
  purchase_date?: string | null;
  condition?: string | null;
  status?: StoreAssetStatus;
  remarks?: string | null;
  /** If true and asset is initialised as Available, add +1 stock transaction. */
  add_stock?: boolean;
}

export const useCreateAsset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAssetPayload) => {
      let assetCode = payload.asset_id?.trim();
      if (!assetCode) {
        const { data, error } = await sb.rpc('next_store_asset_id');
        if (error) throw error;
        assetCode = data as string;
      }
      const status = payload.status ?? 'available';

      // Resolve item_id — auto-create catalogue entry when only new_item is supplied.
      let itemId = payload.item_id || '';
      if (!itemId) {
        if (!payload.new_item) throw new Error('Either item_id or new_item is required');
        itemId = await upsertCatalogueItem({
          item_name: payload.new_item.item_name,
          category: payload.new_item.category || 'tool_equipment',
          sub_category: payload.new_item.sub_category || null,
          unit: payload.new_item.unit || 'pcs',
          is_asset: true,
          remarks: payload.new_item.remarks || `Auto-created for asset ${assetCode}`,
        });
      }

      const { data: asset, error: insErr } = await sb
        .from('store_assets')
        .insert({
          asset_id: assetCode,
          item_id: itemId,
          current_holder: payload.current_holder || null,
          department: payload.department || null,
          rack_id: payload.rack_id || null,
          purchase_date: payload.purchase_date || null,
          condition: payload.condition || null,
          status,
          remarks: payload.remarks || null,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      // Optionally seed inventory with +1 stock for this asset.
      if (payload.add_stock) {
        const { data: itemRow } = await sb
          .from('store_items')
          .select('unit')
          .eq('id', itemId)
          .single();
        const { data: txnNum } = await sb.rpc('next_store_txn_number');
        await sb.from('store_stock_transactions').insert({
          transaction_number: txnNum,
          transaction_date: new Date().toISOString().slice(0, 10),
          transaction_type: 'stock_in',
          item_id: itemId,
          quantity: 1,
          unit: itemRow?.unit || 'pcs',
          rack_id: payload.rack_id || null,
          reference_type: 'asset_register',
          reference_number: assetCode,
          remarks: `Initial stock for asset ${assetCode}`,
        });
      }

      return asset as StoreAsset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_assets'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
    },
  });
};

interface UpdateAssetPayload {
  id: string;
  current_holder?: string | null;
  department?: string | null;
  rack_id?: string | null;
  purchase_date?: string | null;
  condition?: string | null;
  status?: StoreAssetStatus;
  remarks?: string | null;
}

export const useUpdateAsset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateAssetPayload) => {
      const { data, error } = await sb
        .from('store_assets')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as StoreAsset;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store_assets'] }),
  });
};

interface AssetIssuePayload {
  asset: StoreAssetView;
  movement_date: string;
  holder: string;
  department?: string | null;
  rack_id?: string | null;
  condition?: string | null;
  remarks?: string | null;
}

export const useIssueAsset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AssetIssuePayload) => {
      const { asset } = payload;
      if (asset.status !== 'available') {
        throw new Error(`Cannot issue: asset is currently "${asset.status}".`);
      }

      const { data: txnNum, error: txnNumErr } = await sb.rpc('next_store_txn_number');
      if (txnNumErr) throw txnNumErr;

      const { data: txn, error: txnErr } = await sb
        .from('store_stock_transactions')
        .insert({
          transaction_number: txnNum,
          transaction_date: payload.movement_date,
          transaction_type: 'asset_issue',
          item_id: asset.item_id,
          quantity: -1,
          unit: 'pcs',
          rack_id: asset.rack_id,
          reference_type: 'asset',
          reference_number: asset.asset_id,
          person: payload.holder,
          remarks: payload.remarks || null,
        })
        .select()
        .single();
      if (txnErr) throw txnErr;

      await sb.from('store_asset_movements').insert({
        asset_id: asset.id,
        movement_type: 'issue',
        movement_date: payload.movement_date,
        holder: payload.holder,
        department: payload.department || null,
        rack_id: payload.rack_id || null,
        condition: payload.condition || null,
        status_after: 'issued',
        remarks: payload.remarks || null,
        transaction_id: txn.id,
      });

      await sb
        .from('store_assets')
        .update({
          status: 'issued',
          current_holder: payload.holder,
          department: payload.department || asset.department,
          condition: payload.condition || asset.condition,
        })
        .eq('id', asset.id);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['store_assets'] });
      qc.invalidateQueries({ queryKey: ['store_asset_movements'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      logBusinessEvent({
        module: 'store', eventType: 'asset.issued', severity: 'info',
        entityType: 'asset', entityId: vars.asset.id, referenceNumber: vars.asset.asset_id,
        entityName: vars.asset.item_name,
        summary: `Issued asset ${vars.asset.asset_id} to ${vars.holder}`,
        details: { department: vars.department, condition: vars.condition },
      });
    },
  });
};

interface AssetReturnPayload {
  asset: StoreAssetView;
  movement_date: string;
  rack_id?: string | null;
  condition?: string | null;
  status_after?: StoreAssetStatus; // available | repair | scrap
  remarks?: string | null;
}

export const useReturnAsset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AssetReturnPayload) => {
      const { asset } = payload;
      if (asset.status !== 'issued') {
        throw new Error(`Cannot return: asset is "${asset.status}", not issued.`);
      }
      const newStatus: StoreAssetStatus = payload.status_after ?? 'available';

      const { data: txnNum, error: txnNumErr } = await sb.rpc('next_store_txn_number');
      if (txnNumErr) throw txnNumErr;

      const { data: txn, error: txnErr } = await sb
        .from('store_stock_transactions')
        .insert({
          transaction_number: txnNum,
          transaction_date: payload.movement_date,
          transaction_type: 'asset_return',
          item_id: asset.item_id,
          quantity: 1,
          unit: 'pcs',
          rack_id: payload.rack_id || asset.rack_id,
          reference_type: 'asset',
          reference_number: asset.asset_id,
          person: asset.current_holder,
          remarks: payload.remarks || null,
        })
        .select()
        .single();
      if (txnErr) throw txnErr;

      await sb.from('store_asset_movements').insert({
        asset_id: asset.id,
        movement_type: 'return',
        movement_date: payload.movement_date,
        holder: asset.current_holder,
        department: asset.department,
        rack_id: payload.rack_id || asset.rack_id,
        condition: payload.condition || null,
        status_after: newStatus,
        remarks: payload.remarks || null,
        transaction_id: txn.id,
      });

      await sb
        .from('store_assets')
        .update({
          status: newStatus,
          current_holder: null,
          rack_id: payload.rack_id || asset.rack_id,
          condition: payload.condition || asset.condition,
        })
        .eq('id', asset.id);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['store_assets'] });
      qc.invalidateQueries({ queryKey: ['store_asset_movements'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      logBusinessEvent({
        module: 'store', eventType: 'asset.returned', severity: 'info',
        entityType: 'asset', entityId: vars.asset.id, referenceNumber: vars.asset.asset_id,
        entityName: vars.asset.item_name,
        summary: `Returned asset ${vars.asset.asset_id} (status → ${vars.status_after ?? 'available'})`,
      });
    },
  });
};

// =====================================================================
// Stock Verification (monthly physical count)
// =====================================================================

export type StoreVerificationStatus = 'draft' | 'approved' | 'cancelled';

export interface StoreVerificationSession {
  id: string;
  session_number: string;
  session_date: string;
  title: string | null;
  status: StoreVerificationStatus;
  remarks: string | null;
  approved_at: string | null;
  approved_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  adjustment_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface StoreVerificationLineView {
  id: string;
  session_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  category: StoreItemCategory;
  sub_category: string | null;
  unit: string;
  rack_id: string | null;
  rack_code: string | null;
  rack_name: string | null;
  system_quantity: number;
  physical_quantity: number | null;
  difference: number | null;
  remarks: string | null;
  adjustment_txn_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useVerificationSessions = () =>
  useQuery({
    queryKey: ['store_verification_sessions'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_verification_sessions')
        .select('*')
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreVerificationSession[];
    },
  });

export const useVerificationSession = (id: string | undefined) =>
  useQuery({
    queryKey: ['store_verification_session', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_verification_sessions')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as StoreVerificationSession;
    },
  });

export const useVerificationLines = (sessionId: string | undefined) =>
  useQuery({
    queryKey: ['store_verification_lines', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_verification_lines_view')
        .select('*')
        .eq('session_id', sessionId)
        .order('item_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoreVerificationLineView[];
    },
  });

interface CreateVerificationPayload {
  session_date: string;
  title?: string | null;
  remarks?: string | null;
  // optional filter: limit snapshot to these categories; null = all
  categories?: StoreItemCategory[] | null;
}

export const useCreateVerificationSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateVerificationPayload) => {
      const { data: num, error: numErr } = await sb.rpc('next_store_verification_number');
      if (numErr) throw numErr;

      const { data: session, error: sErr } = await sb
        .from('store_verification_sessions')
        .insert({
          session_number: num,
          session_date: payload.session_date,
          title: payload.title || null,
          remarks: payload.remarks || null,
          status: 'draft',
        })
        .select()
        .single();
      if (sErr) throw sErr;

      // Snapshot current stock per item
      let q = sb.from('store_current_stock_by_item').select('*');
      const { data: stockRows, error: stErr } = await q;
      if (stErr) throw stErr;

      const filtered = (stockRows ?? []).filter((r: any) => {
        if (!payload.categories || payload.categories.length === 0) return true;
        return payload.categories.includes(r.category);
      });

      if (filtered.length > 0) {
        const lines = filtered.map((r: any) => ({
          session_id: session.id,
          item_id: r.item_id,
          unit: r.unit,
          rack_id: r.default_rack_id,
          system_quantity: r.current_quantity ?? 0,
          physical_quantity: null,
        }));
        const { error: lErr } = await sb.from('store_verification_lines').insert(lines);
        if (lErr) throw lErr;
      }

      return session as StoreVerificationSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_verification_sessions'] });
    },
  });
};

export const useUpdateVerificationLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      session_id: string;
      physical_quantity?: number | null;
      remarks?: string | null;
    }) => {
      const patch: any = {};
      if (payload.physical_quantity !== undefined) patch.physical_quantity = payload.physical_quantity;
      if (payload.remarks !== undefined) patch.remarks = payload.remarks;
      const { error } = await sb
        .from('store_verification_lines')
        .update(patch)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['store_verification_lines', vars.session_id] });
    },
  });
};

export const useCancelVerificationSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from('store_verification_sessions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['store_verification_sessions'] });
      qc.invalidateQueries({ queryKey: ['store_verification_session', id] });
    },
  });
};

export const useApproveVerificationSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      // 1. Read session + lines
      const { data: session, error: sErr } = await sb
        .from('store_verification_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (sErr) throw sErr;
      if (session.status !== 'draft') {
        throw new Error(`Session is "${session.status}", cannot approve.`);
      }

      const { data: lines, error: lErr } = await sb
        .from('store_verification_lines')
        .select('*')
        .eq('session_id', sessionId);
      if (lErr) throw lErr;

      const adjustments = (lines ?? []).filter((l: any) => {
        if (l.physical_quantity === null || l.physical_quantity === undefined) return false;
        const diff = Number(l.physical_quantity) - Number(l.system_quantity);
        return Math.abs(diff) > 0.00001;
      });

      let adjCount = 0;
      for (const line of adjustments) {
        const diff = Number(line.physical_quantity) - Number(line.system_quantity);
        const { data: txnNum, error: tnErr } = await sb.rpc('next_store_txn_number');
        if (tnErr) throw tnErr;

        const { data: txn, error: tErr } = await sb
          .from('store_stock_transactions')
          .insert({
            transaction_number: txnNum,
            transaction_date: session.session_date,
            transaction_type: 'stock_adjustment',
            item_id: line.item_id,
            quantity: diff,
            unit: line.unit,
            rack_id: line.rack_id,
            reference_type: 'verification',
            reference_number: session.session_number,
            remarks: `Stock verification adjustment (system ${line.system_quantity} → physical ${line.physical_quantity})`,
          })
          .select()
          .single();
        if (tErr) throw tErr;

        await sb
          .from('store_verification_lines')
          .update({ adjustment_txn_id: txn.id })
          .eq('id', line.id);

        adjCount++;
      }

      const { error: upErr } = await sb
        .from('store_verification_sessions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          adjustment_count: adjCount,
        })
        .eq('id', sessionId);
      if (upErr) throw upErr;

      return { adjustments_created: adjCount };
    },
    onSuccess: (res, sessionId) => {
      qc.invalidateQueries({ queryKey: ['store_verification_sessions'] });
      qc.invalidateQueries({ queryKey: ['store_verification_session', sessionId] });
      qc.invalidateQueries({ queryKey: ['store_verification_lines', sessionId] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock_by_item'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      logBusinessEvent({
        module: 'store', eventType: 'stock_verification.completed', severity: 'success',
        entityType: 'verification', entityId: sessionId,
        summary: `Stock verification approved — ${res?.adjustments_created ?? 0} adjustment(s) posted`,
        details: res,
      });
    },
  });
};

// ---------- Stock Ledger (read-only) ----------

export interface StockLedgerRow {
  id: string;
  transaction_number: string;
  transaction_date: string;
  transaction_type: import('@/types/store').StoreTransactionType;
  item_id: string;
  item_code: string;
  item_name: string;
  category: StoreItemCategory;
  sub_category: string | null;
  item_unit: string;
  is_asset: boolean;
  quantity: number;
  qty_in: number;
  qty_out: number;
  unit: string;
  rack_id: string | null;
  rack_code: string | null;
  rack_name: string | null;
  reference_type: string | null;
  reference_number: string | null;
  person: string | null;
  supplier: string | null;
  department: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  running_balance: number;
}

export const useStockLedger = () =>
  useQuery({
    queryKey: ['store_stock_ledger'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_stock_ledger')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as StockLedgerRow[];
    },
  });

// ---------- Inventory Timeline (read-only) ----------
// Per-item ledger slice. The view already computes running_balance per item
// over its full history, so filtering by item_id preserves correct balances.
export const useItemTimeline = (itemId: string | undefined) =>
  useQuery({
    queryKey: ['store_item_timeline', itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_stock_ledger')
        .select('*')
        .eq('item_id', itemId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as StockLedgerRow[];
    },
  });



