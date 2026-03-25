import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Lot } from '@/types';
import type { PackagingType } from '@/types/challan';

export interface ItemData {
  lot_no: string;
  shade_number: string;
  color_name: string;
  packaging_type: PackagingType;
  gross_weight: number;
  num_of_units: number;
  net_weight: number;
  rate: number;
  amount: number;
}

interface ChallanItemRowProps {
  index: number;
  item: ItemData;
  lots: Lot[];
  onChange: (index: number, updated: ItemData) => void;
  onRemove: (index: number) => void;
}

const DEDUCTION: Record<PackagingType, number> = {
  paper_tube: 0.12,
  chesse: 0.18,
};

const calcNet = (gross: number, units: number, type: PackagingType) =>
  parseFloat((gross - DEDUCTION[type] * units).toFixed(3));

const ChallanItemRow: React.FC<ChallanItemRowProps> = ({ index, item, lots, onChange, onRemove }) => {
  // String state for decimal-friendly inputs
  const [grossStr, setGrossStr] = useState(item.gross_weight ? String(item.gross_weight) : '');
  const [unitsStr, setUnitsStr] = useState(item.num_of_units ? String(item.num_of_units) : '');
  const [rateStr, setRateStr] = useState(item.rate ? String(item.rate) : '');

  const handleLotChange = (lotNo: string) => {
    const lot = lots.find(l => l.lot_no === lotNo);
    const updated: ItemData = {
      ...item,
      lot_no: lotNo,
      shade_number: lot?.shade_number || '',
      color_name: lot?.color_name || '',
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

  const handleGrossChange = (raw: string) => {
    setGrossStr(raw);
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      const net = calcNet(val, item.num_of_units, item.packaging_type);
      onChange(index, { ...item, gross_weight: val, net_weight: net, amount: parseFloat((net * item.rate).toFixed(2)) });
    }
  };

  const handleUnitsChange = (raw: string) => {
    setUnitsStr(raw);
    const val = parseInt(raw);
    if (!isNaN(val)) {
      const net = calcNet(item.gross_weight, val, item.packaging_type);
      onChange(index, { ...item, num_of_units: val, net_weight: net, amount: parseFloat((net * item.rate).toFixed(2)) });
    }
  };

  const handleRateChange = (raw: string) => {
    setRateStr(raw);
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      onChange(index, { ...item, rate: val, amount: parseFloat((item.net_weight * val).toFixed(2)) });
    }
  };

  const unitLabel = item.packaging_type === 'chesse' ? 'Chesses' : 'Tubes';

  return (
    <tr className="border-b border-border hover:bg-secondary/30">
      <td className="p-2">
        <select value={item.lot_no} onChange={e => handleLotChange(e.target.value)} className="input-industrial w-full text-sm">
          <option value="">Select lot...</option>
          {lots.map(l => <option key={l.lot_no} value={l.lot_no}>{l.lot_no}</option>)}
        </select>
      </td>
      <td className="p-2 text-sm text-muted-foreground">{item.shade_number}</td>
      <td className="p-2 text-sm text-muted-foreground">{item.color_name}</td>
      <td className="p-2">
        <select value={item.packaging_type} onChange={e => handlePackagingChange(e.target.value as PackagingType)} className="input-industrial w-full text-sm">
          <option value="paper_tube">Paper Tube</option>
          <option value="chesse">Chesse</option>
        </select>
      </td>
      <td className="p-2">
        <input type="number" step="any" value={grossStr} onChange={e => handleGrossChange(e.target.value)}
          onBlur={() => setGrossStr(item.gross_weight ? String(item.gross_weight) : '')}
          className="input-industrial w-full min-w-[80px] text-sm" placeholder="0.000" />
      </td>
      <td className="p-2">
        <input type="number" step="1" min="0" value={unitsStr} onChange={e => handleUnitsChange(e.target.value)}
          onBlur={() => setUnitsStr(item.num_of_units ? String(item.num_of_units) : '')}
          className="input-industrial w-full min-w-[60px] text-sm" placeholder={`# ${unitLabel}`} />
      </td>
      <td className="p-2 text-sm font-medium">{item.net_weight.toFixed(3)}</td>
      <td className="p-2">
        <input type="number" step="any" value={rateStr} onChange={e => handleRateChange(e.target.value)}
          onBlur={() => setRateStr(item.rate ? String(item.rate) : '')}
          className="input-industrial w-full min-w-[80px] text-sm" placeholder="0.00" />
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
