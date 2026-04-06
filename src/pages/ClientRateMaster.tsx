import React, { useState, useMemo } from 'react';
import { useClients } from '@/hooks/useSampling';
import { useAllClientRates, useUpsertClientRate, useDeleteClientRate, type ClientRate } from '@/hooks/useClientRates';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const YARN_TYPE_OPTIONS = [
  '150D', '75D', '100D', '200D', '250D', '300D',
  '75/2 HB', '150/2 HB', '100/2 HB',
  '75/36', '150/48', '100/36',
];

const ClientRateMaster: React.FC = () => {
  const { data: clients = [] } = useClients();
  const { data: rates = [], isLoading } = useAllClientRates();
  const upsert = useUpsertClientRate();
  const deleteRate = useDeleteClientRate();

  const [filterClient, setFilterClient] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<ClientRate | null>(null);
  const [form, setForm] = useState({
    client_id: '',
    yarn_type: '',
    sampling_rate: 0,
    production_rate: 0,
    same_rate: false,
  });

  const resetForm = () => {
    setForm({ client_id: '', yarn_type: '', sampling_rate: 0, production_rate: 0, same_rate: false });
    setEditItem(null);
    setShowForm(false);
  };

  const startEdit = (r: ClientRate) => {
    setForm({
      client_id: r.client_id,
      yarn_type: r.yarn_type,
      sampling_rate: r.sampling_rate,
      production_rate: r.production_rate,
      same_rate: r.same_rate,
    });
    setEditItem(r);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) { toast.error('Select a client.'); return; }
    if (!form.yarn_type.trim()) { toast.error('Yarn type is required.'); return; }
    try {
      await upsert.mutateAsync({ ...form, id: editItem?.id });
      toast.success(editItem ? 'Rate updated.' : 'Rate added.');
      resetForm();
    } catch (err: any) {
      if (err?.code === '23505') toast.error('This client + yarn type combination already exists.');
      else toast.error('Failed to save rate.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rate entry?')) return;
    await deleteRate.mutateAsync(id);
    toast.success('Rate deleted.');
  };

  // Group rates by client
  const grouped = useMemo(() => {
    const filtered = filterClient ? rates.filter(r => r.client_id === filterClient) : rates;
    const map = new Map<string, ClientRate[]>();
    for (const r of filtered) {
      const arr = map.get(r.client_id) || [];
      arr.push(r);
      map.set(r.client_id, arr);
    }
    return map;
  }, [rates, filterClient]);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.client_name || id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Client Rate Master</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Rate
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card-industrial p-5 space-y-4">
          <h2 className="text-sm font-semibold">{editItem ? 'Edit Rate' : 'Add New Rate'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Client *</label>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className="input-industrial w-full">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Yarn Type *</label>
              <div className="relative">
                <input type="text" list="yarn-type-list" value={form.yarn_type}
                  onChange={e => setForm(f => ({ ...f, yarn_type: e.target.value }))}
                  className="input-industrial w-full" placeholder="Select or type yarn type" />
                <datalist id="yarn-type-list">
                  {YARN_TYPE_OPTIONS.map(yt => <option key={yt} value={yt} />)}
                </datalist>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sampling Rate (₹/kg)</label>
              <input type="number" step="0.01" value={form.sampling_rate}
                onChange={e => setForm(f => ({ ...f, sampling_rate: parseFloat(e.target.value) || 0 }))}
                className="input-industrial w-full" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Production Rate (₹/kg)</label>
              <input type="number" step="0.01" value={form.same_rate ? form.sampling_rate : form.production_rate}
                onChange={e => setForm(f => ({ ...f, production_rate: parseFloat(e.target.value) || 0 }))}
                className="input-industrial w-full" disabled={form.same_rate} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.same_rate} onCheckedChange={v => setForm(f => ({ ...f, same_rate: v }))} />
            <label className="text-sm">Same rate for Sampling & Production</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={upsert.isPending}
              className="px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90">
              {editItem ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={resetForm}
              className="px-4 h-11 border border-input rounded-md text-sm btn-transition hover:bg-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Filter by Client:</label>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          className="input-industrial w-64">
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
        </select>
      </div>

      {/* Grouped display */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : grouped.size === 0 ? (
        <div className="card-industrial p-8 text-center text-muted-foreground">No rates defined yet.</div>
      ) : (
        Array.from(grouped.entries()).map(([clientId, clientRates]) => (
          <div key={clientId} className="card-industrial overflow-hidden">
            <div className="px-4 py-3 bg-secondary/50 border-b border-border">
              <h3 className="text-sm font-semibold">{getClientName(clientId)}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Yarn Type</th>
                  <th className="px-4 py-2 font-medium">Sampling Rate</th>
                  <th className="px-4 py-2 font-medium">Production Rate</th>
                  <th className="px-4 py-2 font-medium">Same Rate</th>
                  <th className="px-4 py-2 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clientRates.map(r => (
                  <tr key={r.id} className="border-b border-border hover:bg-secondary/30">
                    <td className="px-4 py-2 font-medium">{r.yarn_type}</td>
                    <td className="px-4 py-2">₹{r.sampling_rate.toFixed(2)}</td>
                    <td className="px-4 py-2">₹{(r.same_rate ? r.sampling_rate : r.production_rate).toFixed(2)}</td>
                    <td className="px-4 py-2">{r.same_rate ? <Check className="w-4 h-4 text-green-600" /> : '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="inline-flex gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 hover:bg-secondary rounded"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};

export default ClientRateMaster;
