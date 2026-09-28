import React, { useState, useMemo, useEffect } from 'react';
import { useClients, useUpdateClientRateConfig } from '@/hooks/useClients';
import {
  useAllClientRates, useUpsertClientRate, useDeleteClientRate, type ClientRate,
  useClientYarnCosts, useUpsertClientYarnCost, useDeleteClientYarnCost, type ClientYarnCost,
  useClientRateTiers, useUpsertClientRateTier, useDeleteClientRateTier, type ClientRateTier,
} from '@/hooks/useClientRates';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ClientRateMaster: React.FC = () => {
  const { data: clients = [] } = useClients();
  const { data: rates = [], isLoading } = useAllClientRates();
  const { lots } = useApp();

  const yarnTypeOptions = useMemo(() => {
    const set = new Set<string>();
    lots.forEach(l => { if (l.denier?.trim()) set.add(l.denier.trim()); });
    return Array.from(set).sort();
  }, [lots]);
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
      </div>

      <Tabs defaultValue="flat">
        <TabsList>
          <TabsTrigger value="flat">Flat Rates</TabsTrigger>
          <TabsTrigger value="tiered">Tiered Rates &amp; Surcharge</TabsTrigger>
        </TabsList>

        <TabsContent value="flat" className="space-y-6 mt-4">
          <div className="flex items-center justify-end">
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
                      {yarnTypeOptions.map(yt => <option key={yt} value={yt} />)}
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
        </TabsContent>

        <TabsContent value="tiered" className="mt-4">
          <TieredRateManager clients={clients} yarnTypeOptions={yarnTypeOptions} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// -----------------------------------------------------------------------
// Tiered rate + paper-tube surcharge management (2026-09-28). Separate
// yarn cost (per client + yarn type) and quantity-tiered overhead (per
// client, shared across yarn types) per Ansh's explicit design -- see
// sql_migrations/20260928_client_rates_v2.sql for the full rationale.
// -----------------------------------------------------------------------

const emptyTierForm = { min_qty: 0, max_qty: '' as number | '', overhead_rate: 0, label: '', sort_order: 0 };
const emptyCostForm = { yarn_type: '', rate_per_kg: 0 };

const TieredRateManager: React.FC<{ clients: ReturnType<typeof useClients>['data']; yarnTypeOptions: string[] }> = ({ clients = [], yarnTypeOptions }) => {
  const [clientId, setClientId] = useState('');
  const client = useMemo(() => clients?.find(c => c.id === clientId), [clients, clientId]);

  const updateConfig = useUpdateClientRateConfig();
  const { data: yarnCosts = [] } = useClientYarnCosts(clientId || undefined);
  const upsertCost = useUpsertClientYarnCost();
  const deleteCost = useDeleteClientYarnCost();
  const { data: tiers = [] } = useClientRateTiers(clientId || undefined);
  const upsertTier = useUpsertClientRateTier();
  const deleteTier = useDeleteClientRateTier();

  const [baseline, setBaseline] = useState('');
  const [surcharge, setSurcharge] = useState('');
  useEffect(() => {
    setBaseline(client?.paper_tube_baseline_kg_per_cone != null ? String(client.paper_tube_baseline_kg_per_cone) : '');
    setSurcharge(client?.paper_tube_extra_cone_surcharge != null ? String(client.paper_tube_extra_cone_surcharge) : '');
  }, [client?.id]);

  const [costForm, setCostForm] = useState(emptyCostForm);
  const [editCost, setEditCost] = useState<ClientYarnCost | null>(null);
  const [tierForm, setTierForm] = useState(emptyTierForm);
  const [editTier, setEditTier] = useState<ClientRateTier | null>(null);

  if (!clients || clients.length === 0) {
    return <p className="text-muted-foreground text-sm">Loading clients...</p>;
  }

  const isTiered = client?.rate_mode === 'tiered';

  const handleToggleTiered = async (v: boolean) => {
    if (!client) return;
    try {
      await updateConfig.mutateAsync({
        client_id: client.id,
        rate_mode: v ? 'tiered' : 'flat',
        paper_tube_baseline_kg_per_cone: client.paper_tube_baseline_kg_per_cone ?? null,
        paper_tube_extra_cone_surcharge: client.paper_tube_extra_cone_surcharge ?? null,
      });
      toast.success(v ? 'Switched to tiered rates.' : 'Switched to flat rates.');
    } catch {
      toast.error('Failed to update rate mode.');
    }
  };

  const saveSurchargeConfig = async () => {
    if (!client) return;
    const baselineNum = baseline.trim() === '' ? null : parseFloat(baseline);
    const surchargeNum = surcharge.trim() === '' ? null : parseFloat(surcharge);
    try {
      await updateConfig.mutateAsync({
        client_id: client.id,
        rate_mode: client.rate_mode || 'tiered',
        paper_tube_baseline_kg_per_cone: baselineNum,
        paper_tube_extra_cone_surcharge: surchargeNum,
      });
      toast.success('Cone surcharge settings saved.');
    } catch {
      toast.error('Failed to save surcharge settings.');
    }
  };

  const submitCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (!costForm.yarn_type.trim()) { toast.error('Yarn type is required.'); return; }
    try {
      await upsertCost.mutateAsync({ id: editCost?.id, client_id: client.id, yarn_type: costForm.yarn_type, rate_per_kg: costForm.rate_per_kg });
      toast.success(editCost ? 'Yarn cost updated.' : 'Yarn cost added.');
      setCostForm(emptyCostForm);
      setEditCost(null);
    } catch (err: any) {
      if (err?.code === '23505') toast.error('A yarn cost for this yarn type already exists.');
      else toast.error('Failed to save yarn cost.');
    }
  };

  const submitTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (!tierForm.label.trim()) { toast.error('Tier label is required.'); return; }
    try {
      await upsertTier.mutateAsync({
        id: editTier?.id,
        client_id: client.id,
        min_qty: tierForm.min_qty,
        max_qty: tierForm.max_qty === '' ? null : Number(tierForm.max_qty),
        overhead_rate: tierForm.overhead_rate,
        label: tierForm.label,
        sort_order: tierForm.sort_order,
      });
      toast.success(editTier ? 'Tier updated.' : 'Tier added.');
      setTierForm({ ...emptyTierForm, sort_order: tiers.length + 1 });
      setEditTier(null);
    } catch (err: any) {
      if (err?.code === '23505') toast.error('A tier with this sort order already exists for this client.');
      else toast.error('Failed to save tier.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Client</label>
        <select value={clientId} onChange={e => { setClientId(e.target.value); setEditCost(null); setEditTier(null); setCostForm(emptyCostForm); setTierForm(emptyTierForm); }}
          className="input-industrial w-full md:w-80">
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
        </select>
      </div>

      {client && (
        <>
          <div className="card-industrial p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={isTiered} onCheckedChange={handleToggleTiered} />
              <label className="text-sm font-medium">Use tiered rate system for {client.client_name}</label>
            </div>
            <p className="text-xs text-muted-foreground">
              When on, Create Challan shows a manually-picked tier dropdown for this client instead of a flat rate --
              the challan maker chooses the tier based on the real total order quantity, not the challan line's own weight.
            </p>
          </div>

          {isTiered && (
            <>
              {/* Paper-tube cone surcharge config */}
              <div className="card-industrial p-5 space-y-4">
                <h3 className="text-sm font-semibold">Paper-Tube Cone Surcharge (optional)</h3>
                <p className="text-xs text-muted-foreground">Off by default. Only set both fields if {client.client_name} is charged extra for smaller/lighter cones than the baseline.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Baseline kg per cone</label>
                    <input type="number" step="0.001" value={baseline} onChange={e => setBaseline(e.target.value)}
                      className="input-industrial w-full" placeholder="e.g. 1" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Surcharge per extra cone (₹)</label>
                    <input type="number" step="0.01" value={surcharge} onChange={e => setSurcharge(e.target.value)}
                      className="input-industrial w-full" placeholder="e.g. 8" />
                  </div>
                </div>
                <button onClick={saveSurchargeConfig} disabled={updateConfig.isPending}
                  className="px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90">
                  Save Surcharge Settings
                </button>
              </div>

              {/* Yarn costs */}
              <div className="card-industrial p-5 space-y-4">
                <h3 className="text-sm font-semibold">Yarn Cost per Yarn Type</h3>
                <form onSubmit={submitCost} className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Yarn Type</label>
                    <input type="text" list="tiered-yarn-type-list" value={costForm.yarn_type}
                      onChange={e => setCostForm(f => ({ ...f, yarn_type: e.target.value }))}
                      className="input-industrial w-40" placeholder="e.g. 150/ROTO" />
                    <datalist id="tiered-yarn-type-list">
                      {yarnTypeOptions.map(yt => <option key={yt} value={yt} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Rate (₹/kg)</label>
                    <input type="number" step="0.01" value={costForm.rate_per_kg}
                      onChange={e => setCostForm(f => ({ ...f, rate_per_kg: parseFloat(e.target.value) || 0 }))}
                      className="input-industrial w-32" />
                  </div>
                  <button type="submit" disabled={upsertCost.isPending}
                    className="px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90">
                    {editCost ? 'Update' : 'Add'}
                  </button>
                  {editCost && (
                    <button type="button" onClick={() => { setEditCost(null); setCostForm(emptyCostForm); }}
                      className="px-4 h-10 border border-input rounded-md text-sm btn-transition hover:bg-secondary">Cancel</button>
                  )}
                </form>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Yarn Type</th>
                      <th className="px-2 py-2 font-medium">Rate (₹/kg)</th>
                      <th className="px-2 py-2 font-medium text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yarnCosts.length === 0 ? (
                      <tr><td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">No yarn costs set yet.</td></tr>
                    ) : yarnCosts.map(yc => (
                      <tr key={yc.id} className="border-b border-border hover:bg-secondary/30">
                        <td className="px-2 py-2 font-medium">{yc.yarn_type}</td>
                        <td className="px-2 py-2">₹{yc.rate_per_kg.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center">
                          <div className="inline-flex gap-1">
                            <button onClick={() => { setEditCost(yc); setCostForm({ yarn_type: yc.yarn_type, rate_per_kg: yc.rate_per_kg }); }}
                              className="p-1.5 hover:bg-secondary rounded"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={async () => { if (confirm('Delete this yarn cost?')) { await deleteCost.mutateAsync(yc.id); toast.success('Deleted.'); } }}
                              className="p-1.5 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rate tiers */}
              <div className="card-industrial p-5 space-y-4">
                <h3 className="text-sm font-semibold">Quantity Tiers (shared across all yarn types for this client)</h3>
                <form onSubmit={submitTier} className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Min Qty (kg)</label>
                    <input type="number" step="0.01" value={tierForm.min_qty}
                      onChange={e => setTierForm(f => ({ ...f, min_qty: parseFloat(e.target.value) || 0 }))}
                      className="input-industrial w-28" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Max Qty (kg, blank = and above)</label>
                    <input type="number" step="0.01" value={tierForm.max_qty}
                      onChange={e => setTierForm(f => ({ ...f, max_qty: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 }))}
                      className="input-industrial w-36" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Overhead (₹/kg)</label>
                    <input type="number" step="0.01" value={tierForm.overhead_rate}
                      onChange={e => setTierForm(f => ({ ...f, overhead_rate: parseFloat(e.target.value) || 0 }))}
                      className="input-industrial w-28" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Label</label>
                    <input type="text" value={tierForm.label}
                      onChange={e => setTierForm(f => ({ ...f, label: e.target.value }))}
                      className="input-industrial w-32" placeholder="e.g. 1-5 kg" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Order</label>
                    <input type="number" step="1" value={tierForm.sort_order}
                      onChange={e => setTierForm(f => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                      className="input-industrial w-20" />
                  </div>
                  <button type="submit" disabled={upsertTier.isPending}
                    className="px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90">
                    {editTier ? 'Update' : 'Add'}
                  </button>
                  {editTier && (
                    <button type="button" onClick={() => { setEditTier(null); setTierForm(emptyTierForm); }}
                      className="px-4 h-10 border border-input rounded-md text-sm btn-transition hover:bg-secondary">Cancel</button>
                  )}
                </form>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Order</th>
                      <th className="px-2 py-2 font-medium">Label</th>
                      <th className="px-2 py-2 font-medium">Min Qty</th>
                      <th className="px-2 py-2 font-medium">Max Qty</th>
                      <th className="px-2 py-2 font-medium">Overhead (₹/kg)</th>
                      <th className="px-2 py-2 font-medium text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.length === 0 ? (
                      <tr><td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">No tiers set yet.</td></tr>
                    ) : [...tiers].sort((a, b) => a.sort_order - b.sort_order).map(t => (
                      <tr key={t.id} className="border-b border-border hover:bg-secondary/30">
                        <td className="px-2 py-2">{t.sort_order}</td>
                        <td className="px-2 py-2 font-medium">{t.label}</td>
                        <td className="px-2 py-2">{t.min_qty}</td>
                        <td className="px-2 py-2">{t.max_qty ?? 'and above'}</td>
                        <td className="px-2 py-2">₹{t.overhead_rate.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center">
                          <div className="inline-flex gap-1">
                            <button onClick={() => { setEditTier(t); setTierForm({ min_qty: t.min_qty, max_qty: t.max_qty ?? '', overhead_rate: t.overhead_rate, label: t.label, sort_order: t.sort_order }); }}
                              className="p-1.5 hover:bg-secondary rounded"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={async () => { if (confirm('Delete this tier?')) { await deleteTier.mutateAsync(t.id); toast.success('Deleted.'); } }}
                              className="p-1.5 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ClientRateMaster;
