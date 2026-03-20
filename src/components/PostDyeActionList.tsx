import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Beaker, Droplets, Layers } from 'lucide-react';
import { calculateDyeGrams } from '@/lib/calculations';
import type { PostDyeAction, PostDyeActionDye, PostDyeActionChemical, MasterItem } from '@/types';

interface Props {
  actions: PostDyeAction[];
  actionDyes: PostDyeActionDye[];
  actionChemicals: PostDyeActionChemical[];
  masterItems: MasterItem[];
  netWeight: number;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'Color Addition': <Droplets className="w-4 h-4 text-blue-500" />,
  'RC': <Beaker className="w-4 h-4 text-orange-500" />,
  'Leveling': <Layers className="w-4 h-4 text-emerald-500" />,
};

const PostDyeActionList: React.FC<Props> = ({ actions, actionDyes, actionChemicals, masterItems, netWeight }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No post-dye actions recorded.</p>;
  }

  const getDyesForAction = (actionId: string) => actionDyes.filter(d => d.action_id === actionId);
  const getChemsForAction = (actionId: string) => actionChemicals.filter(c => c.action_id === actionId);
  const getName = (id: string) => masterItems.find(m => m.id === id)?.name || '—';
  const getUnit = (id: string) => masterItems.find(m => m.id === id)?.unit || '—';

  return (
    <div className="divide-y divide-border">
      {actions.map(action => {
        const isOpen = expandedId === action.id;
        const dyes = getDyesForAction(action.id);
        const chems = getChemsForAction(action.id);
        const summary = [
          dyes.length > 0 ? `${dyes.length} dye${dyes.length > 1 ? 's' : ''}` : null,
          chems.length > 0 ? `${chems.length} chemical${chems.length > 1 ? 's' : ''}` : null,
        ].filter(Boolean).join(', ') || 'Empty';

        return (
          <div key={action.id}>
            <button
              onClick={() => setExpandedId(isOpen ? null : action.id)}
              className="w-full flex items-center gap-3 py-3 px-2 hover:bg-secondary/30 rounded btn-transition text-left"
            >
              {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              {ACTION_ICONS[action.action_type]}
              <span className="font-medium text-sm flex-1">{action.action_type}</span>
              <span className="text-xs text-muted-foreground">{summary}</span>
              <span className="text-xs text-muted-foreground font-data">
                {new Date(action.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
              </span>
            </button>

            {isOpen && (
              <div className="pl-10 pr-2 pb-4 space-y-4">
                {action.description && (
                  <p className="text-sm text-muted-foreground italic">"{action.description}"</p>
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PostDyeActionList;
