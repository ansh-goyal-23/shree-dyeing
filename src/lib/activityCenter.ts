import { supabase } from '@/integrations/supabase/client';

/**
 * Activity Center — fire-and-forget logging helpers.
 * NEVER throw. NEVER block. NEVER affect ERP performance.
 */

type UserCtx = { id: string | null; name: string | null; role: string | null };
let cachedUser: UserCtx = { id: null, name: null, role: null };

export function setActivityUserContext(ctx: Partial<UserCtx>) {
  cachedUser = { ...cachedUser, ...ctx };
}

async function resolveUser(): Promise<UserCtx> {
  if (cachedUser.id) return cachedUser;
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      cachedUser = {
        id: data.user.id,
        name: cachedUser.name || data.user.email || null,
        role: cachedUser.role,
      };
    }
  } catch {/* ignore */}
  return cachedUser;
}

// ---------- BUSINESS EVENTS ----------
export interface BusinessEventInput {
  module: string;
  eventType: string;
  severity?: 'info' | 'success' | 'warning' | 'critical';
  entityType?: string;
  entityId?: string;
  entityName?: string;
  referenceNumber?: string;
  summary: string;
  details?: Record<string, unknown>;
  changeSummary?: Array<{ field: string; before: unknown; after: unknown }>;
}

export function logBusinessEvent(input: BusinessEventInput): void {
  void (async () => {
    try {
      const u = await resolveUser();
      await supabase.from('business_events').insert({
        module: input.module,
        event_type: input.eventType,
        severity: input.severity || 'info',
        user_id: u.id,
        user_name: u.name,
        user_role: u.role,
        entity_type: input.entityType || null,
        entity_id: input.entityId || null,
        entity_name: input.entityName || null,
        reference_number: input.referenceNumber || null,
        summary: input.summary,
        details: input.details || null,
        change_summary: input.changeSummary || null,
      });
    } catch (e) {
      console.warn('[activity] business event failed', e);
    }
  })();
}

// ---------- CHANGE SUMMARY DIFF ----------
export function buildChangeSummary<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
  fields: (keyof T)[]
): Array<{ field: string; before: unknown; after: unknown }> {
  const out: Array<{ field: string; before: unknown; after: unknown }> = [];
  if (!before || !after) return out;
  for (const f of fields) {
    const b = before[f];
    const a = after[f];
    const sameStr = JSON.stringify(b) === JSON.stringify(a);
    if (!sameStr) out.push({ field: String(f), before: b ?? null, after: a ?? null });
  }
  return out;
}

// ---------- USER ACTIVITY ----------
const SESSION_KEY = '__activity_session_id__';

function detectBrowser(): { browser: string; os: string; device: string } {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  const device = /mobile|android|iphone/i.test(ua) ? 'Mobile' : 'Desktop';
  return { browser, os, device };
}

export async function startUserSession(userId: string, userName: string | null, role: string | null): Promise<string | null> {
  try {
    const { browser, os, device } = detectBrowser();
    const { data, error } = await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        user_name: userName,
        role,
        device,
        browser,
        os,
        modules_accessed: [],
      })
      .select('id')
      .single();
    if (error) throw error;
    if (data?.id) {
      try { sessionStorage.setItem(SESSION_KEY, data.id); } catch {/* ignore */}
      return data.id;
    }
  } catch (e) {
    console.warn('[activity] session start failed', e);
  }
  return null;
}

export function getCurrentSessionId(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}

let lastHeartbeat = 0;
let heartbeatStart = Date.now();

export async function heartbeatSession(currentModule?: string): Promise<void> {
  const id = getCurrentSessionId();
  if (!id) return;
  const now = Date.now();
  if (now - lastHeartbeat < 30_000) return; // throttle
  lastHeartbeat = now;
  try {
    // fetch & dedup modules_accessed
    const { data: existing } = await supabase
      .from('user_activity')
      .select('modules_accessed, login_time')
      .eq('id', id)
      .single();
    const arr: string[] = Array.isArray(existing?.modules_accessed) ? existing!.modules_accessed as string[] : [];
    if (currentModule && !arr.includes(currentModule)) arr.push(currentModule);
    const loginTime = existing?.login_time ? new Date(existing.login_time).getTime() : heartbeatStart;
    const duration = Math.max(0, Math.floor((now - loginTime) / 1000));
    await supabase.from('user_activity').update({
      last_activity: new Date(now).toISOString(),
      session_duration_seconds: duration,
      modules_accessed: arr,
    }).eq('id', id);
  } catch (e) {
    console.warn('[activity] heartbeat failed', e);
  }
}

export async function endUserSession(): Promise<void> {
  const id = getCurrentSessionId();
  if (!id) return;
  try {
    await supabase.from('user_activity').update({
      logout_time: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    }).eq('id', id);
  } catch (e) {
    console.warn('[activity] session end failed', e);
  }
  try { sessionStorage.removeItem(SESSION_KEY); } catch {/* ignore */}
}

// ---------- SYSTEM EVENTS ----------
export interface SystemEventInput {
  severity: 'information' | 'warning' | 'error' | 'critical';
  eventType: string;
  module?: string;
  description: string;
  technicalDetails?: Record<string, unknown>;
}

export function logSystemEvent(input: SystemEventInput): void {
  void (async () => {
    try {
      await supabase.from('system_events').insert({
        severity: input.severity,
        event_type: input.eventType,
        module: input.module || null,
        description: input.description,
        technical_details: input.technicalDetails || null,
      });
    } catch (e) {
      console.warn('[activity] system event failed', e);
    }
  })();
}

export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    logSystemEvent({
      severity: 'error',
      eventType: 'frontend.error',
      module: 'web',
      description: ev.message || 'Unknown error',
      technicalDetails: {
        source: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        stack: ev.error?.stack || null,
      },
    });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    logSystemEvent({
      severity: 'error',
      eventType: 'frontend.unhandled_rejection',
      module: 'web',
      description: String(ev.reason?.message || ev.reason || 'Unhandled rejection'),
      technicalDetails: { stack: ev.reason?.stack || null },
    });
  });
}
