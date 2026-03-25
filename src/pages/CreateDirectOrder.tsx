import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateIntakeItem } from '@/hooks/useSampling';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import ClientSelect from '@/components/ClientSelect';
import type { IntakeItemStatus } from '@/types/sampling';

const CreateDirectOrder: React.FC = () => {
  const navigate = useNavigate();
  const createItem = useCreateIntakeItem();
  const { lots } = useApp();

  const [form, setForm] = useState({
    client_id: '',
    linked_lot_no: '',
    yarn_type: '',
    order_quantity: '',
    notes: '',
  });

  const update = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

  const selectedLot = lots.find(l => l.lot_no === form.linked_lot_no);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) { toast.error('Please select a client.'); return; }
    if (!form.linked_lot_no) { toast.error('Please select a shade/lot.'); return; }
    if (!form.order_quantity) { toast.error('Please enter order quantity.'); return; }

    try {
      await createItem.mutateAsync({
        intake_id: null,
        sample_identifier: `ORD-${Date.now().toString(36).toUpperCase()}`,
        shade_reference: selectedLot?.shade_number || form.linked_lot_no,
        yarn_type: form.yarn_type.trim() || selectedLot?.denier || '',
        product_type: '',
        order_quantity: form.order_quantity.trim(),
        notes: form.notes.trim(),
        sample_photo_path: null,
        linked_lot_no: form.linked_lot_no,
        status: 'In Development' as IntakeItemStatus,
        is_direct_order: true,
        client_id: form.client_id,
      });
      toast.success('Direct order created.');
      navigate('/sampling');
    } catch {
      toast.error('Failed to create order.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Direct Order</h1>
      <p className="text-sm text-muted-foreground">Create an order without a sample — e.g. WhatsApp or phone orders.</p>

      <form onSubmit={handleSubmit} className="card-industrial p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Client *</label>
          <ClientSelect value={form.client_id} onChange={v => update('client_id', v)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Shade / Lot *</label>
            <select value={form.linked_lot_no} onChange={e => update('linked_lot_no', e.target.value)} className="input-industrial w-full">
              <option value="">Select shade...</option>
              {lots.map(l => (
                <option key={l.lot_no} value={l.lot_no}>
                  {l.lot_no} ({l.color_name})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Order Quantity (kg) *</label>
            <input type="text" value={form.order_quantity} onChange={e => update('order_quantity', e.target.value)} className="input-industrial w-full" placeholder="e.g. 50" required />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Yarn Type</label>
          <input type="text" value={form.yarn_type} onChange={e => update('yarn_type', e.target.value)} className="input-industrial w-full" placeholder={selectedLot?.denier || 'Yarn type'} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} className="input-industrial w-full min-h-[80px] py-2" placeholder="Order notes..." />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/sampling')}
            className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring">
            Cancel
          </button>
          <button type="submit" disabled={createItem.isPending}
            className="px-6 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
            {createItem.isPending ? 'Creating…' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateDirectOrder;
