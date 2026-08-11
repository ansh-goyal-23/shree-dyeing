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
}
