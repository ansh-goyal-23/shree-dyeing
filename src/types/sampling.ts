export type IntakeType = 'Sheet' | 'Loose Sample';
export type IntakeItemStatus = 'Pending' | 'In Development' | 'In Production' | 'Completed' | 'Cancelled';

export interface Client {
  id: string;
  client_name: string;
  contact_person: string;
  phone_number: string;
  notes: string;
  created_at: string;
}

export interface IntakeEntry {
  id: string;
  intake_type: IntakeType;
  received_date: string;
  sheet_date: string | null;
  client_id: string;
  client_name: string; // joined from clients table
  notes: string;
  reference_photo_path: string | null;
  created_at: string;
  user_id: string;
}

export interface IntakeItem {
  id: string;
  intake_id: string | null;
  sample_identifier: string;
  shade_reference: string;
  yarn_type: string;
  product_type: string;
  order_quantity: string;
  notes: string;
  sample_photo_path: string | null;
  linked_lot_no: string | null;
  status: IntakeItemStatus;
  is_direct_order: boolean;
  client_id: string | null;
  client_name: string; // joined or from direct order
  created_at: string;
}
