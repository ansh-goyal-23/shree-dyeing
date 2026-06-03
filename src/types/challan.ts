export type PackagingType = 'paper_tube' | 'chesse';

export interface Challan {
  id: string;
  challan_number: string;
  date: string;
  client_id: string;
  client_name: string;
  notes: string;
  prepared_by_name: string;
  receiver_name: string;
  receiver_contact_number: string;
  created_at: string;
  created_by?: string | null;
}

export interface ChallanItem {
  id: string;
  challan_id: string;
  lot_no: string;
  shade_number: string;
  color_name: string;
  packaging_type: PackagingType;
  gross_weight: number;
  num_of_units: number;
  net_weight: number;
  rate: number;
  amount: number;
  created_by?: string | null;
}
