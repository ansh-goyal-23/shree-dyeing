import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateEDYChallan, type EDYChallanItemInput } from '@/hooks/useChallan';
import ClientSelect from '@/components/ClientSelect';
import { toast } from 'sonner';
import { useChallanFooterOptions } from '@/hooks/useChallanFooterOptions';
import { useEDYCurrentStock } from '@/hooks/useStore';
import FooterAutocomplete from '@/components/FooterAutocomplete';
import DecimalInput from '@/components/DecimalInput';
import { PlusCircle, Loader2, Trash2 } from 'lucide-react';
import { getDraft, setDraft, clearDraft } from '@/lib/draftCache';
import type { StoreEDYCurrentStockRow } from '@/types/store';

const DRAFT_KEY = 'createEDYChallan:draft';

interface EDYRow extends EDYChallanItemInput {
  receipt_id: string;   // picked receipt id
  rack_label: string;   // for display
  max_gross: number;    // current_balance
  max_cones: number;    // cone_count from receipt
}

const emptyRow = (): EDYRow => ({
  lot_no: '', dyer: '', shade_number: '', gross_weight: 0, num_of_units: 0,
  receipt_id: '', rack_label: '', max_gross: 0, max_cones: 0,
});

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

  // Only include EDY receipts with actual remaining stock
  const availableStock = useMemo(
    () => edyStock.filter(e => Number(e.current_balance || 0) > 0),
    [edyStock],
  );

  const dyers = useMemo(() => {
    const s = new Set<string>();
    availableStock.forEach(e => { if (e.supplier) s.add(e.supplier); });
    return [...s].sort();
  }, [availableStock]);

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

  // Cascading options per row
  const shadesForDyer = (dyer: string) => {
    if (!dyer) return [] as string[];
    const s = new Set<string>();
    availableStock
      .filter(e => e.supplier === dyer)
      .forEach(e => { const sh = e.shade || e.shade_number; if (sh) s.add(sh); });
    return [...s].sort();
  };

  const receiptsFor = (dyer: string, shade: string): StoreEDYCurrentStockRow[] => {
    if (!dyer || !shade) return [];
    return availableStock.filter(
      e => e.supplier === dyer && (e.shade === shade || e.shade_number === shade),
    );
  };

  const handleDyerChange = (i: number, dyer: string) =>
    updateItem(i, {
      dyer, shade_number: '', lot_no: '', receipt_id: '', rack_label: '',
      gross_weight: 0, num_of_units: 0, max_gross: 0, max_cones: 0,
    });

  const handleShadeChange = (i: number, shade: string) =>
    updateItem(i, {
      shade_number: shade, lot_no: '', receipt_id: '', rack_label: '',
      gross_weight: 0, num_of_units: 0, max_gross: 0, max_cones: 0,
    });

  const handleReceiptChange = (i: number, receiptId: string) => {
    const rec = availableStock.find(e => e.receipt_id === receiptId);
    if (!rec) {
      updateItem(i, { receipt_id: '', rack_label: '', lot_no: '', gross_weight: 0, num_of_units: 0, max_gross: 0, max_cones: 0 });
      return;
    }
    const maxGross = Number(rec.current_balance || 0);
    const maxCones = Number(rec.cone_count || 0);
    updateItem(i, {
      receipt_id: rec.receipt_id,
      rack_label: rec.rack_code || rec.rack_name || '—',
      lot_no: rec.lot_no || rec.receipt_number, // stock key: EDY-<receipt_number> uses receipt_number
      gross_weight: maxGross,
      num_of_units: maxCones,
      max_gross: maxGross,
      max_cones: maxCones,
    });
  };

  // Ensure lot_no we send matches the store item_code convention (EDY-<receipt_number>).
  // Stock delta uses `EDY-${lot_no}`, so lot_no must equal receipt_number.
  const buildSubmitItems = (): EDYChallanItemInput[] => items
    .filter(i => i.receipt_id)
    .map(i => {
      const rec = availableStock.find(e => e.receipt_id === i.receipt_id);
      return {
        lot_no: rec ? rec.receipt_number : i.lot_no,
        dyer: i.dyer,
        shade_number: i.shade_number,
        gross_weight: Number(i.gross_weight) || 0,
        num_of_units: Number(i.num_of_units) || 0,
      };
    });

  const totalGross = items.reduce((s, i) => s + (Number(i.gross_weight) || 0), 0);
  const totalCones = items.reduce((s, i) => s + (Number(i.num_of_units) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.challan_number.trim()) { toast.error('Challan number is required.'); return; }
    if (!form.client_id) { toast.error('Please select a client.'); return; }

    const submitItems = buildSubmitItems();
    if (submitItems.length === 0) { toast.error('Add at least one EDY lot.'); return; }

    // Validate qty limits against picked receipt.
    for (const [idx, it] of items.entries()) {
      if (!it.receipt_id) continue;
      if (it.gross_weight <= 0) { toast.error(`Row ${idx + 1}: Gross weight must be > 0.`); return; }
      if (it.gross_weight > it.max_gross + 0.0001) {
        toast.error(`Row ${idx + 1}: Gross weight (${it.gross_weight}) exceeds available (${it.max_gross}).`); return;
      }
      if (it.max_cones > 0 && it.num_of_units > it.max_cones) {
        toast.error(`Row ${idx + 1}: # of Cones (${it.num_of_units}) exceeds available (${it.max_cones}).`); return;
      }
    }

    try {
      await createEDY.mutateAsync({
        challan_number: form.challan_number.trim(),
        date: form.date,
        client_id: form.client_id,
        notes: form.notes.trim(),
        prepared_by_name: form.prepared_by_name.trim(),
        receiver_name: form.receiver_name.trim(),
        receiver_contact_number: form.receiver_contact_number.trim(),
        items: submitItems,
      });
      clearDraft(DRAFT_KEY);
      toast.success('EDY Challan created. Stock updated.');
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

          {dyers.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              No External Dyed Yarn stock available. Receive stock into the EDY store first.
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">Dyer *</th>
                <th className="p-2 font-medium">Shade *</th>
                <th className="p-2 font-medium">Rack (Lot) *</th>
                <th className="p-2 font-medium">Lot #</th>
                <th className="p-2 font-medium">Gross Wt (kg)</th>
                <th className="p-2 font-medium"># of Cones</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const shadeOpts = shadesForDyer(it.dyer);
                const rackOpts = receiptsFor(it.dyer, it.shade_number);
                return (
                  <tr key={i} className="border-b border-border hover:bg-secondary/30 align-top">
                    <td className="p-2 min-w-[140px]">
                      <select value={it.dyer} onChange={e => handleDyerChange(i, e.target.value)}
                        className="input-industrial w-full text-sm">
                        <option value="">Select dyer</option>
                        {dyers.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td className="p-2 min-w-[130px]">
                      <select value={it.shade_number} onChange={e => handleShadeChange(i, e.target.value)}
                        disabled={!it.dyer}
                        className="input-industrial w-full text-sm disabled:opacity-50">
                        <option value="">Select shade</option>
                        {shadeOpts.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="p-2 min-w-[200px]">
                      <select value={it.receipt_id} onChange={e => handleReceiptChange(i, e.target.value)}
                        disabled={!it.shade_number}
                        className="input-industrial w-full text-sm disabled:opacity-50">
                        <option value="">Select rack</option>
                        {rackOpts.map(r => (
                          <option key={r.receipt_id} value={r.receipt_id}>
                            {(r.rack_code || r.rack_name || '—')} · {Number(r.current_balance).toFixed(3)} kg
                            {r.cone_count ? ` · ${r.cone_count} cones` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground min-w-[120px]">
                      {it.lot_no || <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="p-2">
                      <DecimalInput step="0.001" min={0} value={it.gross_weight}
                        onValueChange={v => updateItem(i, { gross_weight: v })}
                        className="input-industrial w-28 text-sm" placeholder="0.000" />
                      {it.receipt_id && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">max {it.max_gross.toFixed(3)}</div>
                      )}
                    </td>
                    <td className="p-2">
                      <DecimalInput step="1" min={0} value={it.num_of_units}
                        onValueChange={v => updateItem(i, { num_of_units: v })}
                        className="input-industrial w-24 text-sm" placeholder="# Cones" />
                      {it.receipt_id && it.max_cones > 0 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">max {it.max_cones}</div>
                      )}
                    </td>
                    <td className="p-2">
                      <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded btn-transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td colSpan={4} className="p-3 text-right">Totals:</td>
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
