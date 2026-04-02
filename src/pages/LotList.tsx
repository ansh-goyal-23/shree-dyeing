import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';
import { Search, CheckCircle2, Clock, XCircle, Factory, ChevronDown } from 'lucide-react';
import type { LotStatus } from '@/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<LotStatus, { icon: React.ElementType; label: string; className: string }> = {
  'Approved': { icon: CheckCircle2, label: 'Approved', className: 'bg-approved/10 text-approved' },
  'Rejected': { icon: XCircle, label: 'Rejected', className: 'bg-destructive/10 text-destructive' },
  'Production': { icon: Factory, label: 'Production', className: 'bg-primary/10 text-primary' },
  'In Approval': { icon: Clock, label: 'In Approval', className: 'bg-correction/10 text-correction' },
};

const ALL_STATUSES: LotStatus[] = ['Approved', 'Rejected', 'Production', 'In Approval'];

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

  const handleStatusChange = async (lotNo: string, status: LotStatus) => {
    await updateLotStatus(lotNo, status);
    toast.success(`Lot ${lotNo} status changed to ${status}.`);
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
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
              filtered.map(lot => {
                const config = STATUS_CONFIG[lot.status] || STATUS_CONFIG['In Approval'];
                const Icon = config.icon;
                return (
                  <tr key={lot.lot_no} className="row-separator hover:bg-secondary/30 btn-transition">
                    <td className="px-4 py-3">
                      <Link to={`/shade-management/lots/${lot.lot_no}`} className="font-data font-semibold text-primary hover:underline">
                        {lot.lot_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-data text-muted-foreground">{lot.date}</td>
                    <td className="px-4 py-3">{lot.yarn_company_name}</td>
                    <td className="px-4 py-3">{lot.color_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-data">{lot.net_weight}</td>
                    <td className="px-4 py-3 font-data">{lot.shade_number}</td>
                    <td className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded cursor-pointer hover:opacity-80 btn-transition ${config.className}`}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                            <ChevronDown className="w-3 h-3 ml-0.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                          {ALL_STATUSES.map(s => {
                            const sc = STATUS_CONFIG[s];
                            const SIcon = sc.icon;
                            return (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => handleStatusChange(lot.lot_no, s)}
                                className={lot.status === s ? 'font-semibold' : ''}
                              >
                                <SIcon className={`w-3.5 h-3.5 mr-2 ${sc.className.split(' ').pop()}`} />
                                {sc.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LotList;
