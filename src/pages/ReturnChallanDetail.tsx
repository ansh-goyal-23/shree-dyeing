import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useChallanReturn, useChallanReturnItems } from '@/hooks/useChallanReturn';
import { returnLineTotal } from '@/types/challanReturn';
import { downloadReturnChallanPdf, shareReturnChallanPdf } from '@/lib/returnChallanPdf';
import { formatYmdLocal } from '@/lib/formatDate';

const PACKAGING_LABEL: Record<string, string> = {
  paper_tube: 'Paper Tube',
  chesse: 'Chesse',
};

const ReturnChallanDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: ret, isLoading: retLoading } = useChallanReturn(id!);
  const { data: items = [], isLoading: itemsLoading } = useChallanReturnItems(id!);

  const handleDownloadPdf = () => { if (ret) downloadReturnChallanPdf(ret, items); };
  const handleShare = async () => {
    if (!ret) return;
    try { await shareReturnChallanPdf(ret, items); } catch { toast.error('Sharing failed.'); }
  };

  if (retLoading || itemsLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!ret) {
    return <div className="text-center py-12 text-muted-foreground">Return challan not found.</div>;
  }

  const totalNetWeight = items.reduce((s, i) => s + i.returned_net_weight, 0);
  const totalAmount = items.reduce((s, i) => s + returnLineTotal(i), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/dispatch/returns" className="p-2 hover:bg-secondary rounded btn-transition"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-2xl font-semibold tracking-tight">Return: {ret.return_number}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 h-9 border border-input rounded-md text-sm font-medium hover:bg-secondary btn-transition">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>
      </div>

      <div className="card-industrial p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div><span className="text-muted-foreground">Date</span><p className="font-medium">{formatYmdLocal(ret.date)}</p></div>
        <div><span className="text-muted-foreground">Client</span><p className="font-medium">{ret.client_name}</p></div>
        <div><span className="text-muted-foreground">Prepared By</span><p className="font-medium">{ret.prepared_by_name || '—'}</p></div>
        <div><span className="text-muted-foreground">Received By</span><p className="font-medium">{ret.received_by_name || '—'}</p></div>
        <div><span className="text-muted-foreground">Contact</span><p className="font-medium">{ret.received_by_contact_number || '—'}</p></div>
        {ret.notes && <div className="md:col-span-3"><span className="text-muted-foreground">Notes</span><p className="font-medium">{ret.notes}</p></div>}
      </div>

      <div className="card-industrial overflow-x-auto">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Returned Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-2 font-medium">Orig. Challan</th>
              <th className="p-2 font-medium">Lot No</th>
              <th className="p-2 font-medium">Shade</th>
              <th className="p-2 font-medium">Packaging</th>
              <th className="p-2 font-medium">Returned Units</th>
              <th className="p-2 font-medium">Returned Net Wt (kg)</th>
              <th className="p-2 font-medium">Rate</th>
              <th className="p-2 font-medium">Reason</th>
              <th className="p-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-border/60 last:border-0">
                <td className="p-2">
                  {item.original_challan_number ? (
                    <Link to={`/dispatch/${item.original_challan_id}`} className="text-primary hover:underline">{item.original_challan_number}</Link>
                  ) : '—'}
                </td>
                <td className="p-2">{item.lot_no}</td>
                <td className="p-2">{item.shade_number}</td>
                <td className="p-2">{PACKAGING_LABEL[item.packaging_type] || item.packaging_type}</td>
                <td className="p-2">{item.returned_num_of_units}</td>
                <td className="p-2">{item.returned_net_weight.toFixed(3)}</td>
                <td className="p-2">₹{item.rate.toFixed(2)}</td>
                <td className="p-2">{item.reason}{item.reason_note ? ` — ${item.reason_note}` : ''}</td>
                <td className="p-2 font-medium">₹{returnLineTotal(item).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td colSpan={5} className="p-3 text-right">Totals:</td>
              <td className="p-3">{totalNetWeight.toFixed(3)} kg</td>
              <td colSpan={2}></td>
              <td className="p-3">₹{totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ReturnChallanDetail;
