## Goal

Improve the existing Store Management module so users never have to pre-create items. Items get created automatically from business transactions, and the Item Master becomes a passive Inventory Catalogue. Keep all existing tables, routes, hooks and transaction architecture intact.

## Scope (what changes / what does NOT)

Changes only:
- One new migration (additive) for storage/columns + view updates.
- `StoreItemMaster` page repurposed to read-only **Inventory Catalogue**.
- `StoreInwardCreate` gets an inline "Create new item" flow with duplicate detection + bill upload.
- `StoreAssetManagement` gets "Create new Asset" action that auto-creates a catalogue entry.
- Finished Goods & External Dyed Yarn auto-create catalogue entries on first receipt (mostly already done — only enforce + dedupe).
- Current Stock displays latest rack derived from transactions.
- Hooks in `useStore.ts` get a few helpers (`useFindSimilarItems`, `useCreateItemFromTransaction`, `useUploadInwardBill`).

Preserved untouched:
- All existing tables (`store_items`, `store_stock_transactions`, `store_racks`, `store_inwards`, `store_internal_issues`, `store_finished_goods_receipts`, `store_edy_receipts`, `store_assets*`, `store_stock_verification*`, ledger view, asset view, etc.).
- ERP integrations (challan dispatch, activity center logging).
- Stock Ledger architecture (still the single source of truth).
- Sidebar entries (only label "Item Master" → "Inventory Catalogue").

## Database migration

New file `sql_migrations/20260625_inventory_catalogue_upgrade.sql` (additive only):

1. `ALTER TABLE store_items` — add `first_received_at timestamptz` (nullable). `default_rack` stays but is no longer required/used by the UI (catalogue rack is derived).
2. `ALTER TABLE store_inwards` — add `bill_url text` and `bill_path text` for uploaded invoice files. (Verify exact table name in the existing inward migration; keep `inward_date`, `supplier`, `invoice_number`, `remarks` as already present.)
3. Drop & recreate `store_current_stock_by_item` view so each row includes the **latest rack** (rack of the most-recent transaction) and `last_transaction_date`, plus `first_received_date` (MIN of inflows) and `current_quantity` (SUM). Single row per item — replaces the per-rack grouping currently used in dashboards. Existing `store_current_stock` view is left intact for backward compatibility.
4. Create Supabase storage bucket `inward-bills` (public read, authenticated write) via `INSERT INTO storage.buckets ... ON CONFLICT DO NOTHING` + matching policies (mirroring `expense-bills`).
5. Trigger `tg_store_items_first_received`: on first inflow transaction (`quantity > 0`) for an item where `first_received_at IS NULL`, stamp `store_items.first_received_at = NEW.transaction_date`.

No data is deleted or moved. No tables are dropped.

## Backend hooks (`src/hooks/useStore.ts`)

Add:
- `useFindSimilarItems(name: string, category?)` — fuzzy match via `ilike %tokens%` on `store_items.item_name`; returns top 5.
- `useUpsertCatalogueItem()` — given `{ item_name, category, sub_category, unit, is_asset }`, returns existing item id if exact-match on `(lower(item_name), category)` exists; otherwise inserts a new `store_items` row. Used by Inward + Asset + FG + EDY flows.
- `useUploadInwardBill()` — uploads to `inward-bills/<inward_id>/<filename>`, returns public URL.
- Update `useCreateStoreInward` to accept either `item_id` (existing) or `new_item: {...}` per line, call `useUpsertCatalogueItem` server-side (in the mutation function) before posting the stock transaction.
- Update `useStoreCurrentStockByItem` to read from the new view (now also exposes `latest_rack_*`, `first_received_date`, `last_transaction_date`).

Existing FG and EDY hooks already auto-create items — add a `useUpsertCatalogueItem` call instead of their bespoke insert, so dedupe is consistent. Naming rules:
- FG → `item_name = lot_number`, category `finished_good`, sub_category `Production Lot`.
- EDY → `item_name = ${lot}_${shade}_${dyer}`, category `external_dyed_yarn`, sub_category `External Production`.

## UI changes

### 1. `StoreItemMaster.tsx` → Inventory Catalogue (read-only)
- Rename heading & sidebar label to "Inventory Catalogue".
- Remove "Create Item" / "Edit" buttons (admin still gets an "Edit" overflow action for unit/category corrections only — no delete).
- Columns: Item Name · Category · Sub Category · Unit · Asset (Yes/No) · Created Date · First Received · Last Transaction · Current Stock.
- Search box + filters: Category, Sub Category, Asset, Has Stock.
- Sortable headers (client-side).
- Row click → existing Inventory Timeline.

### 2. `StoreInwardCreate.tsx` — inline item creation
For each line, the "Item" cell becomes a **Combobox with two modes**:
- Type to search existing `store_items` (live filter).
- If no exact match, footer shows **"+ Create '<typed name>' as new item"**.
- Choosing "Create" opens a small inline dialog: Category, Sub Category, Unit (required), Asset toggle (auto-shown only when Category = Tools & Equipment). On confirm, dialog calls `useUpsertCatalogueItem` and selects the returned item id into the row.
- Before insert, `useFindSimilarItems` runs; if matches exist, the dialog shows a "Did you mean?" panel listing them with **Use Existing Item** buttons. User must explicitly click **Create New Item** to bypass.

Header gets two new fields:
- **Upload Bill** (`<input type=file accept="application/pdf,image/*">`) — uploaded via `useUploadInwardBill` after the inward header is saved; URL stored on `store_inwards.bill_url`.
- (Date, Supplier, Invoice Number, Remarks already present.)

Per-row fields retained: Quantity, Unit (auto from item), Rate (opt), Amount (opt), Rack, Remarks. Rack is **per transaction only** — never written back to `store_items`.

### 3. `StoreAssetManagement.tsx`
- Replace existing "Register Asset" dialog (currently pulls only existing tool_equipment items) with a "New Asset" dialog that captures: Item Name, Sub Category, Unit, Remarks. On submit:
  1. `useUpsertCatalogueItem` with `category='tool_equipment'`, `is_asset=true`.
  2. Existing asset registration flow proceeds with the returned `item_id`.
- Existing "select from catalogue" path stays as a secondary tab for power users.

### 4. Finished Goods & External Dyed Yarn
- Receive forms unchanged visually. Internally swap the bespoke `store_items` insert for `useUpsertCatalogueItem` (idempotent on `(item_name, category)`), so re-receiving the same lot reuses the row instead of erroring on the unique `item_code`.
- Generate `item_code` deterministically: `FG-<lot_no>` and `EDY-<receipt_number>` (existing logic preserved as the dedupe key).

### 5. Current Stock (`StoreCurrentStock.tsx`)
- Switch source to the new view. Columns become: Item · Category · Sub Category · Latest Rack · Current Qty · Unit · Last Transaction. (Existing transaction-history drawer kept.)

### 6. Sidebar (`AppSidebar.tsx`)
- Rename "Item Master" → "Inventory Catalogue". Same route `/store/item-master` (no route changes to avoid breakage).

## Duplicate-detection algorithm

`useFindSimilarItems(name, category?)`:
- Normalise: lowercase, strip punctuation, split on whitespace.
- Query: `store_items` with `item_name ilike %<each token>%` AND optional `category = ?`.
- Score = number of tokens matched + bonus for exact-prefix match. Return top 5 with score ≥ 1, ordered desc.
- Used in Inward "Create new item" dialog and Asset "New Asset" dialog.

## Backward compatibility

- No existing route, table, column or migration is removed.
- Existing items in `store_items` keep working as-is; `first_received_at` backfills lazily via trigger on next inflow (and an inline `UPDATE store_items SET first_received_at = (SELECT MIN(transaction_date) FROM store_stock_transactions t WHERE t.item_id = store_items.id AND t.quantity > 0)` one-time backfill in the migration).
- Old `store_current_stock` view kept untouched; new view added side-by-side.
- ERP integrations (challan dispatch, activity center, ledger) untouched.

## Files touched

- `sql_migrations/20260625_inventory_catalogue_upgrade.sql` (new)
- `src/hooks/useStore.ts` (additive helpers + small updates)
- `src/pages/store/StoreItemMaster.tsx` (rework to catalogue)
- `src/pages/store/StoreInwardCreate.tsx` (inline create + bill upload)
- `src/pages/store/StoreAssetManagement.tsx` (new-asset dialog)
- `src/pages/store/StoreFinishedGoodsReceive.tsx` (swap to upsert)
- `src/pages/store/StoreExternalDyedYarnReceive.tsx` (swap to upsert)
- `src/pages/store/StoreCurrentStock.tsx` (new view columns)
- `src/components/AppSidebar.tsx` (label only)

No deletions. No route changes.
