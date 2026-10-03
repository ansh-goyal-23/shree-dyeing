// Store Management System (Inventory v2) - TypeScript types
// Mirrors sql_migrations/20260625_store_management_system.sql

export type StoreItemCategory =
  | 'raw_material'
  | 'office_utility'
  | 'tool_equipment'
  | 'finished_good'
  | 'external_dyed_yarn';

export type StoreRawSubcategory =
  | 'grey_yarn'
  | 'dye'
  | 'chemical'
  | 'oil'
  | 'paper_tube'
  | 'packaging_material';

export type StoreTransactionType =
  | 'stock_in'
  | 'internal_issue'
  | 'finished_lot_receipt'
  | 'external_dyed_yarn_receipt'
  | 'challan_dispatch'
  | 'challan_return'
  | 'stock_adjustment'
  | 'asset_issue'
  | 'asset_return';

export interface StoreRack {
  id: string;
  rack_code: string;
  rack_name: string;
  area: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface StoreItem {
  id: string;
  item_code: string;
  item_name: string;
  category: StoreItemCategory;
  sub_category: string | null;
  unit: string;
  is_asset: boolean;
  is_active: boolean;
  default_rack: string | null;
  remarks: string | null;
  first_received_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface StoreStockTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string; // ISO date
  transaction_type: StoreTransactionType;
  item_id: string;
  /** Signed: positive = inflow, negative = outflow. */
  quantity: number;
  unit: string;
  rack_id: string | null;
  reference_type: string | null;
  reference_number: string | null;
  person: string | null;
  supplier: string | null;
  remarks: string | null;
  rate: number | null;
  amount: number | null;
  purpose: string | null;
  created_at: string;
  created_by: string | null;
}

export interface StoreInternalIssue {
  id: string;
  issue_number: string;
  issue_date: string;
  department: string | null;
  issued_to: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface StoreInternalIssueLineInput {
  item_id: string;
  quantity: number;
  unit: string;
  rack_id?: string | null;
  purpose?: string | null;
}

export interface StoreStockInward {
  id: string;
  inward_number: string;
  inward_date: string;
  supplier: string | null;
  invoice_number: string | null;
  grn_number: string | null;
  remarks: string | null;
  bill_url: string | null;
  bill_path: string | null;
  total_amount: number;
  created_at: string;
  created_by: string | null;
}

export interface StoreStockInwardLineInput {
  item_id: string;
  quantity: number;
  unit: string;
  rate?: number | null;
  amount?: number | null;
  rack_id?: string | null;
  remarks?: string | null;
}

export interface StoreCurrentStockRow {
  item_id: string;
  item_code: string;
  item_name: string;
  category: StoreItemCategory;
  sub_category: string | null;
  unit: string;
  is_asset: boolean;
  rack_id: string | null;
  rack_code: string | null;
  rack_name: string | null;
  current_quantity: number;
}

/** Map of transaction type -> sign convention for the app layer. */
export const STORE_TXN_SIGN: Record<StoreTransactionType, 1 | -1> = {
  stock_in: 1,
  finished_lot_receipt: 1,
  external_dyed_yarn_receipt: 1,
  asset_return: 1,
  internal_issue: -1,
  challan_dispatch: -1,
  challan_return: 1,
  asset_issue: -1,
  stock_adjustment: 1, // caller decides sign for adjustments
};

export type StoreYarnReceiptSource = 'finished_goods' | 'external_dyed_yarn';

/** Unified receipt row for both Finished Goods and External Dyed Yarn. */
export interface StoreYarnReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  source: StoreYarnReceiptSource;
  lot_no: string | null;
  shade: string | null;
  shade_number: string | null;
  yarn_type: string | null;
  client: string | null;          // finished_goods only
  supplier: string | null;        // external_dyed_yarn only
  challan_number: string | null;
  challan_pdf_url: string | null;
  challan_pdf_path: string | null;
  rate: number | null;
  amount: number | null;
  cone_count: number | null;
  received_weight: number;
  rack_id: string | null;
  item_id: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** Backwards-compatible FG row alias (net_weight/gross_weight map to received_weight). */
export interface StoreFinishedGoodsReceipt extends StoreYarnReceipt {
  lot_no: string;
  net_weight: number;
  gross_weight: number | null;
}

/** Backwards-compatible EDY row alias. */
export interface StoreExternalDyedYarnReceipt extends StoreYarnReceipt {
  net_weight: number;
  gross_weight: number | null;
}

export interface StoreEDYCurrentStockRow {
  receipt_id: string;
  receipt_number: string;
  receipt_date: string;
  supplier: string | null;
  challan_number: string | null;
  yarn_type: string | null;
  shade: string | null;
  shade_number: string | null;
  lot_no: string | null;
  cone_count: number | null;
  received_weight: number;
  rate: number | null;
  amount: number | null;
  rack_id: string | null;
  rack_code: string | null;
  rack_name: string | null;
  item_id: string | null;
  item_code: string | null;
  unit: string | null;
  current_balance: number;
}


export type StoreAssetStatus = 'available' | 'issued' | 'repair' | 'scrap';
export type StoreAssetMovementType = 'issue' | 'return' | 'status_change';

export interface StoreAsset {
  id: string;
  asset_id: string;
  item_id: string;
  current_holder: string | null;
  department: string | null;
  rack_id: string | null;
  purchase_date: string | null;
  condition: string | null;
  status: StoreAssetStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface StoreAssetView extends StoreAsset {
  item_code: string;
  item_name: string;
  category: StoreItemCategory;
  sub_category: string | null;
  rack_code: string | null;
  rack_name: string | null;
}

export interface StoreAssetMovement {
  id: string;
  asset_id: string;
  movement_type: StoreAssetMovementType;
  movement_date: string;
  holder: string | null;
  department: string | null;
  rack_id: string | null;
  condition: string | null;
  status_after: StoreAssetStatus | null;
  remarks: string | null;
  transaction_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface StoreFGCurrentStockRow {
  receipt_id: string;
  receipt_number: string;
  receipt_date: string;
  lot_no: string;
  shade: string | null;
  shade_number: string | null;
  client: string | null;
  yarn_type: string | null;
  cone_count: number | null;
  received_weight: number;
  rack_id: string | null;
  rack_code: string | null;
  rack_name: string | null;
  item_id: string | null;
  item_code: string | null;
  unit: string | null;
  current_balance: number;
  lot_status: string | null;
}

