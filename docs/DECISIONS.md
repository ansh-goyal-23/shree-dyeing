# Decisions & Rationale
## Yarn Dyeing Factory Management System

**Compiled:** 25 August 2026
**Sources:** full project chat history (first message 19 March 2026 → present) cross-checked against the current codebase (`src/**`, `sql_migrations/**`, `supabase/migrations/**`).
**Convention:** quotes are the user's own words from chat (lightly trimmed). Each entry ends with a **Status** line confirming whether the decision still holds in the shipped code, or flagging divergence.

---

## 1. Genesis (19 March 2026)

**Request.** "Build a web-based factory management system for a yarn dyeing unit. This module is for managing dyeing lots, shade development, and recipe tracking. CORE SYSTEM LOGIC (VERY IMPORTANT) LOT-BASED SYSTEM — Every batch is identified by a unique Lot Number…"

- First build was a pure front-end React app ("Chromatech OS") with state in `localStorage`.
- Same day, two precision/usability requests set lasting conventions:
  - "COMPANY NAME AUTOCOMPLETE (FOR DYES & CHEMICALS)… show previously entered companies" → the autocomplete pattern (`CompanyAutocomplete` and friends) used everywhere since.
  - "ADD SUPPORT FOR MULTIPLE UNITS IN CHEMICALS AND DYES… gm kg ml litre" → unit is a first-class field on every master item.

**Status:** Holds. Lot-number-centric model is still the core; units and company autocomplete are pervasive.

## 2. Leaving Lovable Cloud — Supabase + Render (19–20 March 2026)

**Request.** "I want to store this data and login authentication on supabase… The problem with lovable cloud is that the day i stop subscribing to lovable, i would not be able to access my historical data."

- Auth choice: "basic email/password is sufficient" and "I dont care if the email is valid or not. Any gibberish email should work for signup" → email confirmation disabled in Supabase; no other providers.
- Hosting: "I want to host my frontend (master branch) on render… I want to move away from lovable cloud which is currently hosting my frontend." A rewrite rule (`/*` → `/index.html`) was configured on Render for client-side routing.
- Workflow settled as **Lovable (dev) → GitHub (master) → Render (hosting)**; the Lovable publish button is deliberately unused.
- Reinforced later (25 June 2026): "Never Use Lovable Cloud."

**Status:** Holds. `src/integrations/supabase/client.ts` points at the user-owned project; no Lovable Cloud anywhere. Manual SQL migrations remain the schema-change mechanism.

## 3. Recipes: versions abandoned for process steps (20–22 March 2026)

- 20 Mar: "ADD SUPPORT FOR POST-DYE ACTIONS… Define 3 action types" → Color Addition, RC, Leveling, each with own dyes/chemicals.
- 22 Mar (reversal): "REMOVE OLD VERSION SYSTEM AND REPLACE WITH PROCESS-BASED STEPS. Do NOT use Version A, B, C. Do NOT create artificial versions." The initial recipe became the **Base Recipe**; everything after dyeing is a numbered **Process Step**. Photo support per step was requested in the same message.
- 24 Mar: "process steps should also be editable" → edit replaces a step's dye/chemical children atomically.
- 3 June: "Make Base Result Photos div below the Process Steps div and the process added should be visible and not needed to be dropped down" → steps always expanded; base photos moved below.

**Status:** Holds. No version concept remains; `process_steps` + `step_dyes`/`step_chemicals` are the model, rendered expanded on Lot Detail.

## 4. Shade logic & recipe cloning (23 March – 2 April 2026)

- 23 Mar: "in the shade master, when I am adding a new lot, the first thing should be lot no then shade number with dropdown options of all lots already added. If shade number not selected from dropdown take lot no. as shade number."
- 23 Mar: "when a lot with already existing shade number is created, the base recipe should automatically be filled using the same dyes used in shade number's lot and the percentages (although editable)."
- 2 Apr: "when a lot is created with past shade number — it implies it is a production order and not new shade development hence make the status as 'Production'… make the lot status toggleable on the lot list page between — Approved, Rejected, Production…" This produced the 4-state workflow (`In Approval`, `Approved`, `Production`, `Rejected`) and `supabase/migrations/20260402_add_lot_status.sql` (the toggle initially failed because the `status` column didn't exist in the DB).
- 3 Apr: reference recipe viewing while creating a lot → `ReferenceRecipePanel.tsx`.
- 3 June display rules: "the chemicals in the base recipe should be in the alphabetical order.. the dyes however should be shown as added in the reference recipe" and the reference panel must show chemicals too, dyes in saved order.
- July: "the Color Entry should save the text entered in all capitalised format" and shade number must be either blank (→ lot no.) or chosen from the dropdown, else don't save.

**Status:** Holds. `CreateLot.tsx` enforces uppercase colours and the shade rule; `RecipeEditor`/`ReferenceRecipePanel` implement the chemical/dye ordering.

## 5. Cone weight correction & photos (22 March 2026)

"…also the chesses weight is 180 gm not 160 gm." The cone ("chesse") constant became **0.180 kg** and drives `net_weight = gross − cones × 0.180` everywhere.

**Status:** Holds (see SRS glossary and `calculations.ts`).

## 6. Dispatch / Challan (24 March → ongoing)

The dispatch module already existed by 24 March 2026; the earliest captured message is an enhancement, so the original creation request isn't in the loaded history (**open question — origin request not captured**).

- 24 Mar: "ENHANCE DISPATCH MODULE WITH PACKAGING TYPE, FOOTER DETAILS, AND PDF GENERATION… packaging_type (dropdown): Paper Tube / Chesse" with per-packaging net-weight deduction, footer (prepared by / receiver), and a generated PDF.
- 2 Apr: footer autocomplete — "show the options from the already entered data in the dropdown for 'prepared by' and Receiver Name… automatically fill the Receivers contact."
- 5 Apr: "in the items list, add collumn Denier also which also shows automatically when lot is selected." (UI-only at first — see §17 divergence.)
- 5–6 Apr: **Client Rate Master** — "each client can have multiple yarn types (e.g., 150D, 75/2 HB) with rates defined per yarn_type and rate_type (Sampling / Production) and an option for same rate for both. In challan creation, auto-fetch rate…" plus a Production/Sampling toggle per challan item.
- 6 Apr: lot picker became a searchable descending dropdown; later (July) keyboard navigation was added: "we have to use the mouse — attach arrow keys to navigate in the dropdown from the text box."
- 10 Apr: list UX churn in three steps — add sort-by-challan-#-desc + totals row → "remove the current sorting and filter options" → "Add filter and sorting in All Challans" (approved: date range, client filter, search; sort by challan #, date, client, net weight/amount).
- July: challan list "Type" column aggregates item types ("if it has both production and sampling type items — it should show both").
- 11 Jul: **immutability** — "the challan once saved should be saved in database and should not be changed automatically through changing lot details or references… it should change only when challan is edited." → snapshot columns on `challan_items` (`ref_no`, `lot_type`, `denier`).

**Status:** Holds. All of the above is in `CreateChallan.tsx`, `ChallanItemRow.tsx`, `ChallanList.tsx`, `useChallan.ts`.

### 6a. Challan PDF evolution
- 23 Jul: "the challan pdf generation makes the pdf in A4 format, change it to print in 2 inch paper."
- 27 Jul: "Give spacing in the lines below header and above Total Cones. Also for Normal Challan (not EDY) the shade number should be attached with letter N as in — N168, N450, N1001."
- 1 Aug: "Make the challan pdf texts all bold."
- 17 Aug: "The printing pdf for challan is getting cut at the bottom when there are items more than 4" → two-pass render (measure on a 4000 mm virtual page, then emit exact-height page) with wrapped text.

**Status:** Holds. `challanPdf.ts` is a 50.8 mm (2-inch) thermal receipt, all-bold, N-prefixed shades for non-EDY, dynamic height.

### 6b. Payment tracking (11 August 2026)
"I need a system to enter if the challan made is paid by the customer or yet to be paid. Option to select multiple challans together and make them all paid at once." → `challans.amount_received` + `paid_at` (`20260811_challan_payments.sql`), states Paid / Partially Paid / Unpaid, admin-only bulk "Mark as Paid", payment card on Challan Detail.

**Status:** Holds.

## 7. Sampling & Orders (22 March 2026)

"ADD NEW MODULE: SAMPLING & ORDER INTAKE MANAGEMENT… These can come in structured (sheet) or unstructured (loose sample) form… PHOTO SUPPORT: Upload sheet photo at intake level, individual sample photos at item level… For each intake item: Add button 'Create Lot'… Pre-fill yarn_type, color_name." Auto sample IDs, yarn-type autocomplete, and a Direct Order flow (`ORD-` identifiers, kg demand tracking) followed.

**Status:** Holds. `/sampling` routes, `useSampling.ts`.

## 8. Expenses (29 March – 1 April 2026)

- 29 Mar: "ADD ADVANCED EXPENSE BILL SYSTEM WITH MULTI-ITEM ENTRY, CATEGORY-ITEM DEPENDENCY, GST, AND SUPPLIER MASTER… Each Expense represents a full bill/invoice (not single item)."
- 30 Mar: schema error "Could not find the 'gst_amount' column" fixed by aligning the DB.
- 1 Apr (changed same day): freight added "after GST… Final Total = Subtotal + GST + Freight" → then "Freight / Cartage is added before GST and included in taxable value (Taxable Total = Subtotal + Freight, GST applied on this)." **The second formula is the live one.**
- Item creation decoupled: "Users must be able to create items WITHOUT creating an expense" → standalone Item Master (`/item-master`) + CSV bulk upload with company auto-creation.
- Recent: date filter added to All Expenses; "Item Master" retains expense catalogue role (distinct from Store's Inventory Catalogue).

**Status:** Holds. Freight-in-taxable-value is current; `/expenses` list has the From/To date filter.

## 9. Inventory v1 and v2 — built, approved, then abandoned (30 March – 3 June 2026)

- 30 Mar: "ADD NEW MODULE: INVENTORY MANAGEMENT SYSTEM…" → `inventory_stock` + `inventory_transactions`, opening-stock bulk entry.
- 30 Apr: v2 rebuild — delta-based stock for yarn/dyes/chemicals/oil/FG with "a mandatory approval popup" per write; negative stock allowed but flagged; reversal on lot/challan delete; the approval dialog made non-dismissable ("remains open until the user explicitly selects Approve or Cancel").
- 3 June (reversal): "Make the Inventory changes approval system go away. Instead create a log based system for all the inventory changes happening and done by which user doing what.. That Logs should only be seen by admin in a new bar." → `inventory_change_logs` + an admin-only Inventory Logs page; 4 June added purge + admin delete and fixed missing DELETE policies ("As an Admin, when I am deleting some editors work… it doesnt get deleted").
- June (performance reversal): "the inventory updating in creation of lot and while updating lot details is making the software very slow. Remove the Inventory auto updation part from the software." → auto consumption/deduction side effects removed.
- An expense→oil integration ("When Item - Coning Oil in Category - Oils & Auxiliaries is added in expense it should automatically adjust the Oil Stock") was built against this legacy module.

**Status:** **Superseded.** All v1/v2 tables were dropped by `20260627_drop_legacy_inventory.sql`; no `src/` code references them. The Coning-Oil expense→stock automation died with it (**divergence — see §17**). `inventory_change_logs` still exists and is still written by `src/lib/activityLog.ts`, but its viewer page was removed when the Activity Center arrived (**see §17**).

## 10. Store Management — the inventory redesign (25–27 June 2026)

"We are redesigning the entire Inventory module of the Yarn Dyeing Factory ERP from scratch. IMPORTANT: Ignore every previous inventory implementation, database table, automation and business logic. This is a complete redesign… Do not build UI yet. Only database architecture."

Principles set then and still binding: stock changes **only** via explicit transactions; current stock is always a **derived SUM**; Store is independent of lots/recipes/expenses.

Built in this order, each as a separate approved step:
1. Schema: `store_items`, `store_racks`, `store_stock_transactions` (signed quantities), derived current-stock view, txn-number generator (`20260625_store_management_system.sql`).
2. Store UI shell + Item Master, then **Stock Inward (GRN)** — multi-item receipts; "Saving should create Stock Transactions. Do NOT edit stock directly. After save show updated stock."
3. **Internal Issues** — immutable audit trail (edits post reversal + new transactions).
4. **Finished Goods** receipts linked to production lots (one receipt per lot).
5. **External Dyed Yarn (EDY)** receipts — "These lots should behave exactly like Finished Goods… Source = External Dyer."
6. **Asset Management** — only `is_asset` items; issue/return create transactions; current holder always visible; full movement history.
7. **Current Stock** — "This page should never store stock… calculate stock from Stock Transactions. Clicking an item opens complete transaction history."
8. **Stock Verification** — physical count sessions; approval posts `stock_adjustment` transactions.
9. ERP integration — challan dispatch deducts FG/EDY stock via `challan_dispatch` transactions; production lots stay out of stock until dispatch.
10. **Stock Ledger** — "IMPORTANT: The Stock Ledger is READ ONLY… Inventory itself is always calculated from this ledger."
11. **Inventory Timeline** — read-only per-item audit across all categories.

Refinements:
- Catalogue upgrade: auto-upsert items on first inward, "Item Master" renamed **Inventory Catalogue**, asset toggle on Tools & Equipment, rack chosen per transaction rather than on the item.
- FG entry fields: Date, Lot No, Shade No, Cones, Gross Weight, Rack, Remarks. EDY entry: Challan Date, Dyer (autocomplete from history), Lot (optional), Shade (required), Gross Weight, Cones, Rack, Remarks, challan PDF upload. "Add Rack" inline button on both forms.
- 27 Jun: "too many redundant tables in the supabase for store and inventory modules. Recreate with better and non redundant columns" → legacy inventory tables dropped; FG + EDY receipt tables unified into `store_yarn_receipts` with a `source` discriminator (`20260627_unify_yarn_receipts.sql`).
- Edit/delete for FG & EDY receipts; stock-inward edit/delete (delete blocked if it would drive stock negative).
- Stock-inward line items: Item Type → Item (editable + dropdown) → Qty/Unit/Rack/Remarks; "Packing Polythene" added as a type; internal-issue racks restricted to racks actually holding the item ("adding new rack in internal issue form doesnt make sense").
- Aug bug: internal issue showed 0 availability because the dropped `store_current_stock` view was still being read → availability now aggregated directly from `store_stock_transactions`.

**Status:** Holds — this is the live inventory system. All 11 store pages are routed and in the sidebar.

## 11. EDY Challans (8 July 2026)

"In the dropdown, the external dyed yarn store together with production lots is not looking nice. instead there should be a different challan creation for EDY." → dedicated `/dispatch/create-edy` flow, `challans.challan_kind` (`production`|`edy`), cascading selectors "Dyer → Shade → Rack/Receipt" with auto-fill of lot/cones/weight and stock validation; EDY stock deducted on dispatch.

**Status:** Holds.

## 12. Activity Center (25 June 2026)

"Build a complete ERP Activity Center… IMPORTANT: This replaces the traditional 'Audit Logs' page… Three sections: 1. Business Events, 2. User Activity, 3. System Events." → `business_events`, `user_activity`, `system_events` (all admin-read, append-only) + `src/lib/activityCenter.ts` writers (login sessions with device/browser, module heartbeats, global error handlers). The old Inventory Logs page was removed.

**Status:** Holds. Admin-only `/activity`. Note: it does *not* read `inventory_change_logs` (see §17).

## 13. Roles & permissions (28 May – 3 June 2026)

- "I want to create a user with view only rights to everything" → `user_roles` + `has_role()` + ViewerGuard.
- "all view only users should be able to view complete data from the database.. even if it is created by some other user" → permissive SELECT policies on all tables.
- After a viewer deleted a client rate in production: ViewerGuard hardened to hide icon-only destructive buttons.
- "There needs to be 3 types of users. Admin — can make changes anywhere and see everything. Editor for the data entry person — cannot make edits to other users work, can append new items and edit or delete them only, can see everything. Viewer Only — can see everything." → `editor` role + `EditorGuard` ownership checks.

**Status:** Holds. Front-end guards over permissive RLS is the deliberate, documented model.

## 14. Form draft persistence — requested, built, then reversed (16–24 June 2026)

- 16 Jun: "keep the values entered… dont reload the page or empty the values when we move away from the page" → sessionStorage drafts on Create Lot.
- 24 Jun: same complaint across all create forms → sessionStorage drafts on Challan/Direct Order/Intake/Expense.
- Same day (reversal): "dont use the session storage anywhere, its making it very slow" → in-memory `draftCache.ts`; then "remove the session storage, make zero cache" → `draftCache.ts` became a no-op.

**Status:** **Zero cache is intentional and current.** Forms reset on unmount; do not reintroduce persistence.

## 15. Precision & performance decisions

- 24 Jun: "When a lot detail is saved, the values are getting approximated to 4 decimal digit, dont do that, TAKE it as it is." Root cause was DB-side `numeric(14,4)` on dye percentages → widened to `numeric(14,6)` (`20260624_widen_dye_percentage.sql`).
- ~26 Jun: "Everytime I switch tab and come back these gets called… Makes the system very slow" → React Query `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `staleTime: 60s`; AuthContext switched to functional state updates to stop re-render storms. (SRS v1.0 documented the old `refetchOnWindowFocus: true` — corrected in v2.0.)
- Standing numeric rules: weights 3 dp, amounts 2 dp, dye % 6 dp.

**Status:** Holds.

## 16. Reporting

- 29 Apr: "Create an 'Oil Consumption Report' with From Date and To Date that fetches all dispatch (challan) records within the range, and processes each dispatch line item (not whole challan)…" plus "Percent of Oil = weight of oil/lot net weight." Fixed a `num_of_paper_tubes` column bug the same day.
- 18 Aug: "I need chemicals and dyes usage and averages per kg, monthly, weekly, duration wise." Approved answers: count **base recipe + process steps**, include **all lots**, break down with **two tabs** (item summary + period trend) → `ConsumptionReport.tsx` at `/dispatch/consumption` with CSV export.

**Status:** Holds. Oil report (`/dispatch/oil-consumption`) and Dye & Chemical Usage (`/dispatch/consumption`) are separate reports.

---

## 17. Divergences & open questions (chat vs. shipped code)

| # | Topic | Finding |
| --- | --- | --- |
| 1 | **Expense → Oil stock automation** | Requested and built (June) against legacy `oil_inventory`. That table was dropped 27 Jun; no code references it now. The automation silently no longer exists. If still wanted, it must be re-implemented against `store_stock_transactions`. |
| 2 | **`inventory_change_logs`** | Table and writer (`src/lib/activityLog.ts`) still exist and are still called from `AppContext`, `useChallan`, `useExpenses` — but the admin log viewer page was removed when Activity Center landed. Data is being collected with no UI. Either surface it or stop writing. |
| 3 | **`challan_items.denier`** | Denier shown in UI since 5 Apr but not persisted until `20260711_challan_item_denier.sql`. On 17 Aug the user reported the column missing in Supabase; the app now falls back to the lot's denier. **Verify the migration has actually been run.** |
| 4 | **Inward bill columns** | `bill_url`/`bill_path` errored on 7 Aug ("Could not find the 'bill_path' column"); migration `20260807_inward_bill_columns.sql` + an insert fallback were added. **Verify the migration has been run.** |
| 5 | **Draft persistence** | Discussed/built twice, reversed to zero-cache by explicit request. SRS v1.0 already documented the final state; flagged here so it isn't "fixed" again by mistake. |
| 6 | **Dispatch module origin** | The original "create the dispatch/challan module" request is not in the loaded chat history (earliest captured challan message is the 24 Mar packaging/PDF enhancement). Treated as pre-existing by 24 Mar 2026. |
| 7 | **`store_current_stock` view** | Created 25 Jun, dropped 27 Jun as redundant with `store_current_stock_by_item`; later the internal-issue availability check stopped using views entirely and aggregates from `store_stock_transactions`. |
| 8 | **Inventory approval workflow** | Built 30 Apr (mandatory popup), removed 3 Jun in favour of logging. No approval UI remains. |
| 9 | **Version system (A/B/C)** | Built in the first days, removed 22 Mar in favour of process steps. |
| 10 | **React Query focus refetch** | SRS v1.0 said `refetchOnWindowFocus: true`; user found it slow and it is now `false`. Corrected in SRS v2.0. |
| 11 | **Lovable Cloud** | User rejected it twice ("…the day i stop subscribing to lovable, i would not be able to access my historical data"; "Never Use Lovable Cloud"). Permanent constraint. |
