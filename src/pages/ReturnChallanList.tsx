import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, PlusCircle, FileText, FileSpreadsheet, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useChallanReturns, useAllChallanReturnItems } from '@/hooks/useChallanReturn';
import { returnLineTotal } from '@/types/challanReturn';
import { formatYmdLocal } from '@/lib/formatDate';

const ReturnChallanList: React.FC = () => {
  const { data: returns = [], isLoading } = useChallanReturns();
  const { data: allItems = [] } = useAllChallanReturnItems();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  const uniqueClients = useMemo(
    () => [...new Set(returns.map(r => r.client_name))].filter(Boolean).sort(),
    [returns],
  );

  const summaryByReturn = useMemo(() => {
    const map: Record<string, { items: number; netWeight: number; amount: number }> = {};
    for (const it of allItems as any[]) {
      const s = map[it.return_id] || { items: 0, netWeight: 0, amount: 0 };
      s.items += 1;
      s.netWeight += Number(it.returned_net_weight) || 0;
      s.amount += returnLineTotal({ amount: it.amount, paper_tube_surcharge: it.paper_tube_surcharge });
      map[it.return_id] = s;
    }
    return map;
  }, [allItems]);

  const filtered = useMemo(() => {
    return returns.filter(r => {
      if (clientFilter && r.client_name !== clientFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.return_number.toLowerCase().includes(q) && !r.client_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [returns, clientFilter, search]);

  const totals = useMemo(() => filtered.reduce((acc, r) => {
    const s = summaryByReturn[r.id] || { items: 0, netWeight: 0, amount: 0 };
    acc.netWeight += s.netWeight;
    acc.amount += s.amount;
    return acc;
  }, { netWeight: 0, amount: 0 }), [filtered, summaryByReturn]);

  const handleExportExcel = () => {
    if (!filtered.length) { toast.error('No returns match the selected filters.'); return; }
    const rows = (allItems as any[])
      .filter(it => filtered.some(r => r.id === it.return_id))
      .map(it => {
        const ret = filtered.find(r => r.id === it.return_id)!;
        return {
          'Return #': ret.return_number,
          Date: ret.date,
          Client: ret.client_name,
          'Orig. Challan #': it.challans?.challan_number || '',
          'Lot #': it.lot_no || '',
          'Shade #': it.shade_number || '',
          Packaging: it.packaging_type || '',
          'Returned Net Weight (kg)': -(Number(it.returned_net_weight) || 0),
          'Returned Units': -(Number(it.returned_num_of_units) || 0),
          'Rate (Rs.)': Number(it.rate) || 0,
          'Amount (Rs.)': -(Number(it.amount) || 0),
          'Surcharge (Rs.)': -(Number(it.paper_tube_surcharge) || 0),
          Reason: it.reason || '',
          Note: it.reason_note || '',
        };
      });
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
      { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
      { wch: 20 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, 'Returns');
    XLSX.writeFile(workbook, `return-challans-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Excel report generated with ${filtered.length} return(s).`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dispatch — Return Challans</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={isLoading || filtered.length === 0}>
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </Button>
          <Link to="/dispatch/returns/create"
            className="inline-flex items-center gap-2 px-4 h-11 bg-primary text-primary-foreground rounded-md text-sm font-medium btn-transition hover:opacity-90 focus-ring">
            <PlusCircle className="w-4 h-4" /> New Return
          </Link>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search return #, client..." value={search} onChange={e => setSearch(e.target.value)}
            className="input-industrial w-full pl-10" />
        </div>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="input-industrial w-48">
          <option value="">All Clients</option>
          {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No return challans yet.</p>
        </div>
      ) : (
        <div className="card-industrial overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Return #</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Client</th>
                <th className="p-3 font-medium text-right">Lines</th>
                <th className="p-3 font-medium text-right">Net Weight (kg)</th>
                <th className="p-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const s = summaryByReturn[r.id] || { items: 0, netWeight: 0, amount: 0 };
                return (
                  <tr key={r.id} className="border-b border-border hover:bg-secondary/30 btn-transition">
                    <td className="p-3">
                      <Link to={`/dispatch/returns/${r.id}`} className="text-primary font-medium hover:underline">{r.return_number}</Link>
                    </td>
                    <td className="p-3">{formatYmdLocal(r.date)}</td>
                    <td className="p-3">{r.client_name}</td>
                    <td className="p-3 text-right">{s.items}</td>
                    <td className="p-3 text-right">{s.netWeight.toFixed(3)} kg</td>
                    <td className="p-3 text-right font-medium">₹{s.amount.toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-semibold">
                <td className="p-3" colSpan={4}>Total ({filtered.length} return{filtered.length !== 1 ? 's' : ''})</td>
                <td className="p-3 text-right">{totals.netWeight.toFixed(3)} kg</td>
                <td className="p-3 text-right">₹{totals.amount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReturnChallanList;
