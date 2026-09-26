import * as XLSX from 'xlsx';
import type { OrderInput } from '@/types/order';

// Parses an uploaded order-sheet file (.xlsx/.xls/.csv) into OrderInput rows,
// matching the columns of Ansh's working order sheet: CLIENT, POC, DATE,
// COLOUR, YARN TYPE, SAMPLE TYPE, SHADE NO, ORDER QTY, UOM. (QTY SENT /
// BALANCE QTY, if present in the file, are ignored -- those are always
// live-calculated from challans, never stored -- see useOrders.ts.)
//
// Used by the "Upload Excel" full-replace flow on the Orders page: the
// caller deletes all existing orders and inserts exactly what this returns.

export interface ParsedOrderRow {
  rowNumber: number; // 1-based, matching the row's position in the sheet (header = row 1)
  input: OrderInput;
}

export interface SkippedOrderRow {
  rowNumber: number;
  reason: string;
}

export interface ParseOrderSheetResult {
  rows: ParsedOrderRow[];
  skipped: SkippedOrderRow[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// Handles the shapes seen in real order sheets: "10-Sep-26", "10-sept-26",
// "25-SEPT" (no year -- defaults to the current year), "25 Sept" (space
// instead of dash), plus a plain ISO "YYYY-MM-DD" and a final fallback to
// the JS Date parser for anything else recognizable (e.g. "9/10/2026").
// Returns null (unparseable) rather than guessing wrong silently.
export function parseOrderDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return s;

  const m = s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s]?(\d{2,4})?$/);
  if (m) {
    const [, dayStr, monRaw, yearStr] = m;
    const mon = MONTHS[monRaw.toLowerCase()];
    if (!mon) return null;
    const day = parseInt(dayStr, 10);
    let year: number;
    if (yearStr) {
      year = parseInt(yearStr, 10);
      if (year < 100) year += 2000;
    } else {
      year = new Date().getFullYear();
    }
    const d = new Date(Date.UTC(year, mon - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== mon - 1 || d.getUTCDate() !== day) return null;
    return d.toISOString().slice(0, 10);
  }

  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }
  return null;
}

const normalizeHeader = (h: string) => h.trim().toUpperCase().replace(/\s+/g, ' ');

const HEADER_ALIASES: Record<string, string> = {
  'CLIENT': 'CLIENT',
  'POC': 'POC',
  'DATE': 'DATE',
  'ORDER DATE': 'DATE',
  'COLOUR': 'COLOUR',
  'COLOR': 'COLOUR',
  'YARN TYPE': 'YARN TYPE',
  'SAMPLE TYPE': 'SAMPLE TYPE',
  'SHADE NO': 'SHADE NO',
  'SHADE NO.': 'SHADE NO',
  'SHADE NUMBER': 'SHADE NO',
  'ORDER QTY': 'ORDER QTY',
  'QTY': 'ORDER QTY',
  'UOM': 'UOM',
  'UNIT': 'UOM',
  'NOTES': 'NOTES',
};

export async function parseOrderSheetFile(file: File): Promise<ParseOrderSheetResult> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], skipped: [] };
  const sheet = workbook.Sheets[sheetName];

  // raw:false + a fixed date format normalizes genuine Excel date cells to
  // the same "10-Sep-26" shape already handled by parseOrderDate, so date
  // cells and text-typed dates go through one parser.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: '',
    dateNF: 'dd-mmm-yy',
  });

  const rows: ParsedOrderRow[] = [];
  const skipped: SkippedOrderRow[] = [];

  raw.forEach((record, i) => {
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
    const byKey: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      const norm = HEADER_ALIASES[normalizeHeader(key)];
      if (norm) byKey[norm] = String(value ?? '').trim();
    }

    const client_name = byKey['CLIENT'] || '';
    const color_name = byKey['COLOUR'] || '';
    if (!client_name || !color_name) {
      skipped.push({ rowNumber, reason: !client_name ? 'missing Client' : 'missing Colour' });
      return;
    }

    const dateRaw = byKey['DATE'] || '';
    const order_date = dateRaw ? parseOrderDate(dateRaw) : new Date().toISOString().slice(0, 10);
    if (dateRaw && !order_date) {
      skipped.push({ rowNumber, reason: `unrecognized date "${dateRaw}"` });
      return;
    }

    const qtyRaw = (byKey['ORDER QTY'] || '').replace(/,/g, '');
    const order_qty = qtyRaw === '' ? 0 : Number(qtyRaw);
    if (isNaN(order_qty)) {
      skipped.push({ rowNumber, reason: `invalid Order Qty "${byKey['ORDER QTY']}"` });
      return;
    }

    rows.push({
      rowNumber,
      input: {
        client_name,
        poc: byKey['POC'] || undefined,
        order_date: order_date as string,
        color_name,
        yarn_type: byKey['YARN TYPE'] || undefined,
        sample_type: byKey['SAMPLE TYPE'] || undefined,
        shade_no: byKey['SHADE NO'] || undefined,
        order_qty,
        uom: byKey['UOM'] || 'KG',
        notes: byKey['NOTES'] || undefined,
      },
    });
  });

  return { rows, skipped };
}
