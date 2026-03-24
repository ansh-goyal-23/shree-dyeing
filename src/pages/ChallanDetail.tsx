import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useChallan, useChallanItems, useUpdateChallan, useDeleteChallan } from '@/hooks/useChallan';
import { useApp } from '@/context/AppContext';
import ClientSelect from '@/components/ClientSelect';
import ChallanItemRow from '@/components/ChallanItemRow';
import type { ItemData } from '@/components/ChallanItemRow';
import { downloadChallanPdf, shareChallanPdf } from '@/lib/challanPdf';
import { toast } from 'sonner';
import { PlusCircle, Loader2, Pencil, Trash2, ArrowLeft, Download, Share2 } from 'lucide-react';

const emptyItem = (): ItemData => ({
  lot_no: '', shade_number: '', color_name: '', packaging_type: 'paper_tube',
  gross_weight: 0, num_of_units: 0, net_weight: 0, rate: 0, amount: 0,
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
  const { lots } = useApp();

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

  useEffect(() => {
    if (challanItems.length > 0) {
      setItems(challanItems.map(i => ({
        lot_no: i.lot_no, shade_number: i.shade_number, color_name: i.color_name,
        packaging_type: i.packaging_type, gross_weight: i.gross_weight,
        num_of_units: i.num_of_units, net_weight: i.net_weight, rate: i.rate, amount: i.amount,
      })));
    }
  }, [challanItems]);

  const totalNetWeight = items.reduce((s, i) => s + (i.net_weight || 0), 0);
  const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0);

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
      toast.success('Challan deleted.');
      navigate('/dispatch');
    } catch {
      toast.error('Failed to delete.');
    }
  };

  const handleDownloadPdf = () => {
    if (challan) downloadChallanPdf(challan, challanItems);
  };

  const handleShare = async () => {
    if (challan) {
      try {
        await shareChallanPdf(challan, challanItems);
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
    <div className="max-w-5xl mx-auto space-y-6">
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
              <button onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
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
            <div><span className="text-muted-foreground">Date</span><p className="font-medium mt-0.5">{new Date(challan.date).toLocaleDateString()}</p></div>
            <div><span className="text-muted-foreground">Client</span><p className="font-medium mt-0.5">{challan.client_name}</p></div>
            {challan.notes && <div className="col-span-2 md:col-span-4"><span className="text-muted-foreground">Notes</span><p className="mt-0.5">{challan.notes}</p></div>}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card-industrial overflow-x-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Items</h2>
          {editing && (
            <button type="button" onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium border border-input rounded-md hover:bg-secondary btn-transition">
              <PlusCircle className="w-3.5 h-3.5" /> Add Row
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-2 font-medium">Lot No</th>
              <th className="p-2 font-medium">Shade #</th>
              <th className="p-2 font-medium">Color</th>
              <th className="p-2 font-medium">Packaging</th>
              <th className="p-2 font-medium">Gross Wt</th>
              <th className="p-2 font-medium">Units</th>
              <th className="p-2 font-medium">Net Wt</th>
              <th className="p-2 font-medium">Rate/kg</th>
              <th className="p-2 font-medium">Amount</th>
              {editing && <th className="p-2"></th>}
            </tr>
          </thead>
          <tbody>
            {editing ? (
              items.map((item, i) => (
                <ChallanItemRow key={i} index={i} item={item} lots={lots} onChange={updateItem} onRemove={removeItem} />
              ))
            ) : (
              (challanItems.length === 0 ? (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No items.</td></tr>
              ) : challanItems.map(item => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-2 font-medium">
                    <Link to={`/shade-management/lots/${item.lot_no}`} className="text-primary hover:underline">{item.lot_no}</Link>
                  </td>
                  <td className="p-2">{item.shade_number}</td>
                  <td className="p-2">{item.color_name}</td>
                  <td className="p-2">{PACKAGING_LABEL[item.packaging_type] || item.packaging_type}</td>
                  <td className="p-2">{item.gross_weight.toFixed(3)}</td>
                  <td className="p-2">{item.num_of_units}</td>
                  <td className="p-2">{item.net_weight.toFixed(3)}</td>
                  <td className="p-2">₹{item.rate.toFixed(2)}</td>
                  <td className="p-2 font-medium">₹{item.amount.toFixed(2)}</td>
                </tr>
              )))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td colSpan={6} className="p-3 text-right">Totals:</td>
              <td className="p-3">{totalNetWeight.toFixed(3)} kg</td>
              <td className="p-3"></td>
              <td className="p-3">₹{totalAmount.toFixed(2)}</td>
              {editing && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>

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
