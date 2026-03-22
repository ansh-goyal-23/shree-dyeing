import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useIntakeEntry, useIntakeItems, useCreateIntakeItem, useUpdateIntakeItem, useDeleteIntakeItem, getPhotoUrl } from '@/hooks/useSampling';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, PlusCircle, Camera, Loader2, Trash2, ExternalLink, X } from 'lucide-react';
import type { IntakeItemStatus } from '@/types/sampling';

const statusColors: Record<IntakeItemStatus, string> = {
  Pending: 'bg-correction/10 text-correction',
  'In Development': 'bg-primary/10 text-primary',
  Completed: 'bg-approved/10 text-approved',
};

const IntakeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading: entryLoading } = useIntakeEntry(id!);
  const { data: items = [], isLoading: itemsLoading } = useIntakeItems(id!);
  const createItem = useCreateIntakeItem();
  const updateItem = useUpdateIntakeItem();
  const deleteItem = useDeleteIntakeItem();

  const [showAddForm, setShowAddForm] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  if (entryLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!entry) return <div className="text-center py-12 text-muted-foreground">Entry not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sampling')} className="p-2 hover:bg-secondary rounded-md btn-transition"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{entry.client_name}</h1>
          <p className="text-sm text-muted-foreground">{entry.intake_type} • {new Date(entry.received_date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Entry Details */}
      <div className="card-industrial p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">Type</span><p className="font-medium">{entry.intake_type}</p></div>
          <div><span className="text-muted-foreground">Received</span><p className="font-medium font-data">{entry.received_date}</p></div>
          {entry.sheet_date && <div><span className="text-muted-foreground">Sheet Date</span><p className="font-medium font-data">{entry.sheet_date}</p></div>}
          {entry.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes</span><p className="font-medium">{entry.notes}</p></div>}
        </div>
        {entry.reference_photo_path && (
          <button onClick={() => setViewPhoto(getPhotoUrl('lot-photos', entry.reference_photo_path!))}
            className="w-24 h-24 rounded-lg overflow-hidden border border-border hover:border-primary btn-transition">
            <img src={getPhotoUrl('lot-photos', entry.reference_photo_path)} alt="Reference" className="w-full h-full object-cover" />
          </button>
        )}
      </div>

      {/* Items Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Items ({items.length})</h2>
        <button onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-3 h-9 bg-primary text-primary-foreground rounded-md text-xs font-medium btn-transition hover:opacity-90 focus-ring">
          <PlusCircle className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>

      {showAddForm && <AddItemForm intakeId={id!} onClose={() => setShowAddForm(false)} />}

      {itemsLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No items added yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="card-industrial p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {item.sample_photo_path && (
                    <button onClick={() => setViewPhoto(getPhotoUrl('lot-photos', item.sample_photo_path!))}
                      className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-primary btn-transition flex-shrink-0">
                      <img src={getPhotoUrl('lot-photos', item.sample_photo_path)} alt={item.sample_identifier} className="w-full h-full object-cover" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">#{item.sample_identifier}</span>
                      <Badge className={`text-[10px] ${statusColors[item.status]}`}>{item.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-1.5 text-xs">
                      {item.shade_reference && <div><span className="text-muted-foreground">Shade: </span>{item.shade_reference}</div>}
                      {item.yarn_type && <div><span className="text-muted-foreground">Yarn: </span>{item.yarn_type}</div>}
                      {item.product_type && <div><span className="text-muted-foreground">Product: </span>{item.product_type}</div>}
                      {item.order_quantity && <div><span className="text-muted-foreground">Qty: </span>{item.order_quantity}</div>}
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                    {item.linked_lot_no && (
                      <Link to={`/shade-management/lots/${item.linked_lot_no}`} className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Lot {item.linked_lot_no}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!item.linked_lot_no && (
                    <Link to={`/shade-management/lots/create?yarn=${encodeURIComponent(item.yarn_type)}&color=${encodeURIComponent(item.shade_reference)}&intake_item=${item.id}&intake_id=${item.intake_id}`}
                      className="px-2 h-7 bg-approved/10 text-approved rounded text-[10px] font-medium btn-transition hover:bg-approved/20 inline-flex items-center gap-1">
                      Create Lot
                    </Link>
                  )}
                  <select value={item.status} onChange={e => updateItem.mutate({ id: item.id, intake_id: item.intake_id, status: e.target.value as IntakeItemStatus })}
                    className="h-7 text-[10px] border border-input rounded px-1 bg-background">
                    <option value="Pending">Pending</option>
                    <option value="In Development">In Dev</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <button onClick={() => { if (confirm('Delete this item?')) deleteItem.mutate(item.id); }}
                    className="p-1.5 text-muted-foreground hover:text-destructive btn-transition rounded hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Viewer */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <img src={viewPhoto} alt="Preview" className="w-full max-h-[80vh] object-contain rounded-lg" />
            <button onClick={() => setViewPhoto(null)} className="absolute top-2 right-2 p-1.5 bg-white/20 rounded hover:bg-white/30"><X className="w-4 h-4 text-white" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: Add Item Form
const AddItemForm: React.FC<{ intakeId: string; onClose: () => void }> = ({ intakeId, onClose }) => {
  const createItem = useCreateIntakeItem();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    sample_identifier: '', shade_reference: '', yarn_type: '', product_type: '',
    order_quantity: '', notes: '', sample_photo_path: null as string | null,
  });

  const update = (f: string, v: any) => setForm(prev => ({ ...prev, [f]: v }));

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `intake-samples/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('lot-photos').upload(path, file);
    if (error) { toast.error('Upload failed.'); setUploading(false); return; }
    update('sample_photo_path', path);
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sample_identifier.trim()) { toast.error('Sample identifier is required.'); return; }
    try {
      await createItem.mutateAsync({
        intake_id: intakeId,
        sample_identifier: form.sample_identifier.trim(),
        shade_reference: form.shade_reference.trim(),
        yarn_type: form.yarn_type.trim(),
        product_type: form.product_type.trim(),
        order_quantity: form.order_quantity.trim(),
        notes: form.notes.trim(),
        sample_photo_path: form.sample_photo_path,
        linked_lot_no: null,
        status: 'Pending',
      });
      toast.success('Item added.');
      onClose();
    } catch {
      toast.error('Failed to add item.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-industrial p-4 space-y-4 border-2 border-primary/20">
      <h3 className="text-sm font-semibold">Add Item</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Identifier *</label>
          <input type="text" value={form.sample_identifier} onChange={e => update('sample_identifier', e.target.value)} className="input-industrial w-full text-sm" placeholder="A, B, 1..." required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Shade Reference</label>
          <input type="text" value={form.shade_reference} onChange={e => update('shade_reference', e.target.value)} className="input-industrial w-full text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Yarn Type</label>
          <input type="text" value={form.yarn_type} onChange={e => update('yarn_type', e.target.value)} className="input-industrial w-full text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Product Type</label>
          <input type="text" value={form.product_type} onChange={e => update('product_type', e.target.value)} className="input-industrial w-full text-sm" placeholder="lace / webbing / elastic" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Order Quantity</label>
          <input type="text" value={form.order_quantity} onChange={e => update('order_quantity', e.target.value)} className="input-industrial w-full text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Photo</label>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="input-industrial w-full text-xs inline-flex items-center gap-1 justify-center">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            {form.sample_photo_path ? '✓ Uploaded' : 'Upload'}
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Notes</label>
        <input type="text" value={form.notes} onChange={e => update('notes', e.target.value)} className="input-industrial w-full text-sm" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 h-8 border border-input rounded text-xs font-medium btn-transition hover:bg-secondary">Cancel</button>
        <button type="submit" disabled={createItem.isPending} className="px-3 h-8 bg-primary text-primary-foreground rounded text-xs font-medium btn-transition hover:opacity-90">
          {createItem.isPending ? 'Adding…' : 'Add Item'}
        </button>
      </div>
    </form>
  );
};

export default IntakeDetail;
