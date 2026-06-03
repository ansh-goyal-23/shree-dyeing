export interface Supplier {
  id: string;
  supplier_name: string;
  contact: string;
  notes: string;
}

export interface ExpenseCategory {
  id: string;
  category_name: string;
  expense_type: ExpenseType;
}

export interface ExpenseItem {
  id: string;
  item_name: string;
  category_id: string | null;
  category_name?: string;
  expense_type: string;
  unit: string;
  item_type: 'Consumable' | 'Asset';
  is_active: boolean;
  company_id?: string | null;
  company_name?: string;
}

export interface Company {
  id: string;
  company_name: string;
}

export type ExpenseType = 'Purchase' | 'Direct Expense' | 'Asset';
export type PaymentStatus = 'Paid' | 'Unpaid';

export interface ExpenseLineItem {
  id: string;
  expense_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface Expense {
  id: string;
  date: string;
  expense_type: ExpenseType;
  category_id: string | null;
  category_name?: string;
  supplier_id: string | null;
  supplier_name?: string;
  subtotal: number;
  gst_percent: number;
  gst_amount: number;
  freight: number;
  total_amount: number;
  linked_lot_no: string;
  payment_status: PaymentStatus;
  notes: string;
  created_at: string;
  created_by?: string | null;
  line_items?: ExpenseLineItem[];
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
