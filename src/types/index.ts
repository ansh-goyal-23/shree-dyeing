// Which fiber/dyeing process a lot follows. Polyester uses the existing
// recipe_dyes/recipe_chemicals/process_steps tables; Nylon and Cotton use
// their own dedicated *_lot_stages tables (see src/lib/cottonStages.ts).
export type YarnType = 'Polyester' | 'Nylon' | 'Cotton';

export const YARN_TYPES: YarnType[] = ['Polyester', 'Nylon', 'Cotton'];

export interface MasterItem {
  id: string;
  name: string;
  short_name: string;
  type: 'dye' | 'chemical';
  shade_family: string;
  company: string;
  unit: string;
  is_active: boolean;
  yarn_scope: YarnType[];
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
  remarks: string;
  ref_no?: string | null;
  created_by?: string | null;
  yarn_type: YarnType;
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
  created_by?: string | null;
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

// ── Cotton lot flow (dedicated data model, separate from the polyester
// recipe_dyes/recipe_chemicals/process_steps tables) ────────────────────

export type CottonStageType =
  | 'Scour + Bleach'
  | 'Neutralize'
  | 'Dye Bath'
  | 'Alkali - Soda'
  | 'Alkali - Caustic'
  | 'Soaping'
  | 'Fixing';

export interface CottonLotStage {
  id: string;
  lot_no: string;
  stage_type: CottonStageType;
  stage_order: number;
  target_ph: number | null;
  target_temp_c: number | null;
  ramp_rate_c_per_min: number | null;
  hold_minutes: number | null;
  notes: string;
}

export interface CottonStageChemical {
  id: string;
  stage_id: string;
  chemical_id: string;
  qty: number;
}

export interface CottonStageDye {
  id: string;
  stage_id: string;
  dye_id: string;
  percentage: number;
  qty_grams: number;
}
