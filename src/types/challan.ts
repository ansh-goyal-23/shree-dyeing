export interface Challan {
  id: string;
  challan_number: string;
  date: string;
  client_id: string;
  client_name: string; // joined
  notes: string;
  created_at: string;
}

export interface ChallanItem {
  id: string;
  challan_id: string;
  lot_no: string;
  shade_number: string;
  color_name: string;
  gross_weight: number;
  num_of_paper_tubes: number;
  net_weight: number;
  rate: number;
  amount: number;
}
