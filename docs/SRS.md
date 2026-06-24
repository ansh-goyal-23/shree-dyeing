# Software Requirements Specification
## Yarn Dyeing Factory Management System

**Document version:** 1.0
**Date:** 24 June 2026
**Status:** Baseline
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
This document specifies the functional and non-functional requirements of the **Yarn Dyeing Factory Management System** — an internal, single-tenant web application used on the factory floor to manage the full lifecycle of yarn dyeing: from sample intake, recipe development and lot creation, through process steps, dispatch, billing, expense and inventory tracking.

It is intended as the authoritative reference for:
- factory management to validate that the software matches operational reality;
- developers extending or maintaining the application;
- auditors reviewing security, data integrity and traceability.

### 1.2 Product Overview
The application is a React single-page application backed by Supabase (Postgres + Auth + Storage). It is used daily by a small team (factory owner, lab/dyeing operators, dispatch clerks, accountants) on both desktop and mobile devices. All operational data — lots, recipes, intakes, challans, expenses, inventory — lives in a single Supabase project. There is no public-facing surface; access requires authentication.

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
| Direct Order | An order created without a prior intake sheet. |
| Challan | A dispatch document recording goods leaving the factory, including weights, packaging and rate. |
| Demand | The kg quantity a client has ordered, tracked against actual dispatch. |
| Dye % | The percentage of dye relative to net yarn weight; stored to 6 decimal places. |
| Chesse | A cone of yarn (standard cone weight constant: 0.180 kg). |
| Net weight | `gross_weight − number_of_chesses × 0.180`, rounded to 3 dp. |

### 1.5 References
- This repository (`src/**`, `sql_migrations/**`).
- Supabase documentation: <https://supabase.com/docs>.
- Render (hosting): <https://render.com/docs>.
- Internal project memory under `mem://` (business rules, design philosophy).

---

## 2. Overall Description

### 2.1 Product Perspective
The system is a **single-tenant operational tool**, not a multi-tenant SaaS. It replaces paper registers and ad-hoc spreadsheets previously used for lot books, dispatch books, expense logs and stock cards. It exists to:
- give a single source of truth for every lot's recipe and process history;
- enforce numerical discipline (weights, percentages, units);
- digitise dispatch with auto-billing;
- keep stock derived from transactions rather than manual edits, so historical inventory is reconstructable.

### 2.2 User Classes
| Class | Description |
| --- | --- |
| Guest | Not authenticated. May only see `/auth`. |
| Viewer | Read-only access to all operational data. |
| Editor | Read + create/edit/delete own data (front-end ownership guard). |
| Admin | Full read/write/delete on any row; manages users and roles. |

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
- Network: assumed always-online; no offline / PWA behaviour today.
- Devices range from accountants' laptops to factory-floor smartphones, so the UI is responsive and touch-friendly.

### 2.4 Design and Implementation Constraints
These are intentional, durable constraints the system is built around:
- **Manual SQL migrations only.** All schema changes live as numbered files in `sql_migrations/` and are applied via the Supabase SQL editor. There is no automated migration runner.
- **Permissive RLS.** Every public table allows `select/insert/update/delete` to any authenticated user. Authorisation is enforced primarily in the front-end via `ViewerGuard`, `EditorGuard`, `WriteRoute`, `AdminRoute`. Two exceptions: `user_roles` and `inventory_change_logs` are restricted further.
- **Transaction-based inventory.** Stock is never edited directly; it is always the sum of `inventory_transactions_v2` rows. Direct edits to `current_stock` are forbidden by convention.
- **Numerical precision rules.** Weights stored to 3 dp (mg precision); amounts to 2 dp (rupees & paise); dye percentages to 6 dp.
- **Multiple separate queries** (the "data-mapping pattern") are preferred over multi-table JOINs to keep query shapes simple and resilient to schema/RLS changes (see `AppContext.fetchAll`).
- **Raw DB errors are surfaced in toasts** rather than translated, so operators see exactly what failed.
- **Radix Selects use explicit sentinel values** (e.g. `__no_lot_selected__`) because Radix forbids empty-string `<Select.Item>` values.

### 2.5 Assumptions and Dependencies
- The Supabase project URL and anon key in `src/integrations/supabase/client.ts` are stable.
- Exactly one Supabase project backs all environments.
- Auth lives entirely in Supabase Auth (email + password). No SSO, SMS or OAuth providers are configured.
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
| `purge_old_inventory_logs()` | Deletes inventory change logs older than one month. Scheduled hourly via `pg_cron` when available. |

### 3.3 Front-End Guards
| Component | Purpose |
| --- | --- |
| `AuthRoute` | Redirects authenticated users away from `/auth` to the dashboard. |
| `ProtectedRoute` | Redirects unauthenticated users to `/auth`. |
| `ViewerGuard` | Blocks viewer-level access to create/edit affordances. |
| `EditorGuard` | Enforces "edit only your own rows" for editors, by inspecting `created_by`. |
| `WriteRoute` | Wraps create/edit routes so viewers cannot reach them. |
| `AdminRoute` | Restricts admin-only routes (e.g. `/users`). |

### 3.4 Role × Capability Matrix
| Capability | Viewer | Editor | Admin |
| --- | :-: | :-: | :-: |
| View any list/detail page | ✔ | ✔ | ✔ |
| Create lots, recipes, intakes, challans, expenses | – | ✔ | ✔ |
| Edit / delete rows **they** created | – | ✔ | ✔ |
| Edit / delete rows created by others | – | – | ✔ |
| Read inventory change logs | – | – | ✔ |
| Manage users & roles (`/users`) | – | – | ✔ |
| Trigger inventory log purge | ✔ | ✔ | ✔ |
| Modify master data (dyes/chemicals, clients, item master) | – | ✔ | ✔ |

---

## 4. Functional Requirements (Module by Module)

Each module is described as: **Purpose → Primary users → Key entities → Workflows → Business rules → Validation / edge cases → Screens & routes.**

### 4.1 Authentication (`/auth`)
- **Purpose.** Gatekeep all application functionality behind a Supabase email-and-password login.
- **Primary users.** Everyone.
- **Key entities.** `auth.users` (managed by Supabase), `user_roles`.
- **Workflow.** Sign-in / sign-up forms call `supabase.auth.signInWithPassword` / `signUp`. On success Supabase persists a JWT session in `localStorage` (key `sb-uqgrgbqgcpqpdgemehdq-auth-token`). `AuthContext` mirrors this session in React state via `onAuthStateChange`.
- **Business rules.**
  - There is no app-generated session ID; the Supabase access token *is* the session credential.
  - A signed-in user is redirected to `/shade-management`.
  - Sign-out clears the Supabase session and React state.
- **Edge cases.** A discarded browser tab loses in-memory state (e.g. half-filled forms) but keeps the session, because `localStorage` survives tab reloads.

### 4.2 Dashboard / Shade Management Home (`/shade-management`)
- **Purpose.** Landing surface that orients the user to the Shade Management workspace.
- **Primary users.** All authenticated users.
- **Key entities.** Aggregated `lots` data.
- **Workflow.** Quick links to Lots, Master Data and Compare Lots. (Implementation: `src/pages/Dashboard.tsx`.)

### 4.3 Lot Management (`/shade-management/lots`, `/shade-management/lots/:lotNo`)
- **Purpose.** Capture and track every dyeing batch.
- **Primary users.** Lab/dyeing operator (create, edit), management (approve, reject).
- **Key entities.** `lots`, `recipe_dyes`, `recipe_chemicals`, `process_steps`, `lot_photos`.
- **Workflow.**
  1. Operator creates a lot from `/shade-management/lots/create`, supplying lot number, date, yarn company, colour name, denier, cone count, gross weight, optional shade number, optional `source_lot_no`, remarks.
  2. System computes `net_weight = gross − number_of_chesses × 0.180`, rounded to 3 dp.
  3. System assigns initial status:
     - If `shade_number` matches `lot_no` → **In Approval** (this is a *Base Recipe* candidate).
     - Otherwise → **Production** (this lot inherits a Base Recipe).
  4. Operator enters the recipe (dyes by % and grams, chemicals by qty and optional pH).
  5. Management transitions status (In Approval → Approved / Rejected; Approved/Production lots may have process steps added).
- **Business rules.**
  - Lot statuses: `In Approval`, `Approved`, `Rejected`, `Production` (4 states).
  - Lot list is sorted **descending** by `created_at` (newest first).
  - A lot may reference a single source lot for its Base Recipe.
  - `created_by` is auto-populated from `auth.uid()`.
  - Deleting a lot cascades to recipe rows, photos, process steps and step children, in the correct order.
- **Validation / edge cases.**
  - Lot numbers are unique (primary key).
  - RLS may silently block a delete; the app detects "deleted zero rows" and reports failure.
  - `status` column may be absent on older DBs; `updateLotStatus` falls back to `is_approved` only.

### 4.4 Recipe Editor and Reference Recipes
- **Purpose.** Author and edit the dye + chemical formulation of a lot.
- **Primary users.** Lab/dyeing operator.
- **Key entities.** `recipe_dyes`, `recipe_chemicals`, `master_items` (lookup).
- **Workflow.**
  1. Operator opens a lot detail page (`/shade-management/lots/:lotNo`).
  2. The `RecipeEditor` lists dye rows (master item, %, grams) and chemical rows (master item, qty, pH).
  3. For a Production lot the `ReferenceRecipePanel` shows the source lot's Base Recipe side-by-side; the operator can clone it into the editor.
  4. Save replaces all dye/chemical rows for the lot in a single transaction (delete-then-insert with ordered UUIDs).
- **Business rules.**
  - Dye % stored as `numeric(14,6)` (widened from `(14,4)` in `20260624_widen_dye_percentage.sql`).
  - `qty_grams = (percentage / 100) × net_weight × 1000`, rounded to 3 dp (`calculateDyeGrams`).
  - Chemicals: `qty` stored as numeric, pH optional (only present for pH-bearing chemicals).
  - Reduce 10% / Reverse 10% buttons adjust *all dye percentages* multiplicatively; chemicals are unaffected.
- **Validation / edge cases.**
  - Empty Radix `<Select>` items use sentinel values to satisfy Radix.
  - The recipe is editable independently of lot status.

### 4.5 Process Steps
- **Purpose.** Record interventions performed after the initial dye bath.
- **Primary users.** Lab/dyeing operator.
- **Key entities.** `process_steps`, `step_dyes`, `step_chemicals`.
- **Workflow.** From Lot Detail, operator adds a step (`ProcessStepForm`), choosing a step type — *Color Addition*, *RC*, *Leveling* — with a description and step-level dye/chemical lists. Steps are auto-numbered starting at 1 and incremented per lot.
- **Business rules.**
  - Step types are an enum of exactly three values.
  - Editing a step replaces its dye/chemical children atomically.
  - Deleting a step deletes its children first.
- **Validation.** Step numbers are assigned client-side as `max(existing) + 1`.

### 4.6 Lot Photos
- **Purpose.** Visually document a lot's appearance and step outcomes.
- **Key entities.** `lot_photos` (rows), Supabase Storage bucket (files).
- **Workflow.** Operator uploads JPG/PNGs through `LotPhotos`, choosing a category (`base`, `step`, `general`) and optional label. Files are stored in Supabase Storage; the row stores the `file_path` and category. Previews are mandatory before save.
- **Business rules.** Cascade-delete with the parent lot. Photos may optionally be associated with a specific `step_id`.

### 4.7 Compare Lots (`/shade-management/compare`)
- **Purpose.** Side-by-side comparison of two or more lots for shade matching / troubleshooting.
- **Key entities.** `lots`, `recipe_dyes`, `recipe_chemicals`, `process_steps`.
- **Workflow.** User picks lots; the page renders their recipes and process steps in parallel columns.

### 4.8 Master Data (`/shade-management/master`, `/item-master`)
- **Purpose.** Central catalog of dyes and chemicals consumed by recipes.
- **Key entities.** `master_items`.
- **Workflow.** Add / edit / deactivate dyes and chemicals. `short_name` is a brand-style condensed identifier used for tight UI (recipe rows, PDF cells). Standard chemicals (BUF, CDFT, CWS) auto-pre-fill defaults when added to a recipe.
- **Business rules.**
  - Master Data list is sorted **ascending** by name (factory-floor convention).
  - `is_active=false` items are hidden from the dye/chemical selectors but retained for historical recipes.
  - Only chemicals tagged as pH-bearing show the pH field.
- **Validation.** Names are not strictly unique but should be unique in practice; duplicate detection is up to the operator.

### 4.9 Sampling / Intake (`/sampling`)
- **Purpose.** Capture every physical sample that arrives from a client before any lot exists.
- **Key entities.** `intake_entries`, `intake_items`, `clients`.
- **Workflow.**
  1. Operator creates an intake entry of type **Sheet** or **Loose Sample**, choosing a client (master list), entering received date, sheet date, notes and an optional reference photo.
  2. Within the intake, individual `intake_items` are added — each with a sample identifier (auto-generated), shade reference, yarn type (with autocomplete), product type, order quantity, optional photo, status.
  3. A **Direct Order** flow (`/sampling/order/create`) lets the operator skip the intake sheet and add an item directly.
  4. As development progresses, items move through statuses: Pending → In Development → In Production → Completed or Cancelled, with an optional link to a created `lot_no`.
- **Business rules.**
  - Client list is a strict master; inline client creation is supported.
  - Sample identifiers are auto-generated and stable.

### 4.10 Client Management
- **Purpose.** Maintain the master list of clients used by sampling, dispatch and rates.
- **Key entities.** `clients`.
- **Workflow.** Clients are typically added inline from the Intake or Challan flows via the `ClientSelect` autocomplete. A new client is committed before being used downstream.

### 4.11 Order Tracking
- **Purpose.** Track client demand (in kg) against actual production and dispatch.
- **Key entities.** Direct orders via `intake_items` with `is_direct_order=true`; downstream linkage via `linked_lot_no`.
- **Business rules.** Order identifiers are prefixed `ORD-`. Workflow statuses mirror the intake item statuses.

### 4.12 Dispatch / Challan Management (`/dispatch`)
- **Purpose.** Digitise the dispatch register; produce a printable challan; deduct finished-goods stock; feed billing.
- **Key entities.** `challans`, `challan_items`, finished-goods stock and oil consumption tracking on `lots` / `challans`.
- **Workflow.**
  1. Dispatch clerk creates a challan (`/dispatch/create`), choosing client, challan number, date, prepared-by, receiver name and contact.
  2. Items are added: each row picks a `lot_no` (only Approved or Production lots), packaging type (`paper_tube` or `chesse`), gross weight, number of units. The system deducts packaging weight to derive `net_weight` and looks up the rate (see 4.14) to compute `amount`.
  3. On save, the challan totals are computed; finished-goods stock is decremented through `inventory_transactions_v2`.
- **Business rules.**
  - Packaging deductions are constants per packaging type.
  - Rates come from the Client Rate Master, with sampling vs production distinguished by yarn type.
  - Editing or deleting a challan must reverse the prior inventory effect before applying the new one (handled in `useChallan` + change logs).
- **Validation.** Challan number is unique within the system; lot must exist and be in a dispatchable state.

### 4.13 Dispatch PDF (`src/lib/challanPdf.ts`)
- **Purpose.** Produce a printable / shareable dispatch document from a challan.
- **Workflow.** `jsPDF + jspdf-autotable` renders the challan with the company header, item table, totals and footer notes; the Web Share API is used to share the file on mobile when available.
- **Business rules.**
  - Currency labels use the literal "Rs." prefix.
  - Decimal precision in the PDF matches the data: weights 3 dp, amounts 2 dp.

### 4.14 Client Rate Master (`/dispatch/client-rates`)
- **Purpose.** Maintain per-client pricing tables that drive challan amounts.
- **Key entities.** `client_rates` keyed by client + yarn type + production/sampling.
- **Business rules.**
  - Production vs Sampling rates can differ.
  - Yarn Type is the dimension on which rates vary, not lot or shade.

### 4.15 Expense Management (`/expenses`)
- **Purpose.** Record all factory expenses, with optional supplier, multi-line items, GST and freight.
- **Key entities.** `expenses`, `expense_line_items`, `expense_documents`, `expense_items` (catalog), `expense_categories`, `companies`, `suppliers`.
- **Workflow.**
  1. User creates an expense at `/expenses/create`, picking type — *Purchase*, *Direct Expense*, or *Asset*.
  2. Line items: pick from the expense item catalog (with company autocomplete) or enter ad-hoc. Each line contributes to `subtotal`.
  3. GST is computed automatically from the `gst_percent`; freight is additive; `total_amount = subtotal + gst_amount + freight`.
  4. Payment status (`Paid` / `Unpaid`) is set explicitly.
  5. Optionally the expense is linked to a lot (`linked_lot_no`) for cost attribution.
  6. Documents (bills) can be uploaded as `expense_documents` and viewed later.
- **Business rules.**
  - `Purchase` and `Asset` types may feed stock; `Direct Expense` does not.
  - Once linked to a lot, the expense informs cost reports for that lot.

### 4.16 Inventory Management
- **Purpose.** Maintain real-time stock of yarn, dyes/chemicals, oil and finished goods.
- **Key entities.** `yarn_inventory`, `material_inventory`, `oil_inventory`, `finished_goods_stock`, ledger `inventory_transactions_v2`, audit `inventory_change_logs`.
- **Workflow.**
  - Lot save / edit / delete triggers a recomputation of yarn, dye and chemical consumption; the delta is written to the ledger and current_stock is updated.
  - Dispatch save / edit / delete triggers a finished-goods delta and an oil consumption delta.
  - Each delta also produces a row in `inventory_change_logs` capturing previous stock, change, new stock and a warning flag (negative stock).
- **Business rules.**
  - `current_stock` is never edited directly; it is the running balance of ledger deltas.
  - `inventory_change_logs` is admin-readable; any authenticated user may insert.
  - Logs older than one month are purged hourly when `pg_cron` is available, or on demand via `purge_old_inventory_logs()`.
  - CSV bulk upload is supported for initial inventory load.
- **Validation.** Negative stock is permitted but flagged with `warn=true` in the log.

### 4.17 Recipe Adjustments (Reduce 10% / Reverse 10%)
- **Purpose.** Quickly rescale dye percentages by 10% during recipe iteration.
- **Business rules.**
  - **Reduce 10%** multiplies every dye percentage by `0.9` (a "minus ten percent" adjustment).
  - **Reverse 10%** reverses a previous Reduce, multiplying by `1 / 0.9` so the original values are recovered (not by `1.1`).
  - Chemicals are unaffected. Step-level dyes are unaffected.
  - The new percentage is rounded according to the 6-dp scale of `recipe_dyes.percentage`.

### 4.18 Reports — Oil Consumption (`/dispatch/oil-consumption`)
- **Purpose.** Show oil consumption per dispatch and aggregated over time.
- **Key entities.** Oil consumption columns on `challans`, `oil_inventory`.
- **Workflow.** The page filters by date range and lot and renders totals.

### 4.19 User Management (`/users`, Admin only)
- **Purpose.** Add roles to existing auth users and audit current assignments.
- **Workflow.** The page calls `list_users_with_roles()` and `set_user_role()`. Admins choose a new role from the enum; the call deletes any existing role rows for that user and inserts the new one atomically (server-side).
- **Business rules.**
  - Only admins reach this page.
  - The first user calling `claim_first_admin()` becomes admin; subsequent calls fail.

### 4.20 Placeholder Module — Production (`/production`)
- Reserved route, currently renders `PlaceholderModule`. Production workflow is intentionally out of scope for v1.0.

---

## 5. Non-Functional Requirements

### 5.1 Usability
- Layout is **factory-floor first**: large touch targets, explicit unit labels on every weight (`(kg)`, `(g)`, `(grams)`).
- `DecimalInput` is the canonical input for any decimal field; it accepts free typing and clamps on blur to the field's scale.
- Lot list sorted **descending** (newest first); master data sorted **ascending** (alphabetical).
- Autocomplete components (`ClientSelect`, `CompanyAutocomplete`, `LotFieldAutocomplete`, `FooterAutocomplete`, `ItemSelect`, `SupplierSelect`) are used wherever a value belongs to a curated list.

### 5.2 Performance
- React Query is configured with defaults (`refetchOnWindowFocus: true`). Returning to the browser tab triggers a stale-data refetch; it does not unmount components.
- Initial data load uses **separate queries with client-side mapping** rather than nested JOINs (`AppContext.fetchAll`), paginated in 1000-row chunks to bypass Supabase's default page size cap.
- All list pages handle the realistic factory volumes (≤ thousands of lots, tens of thousands of recipe rows) without server-side pagination.

### 5.3 Reliability & Data Integrity
- Inventory is **strictly transactional**; any drift can be reconstructed by replaying `inventory_transactions_v2`.
- Cascading deletes are explicit in the application code (`AppContext.deleteLot`) to avoid relying on database cascade semantics that may differ between environments.
- `created_by` is auto-set via column default `auth.uid()` on all transactional tables, making row ownership auditable.
- `inventory_change_logs` provide an admin-only audit trail of stock-affecting actions.

### 5.4 Security
- Authentication via Supabase Auth (JWT). Tokens live in `localStorage`; the app never sees the service-role key.
- Roles are stored in `user_roles`, never on a profile/users row, preventing privilege-escalation attacks via update.
- All role checks in the database use the `SECURITY DEFINER` `has_role()` to bypass RLS recursion.
- The Supabase **anon key** is intentionally embedded in the client (`src/integrations/supabase/client.ts`); this is the publishable key and is not a secret.
- RLS posture: **permissive write** on transactional tables (`auth_write_all_*`), **viewer read-all** on all tables, with two exceptions — `user_roles` (authenticated read/write) and `inventory_change_logs` (admin select, authenticated insert, admin delete).
- Front-end is the *primary* authorisation layer; this is documented and intentional. Compromising the front-end does not bypass auth (a user still needs a valid Supabase JWT), but a malicious authenticated user can in principle write to any table. This trade-off is accepted given the small, known user base.

### 5.5 Availability & Deployment
- Frontend hosted on **Render**.
- Backend hosted by **Supabase** (managed Postgres + Auth + Storage).
- No CI/CD workflows committed; deployments follow the platform defaults (Render auto-deploy on push).

### 5.6 Maintainability
- TypeScript everywhere; strict-ish project settings via Vite + SWC.
- Components are small and focused (`<400` LOC each).
- Hooks (`useChallan`, `useExpenses`, `useSampling`, `useClientRates`, `useChallanFooterOptions`) own module-specific data access.
- Toast messages surface raw DB error strings so the root cause is visible to operators and developers without log access.

### 5.7 Compatibility
- Browsers: latest two versions of Chrome, Edge, Safari, Firefox.
- Devices: laptops and Android/iOS phones. The sidebar collapses on small screens (`AppSidebar` + `use-mobile`).
- No PWA install; no offline mode.

### 5.8 Numerical Precision Limits
| Domain | Precision |
| --- | --- |
| Weights (kg / g internally as mg) | 3 decimal places |
| Amounts (currency) | 2 decimal places |
| Dye percentage | up to 6 decimal places (`numeric(14,6)`) |

---

## 6. External Interface Requirements

### 6.1 User Interface
- Built with **shadcn/ui** on top of **Radix** primitives, themed via Tailwind CSS v3 tokens (`src/index.css`).
- Sidebar (`AppSidebar`) groups modules into Shade Management, Sampling, Dispatch, Expenses, Item Master, Users.
- Toasts (`sonner`) are the universal feedback channel.

### 6.2 Supabase JavaScript API
- The single client in `src/integrations/supabase/client.ts` is the only allowed entry point to the backend.
- Tables accessed by name; the typed wrapper is intentionally lax (`from(table as any)`) to keep the data-mapping pattern flexible.

### 6.3 Supabase Storage
- One bucket for lot reference photos and sample photos. File paths are stored in `lot_photos.file_path`, `intake_entries.reference_photo_path` and `intake_items.sample_photo_path`.

### 6.4 PDF Generation & Sharing
- `jspdf` + `jspdf-autotable` produce challan PDFs entirely in the browser.
- The Web Share API is used on mobile when available; otherwise the file is downloaded.

### 6.5 Third-Party Integrations
- None. No payment processor, no email/SMS provider, no analytics, no telemetry.

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
                 |                          \--< step_chemicals
                 |  1
                 +--< lot_photos
                 +--< finished_goods_stock
                 +--< inventory_transactions_v2 (via reference_id)
                 +--< challan_items (via lot_no)

clients --< intake_entries --< intake_items
clients --< challans       --< challan_items
clients --< client_rates

master_items --< recipe_dyes / recipe_chemicals / step_dyes / step_chemicals
master_items --1 material_inventory

expense_categories --< expense_items
companies          --< expense_items
suppliers          --< expenses
expenses           --< expense_line_items
                   --< expense_documents

yarn_inventory       (yarn_company + yarn_type)
oil_inventory        (single row)
inventory_change_logs (admin-readable audit)
```

### 7.2 Key Tables
| Table | Purpose | Source migration |
| --- | --- | --- |
| `lots` | One row per dyeing batch; canonical entity. | (initial schema) |
| `recipe_dyes`, `recipe_chemicals` | Base recipe lines per lot. | (initial schema), `20260624_widen_dye_percentage` |
| `process_steps`, `step_dyes`, `step_chemicals` | Post-dyeing interventions. | (initial schema) |
| `lot_photos` | Photo metadata; files in Storage. | (initial schema) |
| `master_items` | Dye + chemical catalog. | (initial schema) |
| `clients` | Client master. | (initial schema) |
| `intake_entries`, `intake_items` | Sampling intake & individual samples. | (initial schema) |
| `challans`, `challan_items` | Dispatch documents & line items. | (initial schema) |
| `client_rates` | Per-client pricing by yarn type. | (initial schema) |
| `expenses`, `expense_line_items`, `expense_documents` | Expense ledger. | (initial schema) |
| `expense_categories`, `expense_items`, `companies`, `suppliers` | Expense reference data. | (initial schema) |
| `yarn_inventory`, `material_inventory`, `oil_inventory`, `finished_goods_stock` | Stock balances by kind. | `20260430_inventory_system` |
| `inventory_transactions_v2` | Unified ledger driving all stock balances. | `20260430_inventory_system` |
| `user_roles` | Role assignments. | `20260528_user_roles` |
| `inventory_change_logs` | Admin-readable audit of stock changes. | `20260603_inventory_change_logs` |

### 7.3 Key Constraints
- `lots.lot_no` is the primary key.
- `recipe_dyes.percentage` and `step_dyes.percentage` are `numeric(14,6)`.
- All weight columns are `numeric(14,3)`.
- `inventory_transactions_v2.inventory_kind` is constrained to `('yarn','material','oil','fg')`.
- `user_roles (user_id, role)` is unique.
- `finished_goods_stock.lot_no` references `lots.lot_no` with `on delete cascade`.

### 7.4 RLS Posture
- Permissive read & write for any authenticated user on every transactional table (`viewer_read_all_*`, `auth_write_all_*` policies).
- `user_roles`: authenticated read & write (admin gating is via the security-definer `set_user_role()` RPC).
- `inventory_change_logs`: admin-only `select` and `delete`; any authenticated user may `insert`.

### 7.5 Grants
Every public-schema table has `grant select, insert, update, delete ... to authenticated` and `grant all ... to service_role`, applied uniformly by `20260604_permissive_write_policies.sql` and `20260528_viewer_read_all.sql`. New tables added in future migrations must follow the same convention (`GRANT` block in the same migration).

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
| PDF | `jspdf` + `jspdf-autotable` |
| Dates | `date-fns` |
| Testing | `vitest`, `@testing-library/react`, `@playwright/test` |
| Linting | `eslint` + `typescript-eslint` |

### 8.2 Backend
- **Supabase** (managed) — Postgres database, Auth, Storage. No edge functions are deployed today.
- Schema lives in `sql_migrations/` and is applied manually through the Supabase SQL editor.

### 8.3 Hosting
- **Render** hosts the built Vite SPA.

### 8.4 Build & Test Commands
| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server. |
| `npm run build` | Production build. |
| `npm run test` | Vitest run. |
| `npm run lint` | ESLint check. |

### 8.5 Migration Workflow
1. Author a new `sql_migrations/<date>_<name>.sql` file.
2. Apply manually in Supabase SQL editor (in chronological order).
3. Include `GRANT` statements alongside every new public table.
4. Use `do $$ begin … exception when duplicate_object then null; end $$;` blocks so migrations are idempotent.

---

## 9. Cross-Cutting Constraints

A consolidated checklist of rules that future contributors must respect:

1. **UI / UX**
   - Factory floor layout; explicit `(kg)` / `(g)` labels on every weight.
   - Lot list sorted DESC; Master Data sorted ASC.
   - Use `DecimalInput` for any decimal field.
2. **Stack**
   - React / Vite / TypeScript / Tailwind v3 / shadcn / Supabase / Render.
   - No alternative frameworks; no server-side rendering.
3. **Data access**
   - Prefer multiple separate queries over JOINs.
   - Radix `<Select>` items must use sentinel values, never empty strings.
4. **Stability**
   - Raw DB errors are surfaced in toasts verbatim.
5. **Numerical**
   - Weights 3 dp; amounts 2 dp; dye % up to 6 dp.
6. **Inventory**
   - Strictly transaction-based; direct stock edits are forbidden.
7. **Migrations**
   - Manual, numbered, idempotent, with grants in the same file.
8. **Security**
   - Roles in `user_roles` only; never on profiles/users.
   - Use `SECURITY DEFINER` helpers for any RLS that depends on role.

---

## 10. Out of Scope & Known Limitations

- **Production module** is a placeholder; the live shop-floor production tracking is not implemented.
- **Draft form persistence** is intentionally not implemented — half-filled forms are kept only in React state. When a browser tab is discarded by Chrome's Memory Saver or the OS, in-progress form fields are lost. The session itself (JWT in `localStorage`) survives.
- **No real-time collaboration**: multiple users editing the same lot concurrently can overwrite each other's changes; the app relies on operational discipline (one operator per lot at a time).
- **No offline / PWA support.** The app requires connectivity to read or write.
- **No automated backups** beyond Supabase's managed backups.
- **No edge functions / server-side business logic.** Everything runs in the browser; any logic change is a frontend deploy.
- **GRANT discipline** is enforced by convention, not automated; new public tables risk silent permission errors if `GRANT` is forgotten.
- **Single Supabase project** for all environments; there is no separate staging database.

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
| `/dispatch/client-rates` | `ClientRateMaster` | Viewer+ (edits Editor+) |
| `/dispatch/oil-consumption` | `OilConsumptionReport` | Viewer+ |
| `/dispatch/:id` | `ChallanDetail` | Viewer+ |
| `/item-master` | `ItemMaster` | Viewer+ (edits Editor+) |
| `/users` | `UserManagement` | Admin |
| `*` | `NotFound` | Authenticated |

### Appendix B. SQL Migration Index
| File | Purpose |
| --- | --- |
| `20260430_inventory_system.sql` | Adds the four inventory tables, unified ledger and tracking columns. |
| `20260528_user_roles.sql` | Creates `user_roles`, `app_role` enum and admin helper RPCs. |
| `20260528_viewer_read_all.sql` | Grants `SELECT` and a permissive viewer policy on every public table. |
| `20260603_editor_role.sql` | Adds the `editor` enum value, refines role precedence, adds `created_by` on transactional tables. |
| `20260603_inventory_change_logs.sql` | Creates the admin-readable inventory change log. |
| `20260604_logs_purge_and_admin_delete.sql` | Admin delete + monthly purge RPC + optional pg_cron schedule. |
| `20260604_permissive_write_policies.sql` | Drops + recreates a permissive write policy on every transactional table. |
| `20260624_widen_dye_percentage.sql` | Widens dye `percentage` scale from `(14,4)` to `(14,6)`. |

### Appendix C. Glossary (Extended)
- **Approved lot.** A Base Recipe lot whose recipe has been signed off by management; eligible to be the `source_lot_no` of future production lots.
- **In Approval.** New Base Recipe lots awaiting sign-off.
- **Production lot.** A lot whose `shade_number ≠ lot_no` (and therefore inherits its recipe from a source lot).
- **Rejected lot.** A lot that failed sign-off; preserved for traceability.
- **Sentinel value.** A non-empty placeholder (e.g. `__no_lot_selected__`) used by Radix `<Select.Item>` to represent "no choice", required because Radix forbids empty-string item values.
- **Data-mapping pattern.** Fetching each table separately and joining in JavaScript, instead of using SQL JOINs — improves resilience to schema changes and RLS quirks.

### Appendix D. Change Log
| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-06-24 | Initial baseline SRS. |
