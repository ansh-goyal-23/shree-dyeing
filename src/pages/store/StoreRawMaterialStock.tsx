import React, { useMemo, useState } from 'react';
import { useRawMaterials, useAddRawMaterial, useIssueRawMaterial } from '@/hooks/useRawMaterials';
import { RAW_MATERIAL_CATEGORIES, RAW_MATERIAL_FIELDS, type RawMaterial, type RawMaterialCategory } from '@/types/rawMaterial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, PackageMinus, Layers } from 'lucide-react';
import { toast } from 'sonner';

const emptyAddForm = { brand: '', supplier: '', spec_name: '', denier_count: '', unit: '', quantity: '', remarks: '' };

const StoreRawMaterialStock: React.FC = () => {
  const [tab, setTab] = useState<RawMaterialCategory>('grey_yarn');
  const { data: materials = [], isLoading } = useRawMaterials(tab);
  const addMaterial = useAddRawMaterial();
  const issueMaterial = useIssueRawMaterial();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);

  const [issueTarget, setIssueTarget] = useState<RawMaterial | null>(null);
  const [issueForm, setIssueForm] = useState({ issued_to: '', quantity: '', remarks: '' });

  const fields = RAW_MATERIAL_FIELDS[tab];

  const openAdd = () => {
    setAddForm({ ...emptyAddForm, unit: fields.defaultUnit });
    setAddOpen(true);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(addForm.quantity);
    if (!qty || qty <= 0) { toast.error('Enter a quantity greater than zero.'); return; }
    if (!addForm.unit.trim()) { toast.error('Unit is required.'); return; }
    if (fields.brand && !addForm.brand.trim()) { toast.error(`${fields.brand} is required.`); return; }
    if (fields.supplier && !addForm.supplier.trim()) { toast.error(`${fields.supplier} is required.`); return; }
    if (fields.spec_name && !addForm.spec_name.trim()) { toast.error(`${fields.spec_name} is required.`); return; }
    try {
      await addMaterial.mutateAsync({
        category: tab,
        brand: fields.brand ? addForm.brand.trim() : undefined,
        supplier: fields.supplier ? addForm.supplier.trim() : undefined,
        spec_name: fields.spec_name ? addForm.spec_name.trim() : undefined,
        denier_count: fields.denier_count ? addForm.denier_count.trim() : undefined,
        unit: addForm.unit.trim(),
        quantity: qty,
        remarks: addForm.remarks.trim() || undefined,
      });
      toast.success('Raw material added.');
      setAddOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add raw material.');
    }
  };

  const openIssue = (m: RawMaterial) => {
    setIssueForm({ issued_to: '', quantity: '', remarks: '' });
    setIssueTarget(m);
  };

  const submitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTarget) return;
    const qty = parseFloat(issueForm.quantity);
    if (!qty || qty <= 0) { toast.error('Enter a quantity greater than zero.'); return; }
    if (!issueForm.issued_to.trim()) { toast.error('Enter who this is being issued to.'); return; }
    try {
      await issueMaterial.mutateAsync({
        material: issueTarget,
        quantity: qty,
        issued_to: issueForm.issued_to,
        remarks: issueForm.remarks.trim() || undefined,
      });
      toast.success('Raw material issued.');
      setIssueTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue raw material.');
    }
  };

  const label = (m: RawMaterial, key: 'brand' | 'supplier' | 'spec_name' | 'denier_count') =>
    (m as any)[key] || '—';

  const fmtQty = (m: RawMaterial) => m.current_quantity.toFixed(m.unit === 'pcs' ? 0 : 3);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="h-6 w-6" /> Raw Material Stock
        </h1>
        <p className="text-muted-foreground text-sm">
          Manually tracked raw material stock. Current quantity is always the sum of every Add and Issue logged below —
          it's never edited directly. (A feature to auto-add stock from Expenses is planned.)
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as RawMaterialCategory)}>
        <TabsList>
          {RAW_MATERIAL_CATEGORIES.map(c => (
            <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
          ))}
        </TabsList>

        {RAW_MATERIAL_CATEGORIES.map(c => (
          <TabsContent key={c.value} value={c.value} className="space-y-4 mt-4">
            <div className="flex items-center justify-end">
              <Button onClick={openAdd}>
                <PlusCircle className="h-4 w-4 mr-1" /> Add {c.label}
              </Button>
            </div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fields.brand && <TableHead>{fields.brand}</TableHead>}
                    {fields.supplier && <TableHead>{fields.supplier}</TableHead>}
                    {fields.spec_name && <TableHead>{fields.spec_name}</TableHead>}
                    {fields.denier_count && <TableHead>{fields.denier_count}</TableHead>}
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell>
                    </TableRow>
                  ) : materials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No {c.label.toLowerCase()} added yet.
                      </TableCell>
                    </TableRow>
                  ) : materials.map(m => {
                    const qty = m.current_quantity;
                    return (
                      <TableRow key={m.id}>
                        {fields.brand && <TableCell>{label(m, 'brand')}</TableCell>}
                        {fields.supplier && <TableCell>{label(m, 'supplier')}</TableCell>}
                        {fields.spec_name && <TableCell>{label(m, 'spec_name')}</TableCell>}
                        {fields.denier_count && <TableCell>{label(m, 'denier_count')}</TableCell>}
                        <TableCell className={'text-right font-semibold ' + (qty <= 0 ? 'text-muted-foreground' : '')}>
                          {fmtQty(m)} <span className="text-xs text-muted-foreground">{m.unit}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" disabled={qty <= 0} onClick={() => openIssue(m)}>
                            <PackageMinus className="h-3.5 w-3.5 mr-1" /> Issue
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Raw Material dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {RAW_MATERIAL_CATEGORIES.find(c => c.value === tab)?.label}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAdd} className="space-y-3">
            {fields.brand && (
              <div>
                <Label>{fields.brand} *</Label>
                <Input value={addForm.brand} onChange={e => setAddForm(f => ({ ...f, brand: e.target.value }))} />
              </div>
            )}
            {fields.supplier && (
              <div>
                <Label>{fields.supplier} *</Label>
                <Input value={addForm.supplier} onChange={e => setAddForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
            )}
            {fields.spec_name && (
              <div>
                <Label>{fields.spec_name} *</Label>
                <Input value={addForm.spec_name} onChange={e => setAddForm(f => ({ ...f, spec_name: e.target.value }))} />
              </div>
            )}
            {fields.denier_count && (
              <div>
                <Label>{fields.denier_count}</Label>
                <Input value={addForm.denier_count} onChange={e => setAddForm(f => ({ ...f, denier_count: e.target.value }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity *</Label>
                <Input type="number" step="0.001" min="0" value={addForm.quantity}
                  onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label>Unit *</Label>
                <Input value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} placeholder="kg, ltr, pcs…" />
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea value={addForm.remarks} onChange={e => setAddForm(f => ({ ...f, remarks: e.target.value }))} rows={2} />
            </div>
            <p className="text-xs text-muted-foreground">
              If a matching {RAW_MATERIAL_CATEGORIES.find(c => c.value === tab)?.label.toLowerCase()} already exists
              (same {[fields.brand, fields.supplier, fields.spec_name, fields.denier_count].filter(Boolean).join(', ').toLowerCase()}),
              this adds to its existing stock instead of creating a duplicate.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addMaterial.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Issue dialog */}
      <Dialog open={!!issueTarget} onOpenChange={(open) => !open && setIssueTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Raw Material</DialogTitle>
          </DialogHeader>
          {issueTarget && (
            <form onSubmit={submitIssue} className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {[label(issueTarget, 'brand'), label(issueTarget, 'supplier'), label(issueTarget, 'spec_name'), label(issueTarget, 'denier_count')]
                  .filter(v => v !== '—').join(' / ')}
                {' — '}
                <span className="font-medium text-foreground">{fmtQty(issueTarget)} {issueTarget.unit}</span> in stock
              </div>
              <div>
                <Label>Issued To *</Label>
                <Input value={issueForm.issued_to} onChange={e => setIssueForm(f => ({ ...f, issued_to: e.target.value }))} placeholder="Person's name" />
              </div>
              <div>
                <Label>Quantity ({issueTarget.unit}) *</Label>
                <Input type="number" step="0.001" min="0" max={issueTarget.current_quantity}
                  value={issueForm.quantity} onChange={e => setIssueForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label>Remarks</Label>
                <Textarea value={issueForm.remarks} onChange={e => setIssueForm(f => ({ ...f, remarks: e.target.value }))} rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIssueTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={issueMaterial.isPending}>Issue</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreRawMaterialStock;
