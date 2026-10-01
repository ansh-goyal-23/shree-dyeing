import jsPDF from 'jspdf';
import type { ChallanReturn, ChallanReturnItem } from '@/types/challanReturn';
import { returnLineTotal } from '@/types/challanReturn';
import { formatYmdLocal } from '@/lib/formatDate';

const PACKAGING_LABEL: Record<string, string> = {
  paper_tube: 'Paper Tube',
  chesse: 'Chesse',
};

// 2-inch thermal receipt format -- same as the regular challan PDF.
const PAGE_W = 50.8; // mm (2 inches)
const MARGIN = 3;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function generateReturnChallanPdfBlob(ret: ChallanReturn, items: ChallanReturnItem[]): Blob {
  const measureDoc = new jsPDF({ unit: 'mm', format: [PAGE_W, 4000] });
  const contentH = renderReturn(measureDoc, ret, items);
  const pageH = Math.max(contentH + MARGIN + 4, 80);

  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, pageH] });
  renderReturn(doc, ret, items);
  return doc.output('blob');
}

function renderReturn(doc: jsPDF, ret: ChallanReturn, items: ChallanReturnItem[]): number {
  const lineH = 4.0;
  const smallH = 3.3;
  let y = MARGIN + 2;

  const centerText = (txt: string, size: number, bold = true) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(txt, PAGE_W / 2, y, { align: 'center' });
  };

  const kvRow = (label: string, value: string) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110);
    doc.text(label, MARGIN, y);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(String(value ?? ''), CONTENT_W - 15) as string[];
    doc.text(lines, PAGE_W - MARGIN, y, { align: 'right' });
    y += lineH + Math.max(lines.length - 1, 0) * (lineH - 0.7);
  };

  const itemField = (label: string, value: string) => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110);
    doc.text(label, MARGIN, y);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(String(value ?? ''), CONTENT_W - 12) as string[];
    doc.text(lines, PAGE_W - MARGIN, y, { align: 'right' });
    y += smallH + Math.max(lines.length - 1, 0) * (smallH - 0.4);
  };

  const divider = (solid = false) => {
    doc.setDrawColor(solid ? 50 : 160);
    doc.setLineWidth(solid ? 0.4 : 0.2);
    if (!solid) doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    doc.setLineDashPattern([], 0);
    y += 2;
  };

  // ── Header ──
  centerText('SHREE MAHAVEER IMPEX', 9, true);
  y += 3.5;
  doc.setTextColor(90);
  centerText('B-150 Phase-2 Noida UP 201301', 7.5);
  y += 2.5;
  centerText('+91 9667184789', 7.5);
  y += 3;
  doc.setTextColor(0);
  centerText('RETURN CHALLAN', 9, true);
  y += 3.5;

  divider(true);
  y += 2;

  // ── Return Meta ──
  kvRow('RETURN #', ret.return_number);
  kvRow('DATE', formatYmdLocal(ret.date, 'en-IN'));
  kvRow('CLIENT', ret.client_name);

  divider();

  // ── Items ──
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('RETURNED ITEMS', MARGIN, y);
  y += lineH;

  items.forEach((item, idx) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(MARGIN, y - 2.4, CONTENT_W, 3.8, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`#${idx + 1}  ${item.lot_no}`, MARGIN + 0.6, y);
    y += smallH + 0.6;

    itemField('Orig. Challan', item.original_challan_number || '—');
    itemField('Shade', item.shade_number || '—');
    if (item.color_name) itemField('Color', item.color_name);
    itemField('Pack', PACKAGING_LABEL[item.packaging_type] || item.packaging_type);
    itemField('Returned Units', String(item.returned_num_of_units));
    itemField('Returned Net Wt', `${item.returned_net_weight.toFixed(3)} kg`);
    if (item.rate_tier_label) itemField('Rate Tier', item.rate_tier_label);
    itemField('Rate', `Rs. ${item.rate.toFixed(2)}`);
    if (item.paper_tube_surcharge) itemField('Surcharge', `${item.returned_extra_cones} cone(s), Rs. ${item.paper_tube_surcharge.toFixed(2)}`);
    itemField('Amount', `Rs. ${returnLineTotal(item).toFixed(2)}`);
    itemField('Reason', item.reason);
    y += 1;
  });

  divider(true);
  y += 2;

  // ── Totals ──
  const totalNet = items.reduce((s, i) => s + i.returned_net_weight, 0);
  const totalUnits = items.reduce((s, i) => s + i.returned_num_of_units, 0);
  const totalAmount = items.reduce((s, i) => s + returnLineTotal(i), 0);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL UNITS', MARGIN, y);
  doc.text(String(totalUnits), PAGE_W - MARGIN, y, { align: 'right' });
  y += lineH;

  doc.text('TOTAL NET', MARGIN, y);
  doc.text(`${totalNet.toFixed(3)} kg`, PAGE_W - MARGIN, y, { align: 'right' });
  y += lineH;

  if (totalAmount > 0) {
    doc.setFontSize(9.5);
    doc.text('TOTAL CREDIT', MARGIN, y);
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, PAGE_W - MARGIN, y, { align: 'right' });
    y += lineH;
  }

  if (ret.notes) {
    y += 1;
    divider();
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.setFont('helvetica', 'normal');
    doc.text('NOTES', MARGIN, y);
    y += smallH;
    doc.setTextColor(0);
    const wrapped = doc.splitTextToSize(ret.notes, CONTENT_W);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * smallH;
  }

  y += 1;
  divider();
  y += 1.5;

  const footerRow = (label: string, value: string) => {
    if (!value) return;
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.setFont('helvetica', 'bold');
    doc.text(label, MARGIN, y);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(String(value ?? ''), CONTENT_W - 15) as string[];
    doc.text(lines, PAGE_W - MARGIN, y, { align: 'right' });
    y += lineH + Math.max(lines.length - 1, 0) * (lineH - 0.7);
  };

  footerRow('PREPARED BY', ret.prepared_by_name);
  footerRow('RECEIVED BY', ret.received_by_name);
  footerRow('CONTACT', ret.received_by_contact_number);

  y += 2;
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.setFont('helvetica', 'bold');
  doc.text('— Return Acknowledged —', PAGE_W / 2, y, { align: 'center' });

  return y;
}

export function downloadReturnChallanPdf(ret: ChallanReturn, items: ChallanReturnItem[]) {
  const blob = generateReturnChallanPdfBlob(ret, items);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Return-${ret.return_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareReturnChallanPdf(ret: ChallanReturn, items: ChallanReturnItem[]) {
  const blob = generateReturnChallanPdfBlob(ret, items);
  const file = new File([blob], `Return-${ret.return_number}.pdf`, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `Return ${ret.return_number}`,
      text: `Return Challan ${ret.return_number} for ${ret.client_name}`,
      files: [file],
    });
  } else {
    downloadReturnChallanPdf(ret, items);
  }
}
