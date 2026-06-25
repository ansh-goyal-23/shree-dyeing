# ERP Activity Center — Implementation Plan

Replaces the existing "Inventory Logs / Audit Logs" surface with a unified **Activity Center** that answers three questions:
1. What happened in the factory? (Business Events)
2. What are employees doing? (User Activity)
3. Is the ERP healthy? (System Events)

Admin-only. Read-only UI. Logging is fire-and-forget so it never slows ERP operations.

---

## 1. Database (new migration `sql_migrations/20260625_activity_center.sql`)

Three append-only tables in `public`, each with GRANTs + RLS (admin read, authenticated insert via helpers, service_role all).

### `business_events`
```
id uuid pk, event_timestamp timestamptz default now(),
module text, event_type text, severity text default 'info',
user_id uuid, user_name text, user_role text,
entity_type text, entity_id text, entity_name text,
reference_number text,
summary text not null,
details jsonb,            -- arbitrary structured payload
change_summary jsonb,     -- [{field, before, after}] meaningful diffs only
created_at timestamptz default now()
```
Indexes: `event_timestamp desc`, `module`, `event_type`, `user_id`, `entity_type+entity_id`, `reference_number`.

### `user_activity`
```
id uuid pk, user_id uuid, user_name text, role text,
login_time timestamptz, logout_time timestamptz,
last_activity timestamptz, session_duration_seconds int,
device text, browser text, os text, ip_address text,
modules_accessed jsonb default '[]', actions_count int default 0,
created_at timestamptz default now()
```
Indexes: `user_id`, `login_time desc`. One row per session; heartbeat updates `last_activity`/`session_duration_seconds`/`modules_accessed`.

### `system_events`
```
id uuid pk, ts timestamptz default now(),
severity text check in (information|warning|error|critical),
event_type text, module text,
description text, technical_details jsonb,
resolved boolean default false, resolved_by uuid, resolved_at timestamptz
```
Indexes: `ts desc`, `severity`, `resolved`.

RLS: all three readable only by admins (`public.has_role(auth.uid(),'admin')`). Insert allowed for `authenticated` so client helpers can write. `system_events` UPDATE allowed for admins (to mark resolved).

The existing `inventory_change_logs` table is left in place (legacy); the sidebar link is moved to Activity Center and inventory logs become one source feeding `business_events` going forward.

---

## 2. Logging helpers (`src/lib/activityCenter.ts`)

Three small async functions, all fire-and-forget (`void supabase.from(...).insert(...)`, swallow errors):

- `logBusinessEvent({ module, eventType, severity?, entityType?, entityId?, entityName?, referenceNumber?, summary, details?, changeSummary? })`
  Pulls `user_id`, name, role from `AuthContext`/`RoleContext` cache.
- `logUserActivity` — session bookkeeping (start, heartbeat, end). Helper exposes `startSession`, `heartbeat(module)`, `endSession`.
- `logSystemEvent({ severity, eventType, module, description, technicalDetails? })`
  Also installed as a global `window.onerror` / `unhandledrejection` handler in `main.tsx` to capture frontend errors as `error` severity.

Helpers must:
- Never throw.
- Never block the caller (`void` the promise).
- Skip when no auth session.

### Diff utility
`buildChangeSummary(before, after, fields)` → `[{field, before, after}]`, ignoring unchanged values. Used by recipe/expense/role flows so logs store *business* diffs only, never raw rows.

---

## 3. Instrumentation (minimal, surgical)

Add `logBusinessEvent` calls inside existing mutation hooks/handlers only at meaningful boundaries — no CRUD spam:

| Module | Where | Event |
|---|---|---|
| Auth | `AuthContext` sign-in / sign-out | `user.logged_in`, `user.logged_out` + start/end session |
| User Mgmt | `UserManagement.tsx` create/role change/disable | `user.created`, `user.role_changed` (with change_summary) |
| Sampling | `useSampling` create/cancel, order create/complete | `sampling.intake_created` etc |
| Shade | `AppContext` lot create/approve/reject/delete, recipe save (with diff), process step add, recipe clone | `lot.*`, `recipe.*`, `process_step.added` |
| Store | `useStore` inward create, issue create, FG receive, EDY receive, verification approve, asset issue/return | `store.*` |
| Dispatch | `useChallan` create/dispatch/cancel/delete | `challan.*` |
| Expenses | `useExpenses` create/delete | `expense.*` |

Each call is one extra line in code already running the mutation — no refactor.

---

## 4. UI

### Routing & sidebar
- New route `/activity` (admin-only via `AdminRoute`).
- `src/components/AppSidebar.tsx`: add **Administration → Activity Center** (Activity icon). Remove/replace old "Inventory Logs" link (keep page but link from Activity Center as a sub-view if needed).

### `src/pages/ActivityCenter.tsx`
Top-level page with shadcn `Tabs`: **Business Events | User Activity | System Events**. Sticky filter bar per tab. URL query `?tab=...` preserved.

### Tab 1 — `components/activity/BusinessEventsTab.tsx`
- Filters: date range, module (multi), event type (multi), user, role, free-text (matches `entity_name`, `reference_number`, `summary`).
- Table: Date · Time · User · Module (icon+label) · Event (badge) · Reference · Summary. Newest first, 100/page, cursor pagination (`event_timestamp < lastSeen`).
- Row click → right `Sheet` drawer: full summary, who/when, JSON `details`, formatted `change_summary` (before → after lines), "Open Record" button that routes by `entity_type` (lot → `/lots/:id`, challan → `/challans/:id`, expense → expense dialog, issue → `/store/issues/:id`, etc.).
- "Timeline" toggle inside drawer when `entity_type+entity_id` set: fetch all events for that entity, render chronological vertical timeline.

### Tab 2 — `components/activity/UserActivityTab.tsx`
- Cards: Users Online (sessions with `last_activity > now()-5min`), Today's Logins, Avg Session, Most Active User, Most Used Module, Failed Logins (from `system_events` where `event_type='auth.failed'`).
- Recent Activity table (login/logout/timeout).
- User profile drawer: last login/logout, session history, daily-usage sparkline, modules used (from `modules_accessed` aggregation), business events count.
- Charts (Recharts already in stack): Daily Active Users (bar), Hourly Logins (line), Module Usage (pie), Session Duration (histogram).
- Filters: date, role, user.

### Tab 3 — `components/activity/SystemEventsTab.tsx`
- Dashboard cards: Recent Errors (24h), Pending (unresolved), Resolved, Storage Usage (from Supabase storage size where available — otherwise hide), Database Status (simple `select 1` ping).
- Severity badges: information=blue, warning=orange, error=red, critical=dark red — tokens added in `index.css`.
- Table with severity filter, "Mark resolved" admin action (updates row).
- Drawer shows `technical_details` JSON.

### Shared
- `components/activity/SeverityBadge.tsx`, `ModuleIcon.tsx`, `EventTypeBadge.tsx`.
- All data hooks in `src/hooks/useActivityCenter.ts` using React Query with `keepPreviousData` and 30s stale time. No realtime subscriptions (polling on tab focus only) to keep it cheap.

### Session tracking
- On login: `logUserActivity.startSession()` inserts a row, stores `session_id` in memory.
- Heartbeat: a single `setInterval` in `Layout.tsx` every 60s updates `last_activity`, `session_duration_seconds`, and appends current route's module to `modules_accessed` (dedup).
- On logout / `beforeunload`: set `logout_time`.

---

## 5. Performance & safety
- All inserts are `void`-promised; failures only `console.warn`, never surfaced to user.
- Indexes on every filter column.
- 100/page cursor pagination, lazy drawer detail fetches.
- No logging of: page views, searches, sorting, filtering, typing, hovers, PDF prints.
- Admin-only RLS so non-admins cannot even read.

---

## 6. Files to create / edit

**Create**
- `sql_migrations/20260625_activity_center.sql`
- `src/lib/activityCenter.ts`
- `src/hooks/useActivityCenter.ts`
- `src/pages/ActivityCenter.tsx`
- `src/components/activity/BusinessEventsTab.tsx`
- `src/components/activity/UserActivityTab.tsx`
- `src/components/activity/SystemEventsTab.tsx`
- `src/components/activity/EventDrawer.tsx`
- `src/components/activity/SeverityBadge.tsx`
- `src/components/activity/ModuleIcon.tsx`

**Edit (one-line instrumentation only)**
- `src/App.tsx` (route), `src/components/AppSidebar.tsx` (link), `src/components/Layout.tsx` (heartbeat)
- `src/context/AuthContext.tsx` (login/logout events + session)
- `src/main.tsx` (global error → `logSystemEvent`)
- `src/hooks/useChallan.ts`, `src/hooks/useExpenses.ts`, `src/hooks/useSampling.ts`, `src/hooks/useStore.ts`
- `src/context/AppContext.tsx` (lot/recipe events)
- `src/pages/UserManagement.tsx` (user/role events)

No existing behavior changes; only additive logging calls.
