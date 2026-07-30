## Goal
Rework Stock Inward (raw materials only) so line entry is Item Type → Item → Qty → Unit → Rack → Remarks, remove pricing, and show line items in the list.

## Line item changes (`src/pages/store/StoreInwardCreate.tsx`)
- New first column **Item Type**: dropdown with Grey Yarn, Chemicals, Colors (dye), Oil — mapped to the existing raw-material sub-categories.
- **Item**: searchable combobox filtered to items of the selected type; typing a new name stages it for creation with that type (category `raw_material`, sub-category from Item Type). Item Type must be picked before the Item dropdown is enabled.
- **Qty** and **Unit** kept (unit auto-fills from the picked item, editable for new items).
- **Rack**: dropdown of active racks plus a "+" button opening the existing `AddRackDialog`, with the new rack auto-selected (same pattern as FG/EDY forms).
- **Remarks**: unchanged free text.
- **Remove Rate, Amount, and the Total Amount summary** from the form; save writes `total_amount = 0` and no rate/amount on transactions.

## Header
Unchanged (Date, Supplier, Invoice #, GRN #, Bill upload, Remarks).

## Validation
- Block save when quantity is ≤ 0 or blank, or when Item Type / Item / Unit are missing.
- Warn (non-blocking confirm) when the invoice number already exists for another inward entry.

## List page (`src/pages/store/StoreInwardList.tsx`)
- Each row becomes expandable: clicking a row reveals its line items (Item Type, Item, Qty, Unit, Rack, Remarks), read from the linked stock transactions.
- Drop the Total Amount column since pricing is removed.

## Technical notes
- Lines are stored in `store_stock_transactions` with `reference_type='stock_inward'`; no schema change is required — Rate/Amount columns simply stop being populated.
- Item Type is derived from `store_items.sub_category`, so no new column is needed.
- Add a hook in `src/hooks/useStore.ts` to fetch inward lines (with item + rack names) for the expandable list rows.
