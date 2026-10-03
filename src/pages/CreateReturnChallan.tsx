import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PlusCircle, Loader2, Trash2 } from 'lucide-react';
import ClientSelect from '@/components/ClientSelect';
import FooterAutocomplete from '@/components/FooterAutocomplete';
import DecimalInput from '@/components/DecimalInput';
import { useChallanFooterOptions } from '@/hooks/useChallanFooterOptions';
import { useChallans, useChallanItems } from '@/hooks/useChallan';
import { useCreateChallanReturn, useChallanReturns, useAllChallanReturnItems } from '@/hooks/useChallanReturn';
import { RETURN_REASONS, type ReturnReason } from '@/types/challanReturn';

interface Draft {
  key: string;
  original_challan_id: string;
  original_challan_number: string;
  original_challan_item_id: string;
  lot_no: string;
  shade_number: string;
  color_name: string;
  denier: string;
  ref_no: string | null;
  lot_type: 'Production' | 'Sampling';
  packaging_type: string;
  // originals, for reference / clamping
  orig_gross_weight: number;
  orig_net_weight: number;
  orig_num_of_units: number;
  orig_extra_cones: number;
  per_cone_rate: number;
  rate: number;
  rate_tier_label: string | null;
  // editable
  returned_gross_weight: number;
  returned_net_weight: number;
  returned_num_of_units: number;
  returned_extra_cones: number;
  reason: ReturnReason;
  reason_note: string;
}

const nextReturnNumber = (existing: { return_number: string }[]) => {
  let max = 0;
  for (const r of existing) {
    const m = /^RET-(\d+)$/i.exec(r.return_number || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `RET-${max + 1}`;
};

const CreateReturnChallan: React.FC = () => {
  const navigate = useNavigate();
  const createReturn = useCreateChallanReturn();
  const { data: footerOptions } = useChallanFooterOptions();
  const { data: allChallans = [] } = useChallans();
  const { data: existingReturns = [] } = useChallanReturns();
  const { data: allReturnItems = [] } = useAllChallanReturnItems();

  const preparedByOptions = footerOptions?.preparedByOptions || [];
  const receiverOptions = footerOptions?.receiverOptions || [];
  const receiverNames = useMemo(() => receiverOptions.map(r => r.name), [receiverOptions]);

  const [returnNumber, setReturnNumber] = useState(() => nextReturnNumber(existingReturns));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientId, setClientId] = useState('');
  const [notes, setNotes] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [receivedByContact, setReceivedByContact] = useState('');

  const [pickerChallanId, setPickerChallanId] = useState('');
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const handleReceiverSelect = (name: string) => {
    const match = receiverOptions.find(r => r.name === name);
    if (match) { setReceivedBy(name); setReceivedByContact(match.contact); }
  };

  const clientChallans = useMemo(
    () => allChallans.filter(c => c.client_id === clientId && c.challan_kind !== 'edy'),
    [allChallans, clientId],
  );

  const { data: pickerItems = [] } = useChallanItems(pickerChallanId);

  const alreadyReturnedByItemId = useMemo(() => {
    const map = new Map<string, { netWeight: number; units: number; cones: number }>();
    for (const r of allReturnItems as any[]) {
      const id = r.original_challan_item_id;
      if (!id) continue;
      const prev = map.get(id) || { netWeight: 0, units: 0, cones: 0 };
      map.set(id, {
        netWeight: prev.netWeight + (Number(r.returned_net_weight) || 0),
        units: prev.units + (Number(r.returned_num_of_units) || 0),
        cones: prev.cones + (Number(r.returned_extra_cones) || 0),
      });
    }
    return map;
  }, [allReturnItems]);

  const pickerChallan = clientChallans.find(c => c.id === pickerChallanId);

  const toggleChecked = (id: string) => setCheckedItemIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const addCheckedToCart = () => {
    const toAdd = pickerItems.filter(it => checkedItemIds.has(it.id) && !drafts.some(d => d.original_challan_item_id === it.id));
    if (toAdd.length === 0) { toast.error('Select at least one line to add.'); return; }
    const newDrafts: Draft[] = toAdd.map(it => {
      const perConeRate = (it as any).extra_cones > 0 ? (Number(it.paper_tube_surcharge) || 0) / (it as any).extra_cones : 0;
      return {
        key: it.id,
        original_challan_id: pickerChallanId,
        original_challan_number: pickerChallan?.challan_number || '',
        original_challan_item_id: it.id,
        lot_no: it.lot_no,
        shade_number: it.shade_number,
        color_name: it.color_name,
        denier: it.denier,
        ref_no: it.ref_no || null,
        lot_type: (it.lot_type === 'Sampling' ? 'Sampling' : 'Production'),
        packaging_type: it.packaging_type,
        orig_gross_weight: it.gross_weight,
        orig_net_weight: it.net_weight,
        orig_num_of_units: it.num_of_units,
        orig_extra_cones: (it as any).extra_cones || 0,
        per_cone_rate: perConeRate,
        rate: it.rate,
        rate_tier_label: it.rate_tier_label || null,
        returned_gross_weight: it.gross_weight,
        returned_net_weight: it.net_weight,
        returned_num_of_units: it.num_of_units,
        returned_extra_cones: (it as any).extra_cones || 0,
        reason: 'Quality Reject',
        reason_note: '',
      };
    });
    setDrafts(prev => [...prev, ...newDrafts]);
    setCheckedItemIds(new Set());
  };

  const updateDraft = (key: string, patch: Partial<Draft>) => {
    setDrafts(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d));
  };
  const removeDraft = (key: string) => setDrafts(prev => prev.filter(d => d.key !== key));

  const lineAmount = (d: Draft) => Number(d.rate || 0) * Number(d.returned_net_weight || 0);
  const lineSurcharge = (d: Draft) => Number(d.per_cone_rate || 0) * Number(d.returned_extra_cones || 0);
  const totalNetWeight = drafts.reduce((s, d) => s + Number(d.returned_net_weight || 0), 0);
  const totalAmount = drafts.reduce((s, d) => s + lineAmount(d) + lineSurcharge(d), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnNumber.trim()) { toast.error('Return number is required.'); return; }
    if (!clientId) { toast.error('Please select a client.'); return; }
    if (drafts.length === 0) { toast.error('Add at least one line to return.'); return; }

    try {
      await createReturn.mutateAsync({
        return_number: returnNumber.trim(),
        date,
        client_id: clientId,
        notes: notes.trim(),
        prepared_by_name: preparedBy.trim(),
        received_by_name: receivedBy.trim(),
        received_by_contact_number: receivedByContact.trim(),
        items: drafts.map(d => ({
          original_challan_id: d.original_challan_id,
          original_challan_item_id: d.original_challan_item_id,
          lot_no: d.lot_no,
          shade_number: d.shade_number,
          color_name: d.color_name,
          denier: d.denier,
          ref_no: d.ref_no,
          lot_type: d.lot_type,
          packaging_type: d.packaging_type,
          returned_gross_weight: Number(d.returned_gross_weight) || 0,
          returned_net_weight: Number(d.returned_net_weight) || 0,
          returned_num_of_units: Number(d.returned_num_of_units) || 0,
          returned_extra_cones: Number(d.returned_extra_cones) || 0,
          rate: d.rate,
          rate_tier_label: d.rate_tier_label,
          paper_tube_surcharge: lineSurcharge(d),
          amount: lineAmount(d),
          reason: d.reason,
          reason_note: d.reason_note.trim() || null,
        })),
      });
      toast.success('Return Challan created successfully.');
      navigate('/dispatch/returns');
    } catch (err: any) {
      toast.error('Failed to create return challan.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Return Challan</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="card-industrial p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Return Number *</label>
              <input type="text" value={returnNumber} onChange={e => setReturnNumber(e.target.value)}
                className="input-industrial w-full mt-1" placeholder="e.g. RET-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="input-industrial w-full mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Client *</label>
              <div className="mt-1">
                <ClientSelect value={clientId} onChange={v => { setClientId(v); setPickerChallanId(''); setCheckedItemIds(new Set()); setDrafts([]); }} />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="input-industrial w-full mt-1" rows={2} placeholder="Optional notes..." />
          </div>
        </div>

        {/* Pick lines from an original challan */}
        {clientId && (
          <div className="card-industrial p-5 space-y-4">
            <h2 className="text-sm font-semibold">Add lines from a past challan</h2>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[260px]">
                <label className="text-sm font-medium text-foreground">Original Challan</label>
                <select value={pickerChallanId} onChange={e => { setPickerChallanId(e.target.value); setCheckedItemIds(new Set()); }}
                  className="input-industrial w-full mt-1">
                  <option value="">Select a challan...</option>
                  {clientChallans.map(c => (
                    <option key={c.id} value={c.id}>{c.challan_number} — {c.date}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={addCheckedToCart} disabled={!pickerChallanId}
                className="inline-flex items-center gap-1.5 px-3 h-10 text-xs font-medium border border-input rounded-md hover:bg-secondary btn-transition disabled:opacity-50">
                <PlusCircle className="w-3.5 h-3.5" /> Add Selected Lines
              </button>
            </div>

            {pickerChallanId && (
              <div className="overflow-x-auto border border-border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-2 w-8"></th>
                      <th className="p-2 font-medium">Lot No</th>
                      <th className="p-2 font-medium">Shade</th>
                      <th className="p-2 font-medium">Packaging</th>
                      <th className="p-2 font-medium">Net Wt (kg)</th>
                      <th className="p-2 font-medium">Units</th>
                      <th className="p-2 font-medium">Rate</th>
                      <th className="p-2 font-medium">Already Returned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickerItems.map(it => {
                      const already = alreadyReturnedByItemId.get(it.id);
                      const alreadyInCart = drafts.some(d => d.original_challan_item_id === it.id);
                      return (
                        <tr key={it.id} className="border-b border-border/60 last:border-0">
                          <td className="p-2">
                            <input type="checkbox" disabled={alreadyInCart}
                              checked={checkedItemIds.has(it.id)} onChange={() => toggleChecked(it.id)} />
                          </td>
                          <td className="p-2">{it.lot_no}{alreadyInCart && <span className="ml-2 text-xs text-muted-foreground">(in cart)</span>}</td>
                          <td className="p-2">{it.shade_number}</td>
                          <td className="p-2">{it.packaging_type}</td>
                          <td className="p-2">{it.net_weight.toFixed(3)}</td>
                          <td className="p-2">{it.num_of_units}</td>
                          <td className="p-2">₹{it.rate.toFixed(2)}</td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {already ? `${already.netWeight.toFixed(3)} kg, ${already.units} unit(s)` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {pickerItems.length === 0 && (
                      <tr><td colSpan={8} className="p-3 text-center text-muted-foreground">No items on this challan.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Cart: lines being returned */}
        <div className="card-industrial overflow-x-auto">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold">Lines Being Returned</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">Orig. Challan</th>
                <th className="p-2 font-medium">Lot No</th>
                <th className="p-2 font-medium">Packaging</th>
                <th className="p-2 font-medium">Returned Net Wt (kg)</th>
                <th className="p-2 font-medium">Returned Units</th>
                <th className="p-2 font-medium">Returned Extra Cones</th>
                <th className="p-2 font-medium">Reason</th>
                <th className="p-2 font-medium">Note</th>
                <th className="p-2 font-medium">Amount</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {drafts.map(d => (
                <tr key={d.key} className="border-b border-border/60 last:border-0">
                  <td className="p-2">{d.original_challan_number}</td>
                  <td className="p-2">{d.lot_no}</td>
                  <td className="p-2">{d.packaging_type}</td>
                  <td className="p-2">
                    <DecimalInput step="0.001" min={0} max={d.orig_net_weight} value={d.returned_net_weight}
                      onValueChange={v => updateDraft(d.key, { returned_net_weight: v })}
                      className="input-industrial w-24 text-sm" />
                    <div className="text-xs text-muted-foreground">of {d.orig_net_weight.toFixed(3)}</div>
                  </td>
                  <td className="p-2">
                    <DecimalInput step="1" min={0} max={d.orig_num_of_units} value={d.returned_num_of_units}
                      onValueChange={v => updateDraft(d.key, { returned_num_of_units: v })}
                      className="input-industrial w-20 text-sm" />
                  </td>
                  <td className="p-2">
                    <DecimalInput step="1" min={0} value={d.returned_extra_cones}
                      onValueChange={v => updateDraft(d.key, { returned_extra_cones: v })}
                      className="input-industrial w-20 text-sm" />
                  </td>
                  <td className="p-2">
                    <select value={d.reason} onChange={e => updateDraft(d.key, { reason: e.target.value as ReturnReason })}
                      className="input-industrial text-sm">
                      {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <input type="text" value={d.reason_note} onChange={e => updateDraft(d.key, { reason_note: e.target.value })}
                      className="input-industrial w-32 text-sm" placeholder="Optional" />
                  </td>
                  <td className="p-2">₹{(lineAmount(d) + lineSurcharge(d)).toFixed(2)}</td>
                  <td className="p-2">
                    <button type="button" onClick={() => removeDraft(d.key)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {drafts.length === 0 && (
                <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No lines added yet — pick a client and a challan above.</td></tr>
              )}
            </tbody>
            {drafts.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td colSpan={3} className="p-3 text-right">Totals:</td>
                  <td className="p-3">{totalNetWeight.toFixed(3)} kg</td>
                  <td colSpan={4}></td>
                  <td className="p-3">₹{totalAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer Details */}
        <div className="card-industrial p-5 space-y-4">
          <h2 className="text-sm font-semibold">Footer Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Prepared By</label>
              <div className="mt-1">
                <FooterAutocomplete value={preparedBy} onChange={setPreparedBy} options={preparedByOptions} placeholder="Signing authority name" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Received By</label>
              <div className="mt-1">
                <FooterAutocomplete value={receivedBy} onChange={setReceivedBy} options={receiverNames}
                  placeholder="Who received the returned goods" onSelect={handleReceiverSelect} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Received By Contact</label>
              <input type="text" value={receivedByContact} onChange={e => setReceivedByContact(e.target.value)}
                className="input-industrial w-full mt-1" placeholder="+91 XXXXXXXXXX" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dispatch/returns')}
            className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary">Cancel</button>
          <button type="submit" disabled={createReturn.isPending}
            className="inline-flex items-center gap-2 px-6 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 disabled:opacity-50">
            {createReturn.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Return Challan
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateReturnChallan;
