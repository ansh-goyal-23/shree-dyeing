# Challan: Dropdown Fix + Separate EDY Challan Flow

## 1. Fix Lot dropdown clipping in Create Challan
The lot search dropdown in `ChallanItemRow` uses `position: absolute` inside a table whose wrapper has `overflow-x-auto`. When only 1–2 items exist, the dropdown gets cut off by the container.

**Fix:** Render the dropdown in a portal so it escapes any parent overflow.
- Rewrite `LotSearchDropdown` in `src/components/ChallanItemRow.tsx` to use a fixed-position panel via `ReactDOM.createPortal`, positioned relative to the input using `getBoundingClientRect()`.
- Keeps existing keyboard/mouse behavior; no visual change beyond no-longer-clipped list.

## 2. Separate EDY Challan creation
Instead of mixing EDY entries in the production-lot dropdown, EDY challans get their own dedicated flow. Headers and footer identical to production challans; only the items table differs.

### 2a. Data model (reuse existing `challans` + `challan_items`)
Add a single column so we don't need parallel tables.

```sql
-- sql_migrations/20260708_edy_challan_kind.sql
alter table public.challans
  add column if not exists challan_kind text not null default 'production'
  check (challan_kind in ('production','edy'));
create index if not exists idx_challans_kind on public.challans(challan_kind);
```

EDY line items store:
- `lot_no` = EDY receipt number (already used as `EDY-<receipt_number>` for stock lookup — unchanged)
- `shade_number`, `color_name` (dyer name stored here for display), `gross_weight`, `num_of_units`
- `packaging_type` = `'chesse'` (default; user only sees # of cones)
- `net_weight`, `rate`, `amount` = 0 (no billing on EDY challans)

No new tables, no schema change to `challan_items`.

### 2b. New page: `src/pages/CreateEDYChallan.tsx`
- Header identical to `CreateChallan` (challan number, date, client, notes).
- Item rows: **Dyer · Shade · Lot (EDY receipt) · Gross Wt (kg) · # of Cones · Delete**.
- Lot picker: portal-based dropdown filtered to EDY stock only (`useEDYCurrentStock`), showing Dyer + Shade + balance. Selecting auto-fills Dyer & Shade.
- Totals row shows sum of Gross Wt.
- Footer identical (Prepared By, Receiver Name, Receiver Contact) reusing `FooterAutocomplete` + `useChallanFooterOptions`.
- Uses new `useCreateEDYChallan` hook that inserts with `challan_kind='edy'`.

### 2c. Hook changes (`src/hooks/useChallan.ts`)
- `mapChallan` reads `challan_kind` (default `production`).
- `useCreateChallan` inserts with `challan_kind: 'production'`.
- Add `useCreateEDYChallan` mirroring insert but with `challan_kind: 'edy'` and rate/amount/net_weight = 0. Stock deduction still fires (net_weight = 0 for EDY, so deduct by gross_weight instead: pass `gross_weight` into `applyChallanStockDelta` for EDY).

### 2d. Remove EDY entries from production dropdown
In `ChallanItemRow.tsx`, drop the `edyOptions` block entirely. The production Create Challan reverts to production-lots-only.

### 2e. `ChallanList` (All Challans tab)
- Add a **Type** column (badge: "Production" / "EDY").
- Add a "New EDY Challan" button next to the existing "New Challan" button (or a split dropdown).
- Optional filter: Type = All / Production / EDY.
- EDY rows: Net Weight column shows gross weight total; Amount shows "—".

### 2f. `ChallanDetail`
- If `challan_kind === 'edy'`, render an EDY-specific items table (Dyer, Shade, Lot, Gross Wt, # of Cones, no rate/amount), and hide amount totals.
- Otherwise unchanged.

### 2g. Routing (`src/App.tsx`)
- Add `/dispatch/create-edy` → `CreateEDYChallan`.

## Files touched
- new: `sql_migrations/20260708_edy_challan_kind.sql`
- new: `src/pages/CreateEDYChallan.tsx`
- edited: `src/components/ChallanItemRow.tsx` (portal dropdown, drop EDY options)
- edited: `src/hooks/useChallan.ts` (`challan_kind`, `useCreateEDYChallan`, EDY stock delta by gross)
- edited: `src/types/challan.ts` (`challan_kind` field)
- edited: `src/pages/ChallanList.tsx` (Type column, New EDY button, type filter)
- edited: `src/pages/ChallanDetail.tsx` (EDY view mode)
- edited: `src/App.tsx` (route)

## Out of scope
- Editing EDY challans (Edit dialog) — can be added later; delete already works via existing flow.
- PDF layout tweaks for EDY challans — will use existing PDF for now unless you want a distinct layout.
