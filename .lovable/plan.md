## Goal
Bring Internal Issue (form + list) in line with the reworked Stock Inward: type-filtered searchable item picker, rack quick-add, stricter validation, and a list whose rows expand to show line items.

## Form changes (`src/pages/store/StoreIssueForm.tsx`)
Line row fields become: **Item Type → Item → Qty → Unit → Rack (+ Add Rack) → Available → Purpose**.

- **Item Type**: dropdown reusing `INWARD_ITEM_TYPES` (Grey Yarn, Chemicals, Colors, Oil) exported from `StoreInwardCreate`, plus the non-raw types already usable for issues (Office Utility, Tools & Equipment) so consumables of any kind can be issued. Selecting a type filters the item list.
- **Item**: replace the plain `<Select>` with the same Popover + Command searchable combobox used in Stock Inward, filtered by the chosen type. Unlike Inward, **no create-on-type** — you can only issue items that already exist in the catalogue (you can't issue stock you never received).
- **Unit**: auto-filled from the item; shown read-only as today.
- **Rack**: keep the rack dropdown, add the `+` button wired to `AddRackDialog` (same as Inward/FG/EDY forms). Default to the item's `default_rack`.
- **Available**: keep the live available-qty column from `useStoreCurrentStock`.
- **Purpose**: unchanged free-text.

## Validation (matching Inward's strictness)
- Item Type required on every filled row.
- Item required on every filled row.
- Quantity must be > 0 (blocks zero/negative).
- Unit required.
- New: block save when requested qty exceeds available stock for that item+rack on **create** (currently only shown as a red hint). On **edit**, keep it a warning only, since previous lines get reversed.
- Duplicate-row warning: if the same item+rack appears twice, confirm before saving.

## List changes (`src/pages/store/StoreIssueList.tsx`)
- Rows become expandable (chevron), same as `StoreInwardList`, showing a sub-table of line items: Item Type, Item, Qty, Unit, Rack, Purpose.
- Keep existing columns and the edit action.

## Technical notes
- Add `useStoreIssueLineDetails(issueNumber)` in `src/hooks/useStore.ts`, mirroring `useStoreInwardLineDetails`: fetch `store_stock_transactions` where `reference_type = 'internal_issue'` and `reference_number = issueNumber`, then map item (name, sub_category, unit) and rack (code, name) via separate queries per the project's data-mapping pattern. Net out reversal pairs so an edited issue shows only current effective lines.
- Move `INWARD_ITEM_TYPES` usage by import; no schema change needed — `purpose` and rack already exist on `store_stock_transactions`.
- No stock is ever written directly; issue save/edit continues to post signed transactions and reversals through the existing `useCreateStoreIssue` / `useUpdateStoreIssue` hooks.
