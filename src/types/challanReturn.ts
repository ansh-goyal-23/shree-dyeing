// Return Challan types.
//
// A client sometimes returns/rejects some of the dyed yarn sent on a past
// challan. A Return Challan records that against the exact original line(s)
// it came from, restocks Store, and feeds the per-client Excel export as a
// negative-qty row -- it does NOT touch the original challan's
// amount_received / Paid-Partially Paid-Unpaid tracking (billing for that
// happens downstream, by the accountant, from the Excel export).
//
// Mirrors the snapshot-immutability principle used by ChallanItem: lot/
// shade/rate/rate_tier are copied from the original line at return time,
// never re-derived later.

export const RETURN_REASONS = [
  'Quality Reject',
  'Shade Mismatch',
  'Wrong Item / Order Error',
  'Excess Quantity',
  'Other',
] as const;

export type ReturnReason = typeof RETURN_REASONS[number];

export interface ChallanReturn {
  id: string;
  return_number: string;
  date: string;
  client_id: string;
  client_name: string;
  notes: string;
  prepared_by_name: string;
  received_by_name: string;
  received_by_contact_number: string;
  created_at: string;
  created_by?: string | null;
}

export interface ChallanReturnItem {
  id: string;
  return_id: string;

  // Required link to the specific original line this is returning against.
  original_challan_id: string;
  original_challan_item_id: string;
  // Denormalized for display without an extra join (filled in when loading).
  original_challan_number?: string;

  // Copied from the original line at return time.
  lot_no: string;
  shade_number: string;
  color_name: string;
  denier: string;
  ref_no?: string | null;
  lot_type?: 'Production' | 'Sampling';
  packaging_type: string;

  // What's actually coming back -- can be less than the original line.
  returned_gross_weight: number;
  returned_net_weight: number;
  returned_num_of_units: number;
  returned_extra_cones: number;

  // Copied from the original line; amount computed the same way a normal
  // challan line is, then snapshotted.
  rate: number;
  rate_tier_label?: string | null;
  paper_tube_surcharge: number;
  amount: number;

  reason: ReturnReason;
  reason_note?: string | null;
  created_at?: string;
  created_by?: string | null;
}

/** Total credited for a returned line, including any surcharge reversal. */
export function returnLineTotal(item: Pick<ChallanReturnItem, 'amount' | 'paper_tube_surcharge'>): number {
  return (Number(item.amount) || 0) + (Number(item.paper_tube_surcharge) || 0);
}
