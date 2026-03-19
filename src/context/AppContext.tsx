import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Lot, LotVersion, RecipeDye, RecipeChemical, MasterItem } from '@/types';
import { calculateNetWeight } from '@/lib/calculations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface AppState {
  lots: Lot[];
  versions: LotVersion[];
  recipeDyes: RecipeDye[];
  recipeChemicals: RecipeChemical[];
  masterItems: MasterItem[];
  loading: boolean;
}

interface AppContextType extends AppState {
  addLot: (lot: Omit<Lot, 'net_weight' | 'is_approved'>, sourceLotNo?: string) => Promise<boolean>;
  approveLot: (lotNo: string) => Promise<void>;
  unapproveLot: (lotNo: string) => Promise<void>;
  addVersion: (lotNo: string, reason: string) => Promise<LotVersion | null>;
  updateRecipeDyes: (versionId: string, dyes: RecipeDye[]) => Promise<void>;
  updateRecipeChemicals: (versionId: string, chemicals: RecipeChemical[]) => Promise<void>;
  addMasterItem: (item: Omit<MasterItem, 'id'>) => Promise<void>;
  updateMasterItem: (item: MasterItem) => Promise<void>;
  getLot: (lotNo: string) => Lot | undefined;
  getVersionsForLot: (lotNo: string) => LotVersion[];
  getDyesForVersion: (versionId: string) => RecipeDye[];
  getChemicalsForVersion: (versionId: string) => RecipeChemical[];
  getApprovedLots: () => Lot[];
  getLotsReferencingSource: (lotNo: string) => Lot[];
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({
    lots: [], versions: [], recipeDyes: [], recipeChemicals: [], masterItems: [], loading: true,
  });

  const fetchAll = useCallback(async () => {
    if (!user) {
      setState({ lots: [], versions: [], recipeDyes: [], recipeChemicals: [], masterItems: [], loading: false });
      return;
    }
    setState(prev => ({ ...prev, loading: true }));

    const [lotsRes, versionsRes, dyesRes, chemsRes, masterRes] = await Promise.all([
      supabase.from('lots').select('*').order('created_at', { ascending: false }),
      supabase.from('lot_versions').select('*').order('created_at', { ascending: true }),
      supabase.from('recipe_dyes').select('*'),
      supabase.from('recipe_chemicals').select('*'),
      supabase.from('master_items').select('*'),
    ]);

    setState({
      lots: (lotsRes.data || []).map(mapLot),
      versions: (versionsRes.data || []).map(mapVersion),
      recipeDyes: (dyesRes.data || []).map(mapDye),
      recipeChemicals: (chemsRes.data || []).map(mapChemical),
      masterItems: (masterRes.data || []).map(mapMasterItem),
      loading: false,
    });
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addLot = useCallback(async (lotData: Omit<Lot, 'net_weight' | 'is_approved'>, sourceLotNo?: string): Promise<boolean> => {
    const net_weight = calculateNetWeight(lotData.gross_weight, lotData.number_of_chesses);

    const { error: lotErr } = await supabase.from('lots').insert({
      lot_no: lotData.lot_no,
      date: lotData.date,
      yarn_company_name: lotData.yarn_company_name,
      color_name: lotData.color_name,
      denier: lotData.denier,
      number_of_chesses: lotData.number_of_chesses,
      gross_weight: lotData.gross_weight,
      net_weight,
      is_approved: false,
      source_lot_no: sourceLotNo || null,
    });
    if (lotErr) return false;

    const versionId = crypto.randomUUID();
    await supabase.from('lot_versions').insert({
      id: versionId,
      lot_no: lotData.lot_no,
      version_code: 'A',
      parent_version_id: null,
      reason_for_change: 'Initial recipe',
    });

    // Copy recipe from source lot if provided
    if (sourceLotNo) {
      const { data: sourceVersions } = await supabase
        .from('lot_versions')
        .select('*')
        .eq('lot_no', sourceLotNo)
        .order('version_code', { ascending: true });

      const latestVersion = sourceVersions?.[sourceVersions.length - 1];
      if (latestVersion) {
        const { data: srcDyes } = await supabase.from('recipe_dyes').select('*').eq('version_id', latestVersion.id);
        const { data: srcChems } = await supabase.from('recipe_chemicals').select('*').eq('version_id', latestVersion.id);

        if (srcDyes?.length) {
          await supabase.from('recipe_dyes').insert(
            srcDyes.map(d => ({
              lot_no: lotData.lot_no,
              version_id: versionId,
              dye_id: d.dye_id,
              percentage: d.percentage,
              qty_grams: parseFloat(((d.percentage / 100) * net_weight * 1000).toFixed(3)),
            }))
          );
        }
        if (srcChems?.length) {
          await supabase.from('recipe_chemicals').insert(
            srcChems.map(c => ({
              lot_no: lotData.lot_no,
              version_id: versionId,
              chemical_id: c.chemical_id,
              qty: c.qty,
            }))
          );
        }
      }
    }

    await fetchAll();
    return true;
  }, [fetchAll]);

  const approveLot = useCallback(async (lotNo: string) => {
    await supabase.from('lots').update({ is_approved: true }).eq('lot_no', lotNo);
    await fetchAll();
  }, [fetchAll]);

  const unapproveLot = useCallback(async (lotNo: string) => {
    await supabase.from('lots').update({ is_approved: false }).eq('lot_no', lotNo);
    await fetchAll();
  }, [fetchAll]);

  const addVersion = useCallback(async (lotNo: string, reason: string): Promise<LotVersion | null> => {
    const existingVersions = state.versions
      .filter(v => v.lot_no === lotNo)
      .sort((a, b) => a.version_code.localeCompare(b.version_code));
    if (existingVersions.length === 0) return null;

    const lastVersion = existingVersions[existingVersions.length - 1];
    const nextCode = String.fromCharCode(lastVersion.version_code.charCodeAt(0) + 1);
    const newVersionId = crypto.randomUUID();

    // Auto un-approve on new version
    await supabase.from('lots').update({ is_approved: false }).eq('lot_no', lotNo);

    const { error } = await supabase.from('lot_versions').insert({
      id: newVersionId,
      lot_no: lotNo,
      version_code: nextCode,
      parent_version_id: lastVersion.id,
      reason_for_change: reason,
    });
    if (error) return null;

    // Copy dyes and chemicals from last version
    const { data: prevDyes } = await supabase.from('recipe_dyes').select('*').eq('version_id', lastVersion.id);
    const { data: prevChems } = await supabase.from('recipe_chemicals').select('*').eq('version_id', lastVersion.id);

    if (prevDyes?.length) {
      await supabase.from('recipe_dyes').insert(
        prevDyes.map(d => ({
          lot_no: lotNo,
          version_id: newVersionId,
          dye_id: d.dye_id,
          percentage: d.percentage,
          qty_grams: d.qty_grams,
        }))
      );
    }
    if (prevChems?.length) {
      await supabase.from('recipe_chemicals').insert(
        prevChems.map(c => ({
          lot_no: lotNo,
          version_id: newVersionId,
          chemical_id: c.chemical_id,
          qty: c.qty,
        }))
      );
    }

    await fetchAll();
    const newVersion: LotVersion = {
      id: newVersionId, lot_no: lotNo, version_code: nextCode,
      parent_version_id: lastVersion.id, reason_for_change: reason,
      created_at: new Date().toISOString(),
    };
    return newVersion;
  }, [state.versions, fetchAll]);

  const updateRecipeDyes = useCallback(async (versionId: string, dyes: RecipeDye[]) => {
    await supabase.from('recipe_dyes').delete().eq('version_id', versionId);
    if (dyes.length > 0) {
      await supabase.from('recipe_dyes').insert(
        dyes.map(d => ({
          lot_no: d.lot_no,
          version_id: d.version_id,
          dye_id: d.dye_id,
          percentage: d.percentage,
          qty_grams: d.qty_grams,
        }))
      );
    }
    await fetchAll();
  }, [fetchAll]);

  const updateRecipeChemicals = useCallback(async (versionId: string, chemicals: RecipeChemical[]) => {
    await supabase.from('recipe_chemicals').delete().eq('version_id', versionId);
    if (chemicals.length > 0) {
      await supabase.from('recipe_chemicals').insert(
        chemicals.map(c => ({
          lot_no: c.lot_no,
          version_id: c.version_id,
          chemical_id: c.chemical_id,
          qty: c.qty,
        }))
      );
    }
    await fetchAll();
  }, [fetchAll]);

  const addMasterItem = useCallback(async (item: Omit<MasterItem, 'id'>) => {
    await supabase.from('master_items').insert({
      name: item.name,
      type: item.type,
      shade_family: item.shade_family,
      company: item.company,
      unit: item.unit,
      is_active: item.is_active,
    });
    await fetchAll();
  }, [fetchAll]);

  const updateMasterItem = useCallback(async (item: MasterItem) => {
    await supabase.from('master_items').update({
      name: item.name,
      type: item.type,
      shade_family: item.shade_family,
      company: item.company,
      unit: item.unit,
      is_active: item.is_active,
    }).eq('id', item.id);
    await fetchAll();
  }, [fetchAll]);

  const getLot = useCallback((lotNo: string) => state.lots.find(l => l.lot_no === lotNo), [state.lots]);
  const getVersionsForLot = useCallback((lotNo: string) => state.versions.filter(v => v.lot_no === lotNo).sort((a, b) => a.version_code.localeCompare(b.version_code)), [state.versions]);
  const getDyesForVersion = useCallback((versionId: string) => state.recipeDyes.filter(d => d.version_id === versionId), [state.recipeDyes]);
  const getChemicalsForVersion = useCallback((versionId: string) => state.recipeChemicals.filter(c => c.version_id === versionId), [state.recipeChemicals]);
  const getApprovedLots = useCallback(() => state.lots.filter(l => l.is_approved), [state.lots]);
  const getLotsReferencingSource = useCallback((lotNo: string) => state.lots.filter(l => l.source_lot_no === lotNo), [state.lots]);

  return (
    <AppContext.Provider value={{
      ...state, addLot, approveLot, unapproveLot, addVersion, updateRecipeDyes, updateRecipeChemicals,
      addMasterItem, updateMasterItem, getLot, getVersionsForLot, getDyesForVersion,
      getChemicalsForVersion, getApprovedLots, getLotsReferencingSource, refreshData: fetchAll,
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

// Mappers from Supabase row to app types
const mapLot = (row: any): Lot => ({
  lot_no: row.lot_no,
  date: row.date,
  yarn_company_name: row.yarn_company_name,
  color_name: row.color_name || '',
  denier: row.denier || '',
  number_of_chesses: Number(row.number_of_chesses) || 0,
  gross_weight: Number(row.gross_weight) || 0,
  net_weight: Number(row.net_weight) || 0,
  is_approved: row.is_approved || false,
  source_lot_no: row.source_lot_no || null,
});

const mapVersion = (row: any): LotVersion => ({
  id: row.id,
  lot_no: row.lot_no,
  version_code: row.version_code,
  parent_version_id: row.parent_version_id || null,
  reason_for_change: row.reason_for_change || '',
  created_at: row.created_at,
});

const mapDye = (row: any): RecipeDye => ({
  id: row.id,
  lot_no: row.lot_no,
  version_id: row.version_id,
  dye_id: row.dye_id,
  percentage: Number(row.percentage) || 0,
  qty_grams: Number(row.qty_grams) || 0,
});

const mapChemical = (row: any): RecipeChemical => ({
  id: row.id,
  lot_no: row.lot_no,
  version_id: row.version_id,
  chemical_id: row.chemical_id,
  qty: Number(row.qty) || 0,
});

const mapMasterItem = (row: any): MasterItem => ({
  id: row.id,
  name: row.name,
  type: row.type,
  shade_family: row.shade_family || '',
  company: row.company || '',
  unit: row.unit || '',
  is_active: row.is_active ?? true,
});
