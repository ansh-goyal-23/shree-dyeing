import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { BusinessEventRow, useBusinessEventsForEntity } from '@/hooks/useActivityCenter';
import SeverityBadge from './SeverityBadge';
import ModuleIcon from './ModuleIcon';

function entityToPath(et: string | null | undefined, eid: string | null | undefined, ref: string | null | undefined): string | null {
  if (!et) return null;
  const t = et.toLowerCase();
  if (t === 'lot' && ref) return `/shade-management/lots/${encodeURIComponent(ref)}`;
  if (t === 'lot' && eid) return `/shade-management/lots/${eid}`;
  if ((t === 'challan' || t === 'dispatch') && eid) return `/dispatch/${eid}`;
  if (t === 'intake' && eid) return `/sampling/${eid}`;
  if (t === 'expense') return `/expenses`;
  if (t === 'issue' && eid) return `/store/internal-issues/${eid}/edit`;
  if (t === 'inward') return `/store/stock-inward`;
  if (t === 'asset') return `/store/assets`;
  if (t === 'item' && eid) return `/store/timeline/${eid}`;
  if (t === 'finished_goods' && ref) return `/store/timeline?code=${encodeURIComponent('FG-' + ref)}`;
  if (t === 'external_dyed_yarn' && ref) return `/store/timeline?code=${encodeURIComponent('EDY-' + ref)}`;
  return null;
}

export const EventDrawer: React.FC<{ event: BusinessEventRow | null; onClose: () => void }> = ({ event, onClose }) => {
  const navigate = useNavigate();
  const open = !!event;

  const recordPath = useMemo(
    () => (event ? entityToPath(event.entity_type, event.entity_id, event.reference_number) : null),
    [event]
  );

  const timelineQuery = useBusinessEventsForEntity(event?.entity_type ?? null, event?.entity_id ?? null);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {event && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <ModuleIcon module={event.module} />
                <SheetTitle className="text-base">{event.summary}</SheetTitle>
              </div>
              <SheetDescription className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono">{event.event_type}</Badge>
                <SeverityBadge severity={event.severity} />
                <span>{format(new Date(event.event_timestamp), 'dd MMM yyyy, HH:mm:ss')}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground text-xs">User</div>
                  <div className="font-medium">{event.user_name || '—'}</div>
                  {event.user_role && <div className="text-xs text-muted-foreground">{event.user_role}</div>}
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Module</div>
                  <div className="font-medium capitalize">{event.module}</div>
                </div>
                {event.entity_type && (
                  <div>
                    <div className="text-muted-foreground text-xs">Entity</div>
                    <div className="font-medium">{event.entity_name || event.entity_id}</div>
                    <div className="text-xs text-muted-foreground capitalize">{event.entity_type}</div>
                  </div>
                )}
                {event.reference_number && (
                  <div>
                    <div className="text-muted-foreground text-xs">Reference</div>
                    <div className="font-mono">{event.reference_number}</div>
                  </div>
                )}
              </div>

              {event.change_summary && event.change_summary.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground text-xs mb-2">Business Changes</div>
                    <div className="space-y-1.5">
                      {event.change_summary.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-medium capitalize w-32 shrink-0">{c.field}</span>
                          <span className="text-muted-foreground line-through">{String(c.before ?? '—')}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{String(c.after ?? '—')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {event.details && Object.keys(event.details).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground text-xs mb-2">Details</div>
                    <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              {recordPath && (
                <Button onClick={() => { navigate(recordPath); onClose(); }} className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" /> Open Related Record
                </Button>
              )}

              {event.entity_type && event.entity_id && (
                <>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground text-xs mb-2">Entity Timeline</div>
                    {timelineQuery.isLoading ? (
                      <div className="text-xs text-muted-foreground">Loading…</div>
                    ) : (timelineQuery.data || []).length === 0 ? (
                      <div className="text-xs text-muted-foreground">No related events.</div>
                    ) : (
                      <ol className="relative border-l pl-4 space-y-3">
                        {(timelineQuery.data || []).map((e) => (
                          <li key={e.id} className="relative">
                            <span className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                            <div className="text-xs text-muted-foreground">{format(new Date(e.event_timestamp), 'dd MMM, HH:mm')}</div>
                            <div className="text-sm font-medium">{e.summary}</div>
                            <div className="text-xs text-muted-foreground">{e.user_name || '—'} · {e.event_type}</div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default EventDrawer;
