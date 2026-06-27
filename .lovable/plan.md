## Goal
Consolidate the Store/Inventory schema in Supabase to remove redundant tables, duplicated columns, and overlapping views — without breaking the working Store UI.

## Redundancies identified

**Dead tables from the decommissioned old inventory module** (kept by old migration `20260430_inventory_system.sql`, no longer referenced by any code):
- `yarn_inventory`
- `material_inventory`
- `oil_inventory`
- `finished_goods_stock`
- `inventory_transactions_v2`
- Tracking columns on `lots` (`last_yarn_consumed`, `last_dye_consumption`, `last_chemical_consumption`, `inventory_synced`)
- Tracking columns on `challans` (`last_oil_by_lot`, `last_fg_by_lot`, `inventory_synced`)

**Overlapping receipt tables** — FG and EDY are 90% the same shape:
- `store_finished_goods_receipts` and `store_external_dyed_yarn_receipts` both carry: receipt_number, receipt_date, shade, lot_no, cone_count, gross_weight, net_weight, rack_id, item_id, remarks. Plus EDY‑only: supplier, challan_number, challan_pdf, rate, amount.

**Duplicate views**:
- `store_current_stock` (per item+rack) and `store_current_stock_by_item` (per item) — only the by_item one is actually used by the UI.
- `store_fg_current_stock` and `store_edy_current_stock` are structurally identical aggregations.

**Columns duplicated between headers and `store_stock_transactions`**:
- supplier, remarks, rack_id, person, department are already on the transaction row and on the header. The header copy is the redundant one.
- `store_stock_inward.total_amount` is derivable from SUM(amount) on its transactions.

## Plan

### Migration 1 — `20260627_drop_legacy_inventory.sql`
Drop the old inventory module entirely:
- `DROP TABLE` (CASCADE) `yarn_inventory`, `material_inventory`, `oil_inventory`, `finished_goods_stock`, `inventory_transactions_v2`.
- `ALTER TABLE lots DROP COLUMN` the 4 inventory tracking columns.
- `ALTER TABLE challans DROP COLUMN` the 3 inventory tracking columns.
- Drop the now-unused `store_current_stock` view (UI uses `store_current_stock_by_item`).

### Migration 2 — `20260627_unify_receipts.sql`
Replace `store_finished_goods_receipts` and `store_external_dyed_yarn_receipts` with a single table `store_yarn_receipts`:

```text
store_yarn_receipts
  id, receipt_number, receipt_date,
  source            enum('finished_goods','external_dyed_yarn')
  lot_no, shade, shade_number, yarn_type,
  client            -- null for EDY
  supplier          -- null for FG (the external dyer)
  challan_number, challan_pdf_url, challan_pdf_path,
  cone_count, gross_weight, net_weight,
  rate, amount,
  rack_id, item_id, remarks,
  created_at, updated_at, created_by
```

- Data migration: copy both existing tables into the new one (source = 'finished_goods' / 'external_dyed_yarn'), then drop the old tables.
- Replace `store_fg_current_stock` and `store_edy_current_stock` with one view `store_yarn_receipt_stock` filtered by `source`.
- Update `useStore.ts` (`useCreateFGReceipt`, `useCreateEDYReceipt`, list hooks) and the FG/EDY pages to read/write the unified table.

### Migration 3 — `20260627_trim_header_columns.sql`
Remove redundant columns now that transactions are authoritative:
- `store_stock_inward`: drop `supplier`, `remarks` (kept on the transaction rows). Replace `total_amount` column with a computed view, or keep but document it as a cache — your call (default: drop it, sum on read).
- `store_internal_issues`: drop `department`, `issued_to`, `remarks`.
- `store_assets`: drop `department`, `rack_id`, `remarks` from the table (latest values are already derivable from `store_asset_movements` + last `store_stock_transactions`). Keep `current_holder` and `status` because they're queried hot.

### App code updates
- `src/types/store.ts` — collapse FG/EDY interfaces into `StoreYarnReceipt`, remove dropped header fields.
- `src/hooks/useStore.ts` — update receipt creation hooks; replace `store_fg_current_stock` / `store_edy_current_stock` reads with `store_yarn_receipt_stock`.
- `src/pages/store/StoreFinishedGoodsReceive.tsx`, `StoreFinishedGoodsList.tsx`, `StoreExternalDyedYarnReceive.tsx`, `StoreExternalDyedYarnList.tsx` — point at the unified table/view.
- `src/pages/store/StoreInwardCreate.tsx`, `StoreInwardList.tsx`, `StoreIssueForm.tsx`, `StoreIssueList.tsx`, `StoreAssetManagement.tsx` — stop writing/reading the trimmed header columns.

## What stays untouched
- `store_items`, `store_racks`, `store_stock_transactions`, `store_stock_ledger`, `store_current_stock_by_item`, `store_asset_movements`, `store_stock_verifications` — these are the lean core and stay as-is.
- All Store UI behavior, screens, and routes remain functionally identical to users.

## Risks / confirmation needed
1. The legacy inventory tables in Migration 1 may still hold historical data. **Drop them outright, or export to a `legacy_*` schema first?**
2. Unifying FG + EDY changes table names existing reports/exports rely on. OK to migrate data and remove the originals?
3. Are you OK losing `store_stock_inward.total_amount` as a stored column (computed on read instead)?
