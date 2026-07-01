import React, { useState, useRef, useEffect, useMemo } from 'react';
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
}

interface ChallanItemRowProps {
  index: number;
  item: ItemData;
  lots: Lot[];
  edyStock?: StoreEDYCurrentStockRow[];
  clientId: string;
  clientRates: ClientRate[];
  onChange: (index: number, updated: ItemData) => void;
  onRemove: (index: number) => void;
}

type LotOption =
  | { kind: 'production'; lot_no: string; label: string; sub: string }
  | { kind: 'edy'; lot_no: string; label: string; sub: string; edy: StoreEDYCurrentStockRow };

const LotSearchDropdown: React.FC<{
  value: string;
  lots: Lot[];
  edyStock: StoreEDYCurrentStockRow[];
  onSelect: (opt: LotOption) => void;
}> = ({ value, lots, edyStock, onSelect }) => {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const prodOptions: LotOption[] = useMemo(() =>
    [...lots]
      .sort((a, b) => (parseFloat(b.lot_no) || 0) - (parseFloat(a.lot_no) || 0))
      .map(l => ({
        kind: 'production' as const,
        lot_no: l.lot_no,
        label: l.lot_no,
        sub: `${l.color_name || ''}${l.shade_number ? ` · ${l.shade_number}` : ''}`,
      })),
    [lots]);

  const edyOptions: LotOption[] = useMemo(() =>
    edyStock
      .filter(e => Number(e.current_balance || 0) > 0)
      .map(e => ({
        kind: 'edy' as const,
        lot_no: e.receipt_number,
        label: e.receipt_number,
        sub: `${e.supplier || 'Dyer'}${e.shade ? ` · ${e.shade}` : ''} · ${Number(e.current_balance).toFixed(3)} kg`,
        edy: e,
      })),
    [edyStock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (o: LotOption) => !q || o.label.toLowerCase().includes(q) || o.sub.toLowerCase().includes(q);
    return { prod: prodOptions.filter(match), edy: edyOptions.filter(match) };
  }, [prodOptions, edyOptions, search]);

  return (
    <div ref={ref} className="relative">
      <input type="text" value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="input-industrial w-full text-sm" placeholder="Search lot or EDY..." />
      {open && (filtered.prod.length > 0 || filtered.edy.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.prod.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-secondary/40">Production Lots</div>
              {filtered.prod.map(o => (
                <button key={`p-${o.lot_no}`} type="button" onMouseDown={e => e.preventDefault()}
                  onClick={() => { onSelect(o); setSearch(o.label); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition">
                  <span className="font-medium">{o.label}</span>
                  {o.sub && <span className="text-muted-foreground ml-2 text-xs">{o.sub}</span>}
                </button>
              ))}
            </>
          )}
          {filtered.edy.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-secondary/40 border-t">External Dyed Yarn (Store)</div>
              {filtered.edy.map(o => (
                <button key={`e-${o.lot_no}`} type="button" onMouseDown={e => e.preventDefault()}
                  onClick={() => { onSelect(o); setSearch(o.label); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition">
                  <span className="font-medium">EDY · {o.label}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{o.sub}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const DEDUCTION: Record<PackagingType, number> = {
  paper_tube: 0.12,
  chesse: 0.18,
};

const calcNet = (gross: number, units: number, type: PackagingType) =>
  parseFloat((gross - DEDUCTION[type] * units).toFixed(3));

const ChallanItemRow: React.FC<ChallanItemRowProps> = ({ index, item, lots, edyStock = [], clientId, clientRates, onChange, onRemove }) => {
  const resolveRate = (denier: string, lotType: LotType, currentRate: number) => {
    if (clientId && denier) {
      const found = lookupRate(clientRates, clientId, denier, lotType);
      if (found !== null) return found;
    }
    return currentRate;
  };

  const handleSelect = (opt: LotOption) => {
    if (opt.kind === 'production') {
      const lot = lots.find(l => l.lot_no === opt.lot_no);
      const denier = lot?.denier || '';
      const autoRate = resolveRate(denier, item.lot_type, item.rate);
      onChange(index, {
        ...item,
        lot_no: opt.lot_no,
        shade_number: lot?.shade_number || '',
        color_name: lot?.color_name || '',
        denier,
        rate: autoRate,
        amount: parseFloat((item.net_weight * autoRate).toFixed(2)),
      });
    } else {
      const e = opt.edy;
      const denier = e.yarn_type || '';
      const autoRate = resolveRate(denier, item.lot_type, item.rate);
      onChange(index, {
        ...item,
        lot_no: opt.lot_no, // = receipt_number; matches item_code EDY-<receipt_number>
        shade_number: e.shade || '',
        color_name: `EDY: ${e.supplier || 'Dyer'}`,
        denier,
        rate: autoRate,
        amount: parseFloat((item.net_weight * autoRate).toFixed(2)),
      });
    }
  };


  const handleLotTypeChange = (lotType: LotType) => {
    const autoRate = resolveRate(item.denier, lotType, item.rate);
    const updated: ItemData = {
      ...item,
      lot_type: lotType,
      rate: autoRate,
      amount: parseFloat((item.net_weight * autoRate).toFixed(2)),
    };
    onChange(index, updated);
  };

  const handlePackagingChange = (type: PackagingType) => {
    const net = calcNet(item.gross_weight, item.num_of_units, type);
    const updated: ItemData = {
      ...item,
      packaging_type: type,
      net_weight: net,
      amount: parseFloat((net * item.rate).toFixed(2)),
    };
    onChange(index, updated);
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
        <LotSearchDropdown value={item.lot_no} lots={lots} edyStock={edyStock} onSelect={handleSelect} />
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
