import { supabase } from '@/integrations/supabase/client';

/**
 * Generic activity logger that piggybacks on the inventory_change_logs table.
 * Used for status changes, expense create/update/delete, etc.
 */
export async function logActivity(params: {
  action: string;                  // e.g. 'Status Change', 'Expense Create'
  referenceType: string;           // 'lot' | 'challan' | 'expense'
  referenceId: string;
  section: string;                 // 'Status' | 'Expense' | 'Payment'
  itemLabel: string;
  prev?: string | number | null;
  next?: string | number | null;
  unit?: string | null;
  warn?: boolean;
}) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('inventory_change_logs').insert({
      user_id: u?.user?.id || null,
      user_email: u?.user?.email || null,
      action: params.action,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      section: params.section,
      item_label: params.itemLabel,
      unit: params.unit || null,
      prev_stock: params.prev != null ? String(params.prev) : null,
      change: params.prev != null && params.next != null ? '→' : null,
      new_stock: params.next != null ? String(params.next) : null,
      warn: !!params.warn,
    });
  } catch (e) {
    console.error('activity log failed', e);
  }
}
