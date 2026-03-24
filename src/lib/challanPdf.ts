import type { Challan, ChallanItem } from '@/types/challan';

const PACKAGING_LABEL: Record<string, string> = {
  paper_tube: 'Paper Tube',
  chesse: 'Chesse',
};

export function generateChallanPdf(challan: Challan, items: ChallanItem[]) {
  const totalNetWeight = items.reduce((s, i) => s + i.net_weight, 0);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  const rows = items.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.lot_no}</td>
      <td>${item.shade_number}</td>
      <td>${item.color_name}</td>
      <td>${PACKAGING_LABEL[item.packaging_type] || item.packaging_type}</td>
      <td class="r">${item.num_of_units}</td>
      <td class="r">${item.gross_weight.toFixed(3)}</td>
      <td class="r">${item.net_weight.toFixed(3)}</td>
      <td class="r">${item.rate.toFixed(2)}</td>
      <td class="r">${item.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Challan ${challan.challan_number}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 14px; }
  .header h1 { font-size: 20px; font-weight: 700; letter-spacing: 1px; margin-bottom: 2px; }
  .header p { font-size: 11px; color: #444; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 14px; padding: 8px 12px; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 4px; }
  .meta div { }
  .meta label { font-size: 9px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .meta .val { font-size: 12px; font-weight: 600; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #333; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
  tr:nth-child(even) td { background: #fafafa; }
  .r { text-align: right; }
  .totals td { font-weight: 700; border-top: 2px solid #333; background: #f0f0f0 !important; font-size: 12px; }
  .footer { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; }
  .footer .col { min-width: 200px; }
  .footer label { font-size: 9px; text-transform: uppercase; color: #888; }
  .footer .val { font-size: 12px; font-weight: 500; margin-top: 2px; border-bottom: 1px dotted #999; min-height: 18px; padding-bottom: 2px; }
  .sig-line { margin-top: 40px; border-top: 1px solid #333; width: 160px; }
</style></head><body>
  <div class="header">
    <h1>SHREE MAHAVEER IMPEX</h1>
    <p>B-150 Phase-2 Noida UP 201301 &nbsp;|&nbsp; +91 9667184789</p>
  </div>

  <div class="meta">
    <div><label>Challan No.</label><div class="val">${challan.challan_number}</div></div>
    <div><label>Date</label><div class="val">${new Date(challan.date).toLocaleDateString('en-IN')}</div></div>
    <div><label>Client</label><div class="val">${challan.client_name}</div></div>
  </div>

  <table>
    <thead><tr>
      <th>#</th><th>Lot No</th><th>Shade #</th><th>Color</th><th>Packaging</th>
      <th class="r">Units</th><th class="r">Gross Wt (kg)</th><th class="r">Net Wt (kg)</th>
      <th class="r">Rate (₹)</th><th class="r">Amount (₹)</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr class="totals">
        <td colspan="7" class="r">TOTAL</td>
        <td class="r">${totalNetWeight.toFixed(3)}</td>
        <td></td>
        <td class="r">${totalAmount.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${challan.notes ? `<p style="margin-bottom:14px;font-size:11px;"><strong>Notes:</strong> ${challan.notes}</p>` : ''}

  <div class="footer">
    <div class="col">
      <label>Prepared By</label>
      <div class="val">${challan.prepared_by_name || ''}</div>
      <div class="sig-line"></div>
      <div style="font-size:9px;color:#888;margin-top:4px;">Authorized Signatory</div>
    </div>
    <div class="col">
      <label>Received By</label>
      <div class="val">${challan.receiver_name || ''}</div>
      ${challan.receiver_contact_number ? `<div style="font-size:10px;color:#666;margin-top:4px;">Contact: ${challan.receiver_contact_number}</div>` : ''}
      <div class="sig-line"></div>
      <div style="font-size:9px;color:#888;margin-top:4px;">Receiver Signature</div>
    </div>
  </div>
</body></html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }
}

export function downloadChallanPdf(challan: Challan, items: ChallanItem[]) {
  generateChallanPdf(challan, items);
}
