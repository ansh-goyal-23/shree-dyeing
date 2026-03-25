import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { MasterItem } from '@/types';
import CompanyAutocomplete from '@/components/CompanyAutocomplete';

const MasterData: React.FC = () => {
  const { masterItems, addMasterItem, updateMasterItem } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MasterItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'dye' | 'chemical'>('all');

  const [form, setForm] = useState({
    name: '',
    type: 'dye' as 'dye' | 'chemical',
    shade_family: '',
    company: '',
    unit: 'gm',
    is_active: true,
  });

  const filtered = masterItems.filter(m => filter === 'all' || m.type === filter);

  const resetForm = () => {
    setForm({ name: '', type: 'dye', shade_family: '', company: '', unit: 'gm', is_active: true });
    setEditItem(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required.'); return; }

    if (editItem) {
      await updateMasterItem({ ...editItem, ...form, name: form.name.trim() });
      toast.success(`${form.name} updated.`);
    } else {
      await addMasterItem({ ...form, name: form.name.trim() });
      toast.success(`${form.name} added.`);
    }
    resetForm();
  };

  const startEdit = (item: MasterItem) => {
    setForm({ name: item.name, type: item.type, shade_family: item.shade_family, company: item.company, unit: item.unit, is_active: item.is_active });
    setEditItem(item);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Master Data</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card-industrial p-4 space-y-4">
          <h2 className="text-sm font-semibold">{editItem ? 'Edit Item' : 'Add New Item'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-industrial w-full" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'dye' | 'chemical' }))} className="input-industrial w-full">
                <option value="dye">Dye</option>
                <option value="chemical">Chemical</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Shade Family</label>
              <input type="text" value={form.shade_family} onChange={e => setForm(f => ({ ...f, shade_family: e.target.value }))} className="input-industrial w-full" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Company</label>
              <CompanyAutocomplete value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="input-industrial w-full">
                <option value="gm">gm</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="litre">litre</option>
              </select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
                Active
              </label>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="submit" className="px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
              {editItem ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 h-11 border border-input rounded-md text-sm btn-transition hover:bg-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'dye', 'chemical'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium btn-transition ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}
          >
            {f === 'all' ? 'All' : f === 'dye' ? 'Dyes' : 'Chemicals'}
          </button>
        ))}
      </div>

      {/* Mobile card view */}
      <div className="block sm:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No items found.</div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="card-industrial p-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded capitalize">{item.type}</span>
                  {!item.is_active && <span className="text-[10px] text-muted-foreground">Inactive</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.unit}{item.shade_family ? ` • ${item.shade_family}` : ''}{item.company ? ` • ${item.company}` : ''}
                </div>
              </div>
              <button onClick={() => startEdit(item)} className="p-2 hover:bg-secondary rounded btn-transition">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block card-industrial overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Shade Family</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No items found.</td></tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id} className="row-separator hover:bg-secondary/30 btn-transition">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 capitalize">{item.type}</td>
                  <td className="px-4 py-3">{item.unit}</td>
                  <td className="px-4 py-3">{item.shade_family || '—'}</td>
                  <td className="px-4 py-3">{item.company || '—'}</td>
                  <td className="px-4 py-3 text-center">{item.is_active ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => startEdit(item)} className="p-1 hover:bg-secondary rounded btn-transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MasterData;
