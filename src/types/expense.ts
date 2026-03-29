export interface ExpenseItem {
  id: string;
  item_name: string;
  category: string;
  unit: string;
  item_type: 'Consumable' | 'Asset';
  is_active: boolean;
}

export type ExpenseType = 'Purchase' | 'Direct Expense' | 'Asset';
export type PaymentStatus = 'Paid' | 'Unpaid';

export interface Expense {
  id: string;
  date: string;
  expense_type: ExpenseType;
  item_id: string | null;
  item_name?: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total_amount: number;
  supplier_name: string;
  linked_lot_no: string;
  payment_status: PaymentStatus;
  notes: string;
  created_at: string;
}

export interface ExpenseDocument {
  id: string;
  expense_id: string;
  file_url: string;
  file_name: string;
  upload_date: string;
}

export interface InventoryEntry {
  id: string;
  item_id: string;
  item_name?: string;
  quantity: number;
  unit: string;
  item_type: string;
  updated_at: string;
}
