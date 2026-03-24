import React from 'react';
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

  const handleField = (field: keyof ItemData, raw: string) => {
    const val = parseFloat(raw) || 0;
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
        <input type="number" step="0.001" value={item.gross_weight || ''} onChange={e => handleField('gross_weight', e.target.value)}
          className="input-industrial w-24 text-sm" placeholder="0.000" />
      </td>
      <td className="p-2">
        <input type="number" step="1" min="0" value={item.num_of_units || ''} onChange={e => handleField('num_of_units', e.target.value)}
          className="input-industrial w-20 text-sm" placeholder={`# ${unitLabel}`} />
      </td>
      <td className="p-2 text-sm font-medium">{item.net_weight.toFixed(3)}</td>
      <td className="p-2">
        <input type="number" step="0.01" value={item.rate || ''} onChange={e => handleField('rate', e.target.value)}
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
