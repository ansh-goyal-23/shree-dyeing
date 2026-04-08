import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';
import { Search, CheckCircle2, Clock, XCircle, Factory } from 'lucide-react';
import type { LotStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const STATUS_CYCLE: LotStatus[] = ['In Approval', 'Approved', 'Production', 'Rejected'];

const STATUS_VARIANT: Record<LotStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'Approved': 'default',
  'Production': 'secondary',
  'In Approval': 'outline',
  'Rejected': 'destructive',
};

const LotList: React.FC = () => {
  const { lots, updateLotStatus } = useApp();
  const [search, setSearch] = useState('');

  const filtered = lots.filter(l => {
    const q = search.toLowerCase();
    return l.lot_no.toLowerCase().includes(q) ||
      l.shade_number.toLowerCase().includes(q) ||
      l.yarn_company_name.toLowerCase().includes(q) ||
      l.color_name.toLowerCase().includes(q);
  }).sort((a, b) => b.lot_no.localeCompare(a.lot_no, undefined, { numeric: true }));

  const handleToggleStatus = async (lotNo: string, currentStatus: LotStatus) => {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    await updateLotStatus(lotNo, next);
    toast.success(`Lot ${lotNo} → ${next}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Lot List</h1>
        <Link
          to="/shade-management/lots/create"
          className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring"
        >
          New Lot
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by Lot No, Company, or Color..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-industrial w-full pl-10"
        />
      </div>

      <div className="card-industrial overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lot No</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Denier</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Color</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Net Wt (kg)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Shade No</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? 'No lots match your search.' : 'No lots created yet.'}
                </td>
              </tr>
            ) : (
              filtered.map(lot => (
                <tr key={lot.lot_no} className="row-separator hover:bg-secondary/30 btn-transition">
                  <td className="px-4 py-3">
                    <Link to={`/shade-management/lots/${lot.lot_no}`} className="font-data font-semibold text-primary hover:underline">
                      {lot.lot_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-data text-muted-foreground">{lot.date}</td>
                  <td className="px-4 py-3">{lot.denier || '—'}</td>
                  <td className="px-4 py-3">{lot.color_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-data">{lot.net_weight}</td>
                  <td className="px-4 py-3 font-data">{lot.shade_number}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={STATUS_VARIANT[lot.status] || 'outline'}
                      className="cursor-pointer select-none"
                      onClick={() => handleToggleStatus(lot.lot_no, lot.status)}
                    >
                      {lot.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LotList;
