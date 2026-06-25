import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserSessions, useSystemEvents } from '@/hooks/useActivityCenter';
import { format, formatDistanceStrict, isToday, startOfDay } from 'date-fns';
import { Users, Clock, LogIn, Activity, AlertTriangle, Trophy } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const ALL = '__all__';

function fmtDur(secs?: number | null): string {
  if (!secs || secs <= 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const CARDS_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

export const UserActivityTab: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [role, setRole] = useState(ALL);

  const sessions = useUserSessions({
    from: from ? `${from}T00:00:00` : undefined,
    to: to ? `${to}T23:59:59` : undefined,
    role: role !== ALL ? role : undefined,
  });
  const failedLogins = useSystemEvents({ severity: 'error' });

  const rows = sessions.data || [];

  const stats = useMemo(() => {
    const now = Date.now();
    const online = rows.filter(r => !r.logout_time && (now - new Date(r.last_activity).getTime()) < 5 * 60_000).length;
    const todaysLogins = rows.filter(r => isToday(new Date(r.login_time))).length;
    const durations = rows.map(r => r.session_duration_seconds || 0).filter(d => d > 0);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const byUser = new Map<string, { name: string; actions: number; sessions: number; modules: Set<string> }>();
    const byModule = new Map<string, number>();
    for (const r of rows) {
      const u = byUser.get(r.user_id) || { name: r.user_name || r.user_id, actions: 0, sessions: 0, modules: new Set<string>() };
      u.sessions += 1;
      u.actions += r.actions_count || 0;
      (r.modules_accessed || []).forEach(m => { u.modules.add(m); byModule.set(m, (byModule.get(m) || 0) + 1); });
      byUser.set(r.user_id, u);
    }
    const mostActive = Array.from(byUser.values()).sort((a, b) => b.sessions - a.sessions)[0];
    const mostUsedModule = Array.from(byModule.entries()).sort((a, b) => b[1] - a[1])[0];

    // daily active users (last 14 days)
    const dauMap = new Map<string, Set<string>>();
    for (const r of rows) {
      const day = format(startOfDay(new Date(r.login_time)), 'yyyy-MM-dd');
      if (!dauMap.has(day)) dauMap.set(day, new Set());
      dauMap.get(day)!.add(r.user_id);
    }
    const dau = Array.from(dauMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([day, set]) => ({ day: day.slice(5), users: set.size }));

    // hourly logins today
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, logins: 0 }));
    for (const r of rows) {
      if (isToday(new Date(r.login_time))) hourly[new Date(r.login_time).getHours()].logins += 1;
    }

    const moduleUsage = Array.from(byModule.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    const failed = (failedLogins.data || []).filter(e => e.event_type === 'auth.failed').length;

    return { online, todaysLogins, avg, mostActive, mostUsedModule, dau, hourly, moduleUsage, failed };
  }, [rows, failedLogins.data]);

  const facetRoles = useMemo(() => Array.from(new Set(rows.map(r => r.role).filter(Boolean))) as string[], [rows]);

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div><div className="text-xs text-muted-foreground mb-1">From</div><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" /></div>
          <div><div className="text-xs text-muted-foreground mb-1">To</div><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" /></div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Role</div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Roles</SelectItem>
                {facetRoles.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Users Online" value={String(stats.online)} accent="text-emerald-600" />
        <StatCard icon={LogIn} label="Today's Logins" value={String(stats.todaysLogins)} />
        <StatCard icon={Clock} label="Avg. Session" value={fmtDur(stats.avg)} />
        <StatCard icon={Trophy} label="Most Active" value={stats.mostActive?.name || '—'} />
        <StatCard icon={Activity} label="Top Module" value={stats.mostUsedModule?.[0] || '—'} />
        <StatCard icon={AlertTriangle} label="Failed Logins" value={String(stats.failed)} accent={stats.failed > 0 ? 'text-red-600' : ''} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Daily Active Users (last 14d)</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={stats.dau}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
                <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Hourly Logins (today)</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={stats.hourly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" fontSize={10} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
                <Line type="monotone" dataKey="logins" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4 md:col-span-2">
          <div className="text-sm font-medium mb-2">Module Usage</div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.moduleUsage} dataKey="value" nameKey="name" outerRadius={80} label>
                  {stats.moduleUsage.map((_, i) => <Cell key={i} fill={CARDS_COLORS[i % CARDS_COLORS.length]} />)}
                </Pie>
                <Legend /><Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-3 text-sm font-medium border-b">Recent Sessions</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Browser</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No sessions recorded yet.</TableCell></TableRow>
            ) : rows.slice(0, 100).map(r => {
              const online = !r.logout_time && (Date.now() - new Date(r.last_activity).getTime()) < 5 * 60_000;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.user_name || '—'}</TableCell>
                  <TableCell className="capitalize">{r.role || '—'}</TableCell>
                  <TableCell className="text-xs">{format(new Date(r.login_time), 'dd MMM HH:mm')}</TableCell>
                  <TableCell className="text-xs">{formatDistanceStrict(new Date(r.last_activity), new Date(), { addSuffix: true })}</TableCell>
                  <TableCell>{fmtDur(r.session_duration_seconds)}</TableCell>
                  <TableCell>{r.device || '—'}</TableCell>
                  <TableCell>{r.browser || '—'}</TableCell>
                  <TableCell>{r.os || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{(r.modules_accessed || []).join(', ') || '—'}</TableCell>
                  <TableCell>
                    {online ? <span className="text-emerald-600 text-xs font-medium">● Online</span>
                      : r.logout_time ? <span className="text-muted-foreground text-xs">Logged out</span>
                      : <span className="text-orange-600 text-xs">Timed out</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: string }> = ({ icon: Icon, label, value, accent }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
    <div className={`text-2xl font-semibold mt-1 ${accent || ''}`}>{value}</div>
  </Card>
);

export default UserActivityTab;
