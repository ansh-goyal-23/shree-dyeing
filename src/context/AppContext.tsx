import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Lot, RecipeDye, RecipeChemical, MasterItem, ProcessStep, StepDye, StepChemical, ProcessStepType } from '@/types';
import { calculateNetWeight } from '@/lib/calculations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface AppState {
  lots: Lot[];
  recipeDyes: RecipeDye[];
  recipeChemicals: RecipeChemical[];
  masterItems: MasterItem[];
  processSteps: ProcessStep[];
  stepDyes: StepDye[];
  stepChemicals: StepChemical[];
  loading: boolean;
}

interface AppContextType extends AppState {
  addLot: (lot: Omit<Lot, 'net_weight' | 'is_approved'>) => Promise<boolean>;
  updateLot: (lotNo: string, data: Partial<Omit<Lot, 'lot_no' | 'net_weight' | 'is_approved'>>) => Promise<boolean>;
  deleteLot: (lotNo: string) => Promise<boolean>;
  approveLot: (lotNo: string) => Promise<void>;
  unapproveLot: (lotNo: string) => Promise<void>;
  updateRecipeDyes: (lotNo: string, dyes: RecipeDye[]) => Promise<void>;
  updateRecipeChemicals: (lotNo: string, chemicals: RecipeChemical[]) => Promise<void>;
  addMasterItem: (item: Omit<MasterItem, 'id'>) => Promise<void>;
  updateMasterItem: (item: MasterItem) => Promise<void>;
  addProcessStep: (lotNo: string, data: {
    step_type: ProcessStepType;
    description: string;
    dyes: Omit<StepDye, 'id' | 'step_id'>[];
    chemicals: Omit<StepChemical, 'id' | 'step_id'>[];
  }) => Promise<void>;
  updateProcessStep: (stepId: string, data: {
    step_type: ProcessStepType;
    description: string;
    dyes: Omit<StepDye, 'id' | 'step_id'>[];
    chemicals: Omit<StepChemical, 'id' | 'step_id'>[];
  }) => Promise<void>;
  deleteProcessStep: (stepId: string) => Promise<void>;
  getLot: (lotNo: string) => Lot | undefined;
  getDyesForLot: (lotNo: string) => RecipeDye[];
  getChemicalsForLot: (lotNo: string) => RecipeChemical[];
  getApprovedLots: () => Lot[];
  getLotsReferencingSource: (lotNo: string) => Lot[];
  getProcessStepsForLot: (lotNo: string) => ProcessStep[];
  getStepDyes: (stepId: string) => StepDye[];
  getStepChemicals: (stepId: string) => StepChemical[];
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({
    lots: [], recipeDyes: [], recipeChemicals: [], masterItems: [],
    processSteps: [], stepDyes: [], stepChemicals: [], loading: true,
  });

  const fetchAll = useCallback(async () => {
    if (!user) {
      setState({ lots: [], recipeDyes: [], recipeChemicals: [], masterItems: [],
        processSteps: [], stepDyes: [], stepChemicals: [], loading: false });
      return;
    }
    setState(prev => ({ ...prev, loading: true }));

    const [lotsRes, dyesRes, chemsRes, masterRes, stepsRes, stepDyesRes, stepChemsRes] = await Promise.all([
      supabase.from('lots').select('*').order('created_at', { ascending: false }),
      supabase.from('recipe_dyes').select('*'),
      supabase.from('recipe_chemicals').select('*'),
      supabase.from('master_items').select('*'),
      supabase.from('process_steps').select('*').order('step_number', { ascending: true }),
      supabase.from('step_dyes').select('*'),
      supabase.from('step_chemicals').select('*'),
    ]);

    setState({
      lots: (lotsRes.data || []).map(mapLot),
      recipeDyes: (dyesRes.data || []).map(mapDye),
      recipeChemicals: (chemsRes.data || []).map(mapChemical),
      masterItems: (masterRes.data || []).map(mapMasterItem),
      processSteps: (stepsRes.data || []).map(mapProcessStep),
      stepDyes: (stepDyesRes.data || []).map(mapStepDye),
      stepChemicals: (stepChemsRes.data || []).map(mapStepChemical),
      loading: false,
    });
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addLot = useCallback(async (lotData: Omit<Lot, 'net_weight' | 'is_approved'>): Promise<boolean> => {
    const net_weight = calculateNetWeight(lotData.gross_weight, lotData.number_of_chesses);
    const shade_number = lotData.shade_number?.trim() || lotData.lot_no;
    const { error: lotErr } = await supabase.from('lots').insert({
      lot_no: lotData.lot_no, date: lotData.date, yarn_company_name: lotData.yarn_company_name,
      color_name: lotData.color_name, denier: lotData.denier, number_of_chesses: lotData.number_of_chesses,
      gross_weight: lotData.gross_weight, net_weight, is_approved: false,
      shade_number, source_lot_no: lotData.source_lot_no || null,
    });
    if (lotErr) return false;
    await fetchAll();
    return true;
  }, [fetchAll]);

  const deleteLot = useCallback(async (lotNo: string): Promise<boolean> => {
    // Delete child records first, then the lot
    await Promise.all([
      supabase.from('recipe_dyes').delete().eq('lot_no', lotNo),
      supabase.from('recipe_chemicals').delete().eq('lot_no', lotNo),
      supabase.from('lot_photos').delete().eq('lot_no', lotNo),
    ]);
    // Delete process steps and their children
    const { data: steps } = await supabase.from('process_steps').select('id').eq('lot_no', lotNo);
    if (steps && steps.length > 0) {
      const stepIds = steps.map(s => s.id);
      await Promise.all([
        supabase.from('step_dyes').delete().in('step_id', stepIds),
        supabase.from('step_chemicals').delete().in('step_id', stepIds),
      ]);
      await supabase.from('process_steps').delete().eq('lot_no', lotNo);
    }
    const { error } = await supabase.from('lots').delete().eq('lot_no', lotNo);
    if (error) return false;
    await fetchAll();
    return true;
  }, [fetchAll]);

  const updateLot = useCallback(async (lotNo: string, data: Partial<Omit<Lot, 'lot_no' | 'net_weight' | 'is_approved'>>): Promise<boolean> => {
    const lot = state.lots.find(l => l.lot_no === lotNo);
    if (!lot) return false;
    const grossWeight = data.gross_weight ?? lot.gross_weight;
    const chesses = data.number_of_chesses ?? lot.number_of_chesses;
    const net_weight = calculateNetWeight(grossWeight, chesses);
    const { error } = await supabase.from('lots').update({ ...data, net_weight }).eq('lot_no', lotNo);
    if (error) return false;
    await fetchAll();
    return true;
  }, [state.lots, fetchAll]);

  const approveLot = useCallback(async (lotNo: string) => {
    await supabase.from('lots').update({ is_approved: true }).eq('lot_no', lotNo);
    await fetchAll();
  }, [fetchAll]);

  const unapproveLot = useCallback(async (lotNo: string) => {
    await supabase.from('lots').update({ is_approved: false }).eq('lot_no', lotNo);
    await fetchAll();
  }, [fetchAll]);

  const updateRecipeDyes = useCallback(async (lotNo: string, dyes: RecipeDye[]) => {
    await supabase.from('recipe_dyes').delete().eq('lot_no', lotNo);
    if (dyes.length > 0) {
      await supabase.from('recipe_dyes').insert(dyes.map(d => ({ lot_no: d.lot_no, dye_id: d.dye_id, percentage: d.percentage, qty_grams: d.qty_grams })));
    }
    await fetchAll();
  }, [fetchAll]);

  const updateRecipeChemicals = useCallback(async (lotNo: string, chemicals: RecipeChemical[]) => {
    await supabase.from('recipe_chemicals').delete().eq('lot_no', lotNo);
    if (chemicals.length > 0) {
      await supabase.from('recipe_chemicals').insert(chemicals.map(c => ({ lot_no: c.lot_no, chemical_id: c.chemical_id, qty: c.qty, ph_value: c.ph_value ?? null })));
    }
    await fetchAll();
  }, [fetchAll]);

  const addMasterItem = useCallback(async (item: Omit<MasterItem, 'id'>) => {
    await supabase.from('master_items').insert({ name: item.name, type: item.type, shade_family: item.shade_family, company: item.company, unit: item.unit, is_active: item.is_active });
    await fetchAll();
  }, [fetchAll]);

  const updateMasterItem = useCallback(async (item: MasterItem) => {
    await supabase.from('master_items').update({ name: item.name, type: item.type, shade_family: item.shade_family, company: item.company, unit: item.unit, is_active: item.is_active }).eq('id', item.id);
    await fetchAll();
  }, [fetchAll]);

  const addProcessStep = useCallback(async (lotNo: string, data: {
    step_type: ProcessStepType;
    description: string;
    dyes: Omit<StepDye, 'id' | 'step_id'>[];
    chemicals: Omit<StepChemical, 'id' | 'step_id'>[];
  }) => {
    const existingSteps = state.processSteps.filter(s => s.lot_no === lotNo);
    const nextStepNumber = existingSteps.length > 0 ? Math.max(...existingSteps.map(s => s.step_number)) + 1 : 1;
    const stepId = crypto.randomUUID();

    await supabase.from('process_steps').insert({
      id: stepId, lot_no: lotNo, step_number: nextStepNumber,
      step_type: data.step_type, description: data.description,
    });

    if (data.dyes.length > 0) {
      await supabase.from('step_dyes').insert(
        data.dyes.map(d => ({ step_id: stepId, dye_id: d.dye_id, percentage: d.percentage, qty_grams: d.qty_grams }))
      );
    }
    if (data.chemicals.length > 0) {
      await supabase.from('step_chemicals').insert(
        data.chemicals.map(c => ({ step_id: stepId, chemical_id: c.chemical_id, qty: c.qty }))
      );
    }
    await fetchAll();
  }, [state.processSteps, fetchAll]);

  const updateProcessStep = useCallback(async (stepId: string, data: {
    step_type: ProcessStepType;
    description: string;
    dyes: Omit<StepDye, 'id' | 'step_id'>[];
    chemicals: Omit<StepChemical, 'id' | 'step_id'>[];
  }) => {
    await supabase.from('process_steps').update({
      step_type: data.step_type, description: data.description,
    }).eq('id', stepId);
    await supabase.from('step_dyes').delete().eq('step_id', stepId);
    await supabase.from('step_chemicals').delete().eq('step_id', stepId);
    if (data.dyes.length > 0) {
      await supabase.from('step_dyes').insert(
        data.dyes.map(d => ({ step_id: stepId, dye_id: d.dye_id, percentage: d.percentage, qty_grams: d.qty_grams }))
      );
    }
    if (data.chemicals.length > 0) {
      await supabase.from('step_chemicals').insert(
        data.chemicals.map(c => ({ step_id: stepId, chemical_id: c.chemical_id, qty: c.qty }))
      );
    }
    await fetchAll();
  }, [fetchAll]);

  const deleteProcessStep = useCallback(async (stepId: string) => {
    await Promise.all([
      supabase.from('step_dyes').delete().eq('step_id', stepId),
      supabase.from('step_chemicals').delete().eq('step_id', stepId),
    ]);
    await supabase.from('process_steps').delete().eq('id', stepId);
    await fetchAll();
  }, [fetchAll]);

  const getLot = useCallback((lotNo: string) => state.lots.find(l => l.lot_no === lotNo), [state.lots]);
  const getDyesForLot = useCallback((lotNo: string) => state.recipeDyes.filter(d => d.lot_no === lotNo), [state.recipeDyes]);
  const getChemicalsForLot = useCallback((lotNo: string) => state.recipeChemicals.filter(c => c.lot_no === lotNo), [state.recipeChemicals]);
  const getApprovedLots = useCallback(() => state.lots.filter(l => l.is_approved), [state.lots]);
  const getLotsReferencingSource = useCallback((lotNo: string) => state.lots.filter(l => l.source_lot_no === lotNo), [state.lots]);
  const getProcessStepsForLot = useCallback((lotNo: string) => state.processSteps.filter(s => s.lot_no === lotNo).sort((a, b) => a.step_number - b.step_number), [state.processSteps]);
  const getStepDyes = useCallback((stepId: string) => state.stepDyes.filter(d => d.step_id === stepId), [state.stepDyes]);
  const getStepChemicals = useCallback((stepId: string) => state.stepChemicals.filter(c => c.step_id === stepId), [state.stepChemicals]);

  return (
    <AppContext.Provider value={{
      ...state, addLot, deleteLot, approveLot, unapproveLot, updateRecipeDyes, updateRecipeChemicals,
      addMasterItem, updateMasterItem, addProcessStep, updateProcessStep, deleteProcessStep, getLot, getDyesForLot,
      getChemicalsForLot, getApprovedLots, getLotsReferencingSource,
      getProcessStepsForLot, getStepDyes, getStepChemicals,
      refreshData: fetchAll,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

const mapLot = (row: any): Lot => ({
  lot_no: row.lot_no, date: row.date, yarn_company_name: row.yarn_company_name,
  color_name: row.color_name || '', denier: row.denier || '',
  number_of_chesses: Number(row.number_of_chesses) || 0, gross_weight: Number(row.gross_weight) || 0,
  net_weight: Number(row.net_weight) || 0, is_approved: row.is_approved || false,
  shade_number: row.shade_number || row.lot_no, source_lot_no: row.source_lot_no || null,
});

const mapDye = (row: any): RecipeDye => ({
  id: row.id, lot_no: row.lot_no,
  dye_id: row.dye_id, percentage: Number(row.percentage) || 0, qty_grams: Number(row.qty_grams) || 0,
});

const mapChemical = (row: any): RecipeChemical => ({
  id: row.id, lot_no: row.lot_no,
  chemical_id: row.chemical_id, qty: Number(row.qty) || 0,
  ph_value: row.ph_value != null ? Number(row.ph_value) : null,
});

const mapMasterItem = (row: any): MasterItem => ({
  id: row.id, name: row.name, type: row.type, shade_family: row.shade_family || '',
  company: row.company || '', unit: row.unit || '', is_active: row.is_active ?? true,
});

const mapProcessStep = (row: any): ProcessStep => ({
  id: row.id, lot_no: row.lot_no, step_number: Number(row.step_number),
  step_type: row.step_type, description: row.description || '', created_at: row.created_at,
});

const mapStepDye = (row: any): StepDye => ({
  id: row.id, step_id: row.step_id, dye_id: row.dye_id,
  percentage: Number(row.percentage) || 0, qty_grams: Number(row.qty_grams) || 0,
});

const mapStepChemical = (row: any): StepChemical => ({
  id: row.id, step_id: row.step_id, chemical_id: row.chemical_id, qty: Number(row.qty) || 0,
});
