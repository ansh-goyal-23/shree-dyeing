export interface InventoryStock {
  id: string;
  item_id: string;
  item_name?: string;
  category_name?: string;
  current_stock: number;
  unit: string;
  item_type: 'Consumable' | 'Asset';
  minimum_stock_level: number;
  last_updated: string;
}

export type TransactionType = 'IN' | 'OUT';
export type TransactionSource = 'Purchase' | 'Adjustment' | 'Lot Usage';

export interface InventoryTransaction {
  id: string;
  item_id: string;
  item_name?: string;
  type: TransactionType;
  source: TransactionSource;
  quantity: number;
  reference_id: string;
  date: string;
  notes: string;
  created_at: string;
}
