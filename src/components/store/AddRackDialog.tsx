import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useCreateStoreRack } from '@/hooks/useStore';
import { toast } from 'sonner';

interface Props {
  onCreated?: (rackId: string) => void;
}

const AddRackDialog: React.FC<Props> = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rack_code: '', rack_name: '', area: '', description: '' });
  const createRack = useCreateStoreRack();

  const reset = () => setForm({ rack_code: '', rack_name: '', area: '', description: '' });

  const handleSave = async () => {
    if (!form.rack_code.trim()) { toast.error('Rack code is required'); return; }
    try {
      const r = await createRack.mutateAsync({
        rack_code: form.rack_code.trim(),
        rack_name: form.rack_name.trim(),
        area: form.area.trim() || null,
        description: form.description.trim() || null,
        is_active: true,
      } as any);
      toast.success(`Rack ${r.rack_code} added`);
      onCreated?.(r.id);
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to add rack');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" title="Add Rack">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add New Rack</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Rack Code *</Label>
            <Input value={form.rack_code} onChange={(e) => setForm(f => ({ ...f, rack_code: e.target.value }))} placeholder="e.g. R-12" />
          </div>
          <div>
            <Label>Rack Name</Label>
            <Input value={form.rack_name} onChange={(e) => setForm(f => ({ ...f, rack_name: e.target.value }))} />
          </div>
          <div>
            <Label>Area</Label>
            <Input value={form.area} onChange={(e) => setForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Finished Goods Hall" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={createRack.isPending}>
            {createRack.isPending ? 'Saving…' : 'Add Rack'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddRackDialog;
