import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { calculateNetWeight } from '@/lib/calculations';
import { toast } from 'sonner';
import LotFieldAutocomplete from '@/components/LotFieldAutocomplete';

const CreateLot: React.FC = () => {
  const { addLot, lots } = useApp();
  const companyNames = useMemo(() => lots.map(l => l.yarn_company_name), [lots]);
  const colorNames = useMemo(() => lots.map(l => l.color_name).filter(Boolean) as string[], [lots]);
  const navigate = useNavigate();
  const [sourceLotSearch, setSourceLotSearch] = useState('');
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);

  const filteredSourceLots = useMemo(() => {
    const search = sourceLotSearch.toLowerCase();
    return lots.filter(l => {
      if (!search) return true;
      return l.lot_no.toLowerCase().includes(search) || l.color_name?.toLowerCase().includes(search) || l.yarn_company_name.toLowerCase().includes(search);
    });
  }, [lots, sourceLotSearch]);
  const [form, setForm] = useState({
    lot_no: '',
    date: new Date().toISOString().split('T')[0],
    yarn_company_name: '',
    color_name: '',
    denier: '',
    number_of_chesses: 0,
    gross_weight: 0,
    source_lot_no: '',
  });

  const netWeight = useMemo(
    () => calculateNetWeight(form.gross_weight, form.number_of_chesses),
    [form.gross_weight, form.number_of_chesses]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lot_no.trim()) { toast.error('Lot No is required.'); return; }
    if (!form.yarn_company_name.trim()) { toast.error('Yarn Company Name is required.'); return; }

    const success = await addLot(
      {
        lot_no: form.lot_no.trim(),
        date: form.date,
        yarn_company_name: form.yarn_company_name.trim(),
        color_name: form.color_name.trim(),
        denier: form.denier.trim(),
        number_of_chesses: form.number_of_chesses,
        gross_weight: form.gross_weight,
        source_lot_no: form.source_lot_no || null,
      },
      form.source_lot_no || undefined
    );

    if (success) {
      toast.success(`Lot ${form.lot_no} created successfully.`);
      navigate(`/lots/${form.lot_no}`);
    } else {
      toast.error(`Invalid Lot No: Already exists or invalid source.`);
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
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => update('date', e.target.value)}
              className="input-industrial w-full font-data"
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
            <label className="text-sm font-medium">Color Name</label>
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
            <label className="text-sm font-medium">Denier</label>
            <input
              type="text"
              value={form.denier}
              onChange={e => update('denier', e.target.value)}
              className="input-industrial w-full"
              placeholder="e.g. 150D"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Source Lot</label>
            <div className="relative">
              <input
                type="text"
                value={sourceLotSearch}
                onChange={e => { setSourceLotSearch(e.target.value); setSourceDropdownOpen(true); }}
                onFocus={() => setSourceDropdownOpen(true)}
                className="input-industrial w-full"
                placeholder="Search lot number..."
              />
              {form.source_lot_no && (
                <button type="button" onClick={() => { update('source_lot_no', ''); setSourceLotSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">✕</button>
              )}
              {sourceDropdownOpen && filteredSourceLots.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  {filteredSourceLots.map(l => (
                    <button key={l.lot_no} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { update('source_lot_no', l.lot_no); setSourceLotSearch(l.lot_no); setSourceDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                      {l.lot_no} — {l.color_name || l.yarn_company_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">No. of Chesses</label>
            <input
              type="number"
              min={0}
              value={form.number_of_chesses || ''}
              onChange={e => update('number_of_chesses', parseInt(e.target.value) || 0)}
              className="input-industrial w-full font-data"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Gross Weight (kg)</label>
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.gross_weight || ''}
              onChange={e => update('gross_weight', parseFloat(e.target.value) || 0)}
              className="input-industrial w-full font-data"
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
            onClick={() => navigate('/lots')}
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
