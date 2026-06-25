import React, { useMemo, useState } from 'react';
import {
  useStoreItems,
  useCreateStoreItem,
  useUpdateStoreItem,
  useStoreRacks,
  useCreateStoreRack,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABEL,
  RAW_MATERIAL_SUBCATEGORIES,
  STORE_UNITS,
} from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Search, Package, PlusCircle, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { StoreItem, StoreItemCategory } from '@/types/store';

const NO_RACK = '__no_rack__';

const emptyForm = {
  item_code: '',
  item_name: '',
  category: 'raw_material' as StoreItemCategory,
  sub_category: '' as string,
  unit: 'kg',
  is_asset: false,
  is_active: true,
  default_rack: '' as string,
  remarks: '',
};

const StoreItemMaster: React.FC = () => {
  const { data: items = [], isLoading } = useStoreItems({ activeOnly: false });
  const { data: racks = [] } = useStoreRacks();
  const createItem = useCreateStoreItem();
  const updateItem = useUpdateStoreItem();
  const createRack = useCreateStoreRack();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subFilter, setSubFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StoreItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const [rackDialogOpen, setRackDialogOpen] = useState(false);
  const [rackForm, setRackForm] = useState({ rack_code: '', rack_name: '', area: '', description: '' });

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (statusFilter === 'active' && !i.is_active) return false;
      if (statusFilter === 'inactive' && i.is_active) return false;
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (subFilter !== 'all' && (i.sub_category || '') !== subFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!i.item_name.toLowerCase().includes(q) && !i.item_code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, search, categoryFilter, subFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (item: StoreItem) => {
    setEditing(item);
    setForm({
      item_code: item.item_code,
      item_name: item.item_name,
      category: item.category,
      sub_category: item.sub_category || '',
      unit: item.unit,
      is_asset: item.is_asset,
      is_active: item.is_active,
      default_rack: item.default_rack || '',
      remarks: item.remarks || '',
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.item_code.trim() || !form.item_name.trim() || !form.unit.trim()) {
      toast.error('Item Code, Name and Unit are required');
      return;
    }
    const payload = {
      item_code: form.item_code.trim(),
      item_name: form.item_name.trim(),
      category: form.category,
      sub_category: form.sub_category || null,
      unit: form.unit,
      is_asset: form.is_asset,
      is_active: form.is_active,
      default_rack: form.default_rack || null,
      remarks: form.remarks || null,
    };
    try {
      if (editing) {
        await updateItem.mutateAsync({ id: editing.id, ...payload });
        toast.success('Item updated');
      } else {
        await createItem.mutateAsync(payload as any);
        toast.success('Item created');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
  };

  const toggleActive = async (item: StoreItem) => {
    try {
      await updateItem.mutateAsync({ id: item.id, is_active: !item.is_active });
      toast.success(item.is_active ? 'Item deactivated' : 'Item activated');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  const submitRack = async () => {
    if (!rackForm.rack_code.trim() || !rackForm.rack_name.trim()) {
      toast.error('Rack code and name are required');
      return;
    }
    try {
      await createRack.mutateAsync({
        rack_code: rackForm.rack_code.trim(),
        rack_name: rackForm.rack_name.trim(),
        area: rackForm.area || null,
        description: rackForm.description || null,
        is_active: true,
      } as any);
      toast.success('Rack added');
      setRackDialogOpen(false);
      setRackForm({ rack_code: '', rack_name: '', area: '', description: '' });
    } catch (e: any) {
      toast.error(e.message || 'Failed to add rack');
    }
  };

  const showSubcategory = form.category === 'raw_material';

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" /> Item Master
          </h1>
          <p className="text-muted-foreground text-sm">Store / Inventory item catalogue.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRackDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-1" /> New Rack
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or code…"
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setSubFilter('all'); }}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {STORE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={subFilter}
          onValueChange={setSubFilter}
          disabled={categoryFilter !== 'raw_material'}
        >
          <SelectTrigger><SelectValue placeholder="Sub Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sub Categories</SelectItem>
            {RAW_MATERIAL_SUBCATEGORIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[110px]">Code</TableHead>
              <TableHead className="min-w-[180px]">Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Sub Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Default Rack</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No items found.</TableCell></TableRow>
            ) : filtered.map(item => {
              const rack = racks.find(r => r.id === item.default_rack);
              const subLabel = RAW_MATERIAL_SUBCATEGORIES.find(s => s.value === item.sub_category)?.label || item.sub_category || '—';
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell>{STORE_CATEGORY_LABEL[item.category]}</TableCell>
                  <TableCell>{item.category === 'raw_material' ? subLabel : '—'}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{item.is_asset ? <Badge variant="secondary">Asset</Badge> : '—'}</TableCell>
                  <TableCell>{rack ? `${rack.rack_code}` : '—'}</TableCell>
                  <TableCell>
                    {item.is_active
                      ? <Badge>Active</Badge>
                      : <Badge variant="outline">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(item)}>
                      {item.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Item' : 'New Item'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Item Code *</Label>
              <Input value={form.item_code} onChange={(e) => setForm(f => ({ ...f, item_code: e.target.value }))} />
            </div>
            <div>
              <Label>Item Name *</Label>
              <Input value={form.item_name} onChange={(e) => setForm(f => ({ ...f, item_name: e.target.value }))} />
            </div>
            <div>
              <Label>Category *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm(f => ({ ...f, category: v as StoreItemCategory, sub_category: '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub Category {showSubcategory && '*'}</Label>
              {showSubcategory ? (
                <Select value={form.sub_category} onValueChange={(v) => setForm(f => ({ ...f, sub_category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select sub category" /></SelectTrigger>
                  <SelectContent>
                    {RAW_MATERIAL_SUBCATEGORIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.sub_category}
                  onChange={(e) => setForm(f => ({ ...f, sub_category: e.target.value }))}
                  placeholder="Optional"
                />
              )}
            </div>
            <div>
              <Label>Unit *</Label>
              <Select value={form.unit} onValueChange={(v) => setForm(f => ({ ...f, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default Rack</Label>
              <Select
                value={form.default_rack || NO_RACK}
                onValueChange={(v) => setForm(f => ({ ...f, default_rack: v === NO_RACK ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RACK}>None</SelectItem>
                  {racks.filter(r => r.is_active).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.rack_code} — {r.rack_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <Label className="m-0">Is Asset</Label>
              <Switch checked={form.is_asset} onCheckedChange={(v) => setForm(f => ({ ...f, is_asset: v }))} />
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <Label className="m-0">Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createItem.isPending || updateItem.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick add Rack */}
      <Dialog open={rackDialogOpen} onOpenChange={setRackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Rack</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rack Code *</Label>
              <Input value={rackForm.rack_code} onChange={(e) => setRackForm(f => ({ ...f, rack_code: e.target.value }))} />
            </div>
            <div>
              <Label>Rack Name *</Label>
              <Input value={rackForm.rack_name} onChange={(e) => setRackForm(f => ({ ...f, rack_name: e.target.value }))} />
            </div>
            <div>
              <Label>Area</Label>
              <Input value={rackForm.area} onChange={(e) => setRackForm(f => ({ ...f, area: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={rackForm.description} onChange={(e) => setRackForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRackDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitRack} disabled={createRack.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreItemMaster;
