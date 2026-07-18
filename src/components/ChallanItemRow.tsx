import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import DecimalInput from '@/components/DecimalInput';
import type { Lot } from '@/types';
import type { PackagingType } from '@/types/challan';
import type { StoreEDYCurrentStockRow } from '@/types/store';
import { lookupRate, type ClientRate } from '@/hooks/useClientRates';

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
}

interface ChallanItemRowProps {
  index: number;
  item: ItemData;
  lots: Lot[];
  edyStock?: StoreEDYCurrentStockRow[]; // kept for API compatibility; unused
  clientId: string;
  clientRates: ClientRate[];
  onChange: (index: number, updated: ItemData) => void;
  onRemove: (index: number) => void;
}

type LotOption = { lot_no: string; label: string; sub: string };

export const PortalDropdown: React.FC<{
  anchor: HTMLElement | null;
  open: boolean;
  children: React.ReactNode;
}> = ({ anchor, open, children }) => {
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(target)) {
        // Also ignore clicks inside the portal by checking if target is inside popover
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

  return (
    <div ref={wrapRef} className="relative">
      <input ref={inputRef} type="text" value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="input-industrial w-full text-sm" placeholder="Search lot..." />
      <PortalDropdown anchor={inputRef.current} open={open && filtered.length > 0}>
        <div data-lot-portal="1">
          {filtered.map(o => (
            <button key={o.lot_no} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(o); setSearch(o.label); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition">
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

const ChallanItemRow: React.FC<ChallanItemRowProps> = ({ index, item, lots, clientId, clientRates, onChange, onRemove }) => {
  const resolveRate = (denier: string, lotType: LotType, currentRate: number) => {
    if (clientId && denier) {
      const found = lookupRate(clientRates, clientId, denier, lotType);
      if (found !== null) return found;
    }
    return currentRate;
  };

  const handleSelect = (opt: LotOption) => {
    const lot = lots.find(l => l.lot_no === opt.lot_no);
    const denier = lot?.denier || '';
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
    });
  };

  const handleField = (field: keyof ItemData, val: number) => {
    const updated = { ...item, [field]: val };
    if (field === 'gross_weight' || field === 'num_of_units') {
      const gw = field === 'gross_weight' ? val : item.gross_weight;
      const units = field === 'num_of_units' ? val : item.num_of_units;
      updated.net_weight = calcNet(gw, units, item.packaging_type);
      updated.amount = parseFloat((updated.net_weight * updated.rate).toFixed(2));
    }
    if (field === 'rate') {
      updated.amount = parseFloat((item.net_weight * val).toFixed(2));
    }
    onChange(index, updated);
  };

  const unitLabel = item.packaging_type === 'chesse' ? 'Chesses' : 'Tubes';

  return (
    <tr className="border-b border-border hover:bg-secondary/30">
      <td className="p-2">
        <LotSearchDropdown value={item.lot_no} lots={lots} onSelect={handleSelect} />
      </td>
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
      <td className="p-2">
        <DecimalInput step="0.01" value={item.rate} onValueChange={v => handleField('rate', v)}
          className="input-industrial w-24 text-sm" placeholder="0.00" />
      </td>
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
