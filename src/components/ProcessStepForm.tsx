import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import DecimalInput from '@/components/DecimalInput';
import { calculateDyeGrams } from '@/lib/calculations';
import type { ProcessStepType, StepDye, StepChemical, MasterItem } from '@/types';

interface Props {
  netWeight: number;
  masterItems: MasterItem[];
  onSubmit: (data: {
    step_type: ProcessStepType;
    description: string;
    dyes: Omit<StepDye, 'id' | 'step_id'>[];
    chemicals: Omit<StepChemical, 'id' | 'step_id'>[];
  }) => Promise<void>;
  onCancel: () => void;
  editingData?: {
    step_type: ProcessStepType;
    description: string;
    dyes: { dye_id: string; percentage: number; qty_grams: number }[];
    chemicals: { chemical_id: string; qty: number }[];
  };
}

const STEP_TYPES: ProcessStepType[] = ['Color Addition', 'RC', 'Leveling'];

const ProcessStepForm: React.FC<Props> = ({ netWeight, masterItems, onSubmit, onCancel, editingData }) => {
  const [step, setStep] = useState<1 | 2>(editingData ? 2 : 1);
  const [stepType, setStepType] = useState<ProcessStepType | ''>(editingData?.step_type || '');
  const [description, setDescription] = useState(editingData?.description || '');
  const [dyes, setDyes] = useState<{ dye_id: string; percentage: number; qty_grams: number }[]>(editingData?.dyes || []);
  const [chemicals, setChemicals] = useState<{ chemical_id: string; qty: number }[]>(editingData?.chemicals || []);
  const [submitting, setSubmitting] = useState(false);

  const dyeItems = masterItems.filter(m => m.type === 'dye' && m.is_active);
  const chemicalItems = masterItems.filter(m => m.type === 'chemical' && m.is_active);

  const showDyes = stepType === 'Color Addition' || stepType === 'Leveling';
  const showChemicals = stepType === 'RC' || stepType === 'Leveling';

  const addDye = () => setDyes(prev => [...prev, { dye_id: '', percentage: 0, qty_grams: 0 }]);
  const updateDye = (idx: number, field: string, value: string | number) => {
    setDyes(prev => {
      const updated = [...prev];
      const dye = { ...updated[idx], [field]: value };
      if (field === 'percentage') dye.qty_grams = calculateDyeGrams(value as number, netWeight);
      updated[idx] = dye;
      return updated;
    });
  };
  const removeDye = (idx: number) => setDyes(prev => prev.filter((_, i) => i !== idx));

  const addChemical = () => setChemicals(prev => [...prev, { chemical_id: '', qty: 0 }]);
  const updateChemical = (idx: number, field: string, value: string | number) => {
    setChemicals(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };
  const removeChemical = (idx: number) => setChemicals(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!stepType) return;
    setSubmitting(true);
    await onSubmit({
      step_type: stepType,
      description: description.trim(),
      dyes: showDyes ? dyes : [],
      chemicals: showChemicals ? chemicals : [],
    });
    setSubmitting(false);
  };

  const isEditing = !!editingData;

  if (step === 1) {
    return (
      <div className="card-industrial p-4 border-l-4 border-primary space-y-4">
        <h3 className="text-sm font-semibold">Step 1: Select Process Type</h3>
        <div className="flex gap-2 flex-wrap">
          {STEP_TYPES.map(t => (
            <button key={t} onClick={() => setStepType(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium btn-transition border ${
                stepType === t ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-secondary'
              }`}>{t}</button>
          ))}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Description / Notes (optional)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            className="input-industrial w-full" placeholder="e.g. Added extra blue for shade match" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 h-10 border border-input rounded-md text-sm btn-transition hover:bg-secondary">Cancel</button>
          <button onClick={() => stepType && setStep(2)} disabled={!stepType}
            className="px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 disabled:opacity-50">Next</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-industrial p-4 border-l-4 border-primary space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{isEditing ? 'Edit' : 'Step 2'}: {stepType} Details</h3>
        {!isEditing && <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground btn-transition">← Back</button>}
      </div>

      {/* Description (editable in step 2 when editing) */}
      {isEditing && (
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Description / Notes (optional)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            className="input-industrial w-full" placeholder="e.g. Added extra blue for shade match" />
        </div>
      )}

      {showDyes && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dyes</h4>
            <button onClick={addDye} className="inline-flex items-center gap-1 text-sm text-primary hover:underline btn-transition"><Plus className="w-3 h-3" /> Add Dye</button>
          </div>
          {dyes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No dyes added yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_100px_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Dye</span><span>%</span><span>Grams</span><span></span>
              </div>
              {dyes.map((dye, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_120px_40px] gap-2 items-center">
                  <select value={dye.dye_id} onChange={e => updateDye(idx, 'dye_id', e.target.value)} className="input-industrial text-sm">
                    <option value="">Select dye...</option>
                    {dyeItems.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <DecimalInput step="0.001" min={0} value={dye.percentage} onValueChange={v => updateDye(idx, 'percentage', v)} className="input-industrial font-data text-sm" />
                  <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed font-data font-semibold text-sm">{calculateDyeGrams(dye.percentage, netWeight).toFixed(3)}</span>
                  <button onClick={() => removeDye(idx)} className="p-2 text-destructive hover:bg-destructive/10 rounded btn-transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showChemicals && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chemicals</h4>
            <button onClick={addChemical} className="inline-flex items-center gap-1 text-sm text-primary hover:underline btn-transition"><Plus className="w-3 h-3" /> Add Chemical</button>
          </div>
          {chemicals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No chemicals added yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_120px_60px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Chemical</span><span>Qty</span><span>Unit</span><span></span>
              </div>
              {chemicals.map((chem, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_120px_60px_40px] gap-2 items-center">
                  <select value={chem.chemical_id} onChange={e => updateChemical(idx, 'chemical_id', e.target.value)} className="input-industrial text-sm">
                    <option value="">Select chemical...</option>
                    {chemicalItems.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="number" step="0.01" min={0} value={chem.qty || ''} onChange={e => updateChemical(idx, 'qty', parseFloat(e.target.value) || 0)} className="input-industrial font-data text-sm" />
                  <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed text-sm text-muted-foreground">{masterItems.find(m => m.id === chem.chemical_id)?.unit || '—'}</span>
                  <button onClick={() => removeChemical(idx)} className="p-2 text-destructive hover:bg-destructive/10 rounded btn-transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 h-10 border border-input rounded-md text-sm btn-transition hover:bg-secondary">Cancel</button>
        <button onClick={handleSubmit} disabled={submitting}
          className="px-6 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 disabled:opacity-50">
          {submitting ? 'Saving...' : isEditing ? 'Update Step' : 'Save Step'}
        </button>
      </div>
    </div>
  );
};

export default ProcessStepForm;
