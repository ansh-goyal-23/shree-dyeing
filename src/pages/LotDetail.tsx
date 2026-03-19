import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import RecipeEditor from '@/components/RecipeEditor';
import ComparisonTable from '@/components/ComparisonTable';
import { CheckCircle2, Clock, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const LotDetail: React.FC = () => {
  const { lotNo } = useParams<{ lotNo: string }>();
  const navigate = useNavigate();
  const { getLot, getVersionsForLot, approveLot, unapproveLot, addVersion, masterItems, getLotsReferencingSource } = useApp();

  const lot = getLot(lotNo || '');
  const versions = getVersionsForLot(lotNo || '');
  const [activeVersionIdx, setActiveVersionIdx] = useState(versions.length - 1);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [reason, setReason] = useState('');

  if (!lot) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">Lot not found.</p>
        <button onClick={() => navigate('/lots')} className="text-primary underline text-sm">Back to Lot List</button>
      </div>
    );
  }

  const activeVersion = versions[activeVersionIdx];
  const referencingLots = getLotsReferencingSource(lot.lot_no);

  const handleApprove = () => {
    approveLot(lot.lot_no);
    toast.success(`Lot ${lot.lot_no} approved.`);
  };

  const handleUnapprove = () => {
    unapproveLot(lot.lot_no);
    toast.info(`Lot ${lot.lot_no} un-approved.`);
  };

  const handleCreateVersion = async () => {
    if (!reason.trim()) { toast.error('Reason for change is required.'); return; }
    const v = await addVersion(lot.lot_no, reason.trim());
    if (v) {
      toast.success(`Version ${v.version_code} created.`);
      setShowNewVersion(false);
      setReason('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/lots')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground btn-transition">
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
          <div className="flex items-center gap-2">
            {lot.is_approved ? (
              <button
                onClick={handleUnapprove}
                className="px-4 h-11 border border-correction text-correction rounded-md text-sm font-medium btn-transition hover:bg-correction/10 focus-ring"
              >
                Un-approve
              </button>
            ) : (
              <button
                onClick={handleApprove}
                className="px-4 h-11 bg-approved text-approved-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring"
              >
                Mark as Approved
              </button>
            )}
            <button
              onClick={() => setShowNewVersion(true)}
              className="px-4 h-11 border border-input rounded-md text-sm font-medium btn-transition hover:bg-secondary focus-ring inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Version
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
            <span className="text-muted-foreground">Source Lot</span>
            <p className="font-medium mt-0.5">
              {lot.source_lot_no ? (
                <Link to={`/lots/${lot.source_lot_no}`} className="font-data text-primary hover:underline">{lot.source_lot_no}</Link>
              ) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* New Version Dialog (inline) */}
      {showNewVersion && (
        <div className="card-industrial p-4 border-l-4 border-correction">
          <h3 className="text-sm font-semibold mb-3">Create New Version</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm text-muted-foreground">Reason for change</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="input-industrial w-full"
                placeholder="e.g. Color correction — added Blue 2G"
              />
            </div>
            <button onClick={handleCreateVersion} className="px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90">
              Create
            </button>
            <button onClick={() => { setShowNewVersion(false); setReason(''); }} className="px-4 h-11 border border-input rounded-md text-sm btn-transition hover:bg-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Version Timeline */}
      {versions.length > 0 && (
        <div className="card-industrial p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Versions</h2>
          <div className="flex items-center gap-1 flex-wrap">
            {versions.map((v, idx) => (
              <React.Fragment key={v.id}>
                {idx > 0 && <span className="text-muted-foreground mx-1">→</span>}
                <button
                  onClick={() => setActiveVersionIdx(idx)}
                  className={`px-3 py-1.5 rounded text-sm font-medium btn-transition ${
                    idx === activeVersionIdx
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  Version {v.version_code}
                  {v.version_code === 'A' ? ' (Original)' : ''}
                </button>
              </React.Fragment>
            ))}
          </div>
          {activeVersion && activeVersion.reason_for_change && (
            <p className="text-sm text-muted-foreground mt-2">
              <span className="font-medium">Reason:</span> {activeVersion.reason_for_change}
            </p>
          )}
        </div>
      )}

      {/* Recipe Editor */}
      {activeVersion && (
        <div className="card-industrial p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Recipe — Version {activeVersion.version_code}
          </h2>
          <RecipeEditor
            key={activeVersion.id}
            versionId={activeVersion.id}
            lotNo={lot.lot_no}
            netWeight={lot.net_weight}
            readOnly={activeVersionIdx < versions.length - 1}
          />
        </div>
      )}

      {/* Comparison Table */}
      {versions.length > 1 && (
        <div className="card-industrial p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Version Comparison</h2>
          <ComparisonTable versions={versions} lotNo={lot.lot_no} masterItems={masterItems} />
        </div>
      )}

      {/* Referencing Lots */}
      {referencingLots.length > 0 && (
        <div className="card-industrial p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Lots Using This Shade ({referencingLots.length})
          </h2>
          <div className="divide-y divide-border">
            {referencingLots.map(rl => (
              <Link
                key={rl.lot_no}
                to={`/lots/${rl.lot_no}`}
                className="flex items-center justify-between py-2 hover:bg-secondary/30 px-2 rounded btn-transition"
              >
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
