## Goal

Build a fully automated, **delta-safe** inventory system covering yarn, dyes, chemicals, oil and finished goods — with a single approval popup gating every inventory write triggered by lot saves and dispatch saves.

---

## 1. Database changes (one migration)

### New tables

**`yarn_inventory`** — keyed by `(yarn_company, yarn_type)`
- `id` uuid pk, `yarn_company` text, `yarn_type` text, `current_stock` numeric (kg), `last_updated` timestamptz
- unique(`yarn_company`, `yarn_type`); allow negative stock (no check)

**`material_inventory`** — for dyes & chemicals (separate from existing `inventory_stock`)
- `id` uuid pk, `master_item_id` uuid fk → `master_items(id)`, `current_stock` numeric (gm), `last_updated` timestamptz
- unique(`master_item_id`)

**`oil_inventory`** — single-row table
- `id` uuid pk default gen_random_uuid(), `current_stock` numeric (kg), `last_updated`
- seeded with one row at `0`

**`finished_goods_stock`** — one row per lot
- `lot_no` text pk fk → lots, `original_cones` int, `original_net_weight` numeric, `remaining_cones` int, `remaining_net_weight` numeric, `last_updated`

**`inventory_transactions_v2`** — unified ledger for all four inventories
- `id`, `inventory_kind` ('yarn'|'material'|'oil'|'fg'), `ref_key` text (yarn key / master_item_id / lot_no / 'OIL'), `delta` numeric, `source` text ('Lot Save'|'Dispatch'|'Lot Edit'|'Dispatch Edit'|'Lot Delete'|'Dispatch Delete'), `reference_id` text (lot_no or challan_id), `notes`, `created_at`

### Tracking columns (delta state)

On `lots`:
- `last_yarn_consumed` numeric default 0 (kg)
- `last_dye_consumption` jsonb default '{}'  — `{ master_item_id: grams }`
- `last_chemical_consumption` jsonb default '{}' — `{ master_item_id: qty }`
- `inventory_synced` boolean default false

On `challans`:
- `last_oil_by_lot` jsonb default '{}' — `{ lot_no: oil_kg }`
- `last_fg_by_lot` jsonb default '{}' — `{ lot_no: { cones, net } }`
- `inventory_synced` boolean default false

---

## 2. Core engine — `src/lib/inventoryEngine.ts` (new)

Pure functions, no UI:

- `computeLotConsumption(lot, recipeDyes, recipeChemicals, processSteps, stepDyes, stepChemicals)` →
  ```
  { yarn: { key, delta_kg }, dyes: [{ master_item_id, delta_g }], chemicals: [{ master_item_id, delta }] }
  ```
  Reads `lots.last_*` columns to compute deltas (new_total − last_applied).

- `computeDispatchConsumption(challan, items, lots)` →
  ```
  { fg: [{ lot_no, delta_cones, delta_net }], oil: [{ lot_no, delta_kg }] }
  ```
  Uses the existing oil formula. Deltas vs `challans.last_*`.

- `previewToRows(preview)` → array of `{ label, prevStock, change, newStock, warn }` for the popup, after fetching current stocks.

- `applyPreview(preview)` → writes all inventory rows + ledger entries + updates `last_*` columns + sets `inventory_synced = true`. All in a single Promise.all batch (Supabase has no client-side tx; we accept best-effort and log failures).

- Auto-create on read: helpers `getOrCreateYarn(company, type)`, `getOrCreateMaterial(master_item_id)` — insert with `current_stock = 0` if missing.

---

## 3. Approval popup — `src/components/InventoryApprovalDialog.tsx` (new)

- Props: `open`, `rows: ApprovalRow[]`, `onApprove()`, `onCancel()`
- Renders one table grouped by section (Yarn / Dyes / Chemicals / Finished Goods / Oil) showing **Item · Prev · Change · New**
- Rows where `newStock < 0` get a red badge + warning icon
- Buttons: **Approve Changes** (primary) / **Cancel**
- On Cancel: caller marks `inventory_synced=false` (record already saved), inventory untouched.

---

## 4. Wiring into save flows

### Lot create / edit (`CreateLot.tsx`)
After the existing lot+recipe+steps save succeeds:
1. `computeLotConsumption(...)` → preview
2. Open `InventoryApprovalDialog` with rows
3. On Approve → `applyPreview` + update `lots.last_*` + `inventory_synced=true`
4. On Cancel → `inventory_synced=false`, toast "Lot saved, inventory not synced"

### Process step add/edit (`ProcessStepForm.tsx`)
Same flow — recompute total lot consumption (base + all steps) and trigger one popup.

### Dispatch save (`CreateChallan.tsx` / `ChallanDetail.tsx` edit)
After challan + items save succeeds:
1. `computeDispatchConsumption(...)` → preview (FG + oil)
2. Approval popup
3. On Approve → write FG + oil + ledger + update `challans.last_*`

### Lot/Dispatch delete
Reverse last applied amounts (negate stored `last_*`) through the same popup → "Restore inventory?"

---

## 5. Finished goods seeding

When a lot is created and saved (regardless of inventory approval), insert/update `finished_goods_stock` with `original_*` = `remaining_*` = lot weights. This is structural, not stock-affecting, so it runs without approval.

---

## 6. Inventory UI

Extend `InventoryList.tsx` with **tabs**:
- **Materials (Purchase)** — existing `inventory_stock` (unchanged)
- **Yarn** — from `yarn_inventory`
- **Dyes & Chemicals** — from `material_inventory` joined to `master_items`
- **Oil** — single card with current stock + ledger
- **Finished Goods** — from `finished_goods_stock` joined to `lots`

Each tab: search + table; clicking a row shows its ledger from `inventory_transactions_v2`.

Packing: no inventory deduction. Optionally compute and display `small_bags = cones`, `big_bags = ceil(cones/12)` on challan detail (display only). Out of scope for inventory writes.

---

## 7. Order of implementation

1. Migration (schema + seed oil row) — user runs SQL
2. `inventoryEngine.ts` + types
3. `InventoryApprovalDialog.tsx`
4. Hook into `CreateLot` save
5. Hook into `ProcessStepForm` save
6. Hook into `CreateChallan` + `ChallanDetail` save
7. Finished-goods seeding on lot save
8. Inventory UI tabs + ledger drilldowns
9. Delete-flow reversals (lots & challans)

---

## Technical notes

- All deltas computed against stored `last_*` JSON, so re-saves never double-deduct.
- Auto-create everywhere: `getOrCreate*` runs inside `computeLotConsumption` so the popup already shows `Prev = 0` for brand-new items.
- Negative stock allowed — no DB check; popup warns visually.
- Single popup per save = batched preview rows from one engine call.
- Existing `inventory_stock` (purchases/expenses) stays untouched — it's a different domain.
- All numeric math uses the same precision rules already in the project (3dp weights, 2dp amounts).
- No backend functions needed; engine runs client-side using the existing supabase-js client.

---

## Out of scope (unless you ask)

- Reorder alerts for new inventories (can reuse `minimum_stock_level` pattern later)
- CSV bulk-upload for yarn/oil opening stock (use the existing Adjust Stock pattern after MVP)
- Server-side enforcement / triggers (kept client-side per project's current Supabase-only architecture)
