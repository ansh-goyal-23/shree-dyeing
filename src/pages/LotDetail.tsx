import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import RecipeEditor, { type RecipeEditorHandle } from '@/components/RecipeEditor';
import { calculateNetWeight, calculateDyeGrams } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProcessStepForm from '@/components/ProcessStepForm';
import ProcessStepList from '@/components/ProcessStepList';
import LotPhotos from '@/components/LotPhotos';
import ReferenceRecipePanel from '@/components/ReferenceRecipePanel';
import { useOrdersForLot } from '@/hooks/useSampling';
import type { LotStatus } from '@/types';
import { Search, CheckCircle2, Clock, Plus, ArrowLeft, ShoppingCart, Trash2, Pencil, Save, X, MessageSquarePlus, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import InventoryApprovalDialog from '@/components/InventoryApprovalDialog';
import { useInventoryApproval } from '@/hooks/useInventoryApproval';
import { supabase } from '@/integrations/supabase/client';

const LotDetail: React.FC = () => {
  const { lotNo } = useParams<{ lotNo: string }>();
  const navigate = useNavigate();
  const {
    getLot, deleteLot, updateLotStatus, approveLot, unapproveLot, updateLot, masterItems,
    getLotsReferencingSource, addProcessStep, updateProcessStep, deleteProcessStep,
    getProcessStepsForLot, stepDyes, stepChemicals, getDyesForLot, getChemicalsForLot, refreshData,
  } = useApp();

  const inv = useInventoryApproval();

  const lot = getLot(lotNo || '');
  const [showStepForm, setShowStepForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    date: '', yarn_company_name: '', color_name: '', denier: '',
    number_of_chesses: 0, gross_weight: 0,
  });
  const [editingRemarks, setEditingRemarks] = useState(false);
  const [remarksDraft, setRemarksDraft] = useState('');
  const [savingRemarks, setSavingRemarks] = useState(false);

  const triggerLotInventory = useCallback(async (lotForInv = lot) => {
    if (!lotForInv) return;
    await refreshData();
    const [{ data: rd }, { data: rc }, { data: ps }] = await Promise.all([
      supabase.from('recipe_dyes').select('*').eq('lot_no', lotForInv.lot_no),
      supabase.from('recipe_chemicals').select('*').eq('lot_no', lotForInv.lot_no),
      supabase.from('process_steps').select('id').eq('lot_no', lotForInv.lot_no),
    ]);
    const stepIds = (ps || []).map((s: any) => s.id);
    let sd: any[] = []; let sc: any[] = [];
    if (stepIds.length) {
      const [{ data: sdd }, { data: scc }] = await Promise.all([
        supabase.from('step_dyes').select('*').in('step_id', stepIds),
        supabase.from('step_chemicals').select('*').in('step_id', stepIds),
      ]);
      sd = sdd || []; sc = scc || [];
    }
    const recipeDyes = (rd || []).map((r: any) => ({ id: r.id, lot_no: r.lot_no, dye_id: r.dye_id, percentage: Number(r.percentage)||0, qty_grams: Number(r.qty_grams)||0 }));
    const recipeChemicals = (rc || []).map((r: any) => ({ id: r.id, lot_no: r.lot_no, chemical_id: r.chemical_id, qty: Number(r.qty)||0, ph_value: r.ph_value!=null?Number(r.ph_value):null }));
    const stepDyesArr = sd.map((r: any) => ({ id: r.id, step_id: r.step_id, dye_id: r.dye_id, percentage: Number(r.percentage)||0, qty_grams: Number(r.qty_grams)||0 }));
    const stepChemArr = sc.map((r: any) => ({ id: r.id, step_id: r.step_id, chemical_id: r.chemical_id, qty: Number(r.qty)||0 }));
    const stepObjs = (ps || []).map((s: any) => ({ id: s.id, lot_no: lotForInv.lot_no, step_number: 0, step_type: '' as any, description: '', created_at: '' }));

    await inv.openForLot({
      lot: lotForInv,
      recipeDyes,
      recipeChemicals,
      steps: stepObjs as any,
      stepDyes: stepDyesArr as any,
      stepChemicals: stepChemArr as any,
      masterItems,
    });
  }, [lot, refreshData, inv, masterItems]);

  if (!lot) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">Lot not found.</p>
        <button onClick={() => navigate('/shade-management/lots')} className="text-primary underline text-sm">Back to Lot List</button>
      </div>
    );
  }

  const startEditing = () => {
    setEditData({
      date: lot.date, yarn_company_name: lot.yarn_company_name,
      color_name: lot.color_name, denier: lot.denier,
      number_of_chesses: lot.number_of_chesses, gross_weight: lot.gross_weight,
    });
    setEditing(true);
  };


  const handleSaveEdit = async () => {
    const success = await updateLot(lot.lot_no, {
      date: editData.date,
      yarn_company_name: editData.yarn_company_name,
      color_name: editData.color_name,
      denier: editData.denier,
      number_of_chesses: editData.number_of_chesses,
      gross_weight: editData.gross_weight,
    });
    if (success) {
      toast.success('Lot details updated.');
      setEditing(false);
      // Re-fetch updated lot for inventory calc (gross/denier/company may have changed)
      const { data: updated } = await supabase.from('lots').select('*').eq('lot_no', lot.lot_no).single();
      if (updated) {
        const lotSnap = {
          ...lot,
          date: updated.date, yarn_company_name: updated.yarn_company_name,
          color_name: updated.color_name || '', denier: updated.denier || '',
          number_of_chesses: Number(updated.number_of_chesses)||0,
          gross_weight: Number(updated.gross_weight)||0,
          net_weight: Number(updated.net_weight)||0,
        };
        await triggerLotInventory(lotSnap as any);
      }
    } else {
      toast.error('Failed to update lot.');
    }
  };

  const referencingLots = getLotsReferencingSource(lot.lot_no);
  const processSteps = getProcessStepsForLot(lot.lot_no);

  const STATUS_CYCLE: LotStatus[] = ['In Approval', 'Approved', 'Production', 'Rejected'];
  const STATUS_VARIANT: Record<LotStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'Approved': 'default', 'Production': 'secondary', 'In Approval': 'outline', 'Rejected': 'destructive',
  };
  const handleToggleStatus = async () => {
    const idx = STATUS_CYCLE.indexOf(lot.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    await updateLotStatus(lot.lot_no, next);
    toast.success(`Lot ${lot.lot_no} → ${next}`);
  };

  const handleStepSubmit = async (data: Parameters<typeof addProcessStep>[1]) => {
    await addProcessStep(lot.lot_no, data);
    toast.success(`${data.step_type} step recorded.`);
    setShowStepForm(false);
    await triggerLotInventory();
  };

  const startEditingRemarks = () => {
    setRemarksDraft(lot.remarks || '');
    setEditingRemarks(true);
  };

  const handleSaveRemarks = async () => {
    setSavingRemarks(true);
    const success = await updateLot(lot.lot_no, { remarks: remarksDraft });
    setSavingRemarks(false);
    if (success) {
      toast.success('Remarks saved.');
      setEditingRemarks(false);
    } else {
      toast.error('Failed to save remarks.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/shade-management/lots')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground btn-transition">
        <ArrowLeft className="w-4 h-4" /> Back to Lot List
      </button>

      {/* Lot Header */}
      <div className="card-industrial p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-2xl font-bold">{lot.lot_no}</span>
            <Badge
              variant={STATUS_VARIANT[lot.status] || 'outline'}
              className="cursor-pointer select-none"
              onClick={handleToggleStatus}
            >
              {lot.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowStepForm(true)} className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Process Step
            </button>
            <button
              onClick={startEditingRemarks}
              className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring inline-flex items-center gap-2"
            >
              <MessageSquarePlus className="w-4 h-4" /> {lot.remarks ? 'Edit Remarks' : 'Add Remarks'}
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="px-4 h-11 border border-destructive text-destructive rounded-md text-sm font-medium btn-transition hover:bg-destructive/10 focus-ring inline-flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Lot {lot.lot_no}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this lot along with its recipe, process steps, and photos. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      await inv.openForLotDelete({
                        lot,
                        masterItems,
                        onAfterApprove: async () => {
                          const success = await deleteLot(lot.lot_no);
                          if (success) navigate('/shade-management/lots');
                          else throw new Error('Failed to delete lot');
                        },
                      });
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Lot Info */}
      <div className="card-industrial p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lot Details</h2>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} className="gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save
              </Button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="text-muted-foreground text-xs">Date</label>
              <Input type="date" value={editData.date} onChange={e => setEditData(p => ({ ...p, date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Yarn Company</label>
              <Input value={editData.yarn_company_name} onChange={e => setEditData(p => ({ ...p, yarn_company_name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Color</label>
              <Input value={editData.color_name} onChange={e => setEditData(p => ({ ...p, color_name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Denier</label>
              <Input value={editData.denier} onChange={e => setEditData(p => ({ ...p, denier: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Chesses</label>
              <Input type="number" value={editData.number_of_chesses} onChange={e => setEditData(p => ({ ...p, number_of_chesses: Number(e.target.value) || 0 }))} className="mt-1" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Gross Weight (kg)</label>
              <Input type="number" step="0.001" value={editData.gross_weight} onChange={e => setEditData(p => ({ ...p, gross_weight: Number(e.target.value) || 0 }))} className="mt-1" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Net Weight</label>
              <p className="font-data font-semibold mt-2 text-muted-foreground italic">Auto-calculated on save</p>
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Shade Number</label>
              <p className="font-data font-medium mt-2">{lot.shade_number}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Date</span><p className="font-data font-medium mt-0.5">{lot.date}</p></div>
            <div><span className="text-muted-foreground">Yarn Company</span><p className="font-medium mt-0.5">{lot.yarn_company_name}</p></div>
            <div><span className="text-muted-foreground">Color</span><p className="font-medium mt-0.5">{lot.color_name || '—'}</p></div>
            <div><span className="text-muted-foreground">Denier</span><p className="font-medium mt-0.5">{lot.denier || '—'}</p></div>
            <div><span className="text-muted-foreground">Chesses</span><p className="font-data font-medium mt-0.5">{lot.number_of_chesses}</p></div>
            <div><span className="text-muted-foreground">Gross Weight</span><p className="font-data font-medium mt-0.5">{lot.gross_weight.toFixed(3)} kg</p></div>
            <div><span className="text-muted-foreground">Net Weight</span><p className="font-data font-semibold mt-0.5">{lot.net_weight.toFixed(3)} kg</p></div>
            <div>
              <span className="text-muted-foreground">Shade Number</span>
              <p className="font-data font-medium mt-0.5">{lot.shade_number}</p>
            </div>
          </div>
        )}
      </div>

      {/* Process Step Form */}
      {showStepForm && (
        <ProcessStepForm
          netWeight={lot.net_weight}
          masterItems={masterItems}
          baseRecipeDyes={getDyesForLot(lot.lot_no).map(d => ({ dye_id: d.dye_id, percentage: d.percentage }))}
          baseRecipeChemicals={getChemicalsForLot(lot.lot_no).map(c => ({ chemical_id: c.chemical_id, qty: c.qty }))}
          onSubmit={handleStepSubmit}
          onCancel={() => setShowStepForm(false)}
        />
      )}

      {/* Reference Recipe Panel + Base Recipe (RecipeEditor receives staged data via ref) */}
      <RecipeEditorWithReference
        lotNo={lot.lot_no}
        netWeight={lot.net_weight}
        defaultReferenceLotNo={lot.shade_number !== lot.lot_no ? lot.shade_number : undefined}
        onRecipeSaved={() => triggerLotInventory()}
      />

      {/* Remarks (free-form notes for this lot) */}
      {(editingRemarks || lot.remarks) && (
        <div className="card-industrial p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <StickyNote className="w-4 h-4" /> Remarks
            </h2>
            {!editingRemarks ? (
              <Button variant="outline" size="sm" onClick={startEditingRemarks} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingRemarks(false)} disabled={savingRemarks} className="gap-1.5">
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSaveRemarks} disabled={savingRemarks} className="gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {savingRemarks ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </div>
          {editingRemarks ? (
            <Textarea
              value={remarksDraft}
              onChange={e => setRemarksDraft(e.target.value)}
              placeholder="Write any reference notes for this lot…"
              rows={4}
              autoFocus
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{lot.remarks}</p>
          )}
        </div>
      )}

      {/* Base Photos */}
      <div className="card-industrial p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Base Result Photos
        </h2>
        <LotPhotos lotNo={lot.lot_no} />
      </div>

      {/* Process Steps Timeline */}
      <div className="card-industrial p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Process Steps {processSteps.length > 0 && `(${processSteps.length})`}
        </h2>
        <ProcessStepList
          steps={processSteps}
          stepDyes={stepDyes}
          stepChemicals={stepChemicals}
          masterItems={masterItems}
          netWeight={lot.net_weight}
          lotNo={lot.lot_no}
          onUpdateStep={async (...args: Parameters<typeof updateProcessStep>) => { await updateProcessStep(...args); await triggerLotInventory(); }}
          onDeleteStep={async (...args: Parameters<typeof deleteProcessStep>) => { await deleteProcessStep(...args); await triggerLotInventory(); }}
        />
      </div>

      {/* Order History */}
      <OrderHistory lotNo={lot.lot_no} />

      {/* Referencing Lots */}
      {referencingLots.length > 0 && (
        <div className="card-industrial p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Lots Using This Shade ({referencingLots.length})
          </h2>
          <div className="divide-y divide-border">
            {referencingLots.map(rl => (
              <Link key={rl.lot_no} to={`/shade-management/lots/${rl.lot_no}`} className="flex items-center justify-between py-2 hover:bg-secondary/30 px-2 rounded btn-transition">
                <span className="font-data font-semibold text-sm">{rl.lot_no}</span>
                <span className="text-sm text-muted-foreground">{rl.yarn_company_name} • {rl.color_name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <InventoryApprovalDialog
        open={inv.open}
        rows={inv.rows}
        title={inv.title}
        busy={inv.busy}
        onApprove={inv.handleApprove}
        onCancel={inv.handleCancel}
      />
    </div>
  );
};

const statusColors: Record<string, string> = {
  Pending: 'bg-correction/10 text-correction',
  'In Development': 'bg-primary/10 text-primary',
  'In Production': 'bg-accent text-accent-foreground',
  Completed: 'bg-approved/10 text-approved',
  Cancelled: 'bg-destructive/10 text-destructive',
};

const OrderHistory: React.FC<{ lotNo: string }> = ({ lotNo }) => {
  const { data: orders = [] } = useOrdersForLot(lotNo);
  const activeOrders = orders.filter(o => o.status !== 'Cancelled');
  const totalQty = activeOrders.reduce((sum, o) => sum + (parseFloat(o.order_quantity) || 0), 0);

  if (orders.length === 0) return null;

  return (
    <div className="card-industrial p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Orders ({activeOrders.length})
        </h2>
        {totalQty > 0 && <span className="text-sm font-data font-semibold">Total: {totalQty}</span>}
      </div>
      <div className="divide-y divide-border">
        {orders.map(order => (
          <div key={order.id} className={`flex items-center justify-between py-2 px-2 ${order.status === 'Cancelled' ? 'opacity-50' : ''}`}>
            <div>
              <span className="text-sm font-medium">{order.client_name || 'Unknown'}</span>
              <div className="flex items-center gap-2 mt-0.5">
                {order.order_quantity && <span className="text-xs text-muted-foreground">Qty: {order.order_quantity}</span>}
                <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <Badge className={`text-[10px] ${statusColors[order.status] || ''}`}>{order.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Couples ReferenceRecipePanel with RecipeEditor so a selected reference
 * recipe is staged into the editor's local state (not persisted) until the
 * user clicks Save Recipe.
 */
const RecipeEditorWithReference: React.FC<{
  lotNo: string;
  netWeight: number;
  defaultReferenceLotNo?: string;
  onRecipeSaved?: () => void | Promise<void>;
}> = ({ lotNo, netWeight, defaultReferenceLotNo, onRecipeSaved }) => {
  const { getDyesForLot, getChemicalsForLot } = useApp();
  const editorRef = useRef<RecipeEditorHandle>(null);

  const existingDyes = getDyesForLot(lotNo);
  const existingChemicals = getChemicalsForLot(lotNo);
  const targetIsEmpty = useMemo(
    () => existingDyes.length === 0 && existingChemicals.every(c => !c.qty || c.qty === 0),
    [existingDyes, existingChemicals]
  );

  return (
    <>
      <ReferenceRecipePanel
        defaultLotNo={defaultReferenceLotNo}
        targetLotNo={lotNo}
        targetIsEmpty={targetIsEmpty}
        onApplyReference={(refDyes, refChems) => {
          editorRef.current?.applyReference(refDyes, refChems);
        }}
      />

      <div className="card-industrial p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Base Recipe (Initial Dyeing)
        </h2>
        <RecipeEditor ref={editorRef} lotNo={lotNo} netWeight={netWeight} onAfterSave={onRecipeSaved} />
      </div>
    </>
  );
};

export default LotDetail;
