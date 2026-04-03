import React, { useState } from 'react';
import { useAllExpenseItems, useCreateExpenseItem, useUpdateExpenseItem, useExpenseCategories, useCreateExpenseCategory, useCompanies, useCreateCompany } from '@/hooks/useExpenses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Search, PlusCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { ExpenseItem } from '@/types/expense';

const UNITS = ['kg', 'gm', 'piece', 'liter', 'meter', 'set'];
const EXPENSE_TYPES = ['Purchase', 'Direct Expense', 'Asset'] as const;

const emptyForm = {
  item_name: '',
  category_id: '' as string,
  expense_type: 'Purchase' as string,
  unit: 'kg',
  item_type: 'Consumable' as 'Consumable' | 'Asset',
  is_active: true,
  company_id: '' as string,
};

const ItemMaster: React.FC = () => {
  const { data: items = [], isLoading } = useAllExpenseItems();
  const createItem = useCreateExpenseItem();
  const updateItem = useUpdateExpenseItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Category management
  const { data: categories = [] } = useExpenseCategories(form.expense_type || undefined);
  const createCategory = useCreateExpenseCategory();
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Company management
  const { data: companies = [] } = useCompanies();
  const createCompany = useCreateCompany();
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  const filtered = items.filter(item => {
    const matchSearch = item.item_name.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || item.expense_type === filterType;
    return matchSearch && matchType;
  });

  const openCreate = () => {
    setForm(emptyForm);
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEdit = (item: ExpenseItem) => {
    setForm({
      item_name: item.item_name,
      category_id: item.category_id || '',
      expense_type: item.expense_type || 'Purchase',
      unit: item.unit,
      item_type: item.item_type,
      is_active: item.is_active,
      company_id: item.company_id || '',
    });
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) { toast.error('Item name is required'); return; }
    try {
      const payload = {
        item_name: form.item_name.trim(),
        category_id: form.category_id || null,
        expense_type: form.expense_type,
        unit: form.unit,
        item_type: form.item_type,
        company_id: form.company_id || null,
      };
      if (editingItem) {
        await updateItem.mutateAsync({ ...payload, id: editingItem.id, is_active: form.is_active });
        toast.success('Item updated');
      } else {
        await createItem.mutateAsync(payload);
        toast.success('Item created');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(`Failed: ${e?.message || 'Unknown error'}`);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) { toast.error('Category name is required'); return; }
    try {
      const created = await createCategory.mutateAsync({ category_name: newCatName.trim(), expense_type: form.expense_type });
      setForm(f => ({ ...f, category_id: created.id }));
      setNewCatName('');
      setCatDialogOpen(false);
      setDialogOpen(true);
      toast.success('Category added');
    } catch (e: any) {
      toast.error(`Failed: ${e?.message || 'Unknown error'}`);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) { toast.error('Company name is required'); return; }
    try {
      const created = await createCompany.mutateAsync({ company_name: newCompanyName.trim() });
      setForm(f => ({ ...f, company_id: created.id }));
      setNewCompanyName('');
      setCompanyDialogOpen(false);
      setDialogOpen(true);
      toast.success('Company added');
    } catch (e: any) {
      toast.error(`Failed: ${e?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Item Master</h1>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No items found. Please add items first.</p>
          <Button onClick={openCreate} variant="outline"><PlusCircle className="w-4 h-4 mr-2" /> Add New Item</Button>
        </div>
      ) : (
        <div className="card-industrial overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expense Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item Type</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className="row-separator hover:bg-secondary/30 btn-transition">
                  <td className="px-4 py-3 font-medium">{item.item_name}</td>
                  <td className="px-4 py-3">{item.company_name || '—'}</td>
                  <td className="px-4 py-3">{item.category_name || '—'}</td>
                  <td className="px-4 py-3">{item.expense_type || '—'}</td>
                  <td className="px-4 py-3">{item.unit}</td>
                  <td className="px-4 py-3">{item.item_type}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={item.is_active ? 'default' : 'secondary'}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openEdit(item)} className="p-1 hover:bg-secondary rounded btn-transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item Name *</Label>
              <Input autoFocus value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} />
            </div>
            <div>
              <Label>Company</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={form.company_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, company_id: v === '__none__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => { setDialogOpen(false); setCompanyDialogOpen(true); }}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Expense Type</Label>
              <Select value={form.expense_type} onValueChange={v => setForm(f => ({ ...f, expense_type: v, category_id: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={form.category_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, category_id: v === '__none__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => { setDialogOpen(false); setCatDialogOpen(true); }}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Item Type</Label>
              <Select value={form.item_type} onValueChange={v => setForm(f => ({ ...f, item_type: v as 'Consumable' | 'Asset' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consumable">Consumable</SelectItem>
                  <SelectItem value="Asset">Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingItem && (
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
                <Label>Active</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={createItem.isPending || updateItem.isPending}>
              {editingItem ? 'Update' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={v => { setCatDialogOpen(v); if (!v) setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Category Name *</Label>
              <Input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }} />
            </div>
            <p className="text-sm text-muted-foreground">For expense type: <strong>{form.expense_type}</strong></p>
          </div>
          <DialogFooter>
            <Button onClick={handleAddCategory} disabled={createCategory.isPending}>Add Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={v => { setCompanyDialogOpen(v); if (!v) setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Company</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Company Name *</Label>
              <Input autoFocus value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddCompany(); }} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddCompany} disabled={createCompany.isPending}>Add Company</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemMaster;
