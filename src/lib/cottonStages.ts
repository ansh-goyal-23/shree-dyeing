import { supabase } from '@/integrations/supabase/client';
import type { CottonStageType } from '@/types';

// Default parameters per Recipes/Cotton-Dyeing-Process.md (confirmed with
// Ansh + master, bifunctional reactive dyes only). Shown as editable
// defaults on the Create Cotton Lot form -- not hardcoded/enforced values.
export interface CottonStageTemplate {
  stage_type: CottonStageType;
  stage_order: number;
  target_ph: number | null;
  target_temp_c: number | null;
  ramp_rate_c_per_min: number | null;
  hold_minutes: number | null;
  notes: string;
  /** master_items chemical names to pre-populate this stage with (qty left at 0 for the user to fill in). */
  defaultChemicalNames: string[];
  /** Whether this stage takes dyes (only the Dye Bath stage does). */
  takesDyes: boolean;
}

export const COTTON_STAGE_TEMPLATE: CottonStageTemplate[] = [
  {
    stage_type: 'Scour + Bleach',
    stage_order: 1,
    target_ph: null,
    target_temp_c: 100,
    ramp_rate_c_per_min: null,
    hold_minutes: 30,
    notes: 'Combined scour + bleach bath. Drain and hard wash after hold.',
    defaultChemicalNames: ['Wetting Agent', 'Emulsifier', 'Caustic Soda', 'Peroxide', 'Peroxide Stabilizer'],
    takesDyes: false,
  },
  {
    stage_type: 'Neutralize',
    stage_order: 2,
    target_ph: 6.75,
    target_temp_c: null,
    ramp_rate_c_per_min: null,
    hold_minutes: null,
    notes: 'Peroxide killer is essential here -- residual bleach peroxide will damage/fade reactive dye if not neutralized before dyeing.',
    defaultChemicalNames: ['Acetic Acid', 'Peroxide Killer'],
    takesDyes: false,
  },
  {
    stage_type: 'Dye Bath',
    stage_order: 3,
    target_ph: null,
    target_temp_c: 60,
    ramp_rate_c_per_min: 0.75,
    hold_minutes: 30,
    notes: "Glauber's salt injected as a single dose while the machine is running (not staged/split dosing). Fixation temperature of 60C is correct only for bifunctional reactive dyes.",
    defaultChemicalNames: ["Glauber's Salt", 'Leveling Agent'],
    takesDyes: true,
  },
  {
    stage_type: 'Alkali - Soda',
    stage_order: 4,
    target_ph: 10.8,
    target_temp_c: null,
    ramp_rate_c_per_min: null,
    hold_minutes: 20,
    notes: 'Soda ash dosed via injector, 20 min rotation.',
    defaultChemicalNames: ['Soda Ash'],
    takesDyes: false,
  },
  {
    stage_type: 'Alkali - Caustic',
    stage_order: 5,
    target_ph: 11,
    target_temp_c: null,
    ramp_rate_c_per_min: null,
    hold_minutes: 60,
    notes: 'Caustic added on top of the soda ash stage, to pH 11 (confirmed -- not pH 14). Hold time here is the TOTAL alkali hold across both Alkali stages (1 hour), not additional to the Alkali-Soda hold above.',
    defaultChemicalNames: ['Caustic Soda'],
    takesDyes: false,
  },
  {
    stage_type: 'Soaping',
    stage_order: 6,
    target_ph: null,
    target_temp_c: 95,
    ramp_rate_c_per_min: null,
    hold_minutes: 20,
    notes: 'Hard wash then running/overflow wash after hold.',
    defaultChemicalNames: ['Soaping Agent'],
    takesDyes: false,
  },
  {
    stage_type: 'Fixing',
    stage_order: 7,
    target_ph: 5.25,
    target_temp_c: 50,
    ramp_rate_c_per_min: null,
    hold_minutes: 20,
    notes: 'Drain, then hydro extract.',
    defaultChemicalNames: ['Fixer'],
    takesDyes: false,
  },
];

export interface CottonStageChemicalInput {
  chemical_id: string;
  qty: number;
}

export interface CottonStageDyeInput {
  dye_id: string;
  percentage: number;
  qty_grams: number;
}

export interface CottonStageInput {
  stage_type: CottonStageType;
  stage_order: number;
  target_ph: number | null;
  target_temp_c: number | null;
  ramp_rate_c_per_min: number | null;
  hold_minutes: number | null;
  notes: string;
  chemicals: CottonStageChemicalInput[];
  dyes: CottonStageDyeInput[];
}

export interface CreateCottonLotInput {
  lot_no: string;
  date: string;
  yarn_company_name: string;
  color_name: string;
  denier: string;
  ref_no: string | null;
  number_of_chesses: number;
  gross_weight: number;
  net_weight: number;
  stages: CottonStageInput[];
}

/**
 * Creates a Cotton lot: the base lots row (yarn_type='Cotton'), then one
 * cotton_lot_stages row per stage, then that stage's chemicals/dyes.
 * Returns { success, error }. Does not touch recipe_dyes/recipe_chemicals/
 * process_steps -- those remain Polyester-only.
 */
export async function createCottonLot(input: CreateCottonLotInput): Promise<{ success: boolean; error?: string }> {
  const { error: lotErr } = await supabase.from('lots').insert({
    lot_no: input.lot_no,
    date: input.date,
    yarn_company_name: input.yarn_company_name,
    color_name: input.color_name.toUpperCase(),
    denier: input.denier,
    number_of_chesses: input.number_of_chesses,
    gross_weight: input.gross_weight,
    net_weight: input.net_weight,
    is_approved: false,
    shade_number: input.lot_no,
    source_lot_no: null,
    status: 'In Approval',
    remarks: '',
    ref_no: input.ref_no,
    yarn_type: 'Cotton',
  });
  if (lotErr) {
    return { success: false, error: lotErr.message.includes('duplicate') ? 'Lot No already exists.' : lotErr.message };
  }

  for (const stage of input.stages) {
    const { data: stageRow, error: stageErr } = await supabase
      .from('cotton_lot_stages')
      .insert({
        lot_no: input.lot_no,
        stage_type: stage.stage_type,
        stage_order: stage.stage_order,
        target_ph: stage.target_ph,
        target_temp_c: stage.target_temp_c,
        ramp_rate_c_per_min: stage.ramp_rate_c_per_min,
        hold_minutes: stage.hold_minutes,
        notes: stage.notes,
      })
      .select('id')
      .single();

    if (stageErr || !stageRow) {
      return { success: false, error: `Lot created, but stage "${stage.stage_type}" failed to save: ${stageErr?.message}` };
    }

    const chemRows = stage.chemicals.filter(c => c.chemical_id).map(c => ({
      stage_id: stageRow.id, chemical_id: c.chemical_id, qty: c.qty,
    }));
    if (chemRows.length > 0) {
      const { error } = await supabase.from('cotton_stage_chemicals').insert(chemRows);
      if (error) return { success: false, error: `Lot created, but chemicals for "${stage.stage_type}" failed to save: ${error.message}` };
    }

    const dyeRows = stage.dyes.filter(d => d.dye_id).map(d => ({
      stage_id: stageRow.id, dye_id: d.dye_id, percentage: d.percentage, qty_grams: d.qty_grams,
    }));
    if (dyeRows.length > 0) {
      const { error } = await supabase.from('cotton_stage_dyes').insert(dyeRows);
      if (error) return { success: false, error: `Lot created, but dyes for "${stage.stage_type}" failed to save: ${error.message}` };
    }
  }

  return { success: true };
}
