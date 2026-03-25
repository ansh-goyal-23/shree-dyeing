import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { calculateDyeGrams } from '@/lib/calculations';
import { Plus, Trash2 } from 'lucide-react';
import DecimalInput from '@/components/DecimalInput';
import type { RecipeDye, RecipeChemical } from '@/types';

const DEFAULT_CHEMICAL_NAMES = ['BUF', 'CDFT', 'CWS'];
const DEFAULT_PH_VALUE = 4.5;

interface Props {
  lotNo: string;
  netWeight: number;
  readOnly?: boolean;
}

const RecipeEditor: React.FC<Props> = ({ lotNo, netWeight, readOnly = false }) => {
  const { masterItems, getDyesForLot, getChemicalsForLot, updateRecipeDyes, updateRecipeChemicals } = useApp();

  const dyes = getDyesForLot(lotNo);
  const chemicals = getChemicalsForLot(lotNo);
  const dyeItems = masterItems.filter(m => m.type === 'dye' && m.is_active);
  const chemicalItems = masterItems.filter(m => m.type === 'chemical' && m.is_active);

  // Build default chemicals list based on master items
  const defaultChemicals = useMemo(() => {
    return DEFAULT_CHEMICAL_NAMES.map(name => {
      const item = chemicalItems.find(c => c.name.toUpperCase() === name);
      if (!item) return null;
      return {
        id: crypto.randomUUID(),
        lot_no: lotNo,
        chemical_id: item.id,
        qty: 0,
        ph_value: name === 'BUF' ? DEFAULT_PH_VALUE : null,
      } as RecipeChemical;
    }).filter(Boolean) as RecipeChemical[];
  }, [chemicalItems, lotNo]);

  // Initialize chemicals: use existing if any, otherwise use defaults
  const initialChemicals = useMemo(() => {
    if (chemicals.length > 0) return chemicals;
    return defaultChemicals;
  }, [chemicals, defaultChemicals]);

  const [localDyes, setLocalDyes] = useState<RecipeDye[]>(dyes);
  const [localChemicals, setLocalChemicals] = useState<RecipeChemical[]>(initialChemicals);
  const [dirty, setDirty] = useState(false);

  const isBufChemical = (chemicalId: string) => {
    const item = masterItems.find(m => m.id === chemicalId);
    return item?.name?.toUpperCase() === 'BUF';
  };

  const addDye = () => {
    setLocalDyes(prev => [...prev, {
      id: crypto.randomUUID(),
      lot_no: lotNo,
      dye_id: '',
      percentage: 0,
      qty_grams: 0,
    }]);
    setDirty(true);
  };

  const updateDye = (idx: number, field: string, value: string | number) => {
    setLocalDyes(prev => {
      const updated = [...prev];
      const dye = { ...updated[idx], [field]: value };
      if (field === 'percentage' || field === 'dye_id') {
        dye.qty_grams = calculateDyeGrams(field === 'percentage' ? (value as number) : dye.percentage, netWeight);
      }
      updated[idx] = dye;
      return updated;
    });
    setDirty(true);
  };

  const removeDye = (idx: number) => {
    setLocalDyes(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const addChemical = () => {
    setLocalChemicals(prev => [...prev, {
      id: crypto.randomUUID(),
      lot_no: lotNo,
      chemical_id: '',
      qty: 0,
      ph_value: null,
    }]);
    setDirty(true);
  };

  const updateChemical = (idx: number, field: string, value: string | number | null) => {
    setLocalChemicals(prev => {
      const updated = [...prev];
      const chem = { ...updated[idx], [field]: value };
      // If chemical changed to BUF, set default pH; if changed away from BUF, clear pH
      if (field === 'chemical_id') {
        chem.ph_value = isBufChemical(value as string) ? DEFAULT_PH_VALUE : null;
      }
      updated[idx] = chem;
      return updated;
    });
    setDirty(true);
  };

  const removeChemical = (idx: number) => {
    setLocalChemicals(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const commitRecipe = async () => {
    await updateRecipeDyes(lotNo, localDyes);
    await updateRecipeChemicals(lotNo, localChemicals);
    setDirty(false);
  };

  const getDyeName = (id: string) => masterItems.find(m => m.id === id)?.name || '';

  return (
    <div className="space-y-6">
      {/* Dyes Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dyes</h3>
          {!readOnly && (
            <button onClick={addDye} className="inline-flex items-center gap-1 text-sm text-primary hover:underline btn-transition">
              <Plus className="w-3 h-3" /> Add Dye
            </button>
          )}
        </div>
        {localDyes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No dyes added.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_100px_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Dye</span><span>%</span><span>Grams</span><span></span>
            </div>
            {localDyes.map((dye, idx) => (
              <div key={dye.id} className="grid grid-cols-[1fr_100px_120px_40px] gap-2 items-center">
                {readOnly ? (
                  <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed text-sm">{getDyeName(dye.dye_id)}</span>
                ) : (
                  <select value={dye.dye_id} onChange={e => updateDye(idx, 'dye_id', e.target.value)} className="input-industrial text-sm">
                    <option value="">Select dye...</option>
                    {dyeItems.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
                {readOnly ? (
                  <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed font-data text-sm">{dye.percentage}</span>
                ) : (
                  <DecimalInput step="0.001" min={0} value={dye.percentage} onValueChange={v => updateDye(idx, 'percentage', v)} className="input-industrial font-data text-sm" />
                )}
                <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed font-data font-semibold text-sm">
                  {calculateDyeGrams(dye.percentage, netWeight).toFixed(3)}
                </span>
                {!readOnly && (
                  <button onClick={() => removeDye(idx)} className="p-2 text-destructive hover:bg-destructive/10 rounded btn-transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chemicals Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chemicals</h3>
          {!readOnly && (
            <button onClick={addChemical} className="inline-flex items-center gap-1 text-sm text-primary hover:underline btn-transition">
              <Plus className="w-3 h-3" /> Add Chemical
            </button>
          )}
        </div>
        {localChemicals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No chemicals added.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_100px_80px_80px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Chemical</span><span>Qty</span><span>Unit</span><span>pH</span><span></span>
            </div>
            {localChemicals.map((chem, idx) => {
              const showPh = isBufChemical(chem.chemical_id);
              return (
                <div key={chem.id} className="grid grid-cols-[1fr_100px_80px_80px_40px] gap-2 items-center">
                  {readOnly ? (
                    <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed text-sm">
                      {masterItems.find(m => m.id === chem.chemical_id)?.name || ''}
                    </span>
                  ) : (
                    <select value={chem.chemical_id} onChange={e => updateChemical(idx, 'chemical_id', e.target.value)} className="input-industrial text-sm">
                      <option value="">Select chemical...</option>
                      {chemicalItems.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  {readOnly ? (
                    <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed font-data text-sm">{chem.qty}</span>
                  ) : (
                    <input type="number" step="0.01" min={0} value={chem.qty || ''} onChange={e => updateChemical(idx, 'qty', parseFloat(e.target.value) || 0)} className="input-industrial font-data text-sm" />
                  )}
                  <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed text-sm text-muted-foreground">
                    {masterItems.find(m => m.id === chem.chemical_id)?.unit || '—'}
                  </span>
                  {/* pH field - only for BUF */}
                  {showPh ? (
                    readOnly ? (
                      <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed font-data text-sm">{chem.ph_value ?? '—'}</span>
                    ) : (
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={14}
                        value={chem.ph_value ?? ''}
                        onChange={e => updateChemical(idx, 'ph_value', e.target.value ? parseFloat(e.target.value) : null)}
                        className="input-industrial font-data text-sm"
                        placeholder="pH"
                      />
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                  {!readOnly && (
                    <button onClick={() => removeChemical(idx)} className="p-2 text-destructive hover:bg-destructive/10 rounded btn-transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save */}
      {!readOnly && dirty && (
        <div className="flex justify-end pt-2">
          <button onClick={commitRecipe} className="px-6 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
            Save Recipe
          </button>
        </div>
      )}
    </div>
  );
};

export default RecipeEditor;
