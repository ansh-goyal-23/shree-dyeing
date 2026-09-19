import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uqgrgbqgcpqpdgemehdq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZ3JnYnFnY3BxcGRnZW1laGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTYzMDcsImV4cCI6MjA4OTQ5MjMwN30._v14o55LXtTBFJx8tkp2_Xqku_w5U4J5b1LBvB2xoR0';

// Which Postgres schema this build talks to. Defaults to 'public' (production
// behavior, unchanged) unless VITE_APP_ENV=staging is set at build time on
// the staging Render service -- in which case the app talks to the isolated
// `staging` schema in the same Shade Master project instead. See
// sql_migrations/20260919_staging_schema.sql for how that schema was created.
const APP_ENV = import.meta.env.VITE_APP_ENV || 'production';
const DB_SCHEMA = APP_ENV === 'staging' ? 'staging' : 'public';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: DB_SCHEMA },
});

export const isStaging = APP_ENV === 'staging';
