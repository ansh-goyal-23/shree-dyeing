import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { calculateNetWeight, calculateDyeGrams } from '@/lib/calculations';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import LotFieldAutocomplete from '@/components/LotFieldAutocomplete';
import DecimalInput from '@/components/DecimalInput';
import InventoryApprovalDialog from '@/components/InventoryApprovalDialog';
import { useInventoryApproval } from '@/hooks/useInventoryApproval';
import { seedFinishedGoodsForLot } from '@/lib/inventoryEngine';


const CreateLot: React.FC = () => {
  const { addLot, lots, getDyesForLot, getChemicalsForLot, updateRecipeDyes, updateRecipeChemicals, masterItems, processSteps, stepDyes, stepChemicals, recipeDyes, recipeChemicals, refreshData } = useApp();
  const inv = useInventoryApproval();
  const companyNames = useMemo(() => [...lots.map(l => l.yarn_company_name)].sort((a, b) => a.localeCompare(b)), [lots]);
  const colorNames = useMemo(() => ([...lots.map(l => l.color_name).filter(Boolean)] as string[]).sort((a, b) => a.localeCompare(b)), [lots]);
  const denierValues = useMemo(() => ([...lots.map(l => l.denier).filter(Boolean)] as string[]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [lots]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefillYarn = searchParams.get('yarn') || '';
  const prefillColor = searchParams.get('color') || '';
  const intakeItemId = searchParams.get('intake_item');
  const intakeId = searchParams.get('intake_id');

  const [form, setForm] = useState({
    lot_no: '',
    date: new Date().toISOString().split('T')[0],
    yarn_company_name: prefillYarn,
    color_name: prefillColor,
    denier: '',
    shade_number: '',
    number_of_chesses: 0,
    gross_weight: 0,
  });

  // Build shade dropdown options: "lot_no (color_name)"
  const shadeOptions = useMemo(() => {
    return lots
      .filter(l => l.status === 'Approved')
      .map(l => ({
        label: `${l.lot_no} (${l.color_name || 'No Color'})`,
        lot_no: l.lot_no,
        yarn_company_name: l.yarn_company_name,
        color_name: l.color_name,
        denier: l.denier,
      }))
      .sort((a, b) => a.lot_no.localeCompare(b.lot_no, undefined, { numeric: true }));
  }, [lots]);

  const netWeight = useMemo(
    () => calculateNetWeight(form.gross_weight, form.number_of_chesses),
    [form.gross_weight, form.number_of_chesses]
  );

  const handleShadeSelect = useCallback((lotNo: string) => {
    const sourceLot = lots.find(l => l.lot_no === lotNo);
    if (sourceLot) {
      setForm(prev => ({
        ...prev,
        shade_number: lotNo,
        yarn_company_name: sourceLot.yarn_company_name,
        color_name: sourceLot.color_name,
        denier: sourceLot.denier,
      }));
    }
  }, [lots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lot_no.trim()) { toast.error('Lot No is required.'); return; }
    if (!form.yarn_company_name.trim()) { toast.error('Yarn Company Name is required.'); return; }
    if (!form.color_name.trim()) { toast.error('Color Name is required.'); return; }
    if (!form.denier.trim()) { toast.error('Denier is required.'); return; }
    if (!form.number_of_chesses) { toast.error('Number of Chesses is required.'); return; }
    if (!form.gross_weight) { toast.error('Gross Weight is required.'); return; }

    const success = await addLot({
      lot_no: form.lot_no.trim(),
      date: form.date,
      yarn_company_name: form.yarn_company_name.trim(),
      color_name: form.color_name.trim(),
      denier: form.denier.trim(),
      shade_number: form.shade_number.trim() || form.lot_no.trim(),
      number_of_chesses: form.number_of_chesses,
      gross_weight: form.gross_weight,
      source_lot_no: null,
      remarks: '',
    });

    if (success) {
      // Clone base recipe from shade source lot if selected
      const shadeLotNo = form.shade_number.trim();
      if (shadeLotNo && shadeLotNo !== form.lot_no.trim()) {
        const sourceDyes = getDyesForLot(shadeLotNo);
        const sourceChemicals = getChemicalsForLot(shadeLotNo);
        const newNetWeight = calculateNetWeight(form.gross_weight, form.number_of_chesses);
        if (sourceDyes.length > 0) {
          const clonedDyes = sourceDyes.map(d => ({
            id: crypto.randomUUID(),
            lot_no: form.lot_no.trim(),
            dye_id: d.dye_id,
            percentage: d.percentage,
            qty_grams: calculateDyeGrams(d.percentage, newNetWeight),
          }));
          await updateRecipeDyes(form.lot_no.trim(), clonedDyes);
        }
        if (sourceChemicals.length > 0) {
          const clonedChemicals = sourceChemicals.map(c => ({
            id: crypto.randomUUID(),
            lot_no: form.lot_no.trim(),
            chemical_id: c.chemical_id,
            qty: c.qty,
            ph_value: c.ph_value ?? null,
          }));
          await updateRecipeChemicals(form.lot_no.trim(), clonedChemicals);
        }
      }

      if (intakeItemId) {
        await supabase.from('intake_items').update({
          linked_lot_no: form.lot_no.trim(),
          status: 'In Development',
        }).eq('id', intakeItemId);
      }
      toast.success(`Lot ${form.lot_no} created successfully.`);

      // Refresh state so engine sees the freshly inserted recipe rows
      await refreshData();

      // Build the freshly-saved lot snapshot for the engine
      const newLotNo = form.lot_no.trim();
      const newNet = calculateNetWeight(form.gross_weight, form.number_of_chesses);
      const newLot = {
        lot_no: newLotNo,
        date: form.date,
        yarn_company_name: form.yarn_company_name.trim(),
        color_name: form.color_name.trim(),
        denier: form.denier.trim(),
        number_of_chesses: form.number_of_chesses,
        gross_weight: form.gross_weight,
        net_weight: newNet,
        is_approved: false,
        status: (form.shade_number.trim() && form.shade_number.trim() !== newLotNo) ? 'Production' : 'In Approval' as any,
        shade_number: form.shade_number.trim() || newLotNo,
        source_lot_no: null,
        remarks: '',
      };

      await seedFinishedGoodsForLot(newLot);

      // Pull updated recipe snapshot (after potential clone) directly from supabase
      const [{ data: rd }, { data: rc }] = await Promise.all([
        supabase.from('recipe_dyes').select('*').eq('lot_no', newLotNo),
        supabase.from('recipe_chemicals').select('*').eq('lot_no', newLotNo),
      ]);
      const freshDyes = (rd || []).map((r: any) => ({ id: r.id, lot_no: r.lot_no, dye_id: r.dye_id, percentage: Number(r.percentage)||0, qty_grams: Number(r.qty_grams)||0 }));
      const freshChems = (rc || []).map((r: any) => ({ id: r.id, lot_no: r.lot_no, chemical_id: r.chemical_id, qty: Number(r.qty)||0, ph_value: r.ph_value!=null?Number(r.ph_value):null }));

      await inv.openForLot({
        lot: newLot,
        recipeDyes: freshDyes,
        recipeChemicals: freshChems,
        steps: processSteps,
        stepDyes,
        stepChemicals,
        masterItems,
      });

      pendingNavRef.current = intakeId ? `/sampling/${intakeId}` : `/shade-management/lots/${newLotNo}`;
    } else {
      toast.error(`Failed to create lot. Lot No may already exist.`);
    }
  };

  const update = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Create Lot</h1>

      <form onSubmit={handleSubmit} className="card-industrial p-6 space-y-5">
        {/* Row 1: Lot No + Shade Number */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Lot No *</label>
            <input
              type="text"
              value={form.lot_no}
              onChange={e => update('lot_no', e.target.value)}
              className="input-industrial w-full font-data"
              placeholder="e.g. 4022"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Shade Number</label>
            <ShadeDropdown
              value={form.shade_number}
              onChange={v => update('shade_number', v)}
              onSelect={handleShadeSelect}
              options={shadeOptions}
              placeholder={form.lot_no || 'Defaults to Lot No'}
            />
            <p className="text-xs text-muted-foreground">Leave empty to use Lot No</p>
          </div>
        </div>

        {/* Row 2: Date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => update('date', e.target.value)}
              className="input-industrial w-full font-data"
              required
            />
          </div>
        </div>

        {/* Row 3: Yarn Company + Color Name (autofilled if shade selected) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Yarn Company *</label>
            <LotFieldAutocomplete
              value={form.yarn_company_name}
              onChange={v => update('yarn_company_name', v)}
              suggestions={companyNames}
              placeholder="Company name"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Color Name *</label>
            <LotFieldAutocomplete
              value={form.color_name}
              onChange={v => update('color_name', v)}
              suggestions={colorNames}
              placeholder="e.g. Navy Blue"
            />
          </div>
        </div>

        {/* Row 4: Denier */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Denier *</label>
            <LotFieldAutocomplete
              value={form.denier}
              onChange={v => update('denier', v)}
              suggestions={denierValues}
              placeholder="e.g. 150D"
            />
          </div>
        </div>

        {/* Row 5: Chesses, Gross, Net */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">No. of Chesses *</label>
            <input
              type="number"
              min={1}
              value={form.number_of_chesses || ''}
              onChange={e => update('number_of_chesses', parseInt(e.target.value) || 0)}
              className="input-industrial w-full font-data"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Gross Weight (kg) *</label>
            <DecimalInput
              min={0}
              step="0.001"
              value={form.gross_weight}
              onValueChange={v => update('gross_weight', v)}
              className="input-industrial w-full font-data"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Net Weight (kg)</label>
            <div className="input-industrial w-full flex items-center bg-secondary/50 font-data font-semibold cursor-not-allowed">
              {netWeight.toFixed(3)}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/shade-management/lots')}
            className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring"
          >
            Create Lot
          </button>
        </div>
      </form>
    </div>
  );
};

/* ─── Shade Dropdown with search ─── */
interface ShadeOption {
  label: string;
  lot_no: string;
  yarn_company_name: string;
  color_name: string;
  denier: string;
}

interface ShadeDropdownProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (lotNo: string) => void;
  options: ShadeOption[];
  placeholder?: string;
}

const ShadeDropdown: React.FC<ShadeDropdownProps> = ({ value, onChange, onSelect, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return options;
    const lower = value.toLowerCase().trim();
    return options.filter(o => o.label.toLowerCase().includes(lower) || o.lot_no.toLowerCase().includes(lower));
  }, [options, value]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="input-industrial w-full"
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map(o => (
            <button
              key={o.lot_no}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(o.lot_no); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreateLot;
