import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { calculateNetWeight } from '@/lib/calculations';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import LotFieldAutocomplete from '@/components/LotFieldAutocomplete';

const CreateLot: React.FC = () => {
  const { addLot, lots } = useApp();
  const companyNames = useMemo(() => lots.map(l => l.yarn_company_name), [lots]);
  const colorNames = useMemo(() => lots.map(l => l.color_name).filter(Boolean) as string[], [lots]);
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

  const netWeight = useMemo(
    () => calculateNetWeight(form.gross_weight, form.number_of_chesses),
    [form.gross_weight, form.number_of_chesses]
  );

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
    });

    if (success) {
      // Link intake item if creating from sampling
      if (intakeItemId) {
        await supabase.from('intake_items').update({
          linked_lot_no: form.lot_no.trim(),
          status: 'In Development',
        }).eq('id', intakeItemId);
      }
      toast.success(`Lot ${form.lot_no} created successfully.`);
      if (intakeId) {
        navigate(`/sampling/${intakeId}`);
      } else {
        navigate(`/shade-management/lots/${form.lot_no}`);
      }
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Denier *</label>
            <input
              type="text"
              value={form.denier}
              onChange={e => update('denier', e.target.value)}
              className="input-industrial w-full"
              placeholder="e.g. 150D"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Shade Number</label>
            <input
              type="text"
              value={form.shade_number}
              onChange={e => update('shade_number', e.target.value)}
              className="input-industrial w-full"
              placeholder={form.lot_no || 'Defaults to Lot No'}
            />
            <p className="text-xs text-muted-foreground">Leave empty to use Lot No</p>
          </div>
        </div>

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
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.gross_weight || ''}
              onChange={e => update('gross_weight', parseFloat(e.target.value) || 0)}
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

export default CreateLot;
