## 1. Internal Issue: remove rack creation

In `src/pages/store/StoreIssueForm.tsx`:
- Remove the `AddRackDialog` button (and its import) from the Rack cell. Issues only draw down stock that already exists in a rack, so creating a rack here can never have stock.
- Keep the rack dropdown itself, but restrict it to racks that actually hold stock for the selected item (from `useStoreCurrentStock`), falling back to the full rack list only if the item has no stock rows.

## 2. Stock Inward: add "Packing Polythene"

In `src/pages/store/StoreInwardCreate.tsx`:
- Add `{ value: 'packaging_material', label: 'Packing Polythene' }` to `INWARD_ITEM_TYPES` (reuses the existing `packaging_material` sub-category already defined in the schema, so no migration needed).

In `src/pages/store/StoreIssueForm.tsx`:
- Add the same entry to `ISSUE_ITEM_TYPES` so packing polythene received via inward can also be issued.

## Technical notes
- No schema or SQL change: `store_raw_subcategory` already includes `packaging_material` and `sub_category` is stored as free text.
- Label wording stays "Packing Polythene" in the UI while the stored value remains `packaging_material` for consistency with existing data.
