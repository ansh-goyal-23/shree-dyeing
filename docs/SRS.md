# Software Requirements Specification
## Yarn Dyeing Factory Management System

**Document version:** 2.0
**Date:** 25 August 2026
**Status:** Updated baseline (supersedes v1.0 of 24 June 2026)
**Audience:** Mixed — factory management / business stakeholders (Sections 1–4, 10) and developers / auditors (Sections 5–9, Appendices)

---

## Table of Contents
1. Introduction
2. Overall Description
3. Personas & Role Model
4. Functional Requirements (Module by Module)
5. Non-Functional Requirements
6. External Interface Requirements
7. Data Model
8. Technology Stack & Infrastructure
9. Cross-Cutting Constraints
10. Out of Scope & Known Limitations
11. Appendices

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements of the **Yarn Dyeing Factory Management System** — an internal, single-tenant web application used on the factory floor to manage the full lifecycle of yarn dyeing: from sample intake, recipe development and lot creation, through process steps, dispatch, billing, payment tracking, expenses, and a transaction-based Store Management (inventory) system with auditing via the Activity Center.

It is intended as the authoritative reference for:
- factory management to validate that the software matches operational reality;
- developers extending or maintaining the application;
- auditors reviewing security, data integrity and traceability.

A companion document, `docs/DECISIONS.md`, records *why* the system looks the way it does, reconstructed from the project's full chat history.

### 1.2 Product Overview
The application is a React single-page application backed by Supabase (Postgres + Auth + Storage) and hosted on Render. It is used daily by a small team (factory owner, lab/dyeing operators, dispatch clerks, accountants) on both desktop and mobile devices. All operational data — lots, recipes, intakes, challans, expenses, store transactions — lives in a single Supabase project. There is no public-facing surface; access requires authentication.

### 1.3 Intended Audience and Reading Guide
| Reader | Recommended sections |
| --- | --- |
| Factory owner / business user | 1, 2, 3, 4, 10 |
| Operator / dispatch / accountant | 4 (relevant module), 9 |
| Developer | All sections, with focus on 5–9 and Appendices |
| Auditor | 3, 5.3–5.4, 7, 9 |

### 1.4 Glossary
| Term | Meaning |
| --- | --- |
| Lot | A single dyeing batch identified by a unique `lot_no`. |
| Shade | A reusable colour identity. The `shade_number` ties multiple lots to the same target colour. |
| Base Recipe | The dye + chemical recipe of an *original* lot whose `shade_number == lot_no`. |
| Reference Recipe | The recipe a *production* lot inherits from a Base Recipe (via `source_lot_no`). |
| Source Lot | The Base Recipe lot a production lot was cloned from (`source_lot_no`). |
| Process Step | A post-dyeing intervention: Color Addition, RC (Re-Colour), or Leveling. |
| Intake | Receipt of physical material (Loose Sample or Sheet) from a client, before any lot is created. |
| Direct Order | An order created without a prior intake sheet (identifier prefix `ORD-`). |
| Challan | A dispatch document recording goods leaving the factory, including weights, packaging and rate. |
| EDY | External Dyed Yarn — yarn dyed by an outside dyer, received into store and dispatched through a dedicated EDY challan flow. |
| Demand | The kg quantity a client has ordered, tracked against actual dispatch. |
| Dye % | The percentage of dye relative to net yarn weight; stored to 6 decimal places. |
| Chesse | A cone of yarn (standard cone weight constant: 0.180 kg). |
| Net weight | `gross_weight − number_of_chesses × 0.180`, rounded to 3 dp. |
| Store | The transaction-based inventory module (replaces all earlier inventory systems). |
| Rack | A physical storage location (`store_racks`) chosen per transaction. |
| Stock Inward / GRN | Goods receipt note; the header for incoming stock (`store_stock_inward`). |
| Internal Issue | Stock issued to a factory department; immutable after save (edits post reversals). |
| Stock Ledger | Read-only chronological view of every stock transaction with running balance. |
| Stock Verification | Physical count session; approval posts `stock_adjustment` transactions. |
| Activity Center | Admin-only monitoring: Business Events, User Activity, System Events. |
| Payment State | Derived challan status: Paid / Partially Paid / Unpaid (from `amount_received`). |

### 1.5 References
- This repository (`src/**`, `sql_migrations/**`, `supabase/migrations/**`).
- `docs/DECISIONS.md` — decisions & rationale mined from chat history.
- Supabase documentation: <https://supabase.com/docs>.
- Render (hosting): <https://render.com/docs>.
- Internal project memory under `mem://` (business rules, design philosophy).

---

## 2. Overall Description

### 2.1 Product Perspective
The system is a **single-tenant operational tool**, not a multi-tenant SaaS. It replaces paper registers and ad-hoc spreadsheets previously used for lot books, dispatch books, expense logs and stock cards. It exists to:
- give a single source of truth for every lot's recipe and process history;
- enforce numerical discipline (weights, percentages, units);
- digitise dispatch with auto-billing, 2-inch thermal PDFs and payment tracking;
- keep stock derived from explicit transactions rather than manual edits, so historical inventory is always reconstructable;
- give the owner an admin-only Activity Center over business, user and system events.

### 2.2 User Classes
| Class | Description |
| --- | --- |
| Guest | Not authenticated. May only see `/auth`. |
| Viewer | Read-only access to all operational data. |
| Editor | Read + create/edit/delete own data (front-end ownership guard). |
| Admin | Full read/write/delete on any row; manages users and roles; sole reader of the Activity Center. |

Business-level personas map onto these technical roles:
| Persona | Typical role |
| --- | --- |
| Factory owner | Admin |
| Lab / dyeing operator | Editor |
| Dispatch clerk | Editor |
| Accountant | Editor or Viewer |
| External reviewer | Viewer |

### 2.3 Operating Environment
- Modern Chromium-based and WebKit-based browsers, desktop and mobile.
- Network: assumed always-online; no offline / PWA behaviour.
- Devices range from accountants' laptops to factory-floor smartphones, so the UI is responsive and touch-friendly.

### 2.4 Design and Implementation Constraints
These are intentional, durable constraints the system is built around:
- **Never Lovable Cloud.** The backend is the owner's own Supabase project so data survives any Lovable subscription. Hosting is Render via GitHub (workflow: Lovable → GitHub master → Render).
- **Manual SQL migrations only.** All schema changes live as numbered files in `sql_migrations/` (plus two early files in `supabase/migrations/`) and are applied via the Supabase SQL editor. There is no automated migration runner.
- **Permissive RLS.** Most public tables allow `select/insert/update/delete` to any authenticated user. Authorisation is enforced primarily in the front-end via `ViewerGuard`, `EditorGuard`, `WriteRoute`, `AdminRoute`. Exceptions: `user_roles`, `inventory_change_logs`, and the three Activity Center tables are restricted further (see 7.4).
- **Transaction-based inventory.** Store stock is never edited directly; it is always the sum of `store_stock_transactions` rows (signed quantities). Receipts, issues, dispatches, adjustments and asset movements are all transactions.
- **Numerical precision rules.** Weights stored to 3 dp (mg precision); amounts to 2 dp (rupees & paise); dye percentages to 6 dp (`numeric(14,6)`).
- **Multiple separate queries** (the "data-mapping pattern") are preferred over multi-table JOINs to keep query shapes simple and resilient to schema/RLS changes.
- **Raw DB errors are surfaced in toasts** rather than translated, so operators see exactly what failed.
- **Radix Selects use explicit sentinel values** (e.g. `__no_lot_selected__`) because Radix forbids empty-string `<Select.Item>` values (an empty-string value once crashed the EDY stock page).
- **Zero draft cache.** Create forms intentionally do not persist half-filled state (see 10).

### 2.5 Assumptions and Dependencies
- The Supabase project URL and anon key in `src/integrations/supabase/client.ts` are stable.
- Exactly one Supabase project backs all environments.
- Auth lives entirely in Supabase Auth (email + password; email confirmation disabled so any address works). No SSO, SMS or OAuth providers are configured.
- The first authenticated user can self-promote to admin via `claim_first_admin()`; thereafter only admins promote.

---

## 3. Personas and Role Model

### 3.1 Role Storage
Roles are stored in a dedicated `public.user_roles` table — *never* on a profile or users table — as required by the security model. The enum `public.app_role` has values `admin`, `editor`, `viewer`.

### 3.2 Server-Side Helpers
| Function | Purpose |
| --- | --- |
| `has_role(user_id, role)` | `SECURITY DEFINER`. Used by RLS policies and other helpers. |
| `get_my_role()` | Returns the highest role of the calling user (admin > editor > viewer). |
| `list_users_with_roles()` | Admin-only. Lists every auth user and current role. |
| `set_user_role(user_id, role)` | Admin-only. Replaces a user's role. |
| `claim_first_admin()` | One-shot bootstrap: makes the caller admin if no admin exists. |
| `purge_old_inventory_logs()` | Legacy. Deletes inventory change logs older than one month. Scheduled hourly via `pg_cron` when available. |
| `next_store_txn_number()` | `STX-YYYYMMDD-#####` transaction numbers. |
| `next_store_inward_number()` | `GRN-YYYYMMDD-#####` inward numbers. |

### 3.3 Front-End Guards
| Component | Purpose |
| --- | --- |
| `AuthRoute` | Redirects authenticated users away from `/auth` to the dashboard. |
| `ProtectedRoute` | Redirects unauthenticated users to `/auth`. |
| `ViewerGuard` | Blocks viewer-level access to create/edit affordances, including icon-only destructive buttons. |
| `EditorGuard` | Enforces "edit only your own rows" for editors, by inspecting `created_by`. |
| `WriteRoute` | Wraps create/edit routes so viewers cannot reach them. |
| `AdminRoute` | Restricts admin-only routes (`/users`, `/activity`). |

### 3.4 Role × Capability Matrix
| Capability | Viewer | Editor | Admin |
| --- | :-: | :-: | :-: |
| View any list/detail page | ✔ | ✔ | ✔ |
| Create lots, recipes, intakes, challans, expenses, store documents | – | ✔ | ✔ |
| Edit / delete rows **they** created | – | ✔ | ✔ |
| Edit / delete rows created by others | – | – | ✔ |
| Bulk-mark challans as paid | – | – | ✔ |
| Read Activity Center (`/activity`) | – | – | ✔ |
| Manage users & roles (`/users`) | – | – | ✔ |
| Modify master data (dyes/chemicals, clients, item master, catalogue) | – | ✔ | ✔ |

---

## 4. Functional Requirements (Module by Module)

Each module is described as: **Purpose → Primary users → Key entities → Workflows → Business rules → Validation / edge cases → Screens & routes.**

### 4.1 Authentication (`/auth`)
- **Purpose.** Gatekeep all application functionality behind a Supabase email-and-password login.
- **Key entities.** `auth.users` (managed by Supabase), `user_roles`.
- **Workflow.** Sign-in / sign-up forms call `supabase.auth.signInWithPassword` / `signUp`. Supabase persists a JWT session in `localStorage`; `AuthContext` mirrors it in React state via `onAuthStateChange`, using functional state updates so token refreshes don't re-render the tree. A signed-in user is redirected to `/shade-management`.
- **Business rules.**
  - Email confirmation is disabled: any address, valid or not, can sign up (explicit owner decision).
  - There is no app-generated session ID; the Supabase access token *is* the session credential.
  - Login/logout and heartbeats are recorded in `user_activity` (see 4.23).

### 4.2 Dashboard / Shade Management Home (`/shade-management`)
- **Purpose.** Landing surface that orients the user to the Shade Management workspace.
- **Workflow.** Quick links to Lots, Master Data and Compare Lots. (`src/pages/Dashboard.tsx`.)

### 4.3 Lot Management (`/shade-management/lots`, `/shade-management/lots/:lotNo`)
- **Purpose.** Capture and track every dyeing batch.
- **Key entities.** `lots`, `recipe_dyes`, `recipe_chemicals`, `process_steps`, `lot_photos`.
- **Workflow.**
  1. Operator creates a lot from `/shade-management/lots/create`, supplying lot number, date, yarn company, colour name, denier, cone count, gross weight, optional shade number, optional `source_lot_no`, optional `ref_no` (`20260706_lot_ref_no.sql`), remarks.
  2. System computes `net_weight = gross − number_of_chesses × 0.180`, rounded to 3 dp.
  3. System assigns initial status: shade == lot no. → **In Approval** (Base Recipe candidate); otherwise → **Production**.
  4. Operator enters the recipe; management transitions status (In Approval → Approved / Rejected).
- **Business rules.**
  - Lot statuses: `In Approval`, `Approved`, `Rejected`, `Production` (4 states), toggleable from the lot list.
  - Colour names are saved in ALL CAPS for consistency.
  - Shade number is either left unchosen (→ lot no.) or picked from the dropdown of existing lots; free-text shades are not saved.
  - Lot list is sorted **descending** (newest first); search matches lot no., shade, colour, client **and remarks**.
  - `created_by` is auto-populated from `auth.uid()`.
  - Deleting a lot cascades (in app code) to recipe rows, photos, process steps and step children.
- **Edge cases.** RLS may silently block a delete; the app detects "deleted zero rows" and reports failure. `status` may be absent on older DBs; `updateLotStatus` falls back to `is_approved`.

### 4.4 Recipe Editor and Reference Recipes
- **Purpose.** Author and edit the dye + chemical formulation of a lot.
- **Key entities.** `recipe_dyes`, `recipe_chemicals`, `master_items` (lookup).
- **Workflow.** `RecipeEditor` lists dye rows (master item, %, grams) and chemical rows (master item, qty, pH). For a Production lot the `ReferenceRecipePanel` shows the source lot's Base Recipe (including yarn company) side-by-side and can clone it into the editor. Save replaces all dye/chemical rows in a delete-then-insert transaction.
- **Business rules.**
  - Dye % stored as `numeric(14,6)` (widened from `(14,4)` in `20260624_widen_dye_percentage.sql` after the owner reported 4-dp rounding).
  - `qty_grams = (percentage / 100) × net_weight × 1000`, rounded to 3 dp.
  - **Chemicals display alphabetically; dyes display in insertion order** (owner rule, 3 June 2026) — in both the editor and the reference panel.
  - Standard chemicals BUF / CDFT / CWS auto-pre-fill in new base recipes; pH field appears only for pH-bearing chemicals.
  - Reduce 10% / Reverse 10% buttons adjust dye percentages only (see 4.19).

### 4.5 Process Steps
- **Purpose.** Record interventions after the initial dye bath (replaced an early "Version A/B/C" design, explicitly rejected by the owner).
- **Key entities.** `process_steps`, `step_dyes`, `step_chemicals`.
- **Workflow.** From Lot Detail, the operator adds a step — *Color Addition*, *RC*, *Leveling* — with description and step-level dyes/chemicals. Steps are auto-numbered (`max + 1`), editable, and **always rendered expanded** (no dropdown/collapse) per owner request.
- **Business rules.** Editing a step replaces its children atomically; deleting a step deletes children first.

### 4.6 Lot Photos
- **Purpose.** Visually document a lot's appearance and step outcomes.
- **Key entities.** `lot_photos`, Supabase Storage bucket.
- **Workflow.** Upload JPG/PNG with category (`base`, `step`, `general`) and optional label; preview before save is mandatory. The **Base Result Photos** section sits **below** Process Steps on Lot Detail.
- **Business rules.** Cascade-delete with the lot; a photo may reference a `step_id`.

### 4.7 Compare Lots (`/shade-management/compare`)
- **Purpose.** Side-by-side comparison of up to 5 lots (metadata + full dye recipes with short names and %), differences highlighted, searchable multi-select.

### 4.8 Master Data (`/shade-management/master`, `/item-master`)
- **Purpose.** Central catalogue of dyes and chemicals consumed by recipes (`master_items`); `/item-master` additionally serves the expense item catalogue.
- **Business rules.**
  - Sorted **ascending** by name (factory-floor convention).
  - `short_name` is the condensed brand identifier used in tight UI and PDFs.
  - `is_active=false` items are hidden from selectors but retained for history.
  - Company field uses autocomplete of previously entered companies; units are per-item (`gm`, `kg`, `ml`, `litre`).

### 4.9 Sampling / Intake (`/sampling`)
- **Purpose.** Capture every physical sample arriving from a client before any lot exists.
- **Key entities.** `intake_entries`, `intake_items`, `clients`.
- **Workflow.** Intake entry of type **Sheet** or **Loose Sample** (client, dates, notes, sheet photo); items within it get auto-generated sample IDs, shade reference, yarn type (autocomplete), product type, order qty, photo and status. Items move Pending → In Development → In Production → Completed/Cancelled and can spawn a pre-filled Create Lot. A **Direct Order** flow (`/sampling/order/create`) skips the intake sheet.

### 4.10 Client Management
- **Key entities.** `clients`. Strict master list; inline creation from Intake/Challan flows via `ClientSelect`, committed before downstream use.

### 4.11 Order Tracking
- **Purpose.** Track client demand (kg) against production/dispatch. Direct orders are `intake_items` with `is_direct_order=true` and `ORD-` identifiers; linkage to lots via `linked_lot_no`.

### 4.12 Dispatch / Challan Management (`/dispatch`)
- **Purpose.** Digitise the dispatch register; produce a printable thermal challan; deduct store stock; feed billing and payment tracking.
- **Key entities.** `challans`, `challan_items`, `store_stock_transactions` (`challan_dispatch`), `store_yarn_receipts`.
- **Workflow.**
  1. Clerk creates a challan (`/dispatch/create`): client, challan number, date, prepared-by and receiver (both autocompleted from prior entries, receiver contact auto-filled), notes.
  2. Items: each row picks a `lot_no` via a searchable, keyboard-navigable dropdown (arrow keys + Enter), a type toggle (**Production**/**Sampling**), packaging type (`paper_tube`/`chesse`), gross weight, units. Net weight derives from packaging deduction; rate comes from the Client Rate Master by client + yarn type + type toggle (same-rate override honoured); amount = net × rate.
  3. On save, FG stock is decremented via `challan_dispatch` transactions; totals are computed.
- **Business rules.**
  - **Immutability snapshot.** `challan_items` stores its own `ref_no`, `lot_type` and `denier` (migrations `20260709/10/11`). Later edits to the lot or references must **not** change a saved challan; only editing the challan itself does. If `denier` was saved blank (older rows), the UI/PDF fall back to the lot's current denier.
  - Challan list sorts by challan number **descending**, shows totals (net weight, amount) for the visible set, supports date-range/client/search filters and column sorting. The **Type** column aggregates the item types inside each challan (e.g. "Production + Sampling").
  - Editing or deleting a challan reverses its prior store transactions before applying new ones.

### 4.13 EDY Challans (`/dispatch/create-edy`)
- **Purpose.** Dispatch External Dyed Yarn from store — kept **separate** from the normal challan flow (owner found the mixed lot dropdown confusing).
- **Key entities.** `challans` with `challan_kind = 'edy'` (`20260708_edy_challan_kind.sql`), `store_yarn_receipts` (EDY source).
- **Workflow.** Cascading selectors: **Dyer → Shade → Rack/Receipt**, auto-filling lot, cones and weight, validated against current EDY balance. Save deducts EDY stock via transactions.
- **Differences from a normal challan.** Items come from EDY store receipts instead of production lots; shades are not N-prefixed on the PDF; rates follow the same Client Rate Master rules.

### 4.14 Challan Payment Tracking
- **Purpose.** Record whether a dispatched challan has been paid.
- **Key entities.** `challans.amount_received` (numeric 2 dp, default 0), `challans.paid_at` (`20260811_challan_payments.sql`).
- **States.** `Paid` (received ≥ total), `Partially Paid` (0 < received < total), `Unpaid` — derived by `paymentState()` in `src/types/challan.ts`.
- **Workflow.** Challan list shows a colour-coded Payment column with balance, plus a payment-status filter. **Admins** can select multiple challans and "Mark as Paid" in one bulk action. Challan Detail has a payment card (total / received / balance) where admins enter received amounts, mark fully paid, or reset to unpaid.

### 4.15 Dispatch PDF (`src/lib/challanPdf.ts`)
- **Purpose.** Produce a printable/shareable dispatch document from a challan.
- **Format.** **2-inch (50.8 mm) thermal receipt**, not A4 (changed 23 July 2026). All text is **bold**. Non-EDY shade numbers are prefixed with "N" (N168, N450…). Currency uses the literal "Rs." prefix. Weights 3 dp, amounts 2 dp.
- **Rendering.** Two-pass: content is first drawn on a 4000 mm virtual page to measure exact height, then re-drawn on an exactly-sized page — so long challans (5+ items) are never cut off. Long values wrap via `splitTextToSize` without overlapping the next row.
- **Sharing.** Web Share API on mobile when available; otherwise file download.

### 4.16 Client Rate Master (`/dispatch/client-rates`)
- **Key entities.** `client_rates` keyed by client + yarn type + rate type (Production/Sampling, with same-rate-for-both option).
- **Business rules.** Rates vary by yarn type, not lot or shade; challan creation auto-fetches and re-fetches on toggle change.

### 4.17 Expense Management (`/expenses`)
- **Purpose.** Record factory expenses as full bills with supplier, multi-line items, GST and freight.
- **Key entities.** `expenses`, `expense_line_items`, `expense_documents`, `expense_items` (catalogue), `expense_categories`, `companies`, `suppliers`.
- **Workflow.** Types: *Purchase*, *Direct Expense*, *Asset*. Lines picked from the catalogue (company autocomplete) or ad-hoc. **Totals: Taxable = Subtotal + Freight; GST applied on Taxable; Final = Taxable + GST** (freight-before-GST was a same-day owner correction). Payment status Paid/Unpaid; optional lot linkage; bill document upload.
- **List.** All Expenses supports search, type/payment filters, sorting, and a **From/To date filter** (added August 2026).

### 4.18 Store Management (`/store/*`)
The inventory system, redesigned from scratch on 25 June 2026 ("Ignore every previous inventory implementation, database table, automation and business logic"). **All stock derives from `store_stock_transactions`; nothing edits stock directly.** The legacy v1/v2 inventory tables were dropped on 27 June 2026.

#### 4.18.1 Store Dashboard (`/store`)
Landing surface for the module with links to all sub-modules.

#### 4.18.2 Inventory Catalogue (`/store/items`)
- **Key entities.** `store_items`, `store_racks`.
- **Business rules.** Formerly "Item Master"; renamed Inventory Catalogue. Items are **auto-upserted** on first inward rather than created manually. Category enum: `raw_material` (sub-categories grey yarn/dye/chemical/oil/paper tube/packaging), `office_utility`, `tool_equipment` (asset toggle `is_asset` here gates Asset Management), `finished_good`, `external_dyed_yarn`. Racks are maintained here but chosen **per transaction**, not stored as the item's location.

#### 4.18.3 Stock Inward / GRN (`/store/stock-inward`)
- **Key entities.** `store_stock_inward` (header) + line transactions (`reference_type='stock_inward'`).
- **Workflow.** Header: date, supplier, invoice no. (duplicate-invoice warning), GRN no., remarks, optional bill upload (`bill_url`/`bill_path`, storage bucket `inward-bills`). Lines: Item Type (Grey Yarn, Chemicals, Colors, Oil, Packing Polythene…) → Item (editable + dropdown) → Qty (must be positive) → Unit → Rack (with inline Add Rack) → Remarks. Saving creates one `stock_in` transaction per line and shows updated stock. List rows expand to show line items.
- **Edit/Delete.** Edit updates header + lines and resyncs transactions. Delete removes header + transactions but is **blocked** if removal would drive any item's stock negative (stock already issued/dispatched).

#### 4.18.4 Internal Issues (`/store/internal-issues`)
- **Key entities.** `store_internal_issues` (header) + line transactions (`internal_issue`, quantity negative, per-line `purpose`).
- **Business rules.** Immutable audit trail: editing posts **reversal** transactions for old lines, then new ones. Item picker shows **available stock**, aggregated live from transactions; rack choices are restricted to racks actually holding the item (no Add Rack here — racks originate at inward).

#### 4.18.5 Finished Goods (`/store/finished-goods`)
- **Key entities.** `store_yarn_receipts` (`source='finished_goods'`, unique per lot) + `finished_lot_receipt` transactions.
- **Workflow.** Receive a production lot into store: Date, Lot #, Shade #, Gross Weight, # of Cones, Rack — picked from the selected lot but editable. Current-stock list shows Date, Lot #, Shade #, Gross Wt, Cones, Rack. Edit/Delete supported.

#### 4.18.6 External Dyed Yarn (`/store/external-dyed-yarn`)
- **Key entities.** `store_yarn_receipts` (`source='external_dyed_yarn'`) + `external_dyed_yarn_receipt` transactions.
- **Workflow.** Receive yarn dyed by an outside dyer: Date, Challan # (optional), Dyer (autocomplete from previous entries), Lot (optional), **Shade # (required)**, Gross Weight, # of Cones, Rack, Remarks, challan PDF upload. Current-stock list shows Date, Challan #, Dyer, Lot #, Shade #, Gross Wt, Cones, Rack, with **filters and filtered totals** (gross weight + cone count). Edit/Delete supported.

#### 4.18.7 Asset Management (`/store/assets`)
- **Key entities.** `store_assets`, `store_asset_movements`, `asset_issue`/`asset_return` transactions.
- **Business rules.** Only `is_asset` items appear. Each physical asset is an individual row with `asset_id`, holder, department, rack, condition and status (`available`/`issued`/`repair`/`scrap`). Issue and Return both create stock transactions; the **current holder is always visible**; complete movement history is retained per asset.

#### 4.18.8 Current Stock (`/store/current-stock`)
- **Purpose.** Never stores stock — every row is a live `SUM(quantity)` over transactions (`store_current_stock_by_item` view per item, including last-transaction timestamps). Clicking an item opens its complete transaction history.

#### 4.18.9 Stock Verification (`/store/stock-verification`)
- **Key entities.** `store_verification_sessions`, `store_verification_lines` (status `draft`/`approved`/`cancelled`).
- **Workflow.** A session snapshots calculated stock per item; a manager records physical counts; on **approval** the system posts a `stock_adjustment` transaction for every line where physical ≠ system.

#### 4.18.10 Stock Ledger (`/store/stock-ledger`)
- **Purpose.** **READ ONLY** chronological view of every transaction (`store_stock_ledger` view), with in/out split and a per-item running balance (window function). Inventory itself is always calculated from this ledger. No inserts/updates through this screen.

#### 4.18.11 Inventory Timeline (`/store/timeline`, `/store/timeline/:itemId`)
- **Purpose.** Read-only audit/tracking page: a per-item chronological feed of every movement, for every inventory category.

### 4.19 Recipe Adjustments (Reduce 10% / Reverse 10%)
- **Reduce 10%** multiplies every base-recipe dye percentage by `0.9`; **Reverse 10%** multiplies by `1/0.9` (recovers the original, not `×1.1`). Chemicals and step-level dyes are unaffected. Results respect the 6-dp dye scale.

### 4.20 Reports — Oil Consumption (`/dispatch/oil-consumption`)
- **Purpose.** Oil usage per dispatch, aggregated over a date range. Processes each challan **line item** (lot, cones, net weight), flattened across challans; includes **Oil % = oil weight / lot net weight**.

### 4.21 Reports — Dye & Chemical Consumption (`/dispatch/consumption`)
- **Purpose.** Usage and averages per kg of every dye and chemical, over any date range. **Distinct from the Oil Consumption report** (which is dispatch-based; this report is lot-recipe-based).
- **Scope (owner-approved, 18 Aug 2026).** Counts **base recipe + all process steps** (Color Addition / RC / Leveling); includes **all lots** in range.
- **Tabs.** (1) **Item Summary** — per item: type, company, total qty, lot count, net weight of lots using it, average per kg, share %. (2) **Period Trend** — totals grouped by month, week, or whole range, expandable to per-item breakdown. Summary cards (lots, net weight, dye grams, chemical qty, averages) and CSV export on both tabs. Large lot sets are fetched with chunked `in` queries.

### 4.22 User Management (`/users`, Admin only)
- Calls `list_users_with_roles()` / `set_user_role()`; role replacement is atomic server-side. Only admins reach the page; `claim_first_admin()` bootstraps the first admin.

### 4.23 Activity Center (`/activity`, Admin only)
- **Purpose.** Central monitoring dashboard that **replaced the old "Audit Logs" (Inventory Logs) page**.
- **Key entities & tabs.**
  - **Business Events** (`business_events`): high-level operational events (lot created/approved/rejected/deleted, recipe updated/cloned, process step added, challan/expense/store events…), each with module, severity, actor, entity, reference number and a JSON change summary.
  - **User Activity** (`user_activity`): one row per login session — login/logout times, duration, device/browser/OS, modules accessed (heartbeat-updated), action counts.
  - **System Events** (`system_events`): errors and warnings with severity (`information`/`warning`/`error`/`critical`), technical details, and a resolved flag admins can set. Global client error handlers feed this table.
- **RLS.** All three tables are admin-read, authenticated-insert (users can only insert/update their own `user_activity` row); effectively append-only.
- **Difference from `inventory_change_logs`.** The legacy table records stock-affecting diffs (prev/change/new) and is still written by `src/lib/activityLog.ts` from lot/challan/expense actions, but it no longer has any UI. The Activity Center reads only its own three tables. (Open item: surface or retire `inventory_change_logs` — see `docs/DECISIONS.md` §17.)

### 4.24 Placeholder Module — Production (`/production`)
Reserved route rendering `PlaceholderModule`. Live shop-floor production tracking remains out of scope.

---

## 5. Non-Functional Requirements

### 5.1 Usability
- Layout is **factory-floor first**: large touch targets, explicit unit labels on every weight (`(kg)`, `(g)`, `(grams)`).
- `DecimalInput` is the canonical input for any decimal field; free typing, clamped on blur to the field's scale.
- Lot list sorted **descending**; master data sorted **ascending**.
- Autocomplete components (`ClientSelect`, `CompanyAutocomplete`, `LotFieldAutocomplete`, `FooterAutocomplete`, `ItemSelect`, `SupplierSelect`) wherever a value belongs to a curated list.
- Lot pickers support keyboard navigation (arrows + Enter) — mouse-free data entry.
- Visual hierarchy on Lot Detail: the lot's own data highlighted (primary left borders); reference recipe panels muted/dashed.

### 5.2 Performance
- React Query is configured with `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `staleTime: 60s` (changed late June 2026 after the owner reported tab-switching reload storms). `AuthContext` uses functional state updates to avoid redundant re-renders on token refresh.
- Initial data load uses **separate queries with client-side mapping** rather than nested JOINs, paginated in 1000-row chunks to bypass Supabase's default page-size cap.
- Large ID sets are queried via chunked `in` filters (e.g. the Consumption Report).

### 5.3 Reliability & Data Integrity
- Store inventory is **strictly transactional**; any drift can be reconstructed by replaying `store_stock_transactions`.
- Internal Issues and Stock Inward edits post reversal/adjustment transactions rather than mutating history.
- Challans snapshot display fields (`ref_no`, `lot_type`, `denier`) so later master-data changes cannot rewrite history.
- Cascading deletes are explicit in application code (`AppContext.deleteLot`) to avoid relying on database cascade semantics.
- `created_by` is auto-set via column default `auth.uid()` on transactional tables.
- Stock-affecting deletes (e.g. Stock Inward) are blocked when they would drive stock negative.

### 5.4 Security
- Authentication via Supabase Auth (JWT in `localStorage`); the app never sees the service-role key.
- Roles in `user_roles` only, never on a profile/users row (prevents privilege escalation by self-update).
- Role checks in the DB use `SECURITY DEFINER has_role()` to bypass RLS recursion.
- The Supabase **anon key** embedded in the client is the publishable key, not a secret.
- RLS posture: permissive read/write for authenticated users on transactional tables; tighter policies on `user_roles`, `inventory_change_logs`, and the three Activity Center tables (admin read).
- Front-end is the *primary* authorisation layer — documented and intentional. A valid Supabase JWT is always required, but a malicious authenticated user could in principle write to permissive tables. Accepted given the small, known user base.

### 5.5 Availability & Deployment
- Frontend hosted on **Render** (static site with SPA rewrite rule), auto-deployed from GitHub `master`.
- Backend hosted by the owner's **Supabase** project (managed Postgres + Auth + Storage).
- Lovable is used for development only; its hosting/publish feature is deliberately unused.

### 5.6 Maintainability
- TypeScript everywhere; Vite + SWC.
- Hooks own module data access (`useChallan`, `useExpenses`, `useSampling`, `useClientRates`, `useStore`, `useChallanFooterOptions`).
- Toast messages surface raw DB error strings verbatim.

### 5.7 Compatibility
- Latest two versions of Chrome, Edge, Safari, Firefox; laptops and Android/iOS phones. Sidebar collapses on small screens. No PWA, no offline mode.

### 5.8 Numerical Precision Limits
| Domain | Precision |
| --- | --- |
| Weights (kg / g internally as mg) | 3 decimal places |
| Amounts (currency) | 2 decimal places |
| Dye percentage | up to 6 decimal places (`numeric(14,6)`) |
| Store quantities | 4 decimal places (`numeric(18,4)`) |

---

## 6. External Interface Requirements

### 6.1 User Interface
- **shadcn/ui** on Radix primitives, themed via Tailwind CSS v3 tokens (`src/index.css`); entry/label borders intentionally darkened (June 2026) for factory-floor visibility.
- Sidebar groups: Shade Management, Sampling & Orders, Dispatch, Expenses, Store Management, Other Modules, Administration (admin only).
- Toasts (`sonner`) are the universal feedback channel.

### 6.2 Supabase JavaScript API
- The single client in `src/integrations/supabase/client.ts` is the only allowed entry point. Typed wrapper intentionally lax (`from(table as any)`) to keep the data-mapping pattern flexible.

### 6.3 Supabase Storage
- Lot/sample photos bucket: `lot_photos.file_path`, `intake_entries.reference_photo_path`, `intake_items.sample_photo_path`.
- `inward-bills` bucket: Stock Inward bill uploads (`store_stock_inward.bill_path`).
- EDY challan PDFs: `store_yarn_receipts.challan_pdf_path`.

### 6.4 PDF Generation & Sharing
- `jspdf` produces the 2-inch thermal challan PDF entirely in the browser (two-pass exact-height render). Web Share API on mobile when available.

### 6.5 Third-Party Integrations
- None. No payment processor, email/SMS provider, analytics, or telemetry.

---

## 7. Data Model

### 7.1 ER Overview

```text
auth.users
   |  1
   |
   |  *           1            *
user_roles    lots <----- recipe_dyes
                 |  1        recipe_chemicals
                 |  1        process_steps --< step_dyes
                 |                         \--< step_chemicals
                 |  1
                 +--< lot_photos
                 +--< challan_items (via lot_no)
                 +--< store_yarn_receipts (FG source; unique lot_no)

clients --< intake_entries --< intake_items
clients --< challans       --< challan_items
clients --< client_rates

master_items --< recipe_dyes / recipe_chemicals / step_dyes / step_chemicals

expense_categories --< expense_items
companies          --< expense_items
suppliers          --< expenses
expenses           --< expense_line_items
                   --< expense_documents

-- Store Management (all stock derives from the ledger) --
store_racks  --< store_stock_transactions >-- store_items
store_items  --< store_assets --< store_asset_movements
store_stock_inward        (header; lines = transactions, ref 'stock_inward')
store_internal_issues     (header; lines = transactions, ref 'internal_issue')
store_yarn_receipts       (unified FG + EDY receipts; source discriminator)
store_verification_sessions --< store_verification_lines

-- Activity Center (admin-read, append-only) --
business_events
user_activity
system_events

-- Legacy (still written, no UI) --
inventory_change_logs
```

### 7.2 Key Tables
| Table | Purpose | Source migration |
| --- | --- | --- |
| `lots` | One row per dyeing batch; canonical entity. Now incl. `status`, `remarks`, `ref_no`. | (initial), `20260402_add_lot_status`*, `20260425_add_lot_remarks`*, `20260706_lot_ref_no` |
| `recipe_dyes`, `recipe_chemicals` | Base recipe lines per lot. | (initial), `20260624_widen_dye_percentage` |
| `process_steps`, `step_dyes`, `step_chemicals` | Post-dyeing interventions. | (initial) |
| `lot_photos` | Photo metadata; files in Storage. | (initial) |
| `master_items` | Dye + chemical catalogue. | (initial) |
| `clients` | Client master. | (initial) |
| `intake_entries`, `intake_items` | Sampling intake & samples / direct orders. | (initial) |
| `challans` | Dispatch documents. Now incl. `challan_kind`, `amount_received`, `paid_at`. | (initial), `20260708_edy_challan_kind`, `20260811_challan_payments` |
| `challan_items` | Dispatch lines with immutable snapshot fields `ref_no`, `lot_type`, `denier`. | (initial), `20260709/10/11_*` |
| `client_rates` | Per-client pricing by yarn type + rate type. | (initial) |
| `expenses`, `expense_line_items`, `expense_documents` | Expense bills. | (initial) |
| `expense_categories`, `expense_items`, `companies`, `suppliers` | Expense reference data. | (initial) |
| `user_roles` | Role assignments. | `20260528_user_roles` |
| `store_racks`, `store_items` | Store locations and item catalogue. | `20260625_store_management_system` |
| `store_stock_transactions` | **The** stock ledger table (signed quantities, rate/amount, purpose, department). | `20260625_store_management_system`, `..._stock_inward`, `..._internal_issues`, `..._stock_ledger` |
| `store_stock_inward` | GRN headers (+ `bill_url`/`bill_path`). | `20260625_store_stock_inward`, `20260807_inward_bill_columns` |
| `store_internal_issues` | Issue headers. | `20260625_store_internal_issues` |
| `store_yarn_receipts` | Unified Finished-Goods + EDY receipts (`source` discriminator; cones, gross weight, challan PDF). | `20260627_unify_yarn_receipts`, `20260626_fg_edy_entry_fields` |
| `store_assets`, `store_asset_movements` | Unit-level assets and their history. | `20260625_store_asset_management` |
| `store_verification_sessions`, `store_verification_lines` | Physical stock counts. | `20260625_store_stock_verification` |
| `business_events`, `user_activity`, `system_events` | Activity Center feeds. | `20260625_activity_center` |
| `inventory_change_logs` | Legacy stock/change audit (write-only today). | `20260603_inventory_change_logs` |
| ~~`yarn_inventory`, `material_inventory`, `oil_inventory`, `finished_goods_stock`, `inventory_transactions_v2`~~ | **Dropped** (legacy inventory v1/v2). | `20260430_inventory_system`, dropped by `20260627_drop_legacy_inventory` |

\* files live under `supabase/migrations/`.

### 7.3 Key Constraints
- `lots.lot_no` is the primary key; `store_yarn_receipts.lot_no` is unique for FG (a lot is received once).
- `recipe_dyes.percentage` / `step_dyes.percentage` are `numeric(14,6)`; weights `numeric(14,3)`; store quantities `numeric(18,4)`; money `numeric(18,4)`/`numeric(14,2)`.
- `store_stock_transactions.quantity` is signed (positive = inflow); sign per type is fixed by `STORE_TXN_SIGN` in `src/types/store.ts`.
- Transaction types enum: `stock_in`, `internal_issue`, `finished_lot_receipt`, `external_dyed_yarn_receipt`, `challan_dispatch`, `stock_adjustment`, `asset_issue`, `asset_return`.
- `user_roles (user_id, role)` unique; `challans.challan_kind ∈ {production, edy}`.
- `store_assets.asset_id`, `store_items.item_code`, `store_racks.rack_code`, GRN/issue/receipt/transaction numbers all unique.

### 7.4 RLS Posture
- Permissive read & write for any authenticated user on transactional tables (`viewer_read_all_*`, `auth_write_all_*`, store policies).
- `user_roles`: authenticated read & write (admin gating via `set_user_role()` RPC).
- `inventory_change_logs`: admin-only `select`/`delete`; any authenticated user may `insert`.
- `business_events`, `system_events`: admin `select`; authenticated `insert`; `system_events` admin `update` (resolve flag).
- `user_activity`: admin `select`; users insert/update **only their own** session row.

### 7.5 Grants
Every public-schema table gets `GRANT` blocks in the same migration (`authenticated` per policy, `service_role` full). Convention enforced by review, not tooling.

---

## 8. Technology Stack & Infrastructure

### 8.1 Frontend
| Concern | Choice |
| --- | --- |
| Framework | React 18 |
| Bundler / dev server | Vite 5 (`@vitejs/plugin-react-swc`) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v3 + `tailwindcss-animate` + `@tailwindcss/typography` |
| UI primitives | shadcn/ui on Radix UI |
| Routing | `react-router-dom` v6 |
| Data fetching | `@tanstack/react-query` v5 + the Supabase client |
| Forms | `react-hook-form` + `zod` resolvers |
| Toasts | `sonner` |
| Icons | `lucide-react` |
| Charts | `recharts` |
| PDF | `jspdf` (+ `jspdf-autotable` legacy) |
| Dates | `date-fns` |
| Testing | `vitest`, `@testing-library/react`, `@playwright/test` |
| Linting | `eslint` + `typescript-eslint` |

### 8.2 Backend
- Owner-managed **Supabase** (Postgres, Auth, Storage). No edge functions deployed.
- Schema lives in `sql_migrations/` (+ two early files in `supabase/migrations/`), applied manually via the SQL editor.

### 8.3 Hosting
- **Render** static site (SPA rewrite rule) auto-deployed from GitHub `master`. Lovable hosting deliberately unused.

### 8.4 Build & Test Commands
| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server. |
| `npm run build` | Production build. |
| `npm run test` | Vitest run. |
| `npm run lint` | ESLint check. |

### 8.5 Migration Workflow
1. Author `sql_migrations/<date>_<name>.sql`.
2. Apply manually in the Supabase SQL editor, in chronological order.
3. Include `GRANT` statements alongside every new public table.
4. Use `do $$ begin … exception when duplicate_object then null; end $$;` / `IF NOT EXISTS` so migrations are idempotent.

---

## 9. Cross-Cutting Constraints

1. **UI / UX** — factory-floor layout; explicit `(kg)`/`(g)` labels; Lot list DESC, Master Data ASC; `DecimalInput` for decimals; keyboard-navigable lot pickers.
2. **Stack** — React / Vite / TypeScript / Tailwind v3 / shadcn / Supabase / Render. **Never Lovable Cloud.** No alternative frameworks; no SSR.
3. **Data access** — multiple separate queries over JOINs; Radix `<Select>` items use sentinel values, never empty strings; chunk large `in` queries.
4. **Stability** — raw DB errors surfaced verbatim in toasts.
5. **Numerical** — weights 3 dp; amounts 2 dp; dye % 6 dp; store quantities 4 dp.
6. **Inventory** — strictly transaction-based via `store_stock_transactions`; direct stock edits and recipe→stock auto-deductions are forbidden.
7. **Migrations** — manual, numbered, idempotent, grants in the same file.
8. **Security** — roles in `user_roles` only; `SECURITY DEFINER` helpers for role-aware RLS.
9. **History** — saved documents (challans, issues, inwards) snapshot or reverse; they are never silently rewritten by later master-data changes.
10. **Forms** — zero draft cache is intentional; do not reintroduce form persistence.

---

## 10. Out of Scope & Known Limitations

- **Production module** is a placeholder; live shop-floor production tracking is not implemented.
- **Draft form persistence** is intentionally absent (owner decision, 24 June 2026): half-filled forms live only in React state and reset on unmount/tab discard. Sessions (JWT) survive.
- **Legacy inventory removed.** The v1/v2 inventory tables and the expense→oil auto-adjustment were dropped with the Store redesign. If expense-driven stock updates are wanted again, they must target `store_stock_transactions`.
- **`inventory_change_logs` has no UI** since the Activity Center replaced the Inventory Logs page; rows are still written.
- **No real-time collaboration** — concurrent edits to the same lot can overwrite each other.
- **No offline / PWA support.**
- **No automated backups** beyond Supabase's managed backups.
- **No edge functions / server-side business logic.**
- **GRANT discipline** is by convention; forgetting `GRANT` in a new migration causes silent permission errors.
- **Single Supabase project** for all environments; no staging database.
- **Migration drift risk:** features have shipped before their migrations were applied (e.g. `20260711_challan_item_denier`, `20260807_inward_bill_columns`). The app has fallbacks, but pending migrations must be verified in the SQL editor.

---

## 11. Appendices

### Appendix A. Route Map
| Path | Component | Required role |
| --- | --- | --- |
| `/auth` | `Auth` | Guest |
| `/` | redirect → `/shade-management` | Authenticated |
| `/shade-management` | `Dashboard` | Viewer+ |
| `/shade-management/lots` | `LotList` | Viewer+ |
| `/shade-management/lots/create` | `CreateLot` | Editor+ |
| `/shade-management/lots/:lotNo` | `LotDetail` | Viewer+ |
| `/shade-management/compare` | `CompareLots` | Viewer+ |
| `/shade-management/master` | `MasterData` | Viewer+ (edits Editor+) |
| `/sampling` | `IntakeList` | Viewer+ |
| `/sampling/create` | `CreateIntake` | Editor+ |
| `/sampling/order/create` | `CreateDirectOrder` | Editor+ |
| `/sampling/:id` | `IntakeDetail` | Viewer+ |
| `/production` | `PlaceholderModule` | Viewer+ |
| `/expenses` | `ExpenseList` | Viewer+ |
| `/expenses/create` | `CreateExpense` | Editor+ |
| `/dispatch` | `ChallanList` | Viewer+ |
| `/dispatch/create` | `CreateChallan` | Editor+ |
| `/dispatch/create-edy` | `CreateEDYChallan` | Editor+ |
| `/dispatch/client-rates` | `ClientRateMaster` | Viewer+ (edits Editor+) |
| `/dispatch/oil-consumption` | `OilConsumptionReport` | Viewer+ |
| `/dispatch/consumption` | `ConsumptionReport` | Viewer+ |
| `/dispatch/:id` | `ChallanDetail` | Viewer+ |
| `/item-master` | `ItemMaster` | Viewer+ (edits Editor+) |
| `/users` | `UserManagement` | Admin |
| `/store` | `StoreDashboard` | Viewer+ |
| `/store/items` | `StoreItemMaster` (Inventory Catalogue) | Viewer+ (edits Editor+) |
| `/store/stock-inward` | `StoreInwardList` | Viewer+ |
| `/store/stock-inward/create` | `StoreInwardCreate` | Editor+ |
| `/store/internal-issues` | `StoreIssueList` | Viewer+ |
| `/store/internal-issues/create` | `StoreIssueForm` | Editor+ |
| `/store/internal-issues/:id/edit` | `StoreIssueForm` | Editor+ (own rows) |
| `/store/finished-goods` | `StoreFinishedGoodsList` | Viewer+ |
| `/store/finished-goods/receive` | `StoreFinishedGoodsReceive` | Editor+ |
| `/store/external-dyed-yarn` | `StoreExternalDyedYarnList` | Viewer+ |
| `/store/external-dyed-yarn/receive` | `StoreExternalDyedYarnReceive` | Editor+ |
| `/store/assets` | `StoreAssetManagement` | Viewer+ (edits Editor+) |
| `/store/current-stock` | `StoreCurrentStock` | Viewer+ |
| `/store/stock-verification` | `StoreVerificationList` | Viewer+ |
| `/store/stock-verification/:id` | `StoreVerificationDetail` | Viewer+ (approve Editor+) |
| `/store/stock-ledger` | `StoreStockLedger` | Viewer+ (read-only data) |
| `/store/timeline`, `/store/timeline/:itemId` | `StoreInventoryTimeline` | Viewer+ (read-only) |
| `/activity` | `ActivityCenter` | Admin |
| `*` | `NotFound` | Authenticated |

### Appendix B. SQL Migration Index
`sql_migrations/` (applied manually, chronological):
| File | Purpose |
| --- | --- |
| `20260430_inventory_system.sql` | Legacy inventory v2 (yarn/material/oil/FG + unified ledger). **Tables dropped 2026-06-27.** |
| `20260528_user_roles.sql` | `user_roles`, `app_role` enum, admin helper RPCs. |
| `20260528_viewer_read_all.sql` | Grants `SELECT` + permissive viewer policy on every public table. |
| `20260603_editor_role.sql` | `editor` role, role precedence, `created_by` on transactional tables. |
| `20260603_inventory_change_logs.sql` | Admin-readable change log (replaced approval workflow). |
| `20260604_logs_purge_and_admin_delete.sql` | Admin delete + monthly purge RPC + optional pg_cron. |
| `20260604_permissive_write_policies.sql` | Permissive write policy on every transactional table (fixed silent admin-delete failures). |
| `20260624_widen_dye_percentage.sql` | Dye `percentage` scale `(14,4)` → `(14,6)`. |
| `20260625_store_management_system.sql` | Store core: racks, items, stock transactions, derived stock view, txn-number generator. |
| `20260625_store_stock_inward.sql` | GRN header + rate/amount on transactions + GRN number generator. |
| `20260625_store_internal_issues.sql` | Issue headers + `purpose` on transactions. |
| `20260625_store_finished_goods.sql` | FG receipts (later unified). |
| `20260625_store_external_dyed_yarn.sql` | EDY receipts (later unified). |
| `20260625_store_asset_management.sql` | Assets + movements + views + sequences. |
| `20260625_store_current_stock_by_item.sql` | Per-item derived stock view with last-transaction timestamps. |
| `20260625_store_stock_verification.sql` | Verification sessions/lines; approval posts adjustments. |
| `20260625_store_stock_ledger.sql` | Read-only ledger view with running balance; `department` column. |
| `20260625_inventory_catalogue_upgrade.sql` | Catalogue auto-upsert support (`first_received_at`), legacy cleanup. |
| `20260625_activity_center.sql` | `business_events`, `user_activity`, `system_events` (admin-read). |
| `20260626_fg_edy_entry_fields.sql` | Cones, gross weight, lot/shade/challan-PDF fields on receipts. |
| `20260627_drop_legacy_inventory.sql` | Drops legacy inventory tables/columns + duplicate stock view. |
| `20260627_unify_yarn_receipts.sql` | Unifies FG + EDY into `store_yarn_receipts` + stock view. |
| `20260706_lot_ref_no.sql` | `lots.ref_no`. |
| `20260708_edy_challan_kind.sql` | `challans.challan_kind` (`production`/`edy`). |
| `20260709_challan_item_ref_no.sql` | `challan_items.ref_no` snapshot. |
| `20260710_challan_item_lot_type.sql` | `challan_items.lot_type` snapshot (Production/Sampling). |
| `20260711_challan_item_denier.sql` | `challan_items.denier` snapshot + backfill. **Verify applied.** |
| `20260807_inward_bill_columns.sql` | Inward `bill_url`/`bill_path` + `inward-bills` bucket. **Verify applied.** |
| `20260811_challan_payments.sql` | `challans.amount_received`, `paid_at` + index. |

`supabase/migrations/` (earliest, pre-convention):
| File | Purpose |
| --- | --- |
| `20260402_add_lot_status.sql` | `lots.status` + backfill from `is_approved`/`shade_number`. |
| `20260425_add_lot_remarks.sql` | `lots.remarks`. |

### Appendix C. Glossary (Extended)
- **Approved lot.** A Base Recipe lot whose recipe has been signed off; eligible as `source_lot_no` for production lots.
- **In Approval.** New Base Recipe lots awaiting sign-off.
- **Production lot.** A lot whose `shade_number ≠ lot_no` (inherits its recipe from a source lot).
- **Rejected lot.** Failed sign-off; preserved for traceability.
- **Sentinel value.** Non-empty placeholder (e.g. `__no_lot_selected__`) used by Radix `<Select.Item>` because Radix forbids empty-string values.
- **Data-mapping pattern.** Fetching each table separately and joining in JavaScript instead of SQL JOINs.
- **Reversal transaction.** A compensating ledger entry with opposite sign; how immutable store documents are "edited".

### Appendix D. Change Log
| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-06-24 | Initial baseline SRS. |
| 2.0 | 2026-08-25 | Full audit against chat history + codebase. Added: Store Management module (4.18, 11 sub-modules), EDY challans (4.13), challan payment tracking (4.14), Activity Center (4.23), Dye & Chemical Consumption report (4.21). Rewrote Dispatch PDF (2-inch thermal, 4.15), Challan module (snapshot immutability, 4.12). Data Model: store_*/activity tables added, legacy inventory tables marked dropped, new constraints & RLS. Performance section corrected (`refetchOnWindowFocus: false`). Constraints: zero draft cache, never Lovable Cloud, transaction-only stock. Route Map and Migration Index brought current (30 + 2 migrations). Companion `docs/DECISIONS.md` created. |
