import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Beaker, Droplets, Layers, Pencil, Trash2 } from 'lucide-react';
import { calculateDyeGrams } from '@/lib/calculations';
import LotPhotos from '@/components/LotPhotos';
import ProcessStepForm from '@/components/ProcessStepForm';
import type { ProcessStep, StepDye, StepChemical, MasterItem, ProcessStepType } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Props {
  steps: ProcessStep[];
  stepDyes: StepDye[];
  stepChemicals: StepChemical[];
  masterItems: MasterItem[];
  netWeight: number;
  lotNo: string;
  onUpdateStep?: (stepId: string, data: {
    step_type: ProcessStepType;
    description: string;
    dyes: Omit<StepDye, 'id' | 'step_id'>[];
    chemicals: Omit<StepChemical, 'id' | 'step_id'>[];
  }) => Promise<void>;
  onDeleteStep?: (stepId: string) => Promise<void>;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  'Color Addition': <Droplets className="w-4 h-4 text-blue-500" />,
  'RC': <Beaker className="w-4 h-4 text-orange-500" />,
  'Leveling': <Layers className="w-4 h-4 text-emerald-500" />,
};

const ProcessStepList: React.FC<Props> = ({ steps, stepDyes, stepChemicals, masterItems, netWeight, lotNo, onUpdateStep, onDeleteStep }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No process steps recorded yet.</p>;
  }

  const getDyesForStep = (stepId: string) => stepDyes.filter(d => d.step_id === stepId);
  const getChemsForStep = (stepId: string) => stepChemicals.filter(c => c.step_id === stepId);
  const getName = (id: string) => masterItems.find(m => m.id === id)?.name || '—';
  const getUnit = (id: string) => masterItems.find(m => m.id === id)?.unit || '—';

  return (
    <div className="space-y-1">
      {steps.map((step) => {
        const isOpen = expandedId === step.id;
        const isEditing = editingStepId === step.id;
        const dyes = getDyesForStep(step.id);
        const chems = getChemsForStep(step.id);
        const summary = [
          dyes.length > 0 ? `${dyes.length} dye${dyes.length > 1 ? 's' : ''}` : null,
          chems.length > 0 ? `${chems.length} chemical${chems.length > 1 ? 's' : ''}` : null,
        ].filter(Boolean).join(', ') || 'Empty';

        if (isEditing && onUpdateStep) {
          return (
            <ProcessStepForm
              key={step.id}
              netWeight={netWeight}
              masterItems={masterItems}
              editingData={{
                step_type: step.step_type as ProcessStepType,
                description: step.description,
                dyes: dyes.map(d => ({ dye_id: d.dye_id, percentage: d.percentage, qty_grams: d.qty_grams })),
                chemicals: chems.map(c => ({ chemical_id: c.chemical_id, qty: c.qty })),
              }}
              onSubmit={async (data) => {
                await onUpdateStep(step.id, data);
                toast.success('Step updated.');
                setEditingStepId(null);
              }}
              onCancel={() => setEditingStepId(null)}
            />
          );
        }

        return (
          <div key={step.id} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(isOpen ? null : step.id)}
              className="w-full flex items-center gap-3 py-3 px-4 hover:bg-secondary/30 btn-transition text-left"
            >
              {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                {step.step_number}
              </span>
              {STEP_ICONS[step.step_type]}
              <span className="font-medium text-sm flex-1">{step.step_type}</span>
              <span className="text-xs text-muted-foreground">{summary}</span>
              <span className="text-xs text-muted-foreground font-data">
                {new Date(step.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border">
                {/* Edit / Delete actions */}
                <div className="flex gap-2 justify-end">
                  {onUpdateStep && (
                    <button
                      onClick={() => setEditingStepId(step.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-input rounded-md hover:bg-secondary btn-transition"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {onDeleteStep && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-destructive text-destructive rounded-md hover:bg-destructive/10 btn-transition">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Step {step.step_number}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this {step.step_type} step and all its dyes/chemicals data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                              await onDeleteStep(step.id);
                              toast.success('Step deleted.');
                              setExpandedId(null);
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {step.description && (
                  <p className="text-sm text-muted-foreground italic">"{step.description}"</p>
                )}

                {dyes.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Dyes Added</h5>
                    <div className="space-y-1">
                      <div className="grid grid-cols-[1fr_80px_100px] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>Dye</span><span>%</span><span>Grams</span>
                      </div>
                      {dyes.map(d => (
                        <div key={d.id} className="grid grid-cols-[1fr_80px_100px] gap-2 text-sm items-center px-1">
                          <span>{getName(d.dye_id)}</span>
                          <span className="font-data">{d.percentage}</span>
                          <span className="font-data font-semibold">{d.qty_grams.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {chems.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Chemicals Used</h5>
                    <div className="space-y-1">
                      <div className="grid grid-cols-[1fr_100px_60px] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>Chemical</span><span>Qty</span><span>Unit</span>
                      </div>
                      {chems.map(c => (
                        <div key={c.id} className="grid grid-cols-[1fr_100px_60px] gap-2 text-sm items-center px-1">
                          <span>{getName(c.chemical_id)}</span>
                          <span className="font-data">{c.qty}</span>
                          <span className="text-muted-foreground">{getUnit(c.chemical_id)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step Photos */}
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Step Photos</h5>
                  <LotPhotos lotNo={lotNo} stepId={step.id} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProcessStepList;
