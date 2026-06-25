import React, { useMemo, useState } from 'react';
import {
  useAssets, useAssetItems, useStoreRacks, useCreateAsset,
  useIssueAsset, useReturnAsset, useAssetMovements,
} from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Wrench, Plus, Search, ArrowUpFromLine, ArrowDownToLine, History, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { StoreAssetView, StoreAssetStatus } from '@/types/store';

const NO_RACK = '__no_rack__';

const STATUS_VARIANT: Record<StoreAssetStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  available: 'default',
  issued: 'secondary',
  repair: 'outline',
  scrap: 'destructive',
};

const STATUS_LABEL: Record<StoreAssetStatus, string> = {
  available: 'Available',
  issued: 'Issued',
  repair: 'Repair',
  scrap: 'Scrap',
};

const today = () => new Date().toISOString().slice(0, 10);

const AssetManagement: React.FC = () => {
  const navigate = useNavigate();
  const { data: assets = [], isLoading } = useAssets();
  const { data: assetItems = [] } = useAssetItems();
  const { data: racks = [] } = useStoreRacks();

  const createAsset = useCreateAsset();
  const issueAsset = useIssueAsset();
  const returnAsset = useReturnAsset();

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    asset_id: '',
    item_id: '',
    current_holder: '',
    department: '',
    rack_id: '',
    purchase_date: '',
    condition: 'Good',
    status: 'available' as StoreAssetStatus,
    remarks: '',
    add_stock: true,
  });

  // Issue dialog
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueTarget, setIssueTarget] = useState<StoreAssetView | null>(null);
  const [issueForm, setIssueForm] = useState({
    movement_date: today(),
    holder: '',
    department: '',
    rack_id: '',
    condition: '',
    remarks: '',
  });

  // Return dialog
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<StoreAssetView | null>(null);
  const [returnForm, setReturnForm] = useState({
    movement_date: today(),
    rack_id: '',
    condition: '',
    status_after: 'available' as StoreAssetStatus,
    remarks: '',
  });

  // History dialog
  const [historyTarget, setHistoryTarget] = useState<StoreAssetView | null>(null);
  const { data: history = [], isLoading: historyLoading } = useAssetMovements(historyTarget?.id);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        a.asset_id.toLowerCase().includes(needle) ||
        a.item_name.toLowerCase().includes(needle) ||
        a.item_code.toLowerCase().includes(needle) ||
        (a.current_holder || '').toLowerCase().includes(needle) ||
        (a.department || '').toLowerCase().includes(needle) ||
        (a.rack_code || '').toLowerCase().includes(needle)
      );
    });
  }, [assets, q, statusFilter]);

  const openCreate = () => {
    setForm({
      asset_id: '', item_id: '', current_holder: '', department: '',
      rack_id: '', purchase_date: '', condition: 'Good',
      status: 'available', remarks: '', add_stock: true,
    });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!form.item_id) { toast.error('Pick the Item (must be marked as Asset)'); return; }
    try {
      await createAsset.mutateAsync({
        asset_id: form.asset_id || null,
        item_id: form.item_id,
        current_holder: form.current_holder || null,
        department: form.department || null,
        rack_id: form.rack_id || null,
        purchase_date: form.purchase_date || null,
        condition: form.condition || null,
        status: form.status,
        remarks: form.remarks || null,
        add_stock: form.add_stock,
      });
      toast.success('Asset registered');
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create asset');
    }
  };

  const openIssue = (a: StoreAssetView) => {
    setIssueTarget(a);
    setIssueForm({
      movement_date: today(),
      holder: '',
      department: a.department || '',
      rack_id: a.rack_id || '',
      condition: a.condition || '',
      remarks: '',
    });
    setIssueOpen(true);
  };

  const submitIssue = async () => {
    if (!issueTarget) return;
    if (!issueForm.holder.trim()) { toast.error('Holder is required'); return; }
    try {
      await issueAsset.mutateAsync({
        asset: issueTarget,
        movement_date: issueForm.movement_date,
        holder: issueForm.holder.trim(),
        department: issueForm.department || null,
        rack_id: issueForm.rack_id || null,
        condition: issueForm.condition || null,
        remarks: issueForm.remarks || null,
      });
      toast.success(`Issued ${issueTarget.asset_id} to ${issueForm.holder}`);
      setIssueOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to issue');
    }
  };

  const openReturn = (a: StoreAssetView) => {
    setReturnTarget(a);
    setReturnForm({
      movement_date: today(),
      rack_id: a.rack_id || '',
      condition: '',
      status_after: 'available',
      remarks: '',
    });
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!returnTarget) return;
    try {
      await returnAsset.mutateAsync({
        asset: returnTarget,
        movement_date: returnForm.movement_date,
        rack_id: returnForm.rack_id || null,
        condition: returnForm.condition || null,
        status_after: returnForm.status_after,
        remarks: returnForm.remarks || null,
      });
      toast.success(`Returned ${returnTarget.asset_id}`);
      setReturnOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to return');
    }
  };

  const stats = useMemo(() => ({
    total: assets.length,
    available: assets.filter(a => a.status === 'available').length,
    issued: assets.filter(a => a.status === 'issued').length,
    repair: assets.filter(a => a.status === 'repair').length,
    scrap: assets.filter(a => a.status === 'scrap').length,
  }), [assets]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Asset Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Tools, machines and equipment marked as Asset in Item Master. Issue & return are tracked as stock transactions.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Register Asset
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {([
          ['Total', stats.total],
          ['Available', stats.available],
          ['Issued', stats.issued],
          ['Repair', stats.repair],
          ['Scrap', stats.scrap],
        ] as const).map(([label, val]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-bold">{val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search asset ID, item, holder, department, rack…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="repair">Repair</SelectItem>
            <SelectItem value="scrap">Scrap</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset ID</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Current Holder</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Rack</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                No assets registered yet. Mark items as <Badge variant="secondary">Asset</Badge> in Item Master, then click "Register Asset".
              </TableCell></TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.asset_id}</TableCell>
                <TableCell>
                  <div className="font-medium">{a.item_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{a.item_code}</div>
                </TableCell>
                <TableCell>{a.current_holder || '—'}</TableCell>
                <TableCell>{a.department || '—'}</TableCell>
                <TableCell>{a.rack_code ? `${a.rack_code} — ${a.rack_name}` : '—'}</TableCell>
                <TableCell>{a.purchase_date || '—'}</TableCell>
                <TableCell>{a.condition || '—'}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {a.status === 'available' && (
                    <Button size="sm" variant="outline" onClick={() => openIssue(a)}>
                      <ArrowUpFromLine className="h-3.5 w-3.5 mr-1" /> Issue
                    </Button>
                  )}
                  {a.status === 'issued' && (
                    <Button size="sm" variant="outline" onClick={() => openReturn(a)}>
                      <ArrowDownToLine className="h-3.5 w-3.5 mr-1" /> Return
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setHistoryTarget(a)}>
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Asset dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Register Asset</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Asset ID</Label>
              <Input
                value={form.asset_id}
                onChange={(e) => setForm(f => ({ ...f, asset_id: e.target.value }))}
                placeholder="Auto-generated if blank (AST-#####)"
              />
            </div>
            <div>
              <Label>Item *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm(f => ({ ...f, item_id: v }))}>
                <SelectTrigger><SelectValue placeholder={assetItems.length ? 'Select asset item' : 'No asset items — mark items as Asset first'} /></SelectTrigger>
                <SelectContent>
                  {assetItems.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.item_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Current Holder</Label>
              <Input value={form.current_holder} onChange={(e) => setForm(f => ({ ...f, current_holder: e.target.value }))} placeholder="(leave blank if Available in store)" />
            </div>
            <div>
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <Label>Rack</Label>
              <Select
                value={form.rack_id || NO_RACK}
                onValueChange={(v) => setForm(f => ({ ...f, rack_id: v === NO_RACK ? '' : v }))}
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
            <div>
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchase_date} onChange={(e) => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <Label>Condition</Label>
              <Input value={form.condition} onChange={(e) => setForm(f => ({ ...f, condition: e.target.value }))} placeholder="Good / Fair / Worn" />
            </div>
            <div>
              <Label>Initial Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as StoreAssetStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="scrap">Scrap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex items-center justify-between border rounded-md px-3 py-2">
              <Label className="m-0">Add +1 to stock for this asset</Label>
              <input
                type="checkbox"
                checked={form.add_stock}
                onChange={(e) => setForm(f => ({ ...f, add_stock: e.target.checked }))}
                className="h-4 w-4"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Remarks</Label>
              <Textarea rows={2} value={form.remarks} onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate} disabled={createAsset.isPending}>
              {createAsset.isPending ? 'Saving…' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue {issueTarget?.asset_id} — {issueTarget?.item_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={issueForm.movement_date} onChange={(e) => setIssueForm(f => ({ ...f, movement_date: e.target.value }))} />
            </div>
            <div>
              <Label>Issued To (Holder) *</Label>
              <Input value={issueForm.holder} onChange={(e) => setIssueForm(f => ({ ...f, holder: e.target.value }))} />
            </div>
            <div>
              <Label>Department</Label>
              <Input value={issueForm.department} onChange={(e) => setIssueForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <Label>Condition at Issue</Label>
              <Input value={issueForm.condition} onChange={(e) => setIssueForm(f => ({ ...f, condition: e.target.value }))} />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea rows={2} value={issueForm.remarks} onChange={(e) => setIssueForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button onClick={submitIssue} disabled={issueAsset.isPending}>
              {issueAsset.isPending ? 'Issuing…' : 'Issue Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return {returnTarget?.asset_id} — {returnTarget?.item_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Returning from: <span className="font-medium text-foreground">{returnTarget?.current_holder || '—'}</span>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={returnForm.movement_date} onChange={(e) => setReturnForm(f => ({ ...f, movement_date: e.target.value }))} />
            </div>
            <div>
              <Label>Rack on Return</Label>
              <Select
                value={returnForm.rack_id || NO_RACK}
                onValueChange={(v) => setReturnForm(f => ({ ...f, rack_id: v === NO_RACK ? '' : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RACK}>None</SelectItem>
                  {racks.filter(r => r.is_active).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.rack_code} — {r.rack_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition on Return</Label>
              <Input value={returnForm.condition} onChange={(e) => setReturnForm(f => ({ ...f, condition: e.target.value }))} placeholder="Good / Damaged / Worn" />
            </div>
            <div>
              <Label>New Status</Label>
              <Select value={returnForm.status_after} onValueChange={(v) => setReturnForm(f => ({ ...f, status_after: v as StoreAssetStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="repair">Send to Repair</SelectItem>
                  <SelectItem value="scrap">Scrap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea rows={2} value={returnForm.remarks} onChange={(e) => setReturnForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={submitReturn} disabled={returnAsset.isPending}>
              {returnAsset.isPending ? 'Returning…' : 'Return Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              History — {historyTarget?.asset_id} — {historyTarget?.item_name}
            </DialogTitle>
          </DialogHeader>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Current Holder: <span className="font-bold">{historyTarget?.current_holder || '—'}</span></CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Holder</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status After</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : history.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No movements yet.</TableCell></TableRow>
                  ) : history.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{m.movement_date}</TableCell>
                      <TableCell><Badge variant={m.movement_type === 'issue' ? 'secondary' : 'default'}>{m.movement_type}</Badge></TableCell>
                      <TableCell>{m.holder || '—'}</TableCell>
                      <TableCell>{m.department || '—'}</TableCell>
                      <TableCell>{m.condition || '—'}</TableCell>
                      <TableCell>{m.status_after ? STATUS_LABEL[m.status_after] : '—'}</TableCell>
                      <TableCell className="text-xs">{m.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetManagement;
