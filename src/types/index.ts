export interface MasterItem {
  id: string;
  name: string;
  type: 'dye' | 'chemical';
  shade_family: string;
  company: string;
  unit: string;
  is_active: boolean;
}

export interface Lot {
  lot_no: string;
  date: string;
  yarn_company_name: string;
  color_name: string;
  denier: string;
  number_of_chesses: number;
  gross_weight: number;
  net_weight: number;
  is_approved: boolean;
  source_lot_no: string | null;
}

export interface LotVersion {
  id: string;
  lot_no: string;
  version_code: string;
  parent_version_id: string | null;
  reason_for_change: string;
  created_at: string;
}

export interface RecipeDye {
  id: string;
  lot_no: string;
  version_id: string;
  dye_id: string;
  percentage: number;
  qty_grams: number;
}

export interface RecipeChemical {
  id: string;
  lot_no: string;
  version_id: string;
  chemical_id: string;
  qty: number;
}
