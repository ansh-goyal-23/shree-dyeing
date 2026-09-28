import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useChallan, useChallanItems, useUpdateChallan, useDeleteChallan, useUpdateChallanPayment } from '@/hooks/useChallan';
import { paymentState, lineTotal } from '@/types/challan';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import ClientSelect from '@/components/ClientSelect';
import ChallanItemRow from '@/components/ChallanItemRow';
import type { ItemData } from '@/components/ChallanItemRow';
import { downloadChallanPdf, shareChallanPdf } from '@/lib/challanPdf';
import { formatYmdLocal } from '@/lib/formatDate';
import { useClientRates, useClientYarnCosts, useClientRateTiers } from '@/hooks/useClientRates';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';
import { PlusCircle, Loader2, Pencil, Trash2, ArrowLeft, Download, Share2 } from 'lucide-react';


const emptyItem = (): ItemData => ({
  lot_no: '', shade_number: '', color_name: '', denier: '', packaging_type: 'paper_tube',
  gross_weight: 0, num_of_units: 0, net_weight: 0, rate: 0, amount: 0, lot_type: 'Production', ref_no: '',
  yarn_cost: null, overhead_rate: null, rate_tier_label: null, paper_tube_surcharge: 0,
});

const PACKAGING_LABEL: Record<string, string> = {
  paper_tube: 'Paper Tube',
  chesse: 'Chesse',
};

const ChallanDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: challan, isLoading: challanLoading } = useChallan(id || '');
  const { data: challanItems = [], isLoading: itemsLoading } = useChallanItems(id || '');
  const updateChallan = useUpdateChallan();
  const deleteChallan = useDeleteChallan();
  const updatePayment = useUpdateChallanPayment();
  const { isAdmin } = useRole();
  const { lots } = useApp();
  const clientId = challan?.client_id || '';
  const { data: clientRates = [] } = useClientRates(clientId || undefined);
  const { data: clients = [] } = useClients();
  const selectedClient = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);
  const rateMode = selectedClient?.rate_mode || 'flat';
  const { data: yarnCosts = [] } = useClientYarnCosts(clientId || undefined);
  const { data: rateTiers = [] } = useClientRateTiers(clientId || undefined);
  const hasSurcharge = !!(selectedClient?.paper_tube_baseline_kg_per_cone && selectedClient?.paper_tube_extra_cone_surcharge != null);
  const [payInput, setPayInput] = useState('');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    challan_number: '', date: '', client_id: '', notes: '',
    prepared_by_name: '', receiver_name: '', receiver_contact_number: '',
  });
  const [items, setItems] = useState<ItemData[]>([]);


  useEffect(() => {
    if (challan) {
      setForm({
        challan_number: challan.challan_number,
        date: challan.date,
        client_id: challan.client_id,
        notes: challan.notes,
        prepared_by_name: challan.prepared_by_name,
        receiver_name: challan.receiver_name,
        receiver_contact_number: challan.receiver_contact_number,
      });
    }
  }, [challan]);

  // Fall back to the lot's denier when the saved item has none (older challans).
  const viewItems = useMemo(() => challanItems.map(i => ({
    ...i,
    denier: i.denier || lots.find(l => l.lot_no === i.lot_no)?.denier || '',
  })), [challanItems, lots]);

  useEffect(() => {
    if (viewItems.length > 0) {
      setItems(viewItems.map(i => ({
        lot_no: i.lot_no, shade_number: i.shade_number, color_name: i.color_name,
        denier: i.denier || '',
        packaging_type: i.packaging_type, gross_weight: i.gross_weight,
        num_of_units: i.num_of_units, net_weight: i.net_weight, rate: i.rate, amount: i.amount,
        lot_type: (i.lot_type as 'Production' | 'Sampling') || 'Production',
        ref_no: i.ref_no || '',
        yarn_cost: i.yarn_cost ?? null, overhead_rate: i.overhead_rate ?? null,
        rate_tier_label: i.rate_tier_label ?? null, paper_tube_surcharge: i.paper_tube_surcharge || 0,
      })));
    }
  }, [viewItems]);

  const totalNetWeight = items.reduce((s, i) => s + (i.net_weight || 0), 0);
  const totalAmount = items.reduce((s, i) => s + lineTotal(i), 0);

  // Payment maths always use the SAVED items, never the edit draft.
  const savedTotal = challanItems.reduce((s, i) => s + lineTotal(i), 0);
  const received = challan?.amount_received || 0;
  const payState = paymentState(savedTotal, received);
  const balance = Math.max(savedTotal - received, 0);

  const savePayment = async (amount: number) => {
    if (!challan) return;
    try {
      await updatePayment.mutateAsync({
        id: challan.id,
        challan_number: challan.challan_number,
        amount_received: amount,
        total: savedTotal,
        prev_received: received,
      });
      setPayInput('');
      toast.success('Payment updated.');
    } catch {
      toast.error('Failed to update payment.');
    }
  };

  const updateItem = (index: number, updated: ItemData) => setItems(prev => prev.map((it, i) => i === index ? updated : it));
  const removeItem = (index: number) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index)); };
  const addItem = () => setItems(prev => [...prev, emptyItem()]);


  const handleSave = async () => {
    if (!form.challan_number.trim()) { toast.error('Challan number required.'); return; }
    const validItems = items.filter(i => i.lot_no);
    if (validItems.length === 0) { toast.error('Add at least one item.'); return; }
    try {
      await updateChallan.mutateAsync({ id: id!, ...form, items: validItems });
      toast.success('Challan updated.');
      setEditing(false);
    } catch (err: any) {
      if (err?.message?.includes('duplicate') || err?.code === '23505') {
        toast.error('Challan number already exists.');
      } else {
        toast.error('Failed to update.');
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this challan?')) return;
    try {
      await deleteChallan.mutateAsync(id!);
      navigate('/dispatch');
    } catch {
      toast.error('Failed to delete.');
    }
  };

  const handleDownloadPdf = () => {
    if (challan) downloadChallanPdf(challan, viewItems);
  };

  const handleShare = async () => {
    if (challan) {
      try {
        await shareChallanPdf(challan, viewItems);
      } catch {
        toast.error('Sharing failed.');
      }
    }
  };

  if (challanLoading || itemsLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!challan) {
    return <div className="text-center py-12 text-muted-foreground">Challan not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-owner-id={(challan as any).created_by || ''}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dispatch" className="p-2 hover:bg-secondary rounded btn-transition"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-2xl font-semibold tracking-tight">Challan: {challan.challan_number}</h1>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              {challan.challan_kind !== 'edy' && (
                <button onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              <button onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 h-9 border border-destructive text-destructive rounded-md text-sm font-medium hover:bg-destructive/10 btn-transition">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(false)}
                className="px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition">Cancel</button>
              <button onClick={handleSave} disabled={updateChallan.isPending}
                className="inline-flex items-center gap-2 px-4 h-9 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 btn-transition disabled:opacity-50">
                {updateChallan.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="card-industrial p-5">
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Challan Number</label>
              <input type="text" value={form.challan_number} onChange={e => setForm(p => ({ ...p, challan_number: e.target.value }))}
                className="input-industrial w-full mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="input-industrial w-full mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Client</label>
              <div className="mt-1"><ClientSelect value={form.client_id} onChange={v => setForm(p => ({ ...p, client_id: v }))} /></div>
            </div>
            <div className="md:col-span-3">
              <label className="text-sm font-medium text-foreground">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="input-industrial w-full mt-1" rows={2} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Challan #</span><p className="font-medium mt-0.5">{challan.challan_number}</p></div>
            <div><span className="text-muted-foreground">Date</span><p className="font-medium mt-0.5">{formatYmdLocal(challan.date)}</p></div>
            <div><span className="text-muted-foreground">Client</span><p className="font-medium mt-0.5">{challan.client_name}</p></div>
            {challan.notes && <div className="col-span-2 md:col-span-4"><span className="text-muted-foreground">Notes</span><p className="mt-0.5">{challan.notes}</p></div>}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card-industrial overflow-x-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Items {challan.challan_kind === 'edy' && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">External Dyed Yarn</span>}
          </h2>
          {editing && challan.challan_kind !== 'edy' && (
            <button type="button" onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium border border-input rounded-md hover:bg-secondary btn-transition">
              <PlusCircle className="w-3.5 h-3.5" /> Add Row
            </button>
          )}
        </div>
        {challan.challan_kind === 'edy' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">Dyer</th>
                <th className="p-2 font-medium">Shade</th>
                <th className="p-2 font-medium">Lot (EDY Receipt)</th>
                <th className="p-2 font-medium">Gross Wt (kg)</th>
                <th className="p-2 font-medium"># of Cones</th>
              </tr>
            </thead>
            <tbody>
              {challanItems.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No items.</td></tr>
              ) : challanItems.map(item => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-2">{item.color_name || '—'}</td>
                  <td className="p-2">{item.shade_number || '—'}</td>
                  <td className="p-2 font-medium">{item.lot_no}</td>
                  <td className="p-2">{item.gross_weight.toFixed(3)}</td>
                  <td className="p-2">{item.num_of_units}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td colSpan={3} className="p-3 text-right">Totals:</td>
                <td className="p-3">{challanItems.reduce((s, i) => s + (Number(i.gross_weight) || 0), 0).toFixed(3)} kg</td>
                <td className="p-3">{challanItems.reduce((s, i) => s + (Number(i.num_of_units) || 0), 0)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">Lot No</th>
                <th className="p-2 font-medium">Ref No</th>
                <th className="p-2 font-medium">Shade #</th>
                <th className="p-2 font-medium">Color</th>
                <th className="p-2 font-medium">Denier</th>
                <th className="p-2 font-medium">Type</th>
                <th className="p-2 font-medium">Packaging</th>
                <th className="p-2 font-medium">Gross Wt (kg)</th>
                <th className="p-2 font-medium">Units</th>
                <th className="p-2 font-medium">Net Wt (kg)</th>
                {rateMode === 'tiered' && <th className="p-2 font-medium">Tier</th>}
                <th className="p-2 font-medium">Rate/kg</th>
                {hasSurcharge && <th className="p-2 font-medium">Surcharge</th>}
                <th className="p-2 font-medium">Amount</th>
                {editing && <th className="p-2"></th>}
              </tr>
            </thead>
            <tbody>
              {editing ? (
                items.map((item, i) => (
                  <ChallanItemRow key={i} index={i} item={item} lots={lots} clientId={clientId} clientRates={clientRates}
                    rateMode={rateMode} yarnCosts={yarnCosts} rateTiers={rateTiers}
                    paperTubeBaselineKgPerCone={selectedClient?.paper_tube_baseline_kg_per_cone ?? null}
                    paperTubeExtraConeSurcharge={selectedClient?.paper_tube_extra_cone_surcharge ?? null}
                    hasSurcharge={hasSurcharge}
                    onChange={updateItem} onRemove={removeItem} />
                ))
              ) : (
                (challanItems.length === 0 ? (
                  <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">No items.</td></tr>
                ) : viewItems.map(item => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="p-2 font-medium">
                      <Link to={`/shade-management/lots/${item.lot_no}`} className="text-primary hover:underline">{item.lot_no}</Link>
                    </td>
                    <td className="p-2">{item.ref_no || '—'}</td>
                    <td className="p-2">{item.shade_number}</td>
                    <td className="p-2">{item.color_name}</td>
                    <td className="p-2">{item.denier || '—'}</td>
                    <td className="p-2">{item.lot_type || 'Production'}</td>
                    <td className="p-2">{PACKAGING_LABEL[item.packaging_type] || item.packaging_type}</td>
                    <td className="p-2">{item.gross_weight.toFixed(3)}</td>
                    <td className="p-2">{item.num_of_units}</td>
                    <td className="p-2">{item.net_weight.toFixed(3)}</td>
                    {rateMode === 'tiered' && <td className="p-2">{(item as any).rate_tier_label || '—'}</td>}
                    <td className="p-2">₹{item.rate.toFixed(2)}</td>
                    {hasSurcharge && (
                      <td className="p-2">{(item as any).paper_tube_surcharge > 0 ? `₹${Number((item as any).paper_tube_surcharge).toFixed(2)}` : '—'}</td>
                    )}
                    <td className="p-2 font-medium">₹{lineTotal(item).toFixed(2)}</td>
                  </tr>
                )))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td colSpan={rateMode === 'tiered' ? 10 : 9} className="p-3 text-right">Totals:</td>
                <td className="p-3">{totalNetWeight.toFixed(3)} kg</td>
                <td className="p-3"></td>
                {hasSurcharge && <td className="p-3"></td>}
                <td className="p-3">₹{totalAmount.toFixed(2)}</td>
                {editing && <td></td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Payment */}
      {savedTotal > 0 && (
        <div className="card-industrial p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold">Payment</h2>
            <span className={
              payState === 'Paid'
                ? 'text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : payState === 'Partially Paid'
                  ? 'text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                  : 'text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
            }>{payState}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-muted-foreground">Total</span><p className="font-medium mt-0.5">₹{savedTotal.toFixed(2)}</p></div>
            <div><span className="text-muted-foreground">Received</span><p className="font-medium mt-0.5">₹{received.toFixed(2)}</p></div>
            <div><span className="text-muted-foreground">Balance</span><p className="font-medium mt-0.5">₹{balance.toFixed(2)}</p></div>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-border">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Amount Received (Rs.)</label>
                <input type="number" step="0.01" min="0" value={payInput} onChange={e => setPayInput(e.target.value)}
                  placeholder={received.toFixed(2)} className="input-industrial w-40 mt-1" />
              </div>
              <button onClick={() => {
                const v = parseFloat(payInput);
                if (isNaN(v) || v < 0) { toast.error('Enter a valid amount.'); return; }
                if (v > savedTotal + 0.005) { toast.error('Amount exceeds challan total.'); return; }
                savePayment(v);
              }} disabled={updatePayment.isPending}
                className="px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition disabled:opacity-50">
                Save Amount
              </button>
              <button onClick={() => savePayment(savedTotal)} disabled={updatePayment.isPending || payState === 'Paid'}
                className="inline-flex items-center gap-2 px-4 h-9 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 btn-transition disabled:opacity-50">
                {updatePayment.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Mark as Paid
              </button>
              <button onClick={() => savePayment(0)} disabled={updatePayment.isPending || received === 0}
                className="px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition disabled:opacity-50">
                Mark as Unpaid
              </button>
            </div>
          )}
        </div>
      )}




      {/* Footer details */}
      {editing ? (
        <div className="card-industrial p-5 space-y-4">
          <h2 className="text-sm font-semibold">Footer Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Prepared By</label>
              <input type="text" value={form.prepared_by_name} onChange={e => setForm(p => ({ ...p, prepared_by_name: e.target.value }))}
                className="input-industrial w-full mt-1" placeholder="Signing authority" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Receiver Name</label>
              <input type="text" value={form.receiver_name} onChange={e => setForm(p => ({ ...p, receiver_name: e.target.value }))}
                className="input-industrial w-full mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Receiver Contact</label>
              <input type="text" value={form.receiver_contact_number} onChange={e => setForm(p => ({ ...p, receiver_contact_number: e.target.value }))}
                className="input-industrial w-full mt-1" />
            </div>
          </div>
        </div>
      ) : (
        (challan.prepared_by_name || challan.receiver_name) && (
          <div className="card-industrial p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {challan.prepared_by_name && (
                <div><span className="text-muted-foreground">Prepared By</span><p className="font-medium mt-0.5">{challan.prepared_by_name}</p></div>
              )}
              {challan.receiver_name && (
                <div><span className="text-muted-foreground">Received By</span><p className="font-medium mt-0.5">{challan.receiver_name}</p></div>
              )}
              {challan.receiver_contact_number && (
                <div><span className="text-muted-foreground">Contact</span><p className="font-medium mt-0.5">{challan.receiver_contact_number}</p></div>
              )}
            </div>
          </div>
        )
      )}

    </div>
  );
};

export default ChallanDetail;
