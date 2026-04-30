/* Delta-safe inventory engine.
   - computeLotConsumption: pure-ish (reads supabase only to fetch last_* + auto-create rows)
   - computeDispatchConsumption
   - applyLotPreview / applyDispatchPreview: write rows + ledger + update last_*
*/
import { supabase } from '@/integrations/supabase/client';
import type {
  ApprovalRow,
  LotConsumptionDelta,
  DispatchConsumptionDelta,
} from '@/types/inventoryV2';
import type { Lot, MasterItem, RecipeDye, RecipeChemical, ProcessStep, StepDye, StepChemical } from '@/types';

const yarnKey = (company: string, type: string) => `${company.trim()}|${type.trim()}`;

// ------------- helpers: get-or-create ----------------
async function getOrCreateYarn(company: string, type: string) {
  const { data: existing } = await supabase
    .from('yarn_inventory')
    .select('*')
    .eq('yarn_company', company)
    .eq('yarn_type', type)
    .maybeSingle();
  if (existing) return existing;
  const { data: inserted, error } = await supabase
    .from('yarn_inventory')
    .insert({ yarn_company: company, yarn_type: type, current_stock: 0 })
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

async function getOrCreateMaterial(masterItemId: string) {
  const { data: existing } = await supabase
    .from('material_inventory')
    .select('*')
    .eq('master_item_id', masterItemId)
    .maybeSingle();
  if (existing) return existing;
  const { data: inserted, error } = await supabase
    .from('material_inventory')
    .insert({ master_item_id: masterItemId, current_stock: 0 })
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

async function getOilRow() {
  const { data } = await supabase.from('oil_inventory').select('*').limit(1).maybeSingle();
  if (data) return data;
  const { data: inserted, error } = await supabase
    .from('oil_inventory')
    .insert({ current_stock: 0 })
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

async function getOrCreateFG(lot: Lot) {
  const { data: existing } = await supabase
    .from('finished_goods_stock')
    .select('*')
    .eq('lot_no', lot.lot_no)
    .maybeSingle();
  if (existing) return existing;
  const { data: inserted, error } = await supabase
    .from('finished_goods_stock')
    .insert({
      lot_no: lot.lot_no,
      original_cones: lot.number_of_chesses,
      original_net_weight: lot.net_weight,
      remaining_cones: lot.number_of_chesses,
      remaining_net_weight: lot.net_weight,
    })
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

// ============================================================
// LOT  — yarn + dye + chemical consumption
// ============================================================
export async function computeLotConsumption(args: {
  lot: Lot;
  recipeDyes: RecipeDye[];
  recipeChemicals: RecipeChemical[];
  steps: ProcessStep[];
  stepDyes: StepDye[];
  stepChemicals: StepChemical[];
  masterItems: MasterItem[];
}): Promise<{ delta: LotConsumptionDelta; rows: ApprovalRow[] }> {
  const { lot, recipeDyes, recipeChemicals, steps, stepDyes, stepChemicals, masterItems } = args;

  // Read tracking columns from DB (live values)
  const { data: lotRow } = await supabase
    .from('lots')
    .select('last_yarn_consumed,last_dye_consumption,last_chemical_consumption')
    .eq('lot_no', lot.lot_no)
    .maybeSingle();

  const lastYarn = Number(lotRow?.last_yarn_consumed ?? 0);
  const lastDye: Record<string, number> = (lotRow?.last_dye_consumption as any) || {};
  const lastChem: Record<string, number> = (lotRow?.last_chemical_consumption as any) || {};

  const stepIds = new Set(steps.filter(s => s.lot_no === lot.lot_no).map(s => s.id));
  const lotStepDyes = stepDyes.filter(d => stepIds.has(d.step_id));
  const lotStepChems = stepChemicals.filter(c => stepIds.has(c.step_id));

  // Aggregate dyes by master_item_id (grams)
  const dyeTotals = new Map<string, number>();
  const addDye = (id: string, g: number) => dyeTotals.set(id, (dyeTotals.get(id) || 0) + g);
  for (const d of recipeDyes.filter(x => x.lot_no === lot.lot_no)) addDye(d.dye_id, d.qty_grams || 0);
  for (const d of lotStepDyes) addDye(d.dye_id, d.qty_grams || 0);

  // Aggregate chemicals by master_item_id
  const chemTotals = new Map<string, number>();
  const addChem = (id: string, q: number) => chemTotals.set(id, (chemTotals.get(id) || 0) + q);
  for (const c of recipeChemicals.filter(x => x.lot_no === lot.lot_no)) addChem(c.chemical_id, c.qty || 0);
  for (const c of lotStepChems) addChem(c.chemical_id, c.qty || 0);

  // Yarn = lot.gross_weight (use gross as raw yarn consumed)
  const newYarn = Number(lot.gross_weight) || 0;

  // Auto-create rows + read current stock
  const yarnRow = await getOrCreateYarn(lot.yarn_company_name, lot.denier);

  const dyesDelta: LotConsumptionDelta['dyes'] = [];
  const dyeStockMap = new Map<string, number>();
  // Include items that may have been consumed previously but no longer present (negative delta restores)
  const allDyeIds = new Set<string>([...dyeTotals.keys(), ...Object.keys(lastDye)]);
  for (const id of allDyeIds) {
    const mi = masterItems.find(m => m.id === id);
    if (!mi) continue;
    const matRow = await getOrCreateMaterial(id);
    dyeStockMap.set(id, Number(matRow.current_stock) || 0);
    const newTotal = dyeTotals.get(id) || 0;
    const lastTotal = Number(lastDye[id] || 0);
    dyesDelta.push({
      master_item_id: id,
      new_total_g: newTotal,
      last_total_g: lastTotal,
      delta_g: newTotal - lastTotal,
      item_name: mi.short_name || mi.name,
    });
  }

  const chemsDelta: LotConsumptionDelta['chemicals'] = [];
  const chemStockMap = new Map<string, number>();
  const allChemIds = new Set<string>([...chemTotals.keys(), ...Object.keys(lastChem)]);
  for (const id of allChemIds) {
    const mi = masterItems.find(m => m.id === id);
    if (!mi) continue;
    const matRow = await getOrCreateMaterial(id);
    chemStockMap.set(id, Number(matRow.current_stock) || 0);
    const newTotal = chemTotals.get(id) || 0;
    const lastTotal = Number(lastChem[id] || 0);
    chemsDelta.push({
      master_item_id: id,
      new_total: newTotal,
      last_total: lastTotal,
      delta: newTotal - lastTotal,
      item_name: mi.name,
      unit: mi.unit || '',
    });
  }

  const yarnDelta = newYarn - lastYarn;
  const yarn = {
    yarn_company: lot.yarn_company_name,
    yarn_type: lot.denier,
    new_total_kg: newYarn,
    last_total_kg: lastYarn,
    delta_kg: yarnDelta,
  };

  // Build approval rows (only show rows with a non-zero delta)
  const rows: ApprovalRow[] = [];
  if (Math.abs(yarnDelta) > 1e-6) {
    const prev = Number(yarnRow.current_stock) || 0;
    const next = prev - yarnDelta;
    rows.push({
      section: 'Yarn',
      label: `${lot.yarn_company_name} / ${lot.denier}`,
      unit: 'kg',
      prevStock: round3(prev),
      change: `${yarnDelta >= 0 ? '−' : '+'}${round3(Math.abs(yarnDelta))}`,
      newStock: round3(next),
      warn: next < 0,
    });
  }
  for (const d of dyesDelta) {
    if (Math.abs(d.delta_g) < 1e-6) continue;
    const prev = dyeStockMap.get(d.master_item_id) || 0;
    const next = prev - d.delta_g;
    rows.push({
      section: 'Dyes',
      label: d.item_name,
      unit: 'gm',
      prevStock: round3(prev),
      change: `${d.delta_g >= 0 ? '−' : '+'}${round3(Math.abs(d.delta_g))}`,
      newStock: round3(next),
      warn: next < 0,
    });
  }
  for (const c of chemsDelta) {
    if (Math.abs(c.delta) < 1e-6) continue;
    const prev = chemStockMap.get(c.master_item_id) || 0;
    const next = prev - c.delta;
    rows.push({
      section: 'Chemicals',
      label: c.item_name,
      unit: c.unit || '—',
      prevStock: round3(prev),
      change: `${c.delta >= 0 ? '−' : '+'}${round3(Math.abs(c.delta))}`,
      newStock: round3(next),
      warn: next < 0,
    });
  }

  return { delta: { yarn, dyes: dyesDelta, chemicals: chemsDelta }, rows };
}

export async function applyLotPreview(args: {
  lot: Lot;
  delta: LotConsumptionDelta;
  source: 'Lot Save' | 'Lot Edit' | 'Lot Delete';
}) {
  const { lot, delta, source } = args;
  const ledger: any[] = [];

  // YARN
  if (delta.yarn && Math.abs(delta.yarn.delta_kg) > 1e-6) {
    const y = await getOrCreateYarn(delta.yarn.yarn_company, delta.yarn.yarn_type);
    const newStock = Number(y.current_stock) - delta.yarn.delta_kg;
    await supabase
      .from('yarn_inventory')
      .update({ current_stock: round3(newStock), last_updated: new Date().toISOString() })
      .eq('id', y.id);
    ledger.push({
      inventory_kind: 'yarn',
      ref_key: yarnKey(delta.yarn.yarn_company, delta.yarn.yarn_type),
      delta: -delta.yarn.delta_kg,
      source,
      reference_id: lot.lot_no,
      notes: `Yarn consumption change for lot ${lot.lot_no}`,
    });
  }

  // DYES
  for (const d of delta.dyes) {
    if (Math.abs(d.delta_g) < 1e-6) continue;
    const m = await getOrCreateMaterial(d.master_item_id);
    const newStock = Number(m.current_stock) - d.delta_g;
    await supabase
      .from('material_inventory')
      .update({ current_stock: round3(newStock), last_updated: new Date().toISOString() })
      .eq('id', m.id);
    ledger.push({
      inventory_kind: 'material',
      ref_key: d.master_item_id,
      delta: -d.delta_g,
      source,
      reference_id: lot.lot_no,
      notes: `Dye change for lot ${lot.lot_no}`,
    });
  }

  // CHEMICALS
  for (const c of delta.chemicals) {
    if (Math.abs(c.delta) < 1e-6) continue;
    const m = await getOrCreateMaterial(c.master_item_id);
    const newStock = Number(m.current_stock) - c.delta;
    await supabase
      .from('material_inventory')
      .update({ current_stock: round3(newStock), last_updated: new Date().toISOString() })
      .eq('id', m.id);
    ledger.push({
      inventory_kind: 'material',
      ref_key: c.master_item_id,
      delta: -c.delta,
      source,
      reference_id: lot.lot_no,
      notes: `Chemical change for lot ${lot.lot_no}`,
    });
  }

  if (ledger.length) {
    await supabase.from('inventory_transactions_v2').insert(ledger);
  }

  // Update last_* trackers + sync flag
  const dyeJson: Record<string, number> = {};
  for (const d of delta.dyes) if (d.new_total_g > 0) dyeJson[d.master_item_id] = round3(d.new_total_g);
  const chemJson: Record<string, number> = {};
  for (const c of delta.chemicals) if (c.new_total > 0) chemJson[c.master_item_id] = round3(c.new_total);

  await supabase
    .from('lots')
    .update({
      last_yarn_consumed: delta.yarn ? round3(delta.yarn.new_total_kg) : 0,
      last_dye_consumption: dyeJson,
      last_chemical_consumption: chemJson,
      inventory_synced: source !== 'Lot Delete',
    })
    .eq('lot_no', lot.lot_no);
}

// ============================================================
// DISPATCH — finished goods + oil
// ============================================================
export async function computeDispatchConsumption(args: {
  challan: { id: string; date: string; last_oil_by_lot?: any; last_fg_by_lot?: any };
  items: Array<{ lot_no: string; num_of_units: number; net_weight: number }>;
  lots: Lot[];
}): Promise<{ delta: DispatchConsumptionDelta; rows: ApprovalRow[] }> {
  const { challan, items, lots } = args;

  // Read live tracking columns
  const { data: chRow } = await supabase
    .from('challans')
    .select('last_oil_by_lot,last_fg_by_lot')
    .eq('id', challan.id)
    .maybeSingle();
  const lastOil: Record<string, number> = (chRow?.last_oil_by_lot as any) || {};
  const lastFg: Record<string, { cones: number; net: number }> = (chRow?.last_fg_by_lot as any) || {};

  // Group items by lot_no
  const grouped = new Map<string, { cones: number; net: number }>();
  for (const it of items) {
    if (!it.lot_no) continue;
    const prev = grouped.get(it.lot_no) || { cones: 0, net: 0 };
    prev.cones += Number(it.num_of_units) || 0;
    prev.net += Number(it.net_weight) || 0;
    grouped.set(it.lot_no, prev);
  }
  // Include lots that were in last_* but no longer present (reversal)
  for (const lotNo of Object.keys(lastFg)) if (!grouped.has(lotNo)) grouped.set(lotNo, { cones: 0, net: 0 });

  const fgDelta: DispatchConsumptionDelta['fg'] = [];
  const oilDelta: DispatchConsumptionDelta['oil'] = [];
  const rows: ApprovalRow[] = [];

  for (const [lot_no, agg] of grouped.entries()) {
    const lot = lots.find(l => l.lot_no === lot_no);
    const lastF = lastFg[lot_no] || { cones: 0, net: 0 };
    const lastO = Number(lastOil[lot_no] || 0);

    // FG entry
    const dCones = agg.cones - (lastF.cones || 0);
    const dNet = agg.net - (lastF.net || 0);
    fgDelta.push({
      lot_no,
      new_cones: agg.cones, last_cones: lastF.cones || 0, delta_cones: dCones,
      new_net: agg.net, last_net: lastF.net || 0, delta_net: dNet,
    });

    // Oil
    let newOil = 0;
    if (lot) {
      const baseWeight = Number(lot.net_weight) || 0;
      const chesses = Number(lot.number_of_chesses) || 0;
      if (agg.cones > 0 && chesses > 0) {
        if (agg.cones === chesses) {
          newOil = agg.net - baseWeight;
        } else {
          newOil = agg.net - (baseWeight / chesses) * agg.cones;
        }
      }
    }
    const dOil = newOil - lastO;
    oilDelta.push({ lot_no, new_oil_kg: newOil, last_oil_kg: lastO, delta_kg: dOil });

    // Approval rows for FG
    if (lot) {
      const fg = await getOrCreateFG(lot);
      if (Math.abs(dCones) > 0 || Math.abs(dNet) > 1e-6) {
        const newRemainingCones = Number(fg.remaining_cones) - dCones;
        const newRemainingNet = Number(fg.remaining_net_weight) - dNet;
        rows.push({
          section: 'Finished Goods',
          label: `Lot ${lot_no}`,
          unit: 'cones / kg',
          prevStock: `${fg.remaining_cones} c / ${round3(Number(fg.remaining_net_weight))} kg`,
          change: `${dCones >= 0 ? '−' : '+'}${Math.abs(dCones)} c / ${dNet >= 0 ? '−' : '+'}${round3(Math.abs(dNet))} kg`,
          newStock: `${newRemainingCones} c / ${round3(newRemainingNet)} kg`,
          warn: newRemainingCones < 0 || newRemainingNet < 0,
        });
      }
    }
  }

  // Approval row for total oil
  const totalOilDelta = oilDelta.reduce((s, x) => s + x.delta_kg, 0);
  if (Math.abs(totalOilDelta) > 1e-6) {
    const oilRow = await getOilRow();
    const prev = Number(oilRow.current_stock);
    const next = prev - totalOilDelta;
    rows.push({
      section: 'Oil',
      label: 'Oil (calculated)',
      unit: 'kg',
      prevStock: round3(prev),
      change: `${totalOilDelta >= 0 ? '−' : '+'}${round3(Math.abs(totalOilDelta))}`,
      newStock: round3(next),
      warn: next < 0,
    });
  }

  return { delta: { fg: fgDelta, oil: oilDelta }, rows };
}

export async function applyDispatchPreview(args: {
  challanId: string;
  delta: DispatchConsumptionDelta;
  lots: Lot[];
  source: 'Dispatch' | 'Dispatch Edit' | 'Dispatch Delete';
}) {
  const { challanId, delta, source, lots } = args;
  const ledger: any[] = [];

  // FG updates
  for (const f of delta.fg) {
    const lot = lots.find(l => l.lot_no === f.lot_no);
    if (!lot) continue;
    const fg = await getOrCreateFG(lot);
    if (Math.abs(f.delta_cones) > 0 || Math.abs(f.delta_net) > 1e-6) {
      await supabase
        .from('finished_goods_stock')
        .update({
          remaining_cones: Number(fg.remaining_cones) - f.delta_cones,
          remaining_net_weight: round3(Number(fg.remaining_net_weight) - f.delta_net),
          last_updated: new Date().toISOString(),
        })
        .eq('lot_no', f.lot_no);
      ledger.push({
        inventory_kind: 'fg',
        ref_key: f.lot_no,
        delta: -f.delta_net,
        source,
        reference_id: challanId,
        notes: `FG dispatch change: ${f.delta_cones >= 0 ? '-' : '+'}${Math.abs(f.delta_cones)} cones`,
      });
    }
  }

  // OIL update (single row)
  const totalOilDelta = delta.oil.reduce((s, x) => s + x.delta_kg, 0);
  if (Math.abs(totalOilDelta) > 1e-6) {
    const oilRow = await getOilRow();
    const newOilStock = Number(oilRow.current_stock) - totalOilDelta;
    await supabase
      .from('oil_inventory')
      .update({ current_stock: round3(newOilStock), last_updated: new Date().toISOString() })
      .eq('id', oilRow.id);
    for (const o of delta.oil) {
      if (Math.abs(o.delta_kg) < 1e-6) continue;
      ledger.push({
        inventory_kind: 'oil',
        ref_key: o.lot_no,
        delta: -o.delta_kg,
        source,
        reference_id: challanId,
        notes: `Oil consumption change for lot ${o.lot_no}`,
      });
    }
  }

  if (ledger.length) await supabase.from('inventory_transactions_v2').insert(ledger);

  // Update challan trackers
  const fgJson: Record<string, { cones: number; net: number }> = {};
  for (const f of delta.fg) if (f.new_cones > 0 || f.new_net > 0) fgJson[f.lot_no] = { cones: f.new_cones, net: round3(f.new_net) };
  const oilJson: Record<string, number> = {};
  for (const o of delta.oil) if (Math.abs(o.new_oil_kg) > 1e-6) oilJson[o.lot_no] = round3(o.new_oil_kg);

  await supabase
    .from('challans')
    .update({
      last_oil_by_lot: oilJson,
      last_fg_by_lot: fgJson,
      inventory_synced: source !== 'Dispatch Delete',
    })
    .eq('id', challanId);
}

// Mark sync flag false (used on Cancel)
export async function markLotInventoryUnsynced(lotNo: string) {
  await supabase.from('lots').update({ inventory_synced: false }).eq('lot_no', lotNo);
}
export async function markChallanInventoryUnsynced(challanId: string) {
  await supabase.from('challans').update({ inventory_synced: false }).eq('id', challanId);
}

// Seed FG row for a newly-created lot (does not affect stock).
export async function seedFinishedGoodsForLot(lot: Lot) {
  await getOrCreateFG(lot);
}

function round3(n: number) { return Math.round(n * 1000) / 1000; }
