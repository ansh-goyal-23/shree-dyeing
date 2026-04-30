export type InventoryKind = 'yarn' | 'material' | 'oil' | 'fg';

export interface YarnStockRow {
  id: string;
  yarn_company: string;
  yarn_type: string;
  current_stock: number;
  last_updated: string;
}

export interface MaterialStockRow {
  id: string;
  master_item_id: string;
  item_name: string;
  item_type: 'dye' | 'chemical';
  unit: string;
  current_stock: number;
  last_updated: string;
}

export interface OilStockRow {
  id: string;
  current_stock: number;
  last_updated: string;
}

export interface FinishedGoodsRow {
  lot_no: string;
  original_cones: number;
  original_net_weight: number;
  remaining_cones: number;
  remaining_net_weight: number;
  last_updated: string;
}

export interface InventoryTxV2 {
  id: string;
  inventory_kind: InventoryKind;
  ref_key: string;
  delta: number;
  source: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

// ---- Approval popup ----
export type ApprovalSection = 'Yarn' | 'Dyes' | 'Chemicals' | 'Finished Goods' | 'Oil';

export interface ApprovalRow {
  section: ApprovalSection;
  label: string;        // "Reliance / 150D Polyester"
  unit: string;         // kg, gm, ml, cones+kg
  prevStock: number | string;
  change: number | string;
  newStock: number | string;
  warn?: boolean;       // newStock < 0
}

// ---- Engine intermediate shapes ----
export interface LotConsumptionDelta {
  yarn: { yarn_company: string; yarn_type: string; new_total_kg: number; last_total_kg: number; delta_kg: number } | null;
  dyes: Array<{ master_item_id: string; new_total_g: number; last_total_g: number; delta_g: number; item_name: string }>;
  chemicals: Array<{ master_item_id: string; new_total: number; last_total: number; delta: number; item_name: string; unit: string }>;
}

export interface DispatchConsumptionDelta {
  fg: Array<{ lot_no: string; new_cones: number; last_cones: number; delta_cones: number; new_net: number; last_net: number; delta_net: number }>;
  oil: Array<{ lot_no: string; new_oil_kg: number; last_oil_kg: number; delta_kg: number }>;
}
