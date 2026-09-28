import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle } from 'lucide-react';
import DecimalInput from '@/components/DecimalInput';
import type { Lot } from '@/types';
import type { PackagingType } from '@/types/challan';
import type { StoreEDYCurrentStockRow } from '@/types/store';
import { lookupRate, lookupYarnCost, type ClientRate, type ClientYarnCost, type ClientRateTier } from '@/hooks/useClientRates';
import type { ClientRateMode } from '@/types/client';

export type LotType = 'Production' | 'Sampling';

export interface ItemData {
  lot_no: string;
  shade_number: string;
  color_name: string;
  denier: string;
  packaging_type: PackagingType;
  gross_weight: number;
  num_of_units: number;
  net_weight: number;
  rate: number;
  amount: number;
  lot_type: LotType;
  ref_no?: string;
  // Tiered-rate snapshot -- only meaningful when the client is rate_mode
  // 'tiered'. See src/types/challan.ts for the full explanation.
  yarn_cost?: number | null;
  overhead_rate?: number | null;
  rate_tier_label?: string | null;
  // Paper-tube cone surcharge -- auto-computed, never manually edited.
  paper_tube_surcharge?: number;
}

interface ChallanItemRowProps {
  index: number;
  item: ItemData;
  lots: Lot[];
  edyStock?: StoreEDYCurrentStockRow[]; // kept for API compatibility; unused
  clientId: string;
  clientRates: ClientRate[];
  // Tiered-rate system (2026-09-28). rateMode/yarnCosts/rateTiers describe
  // the SELECTED CLIENT, computed by the parent page from useClients() +
  // useClientYarnCosts()/useClientRateTiers(). hasSurcharge is true only
  // when the client has both paper-tube surcharge fields configured.
  rateMode?: ClientRateMode;
  yarnCosts?: ClientYarnCost[];
  rateTiers?: ClientRateTier[];
  paperTubeBaselineKgPerCone?: number | null;
  paperTubeExtraConeSurcharge?: number | null;
  hasSurcharge?: boolean;
  onChange: (index: number, updated: ItemData) => void;
  onRemove: (index: number) => void;
}

type LotOption = { lot_no: string; label: string; sub: string };

export const PortalDropdown: React.FC<{
  anchor: HTMLElement | null;
  open: boolean;
  children: React.ReactNode;
  contentRef?: React.RefObject<HTMLDivElement>;
}> = ({ anchor, open, children, contentRef }) => {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchor]);

  if (!open || !rect) return null;
  return createPortal(
    <div
      ref={contentRef}
      style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
      className="max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {children}
    </div>,
    document.body,
  );
};

const LotSearchDropdown: React.FC<{
  value: string;
  lots: Lot[];
  onSelect: (opt: LotOption) => void;
}> = ({ value, lots, onSelect }) => {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(target)) {
        const popover = (target as HTMLElement).closest?.('[data-lot-portal="1"]');
        if (!popover) setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const options: LotOption[] = useMemo(() =>
    [...lots]
      .sort((a, b) => (parseFloat(b.lot_no) || 0) - (parseFloat(a.lot_no) || 0))
      .map(l => ({
        lot_no: l.lot_no,
        label: l.lot_no,
        sub: `${l.color_name || ''}${l.shade_number ? ` · ${l.shade_number}` : ''}`,
      })),
    [lots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q) || o.sub.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => { setHighlight(0); }, [search, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight(h => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault();
        const opt = filtered[highlight];
        onSelect(opt);
        setSearch(opt.label);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input ref={inputRef} type="text" value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="input-industrial w-full text-sm" placeholder="Search lot..." />
      <PortalDropdown anchor={inputRef.current} open={open && filtered.length > 0} contentRef={listRef}>
        <div data-lot-portal="1">
          {filtered.map((o, idx) => (
            <button key={o.lot_no} type="button" data-idx={idx}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => { onSelect(o); setSearch(o.label); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm btn-transition ${idx === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`}>
              <span className="font-medium">{o.label}</span>
              {o.sub && <span className="text-muted-foreground ml-2 text-xs">{o.sub}</span>}
            </button>
          ))}
        </div>
      </PortalDropdown>
    </div>
  );
};


const DEDUCTION: Record<PackagingType, number> = {
  paper_tube: 0.12,
  chesse: 0.18,
};

const calcNet = (gross: number, units: number, type: PackagingType) =>
  parseFloat((gross - DEDUCTION[type] * units).toFixed(3));

const ChallanItemRow: React.FC<ChallanItemRowProps> = ({
  index, item, lots, clientId, clientRates, onChange, onRemove,
  rateMode = 'flat', yarnCosts = [], rateTiers = [],
  paperTubeBaselineKgPerCone = null, paperTubeExtraConeSurcharge = null, hasSurcharge = false,
}) => {
  const isTiered = rateMode === 'tiered';

  const resolveRate = (denier: string, lotType: LotType, currentRate: number) => {
    if (clientId && denier) {
      const found = lookupRate(clientRates, clientId, denier, lotType);
      if (found !== null) return found;
    }
    return currentRate;
  };

  // Paper-tube cone surcharge: baseline_cones = net_weight / baseline_kg_per_cone;
  // extra_cones = actual cones (num_of_units) above that baseline; surcharge =
  // extra_cones * per-cone charge. Only applies to paper_tube packaging, and
  // only when the client has both fields configured. Auto-computed -- never
  // manually chosen, unlike the tiered rate above (see Clients/Client-List.md).
  const computeSurcharge = (netWeight: number, numUnits: number, packaging: PackagingType) => {
    if (packaging !== 'paper_tube') return 0;
    if (!paperTubeBaselineKgPerCone || paperTubeExtraConeSurcharge == null) return 0;
    const baselineCones = netWeight / paperTubeBaselineKgPerCone;
    const extraCones = Math.max(0, numUnits - baselineCones);
    return parseFloat((extraCones * paperTubeExtraConeSurcharge).toFixed(2));
  };

  const yarnCostForDenier = clientId && item.denier
    ? lookupYarnCost(yarnCosts, clientId, item.denier)
    : null;

  const handleSelect = (opt: LotOption) => {
    const lot = lots.find(l => l.lot_no === opt.lot_no);
    const denier = lot?.denier || '';
    if (isTiered) {
      // Tiered clients: only the denier/lot fields update automatically.
      // The rate itself stays whatever tier was already picked (or 0 until
      // the challan maker picks one) -- never auto-looked-up.
      onChange(index, {
        ...item,
        lot_no: opt.lot_no,
        shade_number: lot?.shade_number || '',
        color_name: lot?.color_name || '',
        denier,
        ref_no: (lot as any)?.ref_no || '',
      });
      return;
    }
    const autoRate = resolveRate(denier, item.lot_type, item.rate);
    onChange(index, {
      ...item,
      lot_no: opt.lot_no,
      shade_number: lot?.shade_number || '',
      color_name: lot?.color_name || '',
      denier,
      ref_no: (lot as any)?.ref_no || '',
      rate: autoRate,
      amount: parseFloat((item.net_weight * autoRate).toFixed(2)),
    });
  };

  const handleLotTypeChange = (lotType: LotType) => {
    if (isTiered) {
      onChange(index, { ...item, lot_type: lotType });
      return;
    }
    const autoRate = resolveRate(item.denier, lotType, item.rate);
    onChange(index, {
      ...item,
      lot_type: lotType,
      rate: autoRate,
      amount: parseFloat((item.net_weight * autoRate).toFixed(2)),
    });
  };

  const handlePackagingChange = (type: PackagingType) => {
    const net = calcNet(item.gross_weight, item.num_of_units, type);
    onChange(index, {
      ...item,
      packaging_type: type,
      net_weight: net,
      amount: parseFloat((net * item.rate).toFixed(2)),
      paper_tube_surcharge: computeSurcharge(net, item.num_of_units, type),
    });
  };

  const handleField = (field: keyof ItemData, val: number) => {
    const updated = { ...item, [field]: val };
    if (field === 'gross_weight' || field === 'num_of_units') {
      const gw = field === 'gross_weight' ? val : item.gross_weight;
      const units = field === 'num_of_units' ? val : item.num_of_units;
      updated.net_weight = calcNet(gw, units, item.packaging_type);
      updated.amount = parseFloat((updated.net_weight * updated.rate).toFixed(2));
      updated.paper_tube_surcharge = computeSurcharge(updated.net_weight, units, item.packaging_type);
    }
    if (field === 'rate') {
      updated.amount = parseFloat((item.net_weight * val).toFixed(2));
    }
    onChange(index, updated);
  };

  const handleTierSelect = (tierId: string) => {
    const tier = rateTiers.find(t => t.id === tierId);
    if (!tier) {
      onChange(index, { ...item, rate_tier_label: null, overhead_rate: null, rate: 0, amount: 0 });
      return;
    }
    const yarnCost = yarnCostForDenier ?? 0;
    const rate = parseFloat((yarnCost + tier.overhead_rate).toFixed(2));
    onChange(index, {
      ...item,
      yarn_cost: yarnCostForDenier,
      overhead_rate: tier.overhead_rate,
      rate_tier_label: tier.label,
      rate,
      amount: parseFloat((item.net_weight * rate).toFixed(2)),
    });
  };

  const unitLabel = item.packaging_type === 'chesse' ? 'Chesses' : 'Tubes';
  const surcharge = item.paper_tube_surcharge || 0;
  const selectedTier = rateTiers.find(t => t.label === item.rate_tier_label);

  return (
    <tr className="border-b border-border hover:bg-secondary/30">
      <td className="p-2">
        <LotSearchDropdown value={item.lot_no} lots={lots} onSelect={handleSelect} />
      </td>
      <td className="p-2 text-sm text-muted-foreground">{item.ref_no || '—'}</td>
      <td className="p-2 text-sm text-muted-foreground">{item.shade_number}</td>
      <td className="p-2 text-sm text-muted-foreground">{item.color_name}</td>
      <td className="p-2 text-sm text-muted-foreground">{item.denier}</td>
      <td className="p-2">
        <select value={item.lot_type} onChange={e => handleLotTypeChange(e.target.value as LotType)} className="input-industrial w-full text-sm">
          <option value="Production">Production</option>
          <option value="Sampling">Sampling</option>
        </select>
      </td>
      <td className="p-2">
        <select value={item.packaging_type} onChange={e => handlePackagingChange(e.target.value as PackagingType)} className="input-industrial w-full text-sm">
          <option value="paper_tube">Paper Tube</option>
          <option value="chesse">Chesse</option>
        </select>
      </td>
      <td className="p-2">
        <DecimalInput step="0.001" value={item.gross_weight} onValueChange={v => handleField('gross_weight', v)}
          className="input-industrial w-24 text-sm" placeholder="0.000" />
      </td>
      <td className="p-2">
        <DecimalInput step="1" min={0} value={item.num_of_units} onValueChange={v => handleField('num_of_units', v)}
          className="input-industrial w-20 text-sm" placeholder={`# ${unitLabel}`} />
      </td>
      <td className="p-2 text-sm font-medium">{item.net_weight.toFixed(3)}</td>
      {isTiered && (
        <td className="p-2">
          <select value={selectedTier?.id || ''} onChange={e => handleTierSelect(e.target.value)} className="input-industrial w-full text-sm">
            <option value="">Select tier…</option>
            {[...rateTiers].sort((a, b) => a.sort_order - b.sort_order).map(t => (
              <option key={t.id} value={t.id}>{t.label} (₹{t.overhead_rate.toFixed(0)} ovhd)</option>
            ))}
          </select>
          {yarnCostForDenier === null && item.denier && (
            <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
              <AlertTriangle className="w-3 h-3" /> No yarn cost for {item.denier}
            </div>
          )}
        </td>
      )}
      <td className="p-2">
        {isTiered ? (
          <div className="text-sm font-medium w-24">₹{item.rate.toFixed(2)}</div>
        ) : (
          <DecimalInput step="0.01" value={item.rate} onValueChange={v => handleField('rate', v)}
            className="input-industrial w-24 text-sm" placeholder="0.00" />
        )}
      </td>
      {hasSurcharge && (
        <td className="p-2 text-sm text-muted-foreground">{surcharge > 0 ? `₹${surcharge.toFixed(2)}` : '—'}</td>
      )}
      <td className="p-2 text-sm font-medium">₹{item.amount.toFixed(2)}</td>
      <td className="p-2">
        <button type="button" onClick={() => onRemove(index)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded btn-transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

export default ChallanItemRow;
