import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateEDYChallan, type EDYChallanItemInput } from '@/hooks/useChallan';
import ClientSelect from '@/components/ClientSelect';
import { toast } from 'sonner';
import { useChallanFooterOptions } from '@/hooks/useChallanFooterOptions';
import { useEDYCurrentStock } from '@/hooks/useStore';
import FooterAutocomplete from '@/components/FooterAutocomplete';
import DecimalInput from '@/components/DecimalInput';
import { PortalDropdown } from '@/components/ChallanItemRow';
import { PlusCircle, Loader2, Trash2 } from 'lucide-react';
import { getDraft, setDraft, clearDraft } from '@/lib/draftCache';
import type { StoreEDYCurrentStockRow } from '@/types/store';

const DRAFT_KEY = 'createEDYChallan:draft';

interface EDYRow extends EDYChallanItemInput {}

const emptyRow = (): EDYRow => ({
  lot_no: '', dyer: '', shade_number: '', gross_weight: 0, num_of_units: 0,
});

// ---- EDY lot picker (portal, EDY stock only) ----------------------
const EDYLotPicker: React.FC<{
  value: string;
  edyStock: StoreEDYCurrentStockRow[];
  onSelect: (e: StoreEDYCurrentStockRow) => void;
}> = ({ value, edyStock, onSelect }) => {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (wrapRef.current && !wrapRef.current.contains(t) && !t.closest('[data-edy-portal="1"]')) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const options = useMemo(() =>
    edyStock.filter(e => Number(e.current_balance || 0) > 0),
    [edyStock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(e =>
      e.receipt_number.toLowerCase().includes(q) ||
      (e.supplier || '').toLowerCase().includes(q) ||
      (e.shade || '').toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div ref={wrapRef} className="relative">
      <input ref={inputRef} type="text" value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="input-industrial w-full text-sm" placeholder="Search EDY receipt..." />
      <PortalDropdown anchor={inputRef.current} open={open && filtered.length > 0}>
        <div data-edy-portal="1">
          {filtered.map(e => (
            <button key={e.receipt_number} type="button" onMouseDown={ev => ev.preventDefault()}
              onClick={() => { onSelect(e); setSearch(e.receipt_number); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition">
              <div className="font-medium">{e.receipt_number}</div>
              <div className="text-xs text-muted-foreground">
                {e.supplier || 'Dyer'}{e.shade ? ` · ${e.shade}` : ''} · {Number(e.current_balance).toFixed(3)} kg
              </div>
            </button>
          ))}
        </div>
      </PortalDropdown>
    </div>
  );
};

const CreateEDYChallan: React.FC = () => {
  const navigate = useNavigate();
  const createEDY = useCreateEDYChallan();
  const { data: footerOptions } = useChallanFooterOptions();
  const { data: edyStock = [] } = useEDYCurrentStock();

  const preparedByOptions = footerOptions?.preparedByOptions || [];
  const receiverOptions = footerOptions?.receiverOptions || [];
  const receiverNames = useMemo(() => receiverOptions.map(r => r.name), [receiverOptions]);

  const handleReceiverSelect = (name: string) => {
    const match = receiverOptions.find(r => r.name === name);
    if (match) setForm(p => ({ ...p, receiver_name: name, receiver_contact_number: match.contact }));
  };

  const defaultForm = {
    challan_number: '',
    date: new Date().toISOString().split('T')[0],
    client_id: '',
    notes: '',
    prepared_by_name: '',
    receiver_name: '',
    receiver_contact_number: '',
  };
  const [form, setForm] = useState(() => {
    const saved = getDraft<{ form?: typeof defaultForm }>(DRAFT_KEY);
    return saved?.form ? { ...defaultForm, ...saved.form } : defaultForm;
  });
  const [items, setItems] = useState<EDYRow[]>(() => {
    const saved = getDraft<{ items?: EDYRow[] }>(DRAFT_KEY);
    return saved?.items && saved.items.length ? saved.items : [emptyRow()];
  });
  useEffect(() => { setDraft(DRAFT_KEY, { form, items }); }, [form, items]);

  const updateItem = (i: number, patch: Partial<EDYRow>) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i: number) => { if (items.length > 1) setItems(prev => prev.filter((_, idx) => idx !== i)); };
  const addItem = () => setItems(prev => [...prev, emptyRow()]);

  const handleEDYSelect = (i: number, e: StoreEDYCurrentStockRow) => {
    updateItem(i, {
      lot_no: e.receipt_number,
      dyer: e.supplier || '',
      shade_number: e.shade || e.shade_number || '',
    });
  };

  const totalGross = items.reduce((s, i) => s + (Number(i.gross_weight) || 0), 0);
  const totalCones = items.reduce((s, i) => s + (Number(i.num_of_units) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.challan_number.trim()) { toast.error('Challan number is required.'); return; }
    if (!form.client_id) { toast.error('Please select a client.'); return; }
    const valid = items.filter(i => i.lot_no);
    if (valid.length === 0) { toast.error('Add at least one EDY lot.'); return; }

    try {
      await createEDY.mutateAsync({
        challan_number: form.challan_number.trim(),
        date: form.date,
        client_id: form.client_id,
        notes: form.notes.trim(),
        prepared_by_name: form.prepared_by_name.trim(),
        receiver_name: form.receiver_name.trim(),
        receiver_contact_number: form.receiver_contact_number.trim(),
        items: valid,
      });
      clearDraft(DRAFT_KEY);
      toast.success('EDY Challan created.');
      navigate('/dispatch');
    } catch (err: any) {
      if (err?.message?.includes('duplicate') || err?.code === '23505') {
        toast.error('Challan number already exists.');
      } else {
        toast.error('Failed to create EDY challan.');
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Create EDY Challan</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="card-industrial p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Challan Number *</label>
              <input type="text" value={form.challan_number} onChange={e => setForm(p => ({ ...p, challan_number: e.target.value }))}
                className="input-industrial w-full mt-1" placeholder="e.g. EDY-CH-001" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="input-industrial w-full mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Client *</label>
              <div className="mt-1">
                <ClientSelect value={form.client_id} onChange={v => setForm(p => ({ ...p, client_id: v }))} />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="input-industrial w-full mt-1" rows={2} placeholder="Optional notes..." />
          </div>
        </div>

        {/* Items */}
        <div className="card-industrial overflow-x-auto">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">EDY Items</h2>
            <button type="button" onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium border border-input rounded-md hover:bg-secondary btn-transition">
              <PlusCircle className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">Dyer</th>
                <th className="p-2 font-medium">Shade</th>
                <th className="p-2 font-medium">Lot (EDY Receipt) *</th>
                <th className="p-2 font-medium">Gross Wt (kg)</th>
                <th className="p-2 font-medium"># of Cones</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-border hover:bg-secondary/30">
                  <td className="p-2">
                    <input type="text" value={it.dyer} onChange={e => updateItem(i, { dyer: e.target.value })}
                      className="input-industrial w-full text-sm" placeholder="Dyer name" />
                  </td>
                  <td className="p-2">
                    <input type="text" value={it.shade_number} onChange={e => updateItem(i, { shade_number: e.target.value })}
                      className="input-industrial w-full text-sm" placeholder="Shade" />
                  </td>
                  <td className="p-2 min-w-[180px]">
                    <EDYLotPicker value={it.lot_no} edyStock={edyStock} onSelect={e => handleEDYSelect(i, e)} />
                  </td>
                  <td className="p-2">
                    <DecimalInput step="0.001" value={it.gross_weight} onValueChange={v => updateItem(i, { gross_weight: v })}
                      className="input-industrial w-28 text-sm" placeholder="0.000" />
                  </td>
                  <td className="p-2">
                    <DecimalInput step="1" min={0} value={it.num_of_units} onValueChange={v => updateItem(i, { num_of_units: v })}
                      className="input-industrial w-24 text-sm" placeholder="# Cones" />
                  </td>
                  <td className="p-2">
                    <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded btn-transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td colSpan={3} className="p-3 text-right">Totals:</td>
                <td className="p-3">{totalGross.toFixed(3)} kg</td>
                <td className="p-3">{totalCones}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Details */}
        <div className="card-industrial p-5 space-y-4">
          <h2 className="text-sm font-semibold">Footer Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Prepared By</label>
              <div className="mt-1">
                <FooterAutocomplete value={form.prepared_by_name}
                  onChange={v => setForm(p => ({ ...p, prepared_by_name: v }))}
                  options={preparedByOptions} placeholder="Signing authority name" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Receiver Name</label>
              <div className="mt-1">
                <FooterAutocomplete value={form.receiver_name}
                  onChange={v => setForm(p => ({ ...p, receiver_name: v }))}
                  options={receiverNames} placeholder="Receiver name"
                  onSelect={handleReceiverSelect} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Receiver Contact</label>
              <input type="text" value={form.receiver_contact_number} onChange={e => setForm(p => ({ ...p, receiver_contact_number: e.target.value }))}
                className="input-industrial w-full mt-1" placeholder="+91 XXXXXXXXXX" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dispatch')}
            className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary">Cancel</button>
          <button type="submit" disabled={createEDY.isPending}
            className="inline-flex items-center gap-2 px-6 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 disabled:opacity-50">
            {createEDY.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save EDY Challan
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateEDYChallan;
