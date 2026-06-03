## Goal

Introduce a third role **`editor`** alongside existing `admin` and `viewer`.

| Role | Read | Master data writes | Transactional writes |
|------|------|--------------------|----------------------|
| admin  | all | all                | all (any row)        |
| editor | all | ❌ none            | ✅ insert; edit/delete **own** rows only |
| viewer | all | ❌                 | ❌                   |

Enforcement: **frontend-only** (per request). Backend RLS stays permissive.

---

## Changes

### 1. DB migration — `sql_migrations/20260603_editor_role.sql`
- Extend enum: `alter type public.app_role add value if not exists 'editor';`
- Update `get_my_role()` precedence: admin > editor > viewer.
- Add `created_by uuid` (nullable, default `auth.uid()`) to transactional tables:
  `lots, recipe_dyes, recipe_chemicals, process_steps, step_dyes, step_chemicals, lot_photos, intake_entries, intake_items, expenses, expense_documents, expense_line_items, challans, challan_items, inventory_transactions`.
- Leave master data tables untouched: `clients, client_rate_master, company_master, master_items, suppliers, expense_categories`.
- No RLS changes (frontend-only enforcement, legacy rows remain unowned and treated as "not yours").

### 2. Role context — `src/context/RoleContext.tsx`
- `AppRole = 'admin' | 'editor' | 'viewer'`
- Add `isEditor`, keep `isAdmin`, `isViewer`. Precedence: admin > editor > viewer; default = viewer.

### 3. New `EditorGuard` component — `src/components/EditorGuard.tsx`
Runs only when `isEditor`. Two responsibilities via MutationObserver (same pattern as ViewerGuard):

- **Master-data lockdown**: on routes matching master-data paths (`/master-data`, `/clients`, `/dispatch/client-rates`, `/inventory/items`, `/companies`, `/suppliers`, etc.), hide all write controls (same keyword/icon rules as ViewerGuard).
- **Ownership filter**: any element with `data-owner-id="<uuid>"` that does NOT match `user.id` gets its descendant edit/delete buttons (matched by WRITE_KEYWORDS + write icons) hidden. Rows without `data-owner-id` (legacy) are treated as not-owned → edit/delete hidden.
- New-item buttons ("Add", "Create", "New") remain visible everywhere except master data.

### 4. Tag rows with owner — minimal changes
For each list/detail surface that exposes edit/delete on transactional records, add `data-owner-id={row.created_by}` to the row's container `<tr>` / card `<div>`. Files to touch:
- `src/pages/LotList.tsx`, `src/pages/LotDetail.tsx`
- `src/components/ProcessStepList.tsx`
- `src/components/LotPhotos.tsx`
- `src/pages/IntakeDetail.tsx` (intake_items)
- `src/pages/CreateExpense.tsx` / expense lists
- `src/pages/ChallanList.tsx`
- `src/pages/InventoryList.tsx` (transactions list)

Detail pages (single record like LotDetail) also wrap the page in `data-owner-id`.

### 5. Populate `created_by` on insert
Default is set DB-side via `default auth.uid()`, but to be safe & explicit, update insert call sites to include `created_by: user.id` for the tables listed in (1). Touch the existing create flows: `CreateLot`, `CreateIntake`, `CreateExpense`, lot recipe/process step inserts, photo uploads, challan create, inventory transactions.

### 6. User Management UI — `src/pages/UserManagement.tsx`
- Add third button: **Make editor**.
- Update role badge styles for editor (e.g. amber).
- Row type now `'admin' | 'editor' | 'viewer'`.

### 7. App wiring — `src/App.tsx`
- Mount `<EditorGuard />` next to `<ViewerGuard />`.
- `WriteRoute` (currently blocks viewers from create pages) → also block editors from **master-data create/edit routes** only; keep transactional create routes open.

---

## Out of scope
- No RLS changes (per "frontend only").
- No backfill of `created_by` on existing rows.
- Editors will see legacy (pre-migration) rows as not-editable; admin remains the escape hatch.

## Risks / notes
- Adding an enum value in Postgres must be committed before being referenced — the migration uses `add value if not exists` in its own statement; subsequent `set_user_role` calls work because they're invoked from the app, not the same transaction.
- Frontend-only enforcement means a determined editor can still write via devtools. Acceptable per user direction.
