export type PackagingType = 'paper_tube' | 'chesse';

export type ChallanKind = 'production' | 'edy';

export interface Challan {
  id: string;
  challan_number: string;
  challan_kind: ChallanKind;
  date: string;
  client_id: string;
  client_name: string;
  notes: string;
  prepared_by_name: string;
  receiver_name: string;
  receiver_contact_number: string;
  created_at: string;
  created_by?: string | null;
  amount_received: number;
  paid_at?: string | null;
}

export type PaymentState = 'Paid' | 'Partially Paid' | 'Unpaid';

export function paymentState(total: number, received: number): PaymentState {
  if (total > 0 && received >= total - 0.005) return 'Paid';
  if (received > 0.005) return 'Partially Paid';
  return 'Unpaid';
}

export interface ChallanItem {
  id: string;
  challan_id: string;
  lot_no: string;
  shade_number: string;
  color_name: string;
  denier: string;
  packaging_type: PackagingType;
  gross_weight: number;
  num_of_units: number;
  net_weight: number;
  rate: number;
  amount: number;
  ref_no?: string | null;
  lot_type?: 'Production' | 'Sampling';
  created_by?: string | null;
  // Tiered-rate snapshot (2026-09-28): only set for lines billed against a
  // tiered client. Snapshotted at save time so later edits to a client's
  // client_yarn_costs / client_rate_tiers never rewrite a historical
  // challan's billed amount -- rate = yarn_cost + overhead_rate at the time
  // the challan maker picked the tier.
  yarn_cost?: number | null;
  overhead_rate?: number | null;
  rate_tier_label?: string | null;
  // Paper-tube cone surcharge (2026-09-28): a separate additive rupee
  // amount for the line, never folded into rate/amount. 0 unless the
  // client has a cone-surcharge configured and packaging is paper_tube.
  paper_tube_surcharge?: number;
}

/** Total billed for a line, including any paper-tube cone surcharge. */
export function lineTotal(item: Pick<ChallanItem, 'amount' | 'paper_tube_surcharge'>): number {
  return (Number(item.amount) || 0) + (Number(item.paper_tube_surcharge) || 0);
}
