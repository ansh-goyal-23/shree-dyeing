import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Lot, LotVersion, RecipeDye, RecipeChemical, MasterItem } from '@/types';
import { calculateNetWeight } from '@/lib/calculations';

interface AppState {
  lots: Lot[];
  versions: LotVersion[];
  recipeDyes: RecipeDye[];
  recipeChemicals: RecipeChemical[];
  masterItems: MasterItem[];
}

interface AppContextType extends AppState {
  addLot: (lot: Omit<Lot, 'net_weight' | 'is_approved'>, sourceLotNo?: string) => boolean;
  approveLot: (lotNo: string) => void;
  unapproveLot: (lotNo: string) => void;
  addVersion: (lotNo: string, reason: string) => LotVersion | null;
  updateRecipeDyes: (versionId: string, dyes: RecipeDye[]) => void;
  updateRecipeChemicals: (versionId: string, chemicals: RecipeChemical[]) => void;
  addMasterItem: (item: Omit<MasterItem, 'id'>) => void;
  updateMasterItem: (item: MasterItem) => void;
  getLot: (lotNo: string) => Lot | undefined;
  getVersionsForLot: (lotNo: string) => LotVersion[];
  getDyesForVersion: (versionId: string) => RecipeDye[];
  getChemicalsForVersion: (versionId: string) => RecipeChemical[];
  getApprovedLots: () => Lot[];
  getLotsReferencingSource: (lotNo: string) => Lot[];
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'chromatech_data';

const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { lots: [], versions: [], recipeDyes: [], recipeChemicals: [], masterItems: [] };
};

const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => { saveState(state); }, [state]);

  const addLot = useCallback((lotData: Omit<Lot, 'net_weight' | 'is_approved'>, sourceLotNo?: string): boolean => {
    if (state.lots.some(l => l.lot_no === lotData.lot_no)) return false;
    if (sourceLotNo) {
      const src = state.lots.find(l => l.lot_no === sourceLotNo);
      if (!src) return false;
      if (sourceLotNo === lotData.lot_no) return false;
    }

    const net_weight = calculateNetWeight(lotData.gross_weight, lotData.number_of_chesses);
    const lot: Lot = { ...lotData, net_weight, is_approved: false, source_lot_no: sourceLotNo || null };

    const versionId = crypto.randomUUID();
    const version: LotVersion = {
      id: versionId,
      lot_no: lotData.lot_no,
      version_code: 'A',
      parent_version_id: null,
      reason_for_change: 'Initial recipe',
      created_at: new Date().toISOString(),
    };

    let newDyes: RecipeDye[] = [];
    let newChemicals: RecipeChemical[] = [];

    if (sourceLotNo) {
      const sourceVersions = state.versions
        .filter(v => v.lot_no === sourceLotNo)
        .sort((a, b) => a.version_code.localeCompare(b.version_code));
      const latestVersion = sourceVersions[sourceVersions.length - 1];
      if (latestVersion) {
        newDyes = state.recipeDyes
          .filter(d => d.version_id === latestVersion.id)
          .map(d => ({
            ...d,
            id: crypto.randomUUID(),
            lot_no: lotData.lot_no,
            version_id: versionId,
            qty_grams: parseFloat(((d.percentage / 100) * net_weight * 1000).toFixed(3)),
          }));
        newChemicals = state.recipeChemicals
          .filter(c => c.version_id === latestVersion.id)
          .map(c => ({
            ...c,
            id: crypto.randomUUID(),
            lot_no: lotData.lot_no,
            version_id: versionId,
          }));
      }
    }

    setState(prev => ({
      ...prev,
      lots: [...prev.lots, lot],
      versions: [...prev.versions, version],
      recipeDyes: [...prev.recipeDyes, ...newDyes],
      recipeChemicals: [...prev.recipeChemicals, ...newChemicals],
    }));
    return true;
  }, [state]);

  const approveLot = useCallback((lotNo: string) => {
    setState(prev => ({
      ...prev,
      lots: prev.lots.map(l => l.lot_no === lotNo ? { ...l, is_approved: true } : l),
    }));
  }, []);

  const unapproveLot = useCallback((lotNo: string) => {
    setState(prev => ({
      ...prev,
      lots: prev.lots.map(l => l.lot_no === lotNo ? { ...l, is_approved: false } : l),
    }));
  }, []);

  const addVersion = useCallback((lotNo: string, reason: string): LotVersion | null => {
    const existingVersions = state.versions
      .filter(v => v.lot_no === lotNo)
      .sort((a, b) => a.version_code.localeCompare(b.version_code));
    if (existingVersions.length === 0) return null;

    const lastVersion = existingVersions[existingVersions.length - 1];
    const nextCode = String.fromCharCode(lastVersion.version_code.charCodeAt(0) + 1);
    const newVersionId = crypto.randomUUID();

    const newVersion: LotVersion = {
      id: newVersionId,
      lot_no: lotNo,
      version_code: nextCode,
      parent_version_id: lastVersion.id,
      reason_for_change: reason,
      created_at: new Date().toISOString(),
    };

    const copiedDyes = state.recipeDyes
      .filter(d => d.version_id === lastVersion.id)
      .map(d => ({ ...d, id: crypto.randomUUID(), version_id: newVersionId }));

    const copiedChemicals = state.recipeChemicals
      .filter(c => c.version_id === lastVersion.id)
      .map(c => ({ ...c, id: crypto.randomUUID(), version_id: newVersionId }));

    setState(prev => ({
      ...prev,
      lots: prev.lots.map(l => l.lot_no === lotNo ? { ...l, is_approved: false } : l),
      versions: [...prev.versions, newVersion],
      recipeDyes: [...prev.recipeDyes, ...copiedDyes],
      recipeChemicals: [...prev.recipeChemicals, ...copiedChemicals],
    }));
    return newVersion;
  }, [state]);

  const updateRecipeDyes = useCallback((versionId: string, dyes: RecipeDye[]) => {
    setState(prev => ({
      ...prev,
      recipeDyes: [...prev.recipeDyes.filter(d => d.version_id !== versionId), ...dyes],
    }));
  }, []);

  const updateRecipeChemicals = useCallback((versionId: string, chemicals: RecipeChemical[]) => {
    setState(prev => ({
      ...prev,
      recipeChemicals: [...prev.recipeChemicals.filter(c => c.version_id !== versionId), ...chemicals],
    }));
  }, []);

  const addMasterItem = useCallback((item: Omit<MasterItem, 'id'>) => {
    setState(prev => ({
      ...prev,
      masterItems: [...prev.masterItems, { ...item, id: crypto.randomUUID() }],
    }));
  }, []);

  const updateMasterItem = useCallback((item: MasterItem) => {
    setState(prev => ({
      ...prev,
      masterItems: prev.masterItems.map(m => m.id === item.id ? item : m),
    }));
  }, []);

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
      getChemicalsForVersion, getApprovedLots, getLotsReferencingSource,
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
