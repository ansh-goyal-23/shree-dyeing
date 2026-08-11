# Challan Payment Tracking

Track whether each dispatch challan has been paid, support partial payments, and let an admin mark many challans paid in one action.

## What gets added

**Per challan**
- Payment status: Unpaid / Partially Paid / Paid (derived from amount received vs challan total).
- Amount received (Rs.), editable by admins only.
- Balance = challan total (sum of item amounts) − amount received, shown alongside.

**Challan list (Dispatch — Challans)**
- New "Payment" column with a colored status badge (Paid green, Partially Paid amber, Unpaid red) and balance underneath when not fully paid.
- New filter: Payment status (All / Paid / Partially Paid / Unpaid), alongside existing client and date filters.
- Totals bar gains "Received" and "Outstanding" for the currently filtered set.
- Checkbox column (admins only) with a header select-all for the filtered rows.
- Sticky action bar appears when rows are selected: "Mark N challans as Paid" (sets amount received = each challan's total) and "Clear selection".

**Challan detail page**
- Payment card showing status, total, received, balance.
- Admin-only controls: "Mark as Paid", enter a partial amount received, and "Mark as Unpaid" (resets received to 0).

**Permissions**
- Only Admin can change payment status or amount; Editors and Viewers see the status read-only (existing role context + guard components).

**Activity log**
- Each payment change writes an activity entry (challan number, previous → new received amount) so it shows up in the Activity Center.

## Technical notes

- New migration `sql_migrations/20260811_challan_payments.sql`:
  - `ALTER TABLE public.challans ADD COLUMN amount_received numeric(14,2) NOT NULL DEFAULT 0`, plus `paid_at timestamptz NULL` (set when fully paid, cleared otherwise).
  - Admin-only UPDATE policy for these columns is enforced in the app layer; DB keeps the existing permissive write policies plus grants already in place for `challans`.
- `src/types/challan.ts`: add `amount_received` and `paid_at` to `Challan`.
- `src/hooks/useChallan.ts`: add `useUpdateChallanPayment` (single) and `useBulkMarkChallansPaid` (multi-id update in one request), both invalidating the `challans` query and calling `logActivity` from `src/lib/activityLog.ts`. Mutations tolerate a missing column (same fallback pattern used elsewhere) so the UI does not break before the migration is applied.
- `src/pages/ChallanList.tsx`: selection state (`Set<string>`), payment filter, payment column, bulk action bar. Challan totals already come from `itemSummaryMap` — reuse it for balance math.
- `src/pages/ChallanDetail.tsx`: payment card wrapped so controls only render for admins.
- Amounts use 2 decimals and the existing "Rs."/₹ conventions; no changes to the challan PDF.
