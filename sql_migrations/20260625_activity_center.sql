-- ============================================================
-- Activity Center: business_events, user_activity, system_events
-- Admin-only read. Authenticated insert (helpers). Append-only.
-- ============================================================

-- ---------- BUSINESS EVENTS ----------
CREATE TABLE IF NOT EXISTS public.business_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  module text NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  user_id uuid,
  user_name text,
  user_role text,
  entity_type text,
  entity_id text,
  entity_name text,
  reference_number text,
  summary text NOT NULL,
  details jsonb,
  change_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.business_events TO authenticated;
GRANT ALL ON public.business_events TO service_role;
ALTER TABLE public.business_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read business events" ON public.business_events;
CREATE POLICY "Admins read business events" ON public.business_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated insert business events" ON public.business_events;
CREATE POLICY "Authenticated insert business events" ON public.business_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_be_ts ON public.business_events (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_be_module ON public.business_events (module);
CREATE INDEX IF NOT EXISTS idx_be_event_type ON public.business_events (event_type);
CREATE INDEX IF NOT EXISTS idx_be_user ON public.business_events (user_id);
CREATE INDEX IF NOT EXISTS idx_be_entity ON public.business_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_be_reference ON public.business_events (reference_number);

-- ---------- USER ACTIVITY ----------
CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  role text,
  login_time timestamptz NOT NULL DEFAULT now(),
  logout_time timestamptz,
  last_activity timestamptz NOT NULL DEFAULT now(),
  session_duration_seconds integer DEFAULT 0,
  device text,
  browser text,
  os text,
  ip_address text,
  modules_accessed jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_activity TO authenticated;
GRANT ALL ON public.user_activity TO service_role;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read user activity" ON public.user_activity;
CREATE POLICY "Admins read user activity" ON public.user_activity
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "User insert own session" ON public.user_activity;
CREATE POLICY "User insert own session" ON public.user_activity
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "User update own session" ON public.user_activity;
CREATE POLICY "User update own session" ON public.user_activity
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ua_user ON public.user_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_ua_login ON public.user_activity (login_time DESC);
CREATE INDEX IF NOT EXISTS idx_ua_last_activity ON public.user_activity (last_activity DESC);

-- ---------- SYSTEM EVENTS ----------
CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('information','warning','error','critical')),
  event_type text NOT NULL,
  module text,
  description text NOT NULL,
  technical_details jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read system events" ON public.system_events;
CREATE POLICY "Admins read system events" ON public.system_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated insert system events" ON public.system_events;
CREATE POLICY "Authenticated insert system events" ON public.system_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins update system events" ON public.system_events;
CREATE POLICY "Admins update system events" ON public.system_events
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_se_ts ON public.system_events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_se_severity ON public.system_events (severity);
CREATE INDEX IF NOT EXISTS idx_se_resolved ON public.system_events (resolved);
