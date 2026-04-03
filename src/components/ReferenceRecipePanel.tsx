import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { calculateNetWeight } from '@/lib/calculations';

interface ReferenceRecipePanelProps {
  defaultLotNo?: string;
}

const ReferenceRecipePanel: React.FC<ReferenceRecipePanelProps> = ({ defaultLotNo }) => {
  const { lots, getDyesForLot, masterItems } = useApp();
  const [selectedLot, setSelectedLot] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const approvedLots = useMemo(() =>
    lots.filter(l => l.status === 'Approved').sort((a, b) =>
      b.lot_no.localeCompare(a.lot_no, undefined, { numeric: true })
    ), [lots]);

  const filtered = useMemo(() => {
    if (!search.trim()) return approvedLots;
    const q = search.toLowerCase();
    return approvedLots.filter(l =>
      l.lot_no.toLowerCase().includes(q) ||
      (l.color_name || '').toLowerCase().includes(q) ||
      (l.shade_number || '').toLowerCase().includes(q)
    );
  }, [approvedLots, search]);

  const lot = useMemo(() => lots.find(l => l.lot_no === selectedLot), [lots, selectedLot]);
  const dyes = useMemo(() => selectedLot ? getDyesForLot(selectedLot) : [], [selectedLot, getDyesForLot]);

  const dyeDisplay = useMemo(() =>
    dyes.map(d => {
      const item = masterItems.find(m => m.id === d.dye_id);
      const shortName = item?.short_name || '';
      const name = item?.name || d.dye_id;
      return { label: shortName ? `${shortName} (${name})` : name, percentage: d.percentage };
    }).sort((a, b) => a.label.localeCompare(b.label)),
    [dyes, masterItems]
  );

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const netWeight = lot ? calculateNetWeight(lot.gross_weight, lot.number_of_chesses) : 0;

  return (
    <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Reference Recipe
      </h3>

      {/* Searchable dropdown */}
      <div ref={wrapperRef} className="relative max-w-xs">
        <input
          type="text"
          value={selectedLot ? `${selectedLot}${lot?.color_name ? ` — ${lot.color_name}` : ''}` : search}
          onChange={e => { setSearch(e.target.value); setSelectedLot(''); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="input-industrial w-full text-sm"
          placeholder="Search by lot no, shade, or color…"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
            {filtered.map(l => (
              <button
                key={l.lot_no}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setSelectedLot(l.lot_no); setSearch(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition"
              >
                <span className="font-medium">{l.lot_no}</span>
                <span className="text-muted-foreground ml-2">
                  {l.color_name || 'No Color'} · Shade {l.shade_number}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lot details + dyes */}
      {lot && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div><span className="text-muted-foreground">Lot No:</span> <span className="font-medium">{lot.lot_no}</span></div>
            <div><span className="text-muted-foreground">Color:</span> <span className="font-medium">{lot.color_name}</span></div>
            <div><span className="text-muted-foreground">Shade:</span> <span className="font-medium">{lot.shade_number}</span></div>
            <div><span className="text-muted-foreground">Net Wt:</span> <span className="font-medium font-data">{netWeight.toFixed(3)} kg</span></div>
            <div><span className="text-muted-foreground">Chesses:</span> <span className="font-medium font-data">{lot.number_of_chesses}</span></div>
          </div>

          {dyeDisplay.length > 0 ? (
            <div className="rounded border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left px-3 py-1.5 font-medium">Dye</th>
                    <th className="text-right px-3 py-1.5 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {dyeDisplay.map((d, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-1.5">{d.label}</td>
                      <td className="px-3 py-1.5 text-right font-data">{d.percentage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No dyes in this lot's recipe.</p>
          )}
        </div>
      )}

      {!lot && !search && (
        <p className="text-xs text-muted-foreground">Select a lot to view its recipe as reference.</p>
      )}
    </div>
  );
};

export default ReferenceRecipePanel;
