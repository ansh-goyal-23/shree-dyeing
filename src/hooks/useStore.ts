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
  default_rack_id: string | null;
  default_rack_code: string | null;
  default_rack_name: string | null;
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

interface CreateInwardPayload {
  inward_date: string;
  supplier?: string | null;
  invoice_number?: string | null;
  grn_number?: string | null;
  remarks?: string | null;
  lines: StoreStockInwardLineInput[];
}

export const useCreateStoreInward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateInwardPayload) => {
      if (!payload.lines.length) throw new Error('Add at least one line item');

      // 1. Generate inward number
      const { data: numData, error: numErr } = await sb.rpc('next_store_inward_number');
      if (numErr) throw numErr;
      const inwardNumber: string = numData;

      const totalAmount = payload.lines.reduce(
        (s, l) => s + Number(l.amount ?? (Number(l.rate || 0) * Number(l.quantity || 0))),
        0,
      );

      // 2. Insert header
      const { data: header, error: headerErr } = await sb
        .from('store_stock_inward')
        .insert({
          inward_number: inwardNumber,
          inward_date: payload.inward_date,
          supplier: payload.supplier || null,
          invoice_number: payload.invoice_number || null,
          grn_number: payload.grn_number || null,
          remarks: payload.remarks || null,
          total_amount: totalAmount,
        })
        .select()
        .single();
      if (headerErr) throw headerErr;

      // 3. Build transaction rows (positive quantities; stock_in type)
      const txnRows = await Promise.all(
        payload.lines.map(async (l) => {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_inward_list'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_issue_list'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
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
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
    },
  });
};


// ---------- Finished Goods Receipts (lot-based) ----------

export const useLotsForFG = () =>
  useQuery({
    queryKey: ['fg_eligible_lots'],
    queryFn: async () => {
      const [lotsRes, recvRes] = await Promise.all([
        sb.from('lots').select('lot_no, color_name, yarn_company_name, denier, net_weight, status, shade_number').order('lot_no', { ascending: false }),
        sb.from('store_finished_goods_receipts').select('lot_no'),
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
      const { data, error } = await sb
        .from('store_finished_goods_receipts')
        .select('*')
        .order('receipt_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreFinishedGoodsReceipt[];
    },
  });

export const useFGCurrentStock = () =>
  useQuery({
    queryKey: ['fg_current_stock'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_fg_current_stock')
        .select('*')
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
  net_weight: number;
  rack_id?: string | null;
  remarks?: string | null;
}

export const useCreateFGReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFGReceiptPayload) => {
      if (!payload.lot_no) throw new Error('Select a lot');
      if (!(payload.net_weight > 0)) throw new Error('Net weight must be positive');

      const { data: dup } = await sb
        .from('store_finished_goods_receipts')
        .select('id')
        .eq('lot_no', payload.lot_no)
        .maybeSingle();
      if (dup) throw new Error(`Lot ${payload.lot_no} has already been received`);

      const fgItemCode = `FG-${payload.lot_no}`;
      let itemId: string;
      const { data: existingItem } = await sb
        .from('store_items')
        .select('id')
        .eq('item_code', fgItemCode)
        .maybeSingle();
      if (existingItem?.id) {
        itemId = existingItem.id;
      } else {
        const { data: newItem, error: itemErr } = await sb
          .from('store_items')
          .insert({
            item_code: fgItemCode,
            item_name: `${payload.lot_no}${payload.shade ? ' — ' + payload.shade : ''}`,
            category: 'finished_good',
            sub_category: null,
            unit: 'kg',
            is_asset: false,
            is_active: true,
            default_rack: payload.rack_id || null,
            remarks: `Auto-created for finished lot ${payload.lot_no}`,
          })
          .select('id')
          .single();
        if (itemErr) throw itemErr;
        itemId = newItem.id;
      }

      const { data: rcptNum, error: rcptErr } = await sb.rpc('next_store_fg_number');
      if (rcptErr) throw rcptErr;
      const receiptNumber: string = rcptNum;

      const { data: header, error: headerErr } = await sb
        .from('store_finished_goods_receipts')
        .insert({
          receipt_number: receiptNumber,
          receipt_date: payload.receipt_date,
          lot_no: payload.lot_no,
          shade: payload.shade || null,
          client: payload.client || null,
          yarn_type: payload.yarn_type || null,
          net_weight: payload.net_weight,
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
        quantity: Math.abs(Number(payload.net_weight)),
        unit: 'kg',
        rack_id: payload.rack_id || null,
        reference_type: 'fg_receipt',
        reference_number: receiptNumber,
        remarks: payload.remarks || null,
      });
      if (txnErr) {
        await sb.from('store_finished_goods_receipts').delete().eq('id', header.id);
        throw txnErr;
      }

      return header as StoreFinishedGoodsReceipt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fg_receipt_list'] });
      qc.invalidateQueries({ queryKey: ['fg_current_stock'] });
      qc.invalidateQueries({ queryKey: ['fg_eligible_lots'] });
      qc.invalidateQueries({ queryKey: ['store_items'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
    },
  });
};

// ---------- External Dyed Yarn Receipts ----------

export const useEDYReceiptList = () =>
  useQuery({
    queryKey: ['edy_receipt_list'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_external_dyed_yarn_receipts')
        .select('*')
        .order('receipt_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreExternalDyedYarnReceipt[];
    },
  });

export const useEDYCurrentStock = () =>
  useQuery({
    queryKey: ['edy_current_stock'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('store_edy_current_stock')
        .select('*')
        .order('receipt_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreEDYCurrentStockRow[];
    },
  });

interface CreateEDYReceiptPayload {
  receipt_date: string;
  supplier?: string | null;
  challan_number?: string | null;
  yarn_type?: string | null;
  shade?: string | null;
  net_weight: number;
  rate?: number | null;
  rack_id?: string | null;
  remarks?: string | null;
}

export const useCreateEDYReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEDYReceiptPayload) => {
      if (!(payload.net_weight > 0)) throw new Error('Net weight must be positive');

      const { data: rcptNum, error: rcptErr } = await sb.rpc('next_store_edy_number');
      if (rcptErr) throw rcptErr;
      const receiptNumber: string = rcptNum;

      const itemCode = `EDY-${receiptNumber}`;
      const itemName = `${receiptNumber}${payload.shade ? ' — ' + payload.shade : ''}${payload.supplier ? ' (' + payload.supplier + ')' : ''}`;
      const { data: newItem, error: itemErr } = await sb
        .from('store_items')
        .insert({
          item_code: itemCode,
          item_name: itemName,
          category: 'external_dyed_yarn',
          sub_category: null,
          unit: 'kg',
          is_asset: false,
          is_active: true,
          default_rack: payload.rack_id || null,
          remarks: `Auto-created for external dyed yarn receipt ${receiptNumber}`,
        })
        .select('id')
        .single();
      if (itemErr) throw itemErr;
      const itemId: string = newItem.id;

      const amount =
        payload.rate != null
          ? Number(payload.rate) * Number(payload.net_weight)
          : null;

      const { data: header, error: headerErr } = await sb
        .from('store_external_dyed_yarn_receipts')
        .insert({
          receipt_number: receiptNumber,
          receipt_date: payload.receipt_date,
          supplier: payload.supplier || null,
          challan_number: payload.challan_number || null,
          yarn_type: payload.yarn_type || null,
          shade: payload.shade || null,
          net_weight: payload.net_weight,
          rate: payload.rate ?? null,
          amount,
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
        transaction_type: 'external_dyed_yarn_receipt',
        item_id: itemId,
        quantity: Math.abs(Number(payload.net_weight)),
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
        await sb.from('store_external_dyed_yarn_receipts').delete().eq('id', header.id);
        throw txnErr;
      }

      return header as StoreExternalDyedYarnReceipt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['edy_receipt_list'] });
      qc.invalidateQueries({ queryKey: ['edy_current_stock'] });
      qc.invalidateQueries({ queryKey: ['store_items'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
    },
  });
};

// ---------- Asset Management ----------

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
  item_id: string;
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

      const { data: asset, error: insErr } = await sb
        .from('store_assets')
        .insert({
          asset_id: assetCode,
          item_id: payload.item_id,
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
          .eq('id', payload.item_id)
          .single();
        const { data: txnNum } = await sb.rpc('next_store_txn_number');
        await sb.from('store_stock_transactions').insert({
          transaction_number: txnNum,
          transaction_date: new Date().toISOString().slice(0, 10),
          transaction_type: 'stock_in',
          item_id: payload.item_id,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_assets'] });
      qc.invalidateQueries({ queryKey: ['store_asset_movements'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_assets'] });
      qc.invalidateQueries({ queryKey: ['store_asset_movements'] });
      qc.invalidateQueries({ queryKey: ['store_transactions'] });
      qc.invalidateQueries({ queryKey: ['store_current_stock'] });
    },
  });
};


