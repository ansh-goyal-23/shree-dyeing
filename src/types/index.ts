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
  status: LotStatus;
  shade_number: string;
  source_lot_no: string | null;
}

export interface RecipeDye {
  id: string;
  lot_no: string;
  dye_id: string;
  percentage: number;
  qty_grams: number;
}

export interface RecipeChemical {
  id: string;
  lot_no: string;
  chemical_id: string;
  qty: number;
  ph_value: number | null;
}

export type LotStatus = 'Approved' | 'Rejected' | 'Production' | 'In Approval';

export type ProcessStepType = 'Color Addition' | 'RC' | 'Leveling';

export interface ProcessStep {
  id: string;
  lot_no: string;
  step_number: number;
  step_type: ProcessStepType;
  description: string;
  created_at: string;
}

export interface StepDye {
  id: string;
  step_id: string;
  dye_id: string;
  percentage: number;
  qty_grams: number;
}

export interface StepChemical {
  id: string;
  step_id: string;
  chemical_id: string;
  qty: number;
}

export interface LotPhoto {
  id: string;
  lot_no: string;
  step_id: string | null;
  file_path: string;
  label: string;
  category: 'base' | 'step' | 'general';
  created_at: string;
}
