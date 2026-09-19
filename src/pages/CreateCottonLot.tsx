import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { calculateNetWeight, calculateDyeGrams } from '@/lib/calculations';
import { COTTON_STAGE_TEMPLATE, createCottonLot, type CottonStageInput } from '@/lib/cottonStages';
import LotFieldAutocomplete from '@/components/LotFieldAutocomplete';
import DecimalInput from '@/components/DecimalInput';

interface Props {
  onBack: () => void;
}

const buildInitialStages = (
  masterItems: ReturnType<typeof useApp>['masterItems']
): CottonStageInput[] => {
  return COTTON_STAGE_TEMPLATE.map(t => {
    const chemicals = t.defaultChemicalNames
      .map(name => masterItems.find(m => m.type === 'chemical' && m.yarn_scope.includes('Cotton') && m.name.toLowerCase() === name.toLowerCase()))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map(m => ({ chemical_id: m.id, qty: 0 }));
    return {
      stage_type: t.stage_type,
      stage_order: t.stage_order,
      target_ph: t.target_ph,
      target_temp_c: t.target_temp_c,
      ramp_rate_c_per_min: t.ramp_rate_c_per_min,
      hold_minutes: t.hold_minutes,
      notes: t.notes,
      chemicals,
      dyes: [],
    };
  });
};

const CreateCottonLot: React.FC<Props> = ({ onBack }) => {
  const { lots, masterItems, refreshData } = useApp();
  const navigate = useNavigate();

  const companyNames = useMemo(() => [...new Set(lots.map(l => l.yarn_company_name))].sort((a, b) => a.localeCompare(b)), [lots]);
  const colorNames = useMemo(() => [...new Set(lots.map(l => l.color_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [lots]);
  const denierValues = useMemo(() => [...new Set(lots.map(l => l.denier).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [lots]);

  const cottonChemicals = useMemo(
    () => masterItems.filter(m => m.type === 'chemical' && m.yarn_scope.includes('Cotton') && m.is_active).sort((a, b) => a.name.localeCompare(b.name)),
    [masterItems]
  );
  const cottonDyes = useMemo(
    () => masterItems.filter(m => m.type === 'dye' && m.yarn_scope.includes('Cotton') && m.is_active).sort((a, b) => (a.short_name || a.name).localeCompare(b.short_name || b.name)),
    [masterItems]
  );

  const [form, setForm] = useState({
    lot_no: '',
    date: new Date().toISOString().split('T')[0],
    yarn_company_name: '',
    color_name: '',
    denier: '',
    ref_no: '',
    number_of_chesses: 0,
    gross_weight: 0,
  });
  const [stages, setStages] = useState<CottonStageInput[]>(() => buildInitialStages(masterItems));
  const [submitting, setSubmitting] = useState(false);

  const netWeight = useMemo(() => calculateNetWeight(form.gross_weight, form.number_of_chesses), [form.gross_weight, form.number_of_chesses]);

  const update = (field: keyof typeof form, value: string | number) => setForm(prev => ({ ...prev, [field]: value }));

  const updateStage = (idx: number, patch: Partial<CottonStageInput>) => {
    setStages(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addChemicalRow = (stageIdx: number) => {
    setStages(prev => prev.map((s, i) => (i === stageIdx ? { ...s, chemicals: [...s.chemicals, { chemical_id: '', qty: 0 }] } : s)));
  };
  const updateChemicalRow = (stageIdx: number, rowIdx: number, patch: Partial<{ chemical_id: string; qty: number }>) => {
    setStages(prev => prev.map((s, i) => {
      if (i !== stageIdx) return s;
      const chemicals = s.chemicals.map((c, j) => (j === rowIdx ? { ...c, ...patch } : c));
      return { ...s, chemicals };
    }));
  };
  const removeChemicalRow = (stageIdx: number, rowIdx: number) => {
    setStages(prev => prev.map((s, i) => (i === stageIdx ? { ...s, chemicals: s.chemicals.filter((_, j) => j !== rowIdx) } : s)));
  };

  const addDyeRow = (stageIdx: number) => {
    setStages(prev => prev.map((s, i) => (i === stageIdx ? { ...s, dyes: [...s.dyes, { dye_id: '', percentage: 0, qty_grams: 0 }] } : s)));
  };
  const updateDyeRow = (stageIdx: number, rowIdx: number, patch: Partial<{ dye_id: string; percentage: number }>) => {
    setStages(prev => prev.map((s, i) => {
      if (i !== stageIdx) return s;
      const dyes = s.dyes.map((d, j) => {
        if (j !== rowIdx) return d;
        const merged = { ...d, ...patch };
        return { ...merged, qty_grams: calculateDyeGrams(merged.percentage, netWeight) };
      });
      return { ...s, dyes };
    }));
  };
  const removeDyeRow = (stageIdx: number, rowIdx: number) => {
    setStages(prev => prev.map((s, i) => (i === stageIdx ? { ...s, dyes: s.dyes.filter((_, j) => j !== rowIdx) } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lot_no.trim()) { toast.error('Lot No is required.'); return; }
    if (!form.yarn_company_name.trim()) { toast.error('Yarn Company Name is required.'); return; }
    if (!form.color_name.trim()) { toast.error('Color Name is required.'); return; }
    if (!form.denier.trim()) { toast.error('Denier is required.'); return; }
    if (!form.number_of_chesses) { toast.error('Number of Chesses is required.'); return; }
    if (!form.gross_weight) { toast.error('Gross Weight is required.'); return; }

    setSubmitting(true);
    const result = await createCottonLot({
      lot_no: form.lot_no.trim(),
      date: form.date,
      yarn_company_name: form.yarn_company_name.trim(),
      color_name: form.color_name.trim(),
      denier: form.denier.trim(),
      ref_no: form.ref_no.trim() || null,
      number_of_chesses: form.number_of_chesses,
      gross_weight: form.gross_weight,
      net_weight: netWeight,
      stages,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success(`Cotton lot ${form.lot_no} created successfully.`);
      await refreshData();
      navigate('/shade-management/lots');
    } else {
      toast.error(result.error || 'Failed to create lot.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 hover:bg-secondary rounded-md btn-transition" title="Change yarn type">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Create Cotton Lot</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basics */}
        <div className="card-industrial p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lot Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lot No *</label>
              <input type="text" value={form.lot_no} onChange={e => update('lot_no', e.target.value)} className="input-industrial w-full font-data" placeholder="e.g. 4200" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date *</label>
              <input type="date" value={form.date} onChange={e => update('date', e.target.value)} className="input-industrial w-full font-data" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Yarn Company *</label>
              <LotFieldAutocomplete value={form.yarn_company_name} onChange={v => update('yarn_company_name', v)} suggestions={companyNames} placeholder="Company name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Color Name *</label>
              <LotFieldAutocomplete value={form.color_name} onChange={v => update('color_name', v)} suggestions={colorNames} placeholder="e.g. Navy Blue" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Denier *</label>
              <LotFieldAutocomplete value={form.denier} onChange={v => update('denier', v)} suggestions={denierValues} placeholder="e.g. 20/1" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ref. No.</label>
              <input type="text" value={form.ref_no} onChange={e => update('ref_no', e.target.value)} className="input-industrial w-full font-data" placeholder="Optional reference" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">No. of Chesses *</label>
              <input type="number" min={1} value={form.number_of_chesses || ''} onChange={e => update('number_of_chesses', parseInt(e.target.value) || 0)} className="input-industrial w-full font-data" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Gross Weight (kg) *</label>
              <DecimalInput min={0} step="0.001" value={form.gross_weight} onValueChange={v => update('gross_weight', v)} className="input-industrial w-full font-data" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Net Weight (kg)</label>
              <div className="input-industrial w-full flex items-center bg-secondary/50 font-data font-semibold cursor-not-allowed">
                {netWeight.toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        {/* Stages */}
        {stages.map((stage, idx) => (
          <div key={stage.stage_type} className="card-industrial p-6 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Stage {stage.stage_order} — {stage.stage_type}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Target pH</label>
                <input type="number" step="0.01" value={stage.target_ph ?? ''} onChange={e => updateStage(idx, { target_ph: e.target.value ? parseFloat(e.target.value) : null })} className="input-industrial w-full font-data text-sm" placeholder="—" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Target Temp (°C)</label>
                <input type="number" step="0.5" value={stage.target_temp_c ?? ''} onChange={e => updateStage(idx, { target_temp_c: e.target.value ? parseFloat(e.target.value) : null })} className="input-industrial w-full font-data text-sm" placeholder="—" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ramp (°C/min)</label>
                <input type="number" step="0.05" value={stage.ramp_rate_c_per_min ?? ''} onChange={e => updateStage(idx, { ramp_rate_c_per_min: e.target.value ? parseFloat(e.target.value) : null })} className="input-industrial w-full font-data text-sm" placeholder="—" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hold (min)</label>
                <input type="number" step="1" value={stage.hold_minutes ?? ''} onChange={e => updateStage(idx, { hold_minutes: e.target.value ? parseInt(e.target.value) : null })} className="input-industrial w-full font-data text-sm" placeholder="—" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea value={stage.notes} onChange={e => updateStage(idx, { notes: e.target.value })} className="input-industrial w-full text-sm min-h-[3rem]" rows={2} />
            </div>

            {/* Chemicals */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chemicals</h3>
                <button type="button" onClick={() => addChemicalRow(idx)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline btn-transition">
                  <Plus className="w-3 h-3" /> Add Chemical
                </button>
              </div>
              {stage.chemicals.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No chemicals added.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_100px_60px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
                    <span>Chemical</span><span>Qty</span><span>Unit</span><span></span>
                  </div>
                  {stage.chemicals.map((c, rowIdx) => (
                    <div key={rowIdx} className="grid grid-cols-[1fr_100px_60px_36px] gap-2 items-center">
                      <select value={c.chemical_id} onChange={e => updateChemicalRow(idx, rowIdx, { chemical_id: e.target.value })} className="input-industrial text-sm">
                        <option value="">Select chemical...</option>
                        {cottonChemicals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <DecimalInput step="0.01" min={0} value={c.qty} onValueChange={v => updateChemicalRow(idx, rowIdx, { qty: v })} className="input-industrial font-data text-sm" />
                      <span className="text-sm text-muted-foreground">
                        {cottonChemicals.find(m => m.id === c.chemical_id)?.unit || '—'}
                      </span>
                      <button type="button" onClick={() => removeChemicalRow(idx, rowIdx)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded btn-transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dyes (Dye Bath stage only) */}
            {stage.stage_type === 'Dye Bath' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dyes</h3>
                  <button type="button" onClick={() => addDyeRow(idx)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline btn-transition">
                    <Plus className="w-3 h-3" /> Add Dye
                  </button>
                </div>
                {cottonDyes.length === 0 && (
                  <p className="text-xs text-amber-600 mb-2">
                    No reactive dyes are set up yet for Cotton. Add them in Master Data (Shade Management → Master Data) with "Cotton" checked under Yarn Type.
                  </p>
                )}
                {stage.dyes.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No dyes added.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_90px_110px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
                      <span>Dye</span><span>%</span><span>Grams</span><span></span>
                    </div>
                    {stage.dyes.map((d, rowIdx) => (
                      <div key={rowIdx} className="grid grid-cols-[1fr_90px_110px_36px] gap-2 items-center">
                        <select value={d.dye_id} onChange={e => updateDyeRow(idx, rowIdx, { dye_id: e.target.value })} className="input-industrial text-sm">
                          <option value="">Select dye...</option>
                          {cottonDyes.map(m => <option key={m.id} value={m.id}>{m.short_name ? `${m.short_name} (${m.name})` : m.name}</option>)}
                        </select>
                        <DecimalInput step="0.001" min={0} value={d.percentage} onValueChange={v => updateDyeRow(idx, rowIdx, { percentage: v })} className="input-industrial font-data text-sm" />
                        <span className="input-industrial flex items-center bg-secondary/50 cursor-not-allowed font-data font-semibold text-sm">
                          {d.qty_grams.toFixed(3)}
                        </span>
                        <button type="button" onClick={() => removeDyeRow(idx, rowIdx)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded btn-transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-end gap-3 pt-2 pb-6">
          <button type="button" onClick={onBack} className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-6 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Cotton Lot'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCottonLot;
