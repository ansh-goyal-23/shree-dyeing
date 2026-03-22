import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import RecipeEditor from '@/components/RecipeEditor';
import ProcessStepForm from '@/components/ProcessStepForm';
import ProcessStepList from '@/components/ProcessStepList';
import LotPhotos from '@/components/LotPhotos';
import { CheckCircle2, Clock, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const LotDetail: React.FC = () => {
  const { lotNo } = useParams<{ lotNo: string }>();
  const navigate = useNavigate();
  const {
    getLot, approveLot, unapproveLot, masterItems,
    getLotsReferencingSource, addProcessStep, getProcessStepsForLot,
    stepDyes, stepChemicals,
  } = useApp();

  const lot = getLot(lotNo || '');
  const [showStepForm, setShowStepForm] = useState(false);

  if (!lot) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">Lot not found.</p>
        <button onClick={() => navigate('/shade-management/lots')} className="text-primary underline text-sm">Back to Lot List</button>
      </div>
    );
  }

  const referencingLots = getLotsReferencingSource(lot.lot_no);
  const processSteps = getProcessStepsForLot(lot.lot_no);

  const handleApprove = async () => {
    await approveLot(lot.lot_no);
    toast.success(`Lot ${lot.lot_no} approved.`);
  };

  const handleUnapprove = async () => {
    await unapproveLot(lot.lot_no);
    toast.info(`Lot ${lot.lot_no} un-approved.`);
  };

  const handleStepSubmit = async (data: Parameters<typeof addProcessStep>[1]) => {
    await addProcessStep(lot.lot_no, data);
    toast.success(`${data.step_type} step recorded.`);
    setShowStepForm(false);
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
            {lot.is_approved ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-approved/10 text-approved rounded">
                <CheckCircle2 className="w-3 h-3" /> Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-correction/10 text-correction rounded">
                <Clock className="w-3 h-3" /> Draft
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lot.is_approved ? (
              <button onClick={handleUnapprove} className="px-4 h-11 border border-correction text-correction rounded-md text-sm font-medium btn-transition hover:bg-correction/10 focus-ring">
                Un-approve
              </button>
            ) : (
              <button onClick={handleApprove} className="px-4 h-11 bg-approved text-approved-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
                Mark as Approved
              </button>
            )}
            <button onClick={() => setShowStepForm(true)} className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Process Step
            </button>
          </div>
        </div>
      </div>

      {/* Lot Info */}
      <div className="card-industrial p-4">
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
      </div>

      {/* Process Step Form */}
      {showStepForm && (
        <ProcessStepForm
          netWeight={lot.net_weight}
          masterItems={masterItems}
          onSubmit={handleStepSubmit}
          onCancel={() => setShowStepForm(false)}
        />
      )}

      {/* Base Recipe */}
      <div className="card-industrial p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Base Recipe (Initial Dyeing)
        </h2>
        <RecipeEditor lotNo={lot.lot_no} netWeight={lot.net_weight} />
      </div>

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
        />
      </div>

      {/* Referencing Lots */}
      {referencingLots.length > 0 && (
        <div className="card-industrial p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Lots Using This Shade ({referencingLots.length})
          </h2>
          <div className="divide-y divide-border">
            {referencingLots.map(rl => (
              <Link key={rl.lot_no} to={`/lots/${rl.lot_no}`} className="flex items-center justify-between py-2 hover:bg-secondary/30 px-2 rounded btn-transition">
                <span className="font-data font-semibold text-sm">{rl.lot_no}</span>
                <span className="text-sm text-muted-foreground">{rl.yarn_company_name} • {rl.color_name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LotDetail;
