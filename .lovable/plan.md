
# Plan: Software Requirements Specification (SRS) Document

## Goal
Deliver an in-depth, lean-modern SRS for the Yarn Dyeing Factory Management System (the app currently in this repo). The document will be written for a **mixed audience** — readable business sections up front, technical detail in later sections — and shipped in **two formats**:

1. `docs/SRS.md` — versioned source of truth, lives in the repo.
2. `/mnt/documents/SRS.docx` — downloadable Word copy generated from the same content using `docx-js`, validated, and rendered as images for QA before delivery.

No application code will change. Only documentation files will be added.

---

## Deliverables

- `docs/SRS.md` (new)
- `/mnt/documents/SRS.docx` (new, exposed via `<presentation-artifact>`)
- A short build script under `/tmp/` (not committed) used only to generate the .docx

---

## Document Structure (Lean Modern SRS)

The SRS will have the following sections. Each is sized to give real depth without padding.

### 1. Introduction
- 1.1 Purpose of the document
- 1.2 Product overview — what the system is (factory-floor dyeing operations: lots, recipes, sampling, dispatch, expenses, inventory)
- 1.3 Intended audience & how to read this document
- 1.4 Glossary (Lot, Shade, Base Recipe, Reference Recipe, Intake, Challan, RC, Leveling, Color Addition, Demand, Dye %, etc.)
- 1.5 References (Supabase docs, Render, repo, SQL migrations)

### 2. Overall Description
- 2.1 Product perspective — single-tenant internal factory tool, React SPA on Render, Supabase backend
- 2.2 User classes & personas — Admin, Editor, Viewer, plus business roles (factory owner, lab/dyeing operator, dispatch clerk, accountant)
- 2.3 Operating environment — desktop + mobile browsers, factory-floor friendly UI
- 2.4 Design & implementation constraints (manual SQL migrations only, permissive RLS, transaction-based inventory, decimal precision rules, Radix Select sentinel pattern, raw DB errors surfaced in toasts)
- 2.5 Assumptions & dependencies

### 3. Personas & Role Model
- Role matrix (Admin / Editor / Viewer / Guest) mapped to capability (read, create, edit, delete, admin functions)
- How roles are stored (`user_roles` table, `has_role` security-definer function), why roles are separated from profiles
- Route-level guards: `ViewerGuard`, `EditorGuard`, `WriteRoute`, `AdminRoute`

### 4. Functional Requirements — Module by Module
Each module follows the same template:
*Purpose → Primary users → Key entities → Workflows / use cases → Business rules → Validation & edge cases → Screens / routes*

Modules covered:
- 4.1 **Authentication** (`/auth`, Supabase email+password, session in `localStorage`, no app-generated session id)
- 4.2 **Dashboard / Shade Management home** (`/shade-management`)
- 4.3 **Lot Management** — Lot list (DESC), Create Lot, Lot Detail, 4-state status workflow (In Approval → Approved → Production / Rejected), shade numbers, source lot cloning, remarks, `created_by`
- 4.4 **Recipe Editor & Reference Recipes** — Base Recipe vs Reference Recipe, dye % (up to 6 decimals), chemical qty, pH, cloning Base Recipes, recipe math (net weight, dye grams)
- 4.5 **Process Steps** — Color Addition, RC, Leveling; sequencing after initial dyeing; step-level dyes/chemicals
- 4.6 **Lot Photos** — base/step/general categories, mandatory preview, Supabase Storage bucket
- 4.7 **Compare Lots**
- 4.8 **Master Data** (ASC sort) — dyes & chemicals (Item Master, `short_name` formatting, standard chemicals BUF/CDFT/CWS pre-fills, pH-only fields)
- 4.9 **Sampling / Intake** — Loose Samples vs Sheets, auto-IDs, Yarn Type autocomplete, Direct Order creation
- 4.10 **Client Management** — master list constraint, inline client creation, Company autocomplete
- 4.11 **Order Tracking** — demand in kg, `ORD-` identifiers, workflow statuses
- 4.12 **Dispatch / Challan Management** — packaging deductions, auto-billing, challan items, footer options
- 4.13 **Dispatch PDF** — formatting rules, "Rs." units, decimal precision, Web Share API
- 4.14 **Client Rate Master** — dynamic Production vs Sampling pricing by Yarn Type
- 4.15 **Expense Management** — multi-type billing, auto-tax, stock integration
- 4.16 **Inventory Management** — strictly transaction-based, bulk CSV upload, low-stock alerts, change logs, forbidden direct stock edits
- 4.17 **Recipe Adjustments** — Reduce 10% / Reverse 10% behavior on dye %
- 4.18 **Reports** — Oil Consumption Report
- 4.19 **User Management** (Admin) — assign roles, list users
- 4.20 **Placeholder modules** (Production) — declared scope-out

### 5. Non-Functional Requirements
- 5.1 Usability — factory-floor layout, explicit `(kg)`/`(g)` labels, `DecimalInput`, large hit targets, mobile responsiveness
- 5.2 Performance — React Query caching defaults, separate-queries-over-JOINs pattern, expected list sizes
- 5.3 Reliability & data integrity — transactional inventory, manual SQL migrations, permissive RLS with app-side guards, `created_by` audit fields, `inventory_change_logs`, log purge policy
- 5.4 Security — Supabase auth, role separation, security-definer functions, no client-side role checks, JWT in `localStorage`, no service-role key in client
- 5.5 Availability & deployment — Render hosting, Supabase managed Postgres + Storage + Auth
- 5.6 Maintainability — Radix Select sentinel pattern, raw DB error toasts, data-mapping query pattern
- 5.7 Compatibility — modern Chromium/Safari/Firefox, desktop + mobile
- 5.8 Math limits — 3 dp for weights (mg), 2 dp for amounts, up to 6 dp for dye %

### 6. External Interface Requirements
- 6.1 UI principles (factory floor layout, sort directions, autocomplete patterns)
- 6.2 Supabase JS client interface (`src/integrations/supabase/client.ts`)
- 6.3 Supabase Storage buckets (lot photos)
- 6.4 PDF generation (jspdf + jspdf-autotable, Web Share API)
- 6.5 No third-party payment/SMS/email integrations

### 7. Data Model
- 7.1 Entity-Relationship overview (diagram in ASCII)
- 7.2 Table-by-table summary derived from `sql_migrations/*.sql` and `src/types/*`:
  lots, recipe_dyes, recipe_chemicals, process_steps, step_dyes, step_chemicals, lot_photos, master_items, clients, intakes, orders, challans, challan_items, expenses, inventory_items, inventory_transactions, inventory_change_logs, user_roles, client_rates, footer_options
- 7.3 Key constraints, defaults, decimal precision (incl. `20260624_widen_dye_percentage.sql`)
- 7.4 RLS posture — permissive write policies, viewer read-all, admin delete, editor role
- 7.5 GRANT policy summary for `public` schema tables

### 8. Technology Stack & Infrastructure
- 8.1 Frontend — React 18, Vite 5, TypeScript 5, Tailwind v3, shadcn/Radix, React Router, React Query, react-hook-form + zod, sonner toasts, lucide icons, recharts, jspdf, date-fns
- 8.2 Backend — Supabase (Postgres + Auth + Storage); no edge functions in repo
- 8.3 Hosting — Render (frontend)
- 8.4 Build/test — Vite, Vitest, Playwright, ESLint
- 8.5 Migration workflow — manual SQL files under `sql_migrations/`, applied in order

### 9. Cross-Cutting Constraints (from project memory)
Consolidated list of the rules the system intentionally enforces (decimal limits, sort directions, sentinel patterns, transactional stock, raw DB error toasts, no JOIN-heavy queries, etc.) so future contributors have a single reference.

### 10. Out of Scope / Known Limitations
- No production module yet, no real-time multi-user collaboration, no offline mode, no edge functions, draft form state intentionally not persisted (in-memory only), tab discard caveats.

### 11. Appendices
- A. Route map (full table of routes from `App.tsx` + required role)
- B. SQL migration index with one-line purpose for each file
- C. Glossary (extended)
- D. Change log (initial v1.0)

---

## Method

1. Read the files I haven't already opened to fill in detail: `AuthContext`, `RoleContext`, `AppContext`, all `sql_migrations/*.sql`, key pages (`CreateLot`, `LotDetail`, `RecipeEditor`, `CreateChallan`, `CreateExpense`, `ItemMaster`, `UserManagement`, `useChallan`, `useExpenses`, `useSampling`, `useClientRates`). Batch reads in parallel.
2. Write `docs/SRS.md` with the structure above, ~25–40 pages of content.
3. Write `/tmp/build_srs_docx.js` using `docx-js` (US Letter, Arial, proper heading styles, real bullet/number lists via `LevelFormat`, real tables with dual widths, no unicode bullets, no `\n`).
4. Run the build script, validate the resulting docx, render each page to JPEG, inspect every page for clipped/overflowing text or broken tables, fix and re-run until clean.
5. Place the final file at `/mnt/documents/SRS.docx` and surface it with a `<presentation-artifact>` tag in the closing message.

## Out of scope for this task
- No code changes to `src/**`.
- No new migrations.
- No security findings remediation — the SRS will *describe* the current posture, not change it.
