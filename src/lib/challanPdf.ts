import jsPDF from 'jspdf';
import type { Challan, ChallanItem } from '@/types/challan';
import { lineTotal } from '@/types/challan';
import { formatYmdLocal } from '@/lib/formatDate';

const PACKAGING_LABEL: Record<string, string> = {
  paper_tube: 'Paper Tube',
  chesse: 'Chesse',
};

// 2-inch thermal receipt format
const PAGE_W = 50.8; // mm (2 inches)
const MARGIN = 3;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function generateChallanPdfBlob(challan: Challan, items: ChallanItem[]): Blob {
  // Pass 1: draw onto a throw-away tall page just to measure the real content height.
  const measureDoc = new jsPDF({ unit: 'mm', format: [PAGE_W, 4000] });
  const contentH = renderChallan(measureDoc, challan, items);
  const pageH = Math.max(contentH + MARGIN + 4, 80);

  // Pass 2: draw for real on an exactly-sized page.
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, pageH] });
  renderChallan(doc, challan, items);
  return doc.output('blob');
}

/** Draws the whole receipt and returns the final y offset (mm). */
function renderChallan(doc: jsPDF, challan: Challan, items: ChallanItem[]): number {
  const isEdy = challan.challan_kind === 'edy';
  const lineH = 4.0;
  const smallH = 3.3;
  let y = MARGIN + 2;

  const centerText = (txt: string, size: number, bold = true) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(txt, PAGE_W / 2, y, { align: 'center' });
  };

  const leftText = (txt: string, size: number, bold = true, x = MARGIN) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(txt, x, y);
  };

  const rightText = (txt: string, size: number, bold = true) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(txt, PAGE_W - MARGIN, y, { align: 'right' });
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


  divider(true);
  y += 2;

  // ── Challan Meta ──
  kvRow('CHALLAN #', challan.challan_number);
  kvRow('DATE', formatYmdLocal(challan.date, 'en-IN'));
  kvRow('CLIENT', challan.client_name);
  if (isEdy) kvRow('TYPE', 'External Dyed Yarn');

  divider();

  // ── Items ──
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEMS', MARGIN, y);
  y += lineH;


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

  const formatShade = (shade: string | null | undefined) => {
    if (!shade) return shade;
    const s = String(shade).trim();
    return /^N/i.test(s) ? s : `N${s}`;
  };


  items.forEach((item, idx) => {
    // item number banner
    doc.setFillColor(240, 240, 240);
    doc.rect(MARGIN, y - 2.4, CONTENT_W, 3.8, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`#${idx + 1}  ${item.lot_no}`, MARGIN + 0.6, y);
    y += smallH + 0.6;


    if (isEdy) {
      if (item.color_name) itemField('Dyer', item.color_name);
      if (item.shade_number) itemField('Shade', item.shade_number);
      itemField('Gross Wt', `${item.gross_weight.toFixed(3)} kg`);
      itemField('Cones', String(item.num_of_units));
    } else {
      if (item.ref_no) itemField('Ref', item.ref_no);
      itemField('Shade', formatShade(item.shade_number));
      if (item.color_name) itemField('Color', item.color_name);
      if (item.denier) itemField('Denier', item.denier);
      if (item.lot_type) itemField('Type', item.lot_type);
      itemField('Pack', PACKAGING_LABEL[item.packaging_type] || item.packaging_type);
      itemField('Units', String(item.num_of_units));
      itemField('Gross', `${item.gross_weight.toFixed(3)} kg`);
      itemField('Net', `${item.net_weight.toFixed(3)} kg`);
      itemField('Rate', `Rs. ${item.rate.toFixed(2)}`);
      if (item.rate_tier_label) itemField('Tier', item.rate_tier_label);
      itemField('Amount', `Rs. ${item.amount.toFixed(2)}`);
      if (item.paper_tube_surcharge) itemField('Surcharge', `Rs. ${item.paper_tube_surcharge.toFixed(2)}`);
    }
    y += 1;
  });

  divider(true);
  y += 2;

  // ── Totals ──
  const totalNet = items.reduce((s, i) => s + (isEdy ? i.gross_weight : i.net_weight), 0);
  const totalCones = items.reduce((s, i) => s + i.num_of_units, 0);
  const totalAmount = items.reduce((s, i) => s + lineTotal(i), 0);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL CONES', MARGIN, y);
  doc.text(String(totalCones), PAGE_W - MARGIN, y, { align: 'right' });
  y += lineH;

  doc.text(isEdy ? 'TOTAL GROSS' : 'TOTAL NET', MARGIN, y);
  doc.text(`${totalNet.toFixed(3)} kg`, PAGE_W - MARGIN, y, { align: 'right' });
  y += lineH;

  if (!isEdy && totalAmount > 0) {
    doc.setFontSize(9.5);
    doc.text('TOTAL AMT', MARGIN, y);
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, PAGE_W - MARGIN, y, { align: 'right' });
    y += lineH;
  }


  // ── Notes ──
  if (challan.notes) {
    y += 1;
    divider();
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.setFont('helvetica', 'normal');
    doc.text('NOTES', MARGIN, y);
    y += smallH;
    doc.setTextColor(0);
    const wrapped = doc.splitTextToSize(challan.notes, CONTENT_W);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * smallH;
  }


  y += 1;
  divider();
  y += 1.5;

  // ── Footer ──
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


  footerRow('PREPARED BY', challan.prepared_by_name);
  footerRow('RECEIVED BY', challan.receiver_name);
  footerRow('CONTACT', challan.receiver_contact_number);

  y += 2;
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.setFont('helvetica', 'bold');
  doc.text('— Thank you —', PAGE_W / 2, y, { align: 'center' });


  return y;
}

export function downloadChallanPdf(challan: Challan, items: ChallanItem[]) {
  const blob = generateChallanPdfBlob(challan, items);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Challan-${challan.challan_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareChallanPdf(challan: Challan, items: ChallanItem[]) {
  const blob = generateChallanPdfBlob(challan, items);
  const file = new File([blob], `Challan-${challan.challan_number}.pdf`, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `Challan ${challan.challan_number}`,
      text: `Challan ${challan.challan_number} for ${challan.client_name}`,
      files: [file],
    });
  } else {
    downloadChallanPdf(challan, items);
  }
}
