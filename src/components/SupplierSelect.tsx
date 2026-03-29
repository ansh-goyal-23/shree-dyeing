import React, { useState } from 'react';
import { useSuppliers, useCreateSupplier } from '@/hooks/useExpenses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle } from 'lucide-react';
import type { Supplier } from '@/types/expense';

interface SupplierSelectProps {
  value: string;
  onChange: (id: string, supplier?: Supplier) => void;
}

const EMPTY = '__none__';

const SupplierSelect: React.FC<SupplierSelectProps> = ({ value, onChange }) => {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ supplier_name: '', contact: '', notes: '' });

  const filtered = suppliers.filter(s => s.supplier_name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!form.supplier_name.trim()) return;
    try {
      const created = await createSupplier.mutateAsync(form);
      onChange(created.id, created);
      setForm({ supplier_name: '', contact: '', notes: '' });
      setOpen(false);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Select value={value || EMPTY} onValueChange={v => onChange(v === EMPTY ? '' : v, suppliers.find(s => s.id === v))}>
          <SelectTrigger><SelectValue placeholder={isLoading ? 'Loading...' : 'Select supplier...'} /></SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="mb-2" />
            </div>
            <SelectItem value={EMPTY}>None</SelectItem>
            {filtered.map(s => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Supplier Name *</Label><Input value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))} /></div>
            <div><Label>Contact</Label><Input value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createSupplier.isPending}>{createSupplier.isPending ? 'Adding...' : 'Add Supplier'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierSelect;
