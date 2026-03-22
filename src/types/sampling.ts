export type IntakeType = 'Sheet' | 'Loose Sample';
export type IntakeItemStatus = 'Pending' | 'In Development' | 'Completed';

export interface IntakeEntry {
  id: string;
  intake_type: IntakeType;
  received_date: string;
  sheet_date: string | null;
  client_name: string;
  notes: string;
  reference_photo_path: string | null;
  created_at: string;
  user_id: string;
}

export interface IntakeItem {
  id: string;
  intake_id: string;
  sample_identifier: string;
  shade_reference: string;
  yarn_type: string;
  product_type: string;
  order_quantity: string;
  notes: string;
  sample_photo_path: string | null;
  linked_lot_no: string | null;
  status: IntakeItemStatus;
  created_at: string;
}
