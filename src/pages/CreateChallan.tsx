import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateChallan } from '@/hooks/useChallan';
import { useApp } from '@/context/AppContext';
import ClientSelect from '@/components/ClientSelect';
import ChallanItemRow from '@/components/ChallanItemRow';
import type { ItemData } from '@/components/ChallanItemRow';
import { toast } from 'sonner';
import { PlusCircle, Loader2 } from 'lucide-react';

const emptyItem = (): ItemData => ({
  lot_no: '', shade_number: '', color_name: '', packaging_type: 'paper_tube',
  gross_weight: 0, num_of_units: 0, net_weight: 0, rate: 0, amount: 0,
});

const CreateChallan: React.FC = () => {
  const navigate = useNavigate();
  const createChallan = useCreateChallan();
  const { lots } = useApp();

  const [form, setForm] = useState({
    challan_number: '',
    date: new Date().toISOString().split('T')[0],
    client_id: '',
    notes: '',
    prepared_by_name: '',
    receiver_name: '',
    receiver_contact_number: '',
  });
  const [items, setItems] = useState<ItemData[]>([emptyItem()]);

  const updateItem = (index: number, updated: ItemData) => {
    setItems(prev => prev.map((it, i) => i === index ? updated : it));
  };
  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };
  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const totalNetWeight = items.reduce((s, i) => s + i.net_weight, 0);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.challan_number.trim()) { toast.error('Challan number is required.'); return; }
    if (!form.client_id) { toast.error('Please select a client.'); return; }
    const validItems = items.filter(i => i.lot_no);
    if (validItems.length === 0) { toast.error('Add at least one item.'); return; }

    try {
      await createChallan.mutateAsync({
        challan_number: form.challan_number.trim(),
        date: form.date,
        client_id: form.client_id,
        notes: form.notes.trim(),
        prepared_by_name: form.prepared_by_name.trim(),
        receiver_name: form.receiver_name.trim(),
        receiver_contact_number: form.receiver_contact_number.trim(),
        items: validItems,
      });
      toast.success('Challan created successfully.');
      navigate('/dispatch');
    } catch (err: any) {
      if (err?.message?.includes('duplicate') || err?.code === '23505') {
        toast.error('Challan number already exists.');
      } else {
        toast.error('Failed to create challan.');
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Create Challan</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="card-industrial p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Challan Number *</label>
              <input type="text" value={form.challan_number} onChange={e => setForm(p => ({ ...p, challan_number: e.target.value }))}
                className="input-industrial w-full mt-1" placeholder="e.g. CH-001" autoFocus />
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
            <h2 className="text-sm font-semibold">Items</h2>
            <button type="button" onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium border border-input rounded-md hover:bg-secondary btn-transition">
              <PlusCircle className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>
          <div className="min-w-[700px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-2 font-medium">Lot No</th>
                  <th className="p-2 font-medium">Shade #</th>
                  <th className="p-2 font-medium">Color</th>
                  <th className="p-2 font-medium">Packaging</th>
                  <th className="p-2 font-medium">Gross Wt (kg)</th>
                  <th className="p-2 font-medium">Units</th>
                  <th className="p-2 font-medium">Net Wt (kg)</th>
                  <th className="p-2 font-medium">Rate/kg</th>
                  <th className="p-2 font-medium">Amount</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <ChallanItemRow key={i} index={i} item={item} lots={lots} onChange={updateItem} onRemove={removeItem} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td colSpan={6} className="p-3 text-right">Totals:</td>
                  <td className="p-3">{totalNetWeight.toFixed(3)} kg</td>
                  <td className="p-3"></td>
                  <td className="p-3">₹{totalAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Details */}
        <div className="card-industrial p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold">Footer Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Prepared By</label>
              <input type="text" value={form.prepared_by_name} onChange={e => setForm(p => ({ ...p, prepared_by_name: e.target.value }))}
                className="input-industrial w-full mt-1" placeholder="Signing authority name" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Receiver Name</label>
              <input type="text" value={form.receiver_name} onChange={e => setForm(p => ({ ...p, receiver_name: e.target.value }))}
                className="input-industrial w-full mt-1" placeholder="Receiver name" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Receiver Contact</label>
              <input type="text" value={form.receiver_contact_number} onChange={e => setForm(p => ({ ...p, receiver_contact_number: e.target.value }))}
                className="input-industrial w-full mt-1" placeholder="+91 XXXXXXXXXX" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button type="button" onClick={() => navigate('/dispatch')}
            className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary">Cancel</button>
          <button type="submit" disabled={createChallan.isPending}
            className="inline-flex items-center justify-center gap-2 px-6 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 disabled:opacity-50">
            {createChallan.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Challan
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateChallan;
