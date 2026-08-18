# Dye & Chemical Consumption Report

A new read-only report showing how much of each dye and chemical was used, with per-kg averages, grouped monthly, weekly, or over any custom date range.

## What it shows

Consumption is taken from lot recipes: the base recipe plus every process step (Color Addition, RC, Leveling). All lots in the selected date range are included regardless of status.

**Tab 1 — Item Summary** (one row per dye/chemical)
- Item name (short name), type (Dye / Chemical), company
- Total quantity used (grams for dyes, item unit for chemicals)
- Number of lots it appeared in
- Average per kg of yarn = total qty / total net weight of the lots using it
- Share of total usage (%)
- Sorted by total quantity desc; separate Dyes and Chemicals sections

**Tab 2 — Period Trend** (one row per period)
- Period label (month / week / whole range)
- Lots produced, total net weight (kg)
- Total dye grams, dye g/kg
- Total chemical qty, chemical qty/kg
- Click a period row to expand the per-item breakdown for that period

## Controls

- Period toggle: Monthly / Weekly / Custom range
- Date From / Date To pickers (same calendar-popover pattern as the Oil Consumption report)
- Item type filter: All / Dyes only / Chemicals only
- Optional item search box to focus on one dye or chemical
- Totals summary cards on top: lots, net weight, total dye grams, dye g/kg
- Export current table to CSV

## Technical notes

- New page `src/pages/ConsumptionReport.tsx`, route `/dispatch/consumption` (reports live under Dispatch today), sidebar entry "Dye & Chemical Usage" next to "Oil Consumption". Read-only, so visible to Viewer too.
- Data fetched with react-query via separate simple queries (no JOINs), matching existing patterns:
  1. `lots` filtered on `date` range → lot_no, date, net_weight, status
  2. `recipe_dyes` and `recipe_chemicals` for those lot_nos
  3. `process_steps` for those lot_nos → step ids, then `step_dyes` and `step_chemicals`
  4. `master_items` for names/units/type
  Client-side aggregation into item and period buckets. Paged fetches in chunks of 1000 and `.in()` batched to avoid URL limits.
- Dye quantity uses stored `qty_grams`; chemical quantity uses stored `qty`. Percentages are not summed across lots (not additive) — averages are always qty per kg of net weight.
- Precision: weights 3 decimals, per-kg averages 3 decimals, percentages 2 (matches existing conventions).
- Week buckets start Monday, labelled by ISO week start date; month buckets labelled `MMM yyyy`. Dates handled with the existing `formatYmdLocal` helper to avoid timezone shifts.
- No schema changes and no new migrations — all data already exists.
