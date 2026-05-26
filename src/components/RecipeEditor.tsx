import React, { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useApp } from '@/context/AppContext';
import { calculateDyeGrams } from '@/lib/calculations';
import { Plus, Trash2, Percent, Undo2 } from 'lucide-react';
import DecimalInput from '@/components/DecimalInput';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { RecipeDye, RecipeChemical } from '@/types';

const DEFAULT_CHEMICAL_NAMES = ['BUF', 'CDFT', 'CWS'];
const DEFAULT_PH_VALUE = 4.5;

interface Props {
  lotNo: string;
  netWeight: number;
  readOnly?: boolean;
  onAfterSave?: () => void | Promise<void>;
}

export interface RecipeEditorHandle {
  /** Stage a reference recipe into local editor state without saving. */
  applyReference: (refDyes: RecipeDye[], refChemicals: RecipeChemical[]) => void;
}

const RecipeEditor = forwardRef<RecipeEditorHandle, Props>(({ lotNo, netWeight, readOnly = false, onAfterSave }, ref) => {
  const { masterItems, getDyesForLot, getChemicalsForLot, updateRecipeDyes, updateRecipeChemicals } = useApp();

  const dyes = getDyesForLot(lotNo);
  const chemicals = getChemicalsForLot(lotNo);
  const dyeItems = masterItems.filter(m => m.type === 'dye' && m.is_active).sort((a, b) => (a.short_name || a.name).localeCompare(b.short_name || b.name));
  const chemicalItems = masterItems.filter(m => m.type === 'chemical' && m.is_active).sort((a, b) => a.name.localeCompare(b.name));

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
  const [prevDyes, setPrevDyes] = useState<RecipeDye[] | null>(null);

  // Imperative API: stage a reference recipe into local state without saving.
  useImperativeHandle(ref, () => ({
    applyReference: (refDyes, refChemicals) => {
      const stagedDyes: RecipeDye[] = refDyes.map(d => ({
        id: crypto.randomUUID(),
        lot_no: lotNo,
        dye_id: d.dye_id,
        percentage: d.percentage,
        qty_grams: calculateDyeGrams(d.percentage, netWeight),
      }));
      const stagedChems: RecipeChemical[] = refChemicals.map(c => ({
        id: crypto.randomUUID(),
        lot_no: lotNo,
        chemical_id: c.chemical_id,
        qty: c.qty,
        ph_value: c.ph_value ?? null,
      }));
      setLocalDyes(stagedDyes);
      if (stagedChems.length > 0) setLocalChemicals(stagedChems);
      setDirty(true);
    },
  }), [lotNo, netWeight]);

  const applyReduction = () => {
    setPrevDyes([...localDyes]);
    setLocalDyes(prev => prev.map(dye => {
      const newPct = parseFloat((dye.percentage * 0.90).toFixed(6));
      return { ...dye, percentage: newPct, qty_grams: calculateDyeGrams(newPct, netWeight) };
    }));
    setDirty(true);
  };

  const applyReverse = () => {
    setPrevDyes([...localDyes]);
    setLocalDyes(prev => prev.map(dye => {
      const newPct = parseFloat((dye.percentage / 0.90).toFixed(6));
      return { ...dye, percentage: newPct, qty_grams: calculateDyeGrams(newPct, netWeight) };
    }));
    setDirty(true);
  };

  const undoReduction = () => {
    if (prevDyes) {
      setLocalDyes(prevDyes);
      setPrevDyes(null);
      setDirty(true);
    }
  };

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
    if (onAfterSave) await onAfterSave();
  };

  const getDyeDisplayName = (id: string) => {
    const item = masterItems.find(m => m.id === id);
    if (!item) return '';
    return item.short_name ? `${item.short_name} (${item.name})` : item.name;
  };

  return (
    <div className="space-y-6">
      {/* Dyes Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dyes</h3>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {prevDyes && (
                <Button variant="outline" size="sm" onClick={undoReduction} className="gap-1 text-xs">
                  <Undo2 className="w-3 h-3" /> Undo
                </Button>
              )}
              {localDyes.length > 0 && (
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <Percent className="w-3 h-3" /> Reverse 10% (÷0.9)
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reverse 10% reduction?</AlertDialogTitle>
                        <AlertDialogDescription>Divide all dye percentages by 0.9 to recover values before a 10% reduction? This can be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={applyReverse}>Yes, Apply</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <Percent className="w-3 h-3" /> Reduce 10%
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reduce dye percentages?</AlertDialogTitle>
                        <AlertDialogDescription>Apply 10% reduction to all dye percentages? This can be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={applyReduction}>Yes, Apply</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              <button onClick={addDye} className="inline-flex items-center gap-1 text-sm text-primary hover:underline btn-transition">
                <Plus className="w-3 h-3" /> Add Dye
              </button>
            </div>
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
                  <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed text-sm">{getDyeDisplayName(dye.dye_id)}</span>
                ) : (
                  <select value={dye.dye_id} onChange={e => updateDye(idx, 'dye_id', e.target.value)} className="input-industrial text-sm">
                    <option value="">Select dye...</option>
                    {dyeItems.map(d => <option key={d.id} value={d.id}>{d.short_name ? `${d.short_name} (${d.name})` : d.name}</option>)}
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
                    <DecimalInput step="0.01" min={0} value={chem.qty} onValueChange={v => updateChemical(idx, 'qty', v)} className="input-industrial font-data text-sm" />
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
});

RecipeEditor.displayName = 'RecipeEditor';

export default RecipeEditor;
