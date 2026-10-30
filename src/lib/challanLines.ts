// Helpers for the two kinds of challan line:
//   - product line : a dyed lot (lot_no set, weights, rate x net weight)
//   - "other item" : free-text description + a directly typed amount, for things
//                    we send that aren't yarn we dyed (tools, raw material, ...).
//                    Stored as a challan_items row with is_custom = true,
//                    lot_no = '' and all weights / units / rate = 0.

export const CUSTOM_DESCRIPTION_MAX = 200;

export interface LineLike {
  lot_no?: string | null;
  is_custom?: boolean | null;
  description?: string | null;
  amount?: number | null;
}

export const isCustomLine = (i: Pick<LineLike, 'is_custom'>): boolean => !!i.is_custom;

/** The text to show for a line: the typed description for an "other item", else the lot number. */
export const customLabel = (i: Pick<LineLike, 'description'>): string => (i.description ?? '').trim();

/**
 * Whether a row has anything in it. Blank rows are dropped silently on save:
 * a product row with no lot, or an "other item" row with no description and no amount.
 */
export function lineHasContent(i: LineLike): boolean {
  if (isCustomLine(i)) return customLabel(i) !== '' || (Number(i.amount) || 0) > 0;
  return !!i.lot_no;
}

/** An error message for the first bad "other item" row, or null if all are fine. */
export function customLineError(items: LineLike[]): string | null {
  for (const i of items) {
    if (!isCustomLine(i)) continue;
    const label = customLabel(i);
    const amount = Number(i.amount) || 0;
    if (label === '' && amount > 0) return 'An "Other item" row has an amount but no description. Write what is being sent.';
    if (label !== '' && amount < 0) return `"${label}" has a negative amount.`;
  }
  return null;
}

/**
 * Drops blank rows and tidies "other item" rows (trimmed description, no lot,
 * no weights/units/rate) so a stray value typed earlier can't leak into the
 * kg totals, store stock or reports.
 */
export function prepareLines<T extends LineLike>(items: T[]): { lines: T[]; error: string | null } {
  const kept = items.filter(lineHasContent);
  const error = customLineError(kept);
  const lines = kept.map(i => {
    if (!isCustomLine(i)) return i;
    return {
      ...i,
      is_custom: true,
      lot_no: '',
      description: customLabel(i).slice(0, CUSTOM_DESCRIPTION_MAX),
      amount: Math.round((Number(i.amount) || 0) * 100) / 100,
      shade_number: '',
      color_name: '',
      denier: '',
      ref_no: '',
      gross_weight: 0,
      num_of_units: 0,
      net_weight: 0,
      rate: 0,
      yarn_cost: null,
      overhead_rate: null,
      rate_tier_label: null,
      paper_tube_surcharge: 0,
      extra_cones: 0,
    };
  });
  return { lines, error };
}
