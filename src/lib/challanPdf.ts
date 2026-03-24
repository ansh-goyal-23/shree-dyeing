import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Challan, ChallanItem } from '@/types/challan';

const PACKAGING_LABEL: Record<string, string> = {
  paper_tube: 'Paper Tube',
  chesse: 'Chesse',
};

export function generateChallanPdfBlob(challan: Challan, items: ChallanItem[]): Blob {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // ── Company Header ──
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SHREE MAHAVEER IMPEX', pw / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('B-150 Phase-2 Noida UP 201301  |  +91 9667184789', pw / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(50);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // ── Challan Meta ──
  doc.setTextColor(0);
  doc.setFontSize(10);
  const metaLeft = margin;
  const metaMid = pw / 2 - 10;
  const metaRight = pw - margin;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text('CHALLAN NO.', metaLeft, y);
  doc.text('DATE', metaMid, y);
  doc.text('CLIENT', metaRight - 40, y);
  y += 4;

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(challan.challan_number, metaLeft, y);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(challan.date).toLocaleDateString('en-IN'), metaMid, y);
  doc.text(challan.client_name, metaRight - 40, y);
  y += 10;

  // ── Items Table ──
  const totalNetWeight = items.reduce((s, i) => s + i.net_weight, 0);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  const tableData = items.map((item, idx) => [
    String(idx + 1),
    item.lot_no,
    item.shade_number,
    item.color_name,
    PACKAGING_LABEL[item.packaging_type] || item.packaging_type,
    String(item.num_of_units),
    item.gross_weight.toFixed(3),
    item.net_weight.toFixed(3),
    item.rate.toFixed(2),
    item.amount.toFixed(2),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Lot No', 'Shade #', 'Color', 'Packaging', 'Units', 'Gross Wt (kg)', 'Net Wt (kg)', 'Rate/kg (₹)', 'Amount (₹)']],
    body: tableData,
    foot: [['', '', '', '', '', '', 'TOTAL', totalNetWeight.toFixed(3), '', totalAmount.toFixed(2)]],
    theme: 'grid',
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: 30,
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: 30,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { cellWidth: 20 },
      2: { cellWidth: 16 },
      3: { cellWidth: 22 },
      4: { cellWidth: 20 },
      5: { halign: 'right', cellWidth: 13 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 20 },
      8: { halign: 'right', cellWidth: 22 },
      9: { halign: 'right', cellWidth: 20 },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Notes ──
  if (challan.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(challan.notes, margin + 14, y);
    y += 8;
  }

  // ── Footer (clean, no signature lines) ──
  y += 6;
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  const colW = (pw - 2 * margin) / 3;

  const drawFooterCol = (label: string, value: string, x: number) => {
    if (!value) return;
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, y);
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x, y + 5);
  };

  drawFooterCol('PREPARED BY', challan.prepared_by_name || '', margin);
  drawFooterCol('RECEIVED BY', challan.receiver_name || '', margin + colW);
  if (challan.receiver_contact_number) {
    drawFooterCol('CONTACT', challan.receiver_contact_number, margin + colW * 2);
  }

  return doc.output('blob');
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
    // Fallback: just download
    downloadChallanPdf(challan, items);
  }
}
