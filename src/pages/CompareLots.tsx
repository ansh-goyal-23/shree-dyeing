import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';
import { Search, X, GitCompare, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MAX_LOTS = 5;

const CompareLots: React.FC = () => {
  const { lots, masterItems, getDyesForLot } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const dyeName = (id: string) => {
    const m = masterItems.find(i => i.id === id);
    return m?.short_name?.trim() || m?.name || '—';
  };

  const matchingLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? lots.filter(l =>
          l.lot_no.toLowerCase().includes(q) ||
          l.shade_number.toLowerCase().includes(q) ||
          l.color_name.toLowerCase().includes(q),
        )
      : lots;
    return list.slice(0, 50);
  }, [lots, search]);

  const selectedLots = useMemo(
    () => selected.map(no => lots.find(l => l.lot_no === no)).filter(Boolean) as typeof lots,
    [selected, lots],
  );

  const toggleLot = (lotNo: string) => {
    setSelected(prev => {
      if (prev.includes(lotNo)) return prev.filter(l => l !== lotNo);
      if (prev.length >= MAX_LOTS) return prev;
      return [...prev, lotNo];
    });
  };

  // Build unified dye list (union of all dye_ids across selected lots), sorted by short name
  const unifiedDyes = useMemo(() => {
    const ids = new Set<string>();
    selectedLots.forEach(l => getDyesForLot(l.lot_no).forEach(d => ids.add(d.dye_id)));
    return Array.from(ids).sort((a, b) => dyeName(a).localeCompare(dyeName(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLots, masterItems]);

  // Per-lot dye map: lot_no -> dye_id -> percentage
  const lotDyeMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    selectedLots.forEach(l => {
      const m: Record<string, number> = {};
      getDyesForLot(l.lot_no).forEach(d => { m[d.dye_id] = d.percentage; });
      map[l.lot_no] = m;
    });
    return map;
  }, [selectedLots, getDyesForLot]);

  // Field-level diff helper
  const allDiffer = (vals: (string | number | null | undefined)[]) => {
    if (vals.length < 2) return false;
    const norm = vals.map(v => (v == null ? '' : String(v)));
    return new Set(norm).size > 1;
  };

  const fieldRows: { label: string; get: (l: typeof lots[number]) => React.ReactNode; raw: (l: typeof lots[number]) => string | number }[] = [
    { label: 'Date', get: l => l.date, raw: l => l.date },
    { label: 'Shade #', get: l => l.shade_number, raw: l => l.shade_number },
    { label: 'Color', get: l => l.color_name || '—', raw: l => l.color_name || '' },
    { label: 'Yarn Company', get: l => l.yarn_company_name, raw: l => l.yarn_company_name },
    { label: 'Denier', get: l => l.denier || '—', raw: l => l.denier || '' },
    { label: 'Chesses', get: l => l.number_of_chesses, raw: l => l.number_of_chesses },
    { label: 'Gross Wt (kg)', get: l => l.gross_weight.toFixed(3), raw: l => l.gross_weight },
    { label: 'Net Wt (kg)', get: l => l.net_weight.toFixed(3), raw: l => l.net_weight },
    { label: 'Status', get: l => <Badge variant="outline">{l.status}</Badge>, raw: l => l.status },
    { label: 'Source Lot', get: l => l.source_lot_no || '—', raw: l => l.source_lot_no || '' },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitCompare className="h-6 w-6" /> Compare Lots
          </h1>
          <p className="text-sm text-muted-foreground">Select up to {MAX_LOTS} lots to compare side-by-side.</p>
        </div>
        {selected.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setSelected([])}>
            <X className="mr-1 h-4 w-4" /> Clear all
          </Button>
        )}
      </div>

      {/* Selector */}
      <div className="flex flex-wrap items-start gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" disabled={selected.length >= MAX_LOTS}>
              <Search className="mr-2 h-4 w-4" />
              {selected.length >= MAX_LOTS ? `Max ${MAX_LOTS} reached` : 'Add lot to compare'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="start">
            <div className="p-2 border-b">
              <Input
                placeholder="Search lot no, shade no, color..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {matchingLots.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No lots found.</div>
              ) : (
                matchingLots.map(l => {
                  const isSel = selected.includes(l.lot_no);
                  const disabled = !isSel && selected.length >= MAX_LOTS;
                  return (
                    <button
                      key={l.lot_no}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleLot(l.lot_no)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm border-b last:border-b-0 flex items-center justify-between gap-2',
                        isSel ? 'bg-primary/10' : 'hover:bg-muted',
                        disabled && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{l.lot_no} {l.shade_number !== l.lot_no && <span className="text-muted-foreground">· {l.shade_number}</span>}</div>
                        <div className="text-xs text-muted-foreground truncate">{l.color_name || '—'} · {l.yarn_company_name}</div>
                      </div>
                      {isSel && <Badge variant="default" className="shrink-0">Selected</Badge>}
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        {selected.map(no => {
          const l = lots.find(x => x.lot_no === no);
          if (!l) return null;
          return (
            <Badge key={no} variant="secondary" className="text-sm py-1 pl-2 pr-1 gap-1">
              {l.lot_no}
              <button
                type="button"
                onClick={() => toggleLot(no)}
                className="ml-1 rounded hover:bg-background/60 p-0.5"
                aria-label={`Remove ${l.lot_no}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>

      {selectedLots.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Add at least one lot to start comparing.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-muted/80 backdrop-blur text-left font-semibold px-3 py-2 border-b border-r min-w-[180px]"
                  >
                    Field
                  </th>
                  {selectedLots.map(l => (
                    <th key={l.lot_no} className="text-left font-semibold px-3 py-2 border-b border-r min-w-[180px]">
                      <div className="flex items-center gap-1">
                        <Link to={`/shade-management/lots/${encodeURIComponent(l.lot_no)}`} className="hover:underline text-primary">
                          {l.lot_no}
                        </Link>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="text-xs font-normal text-muted-foreground">{l.color_name || '—'}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Lot detail rows */}
                {fieldRows.map(row => {
                  const diff = allDiffer(selectedLots.map(l => row.raw(l)));
                  return (
                    <tr key={row.label} className="border-b">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 border-r font-medium">{row.label}</td>
                      {selectedLots.map(l => (
                        <td
                          key={l.lot_no}
                          className={cn('px-3 py-2 border-r', diff && 'bg-amber-500/10 dark:bg-amber-400/10')}
                        >
                          {row.get(l)}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* Recipe section header */}
                <tr className="bg-muted/40">
                  <td
                    className="sticky left-0 z-10 bg-muted/60 px-3 py-2 border-r border-b font-semibold uppercase text-xs tracking-wide"
                    colSpan={1}
                  >
                    Dye Recipe
                  </td>
                  <td className="px-3 py-2 border-b text-xs text-muted-foreground" colSpan={selectedLots.length}>
                    {unifiedDyes.length} unique dye{unifiedDyes.length === 1 ? '' : 's'} across selected lots · differences highlighted
                  </td>
                </tr>

                {unifiedDyes.length === 0 ? (
                  <tr>
                    <td className="sticky left-0 z-10 bg-card px-3 py-3 border-r text-muted-foreground" colSpan={1}>
                      No dyes
                    </td>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={selectedLots.length}>
                      No dye recipe found in selected lots.
                    </td>
                  </tr>
                ) : (
                  unifiedDyes.map(dyeId => {
                    const vals = selectedLots.map(l => lotDyeMap[l.lot_no]?.[dyeId]);
                    const present = vals.map(v => (v == null ? '__absent__' : v.toString()));
                    const diff = new Set(present).size > 1;
                    return (
                      <tr key={dyeId} className="border-b">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 border-r font-medium">
                          {dyeName(dyeId)}
                        </td>
                        {selectedLots.map((l, idx) => {
                          const v = vals[idx];
                          const absent = v == null;
                          return (
                            <td
                              key={l.lot_no}
                              className={cn(
                                'px-3 py-2 border-r tabular-nums',
                                diff && !absent && 'bg-amber-500/10 dark:bg-amber-400/10',
                                absent && 'bg-destructive/5 text-muted-foreground italic',
                              )}
                            >
                              {absent ? '—' : `${Number(v).toFixed(3)}%`}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompareLots;
