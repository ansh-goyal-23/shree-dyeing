import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRole } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logBusinessEvent } from '@/lib/activityCenter';

interface Row {
  user_id: string;
  email: string;
  created_at: string;
  role: 'admin' | 'editor' | 'viewer';
}

const UserManagement: React.FC = () => {
  const { role, loading: roleLoading, isAdmin, refresh } = useRole();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_users_with_roles');
    if (error) toast.error(error.message);
    else setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const claimAdmin = async () => {
    const { error } = await supabase.rpc('claim_first_admin');
    if (error) toast.error(error.message);
    else { toast.success('You are now admin'); await refresh(); }
  };

  const setUserRole = async (userId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    setSaving(userId);
    const prevRow = rows.find(r => r.user_id === userId);
    const { error } = await supabase.rpc('set_user_role', { _user_id: userId, _role: newRole });
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Role updated');
    logBusinessEvent({
      module: 'admin', eventType: 'user.role_changed', severity: 'warning',
      entityType: 'user', entityId: userId, entityName: prevRow?.email,
      summary: `Changed ${prevRow?.email || 'user'} role: ${prevRow?.role || '—'} → ${newRole}`,
      changeSummary: [{ field: 'role', before: prevRow?.role || null, after: newRole }],
    });
    if (userId === user?.id) await refresh();
    await load();
  };

  if (roleLoading) return <div className="text-muted-foreground">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="card-industrial p-6 space-y-4 max-w-lg">
        <h2 className="text-lg font-semibold">Users & Roles</h2>
        <p className="text-sm text-muted-foreground">
          You are not an admin. If no admin exists yet, click below to claim the first admin role.
        </p>
        <button
          onClick={claimAdmin}
          className="h-10 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
        >
          Claim first admin
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users & Roles</h1>
        <p className="text-sm text-muted-foreground">Admins have full access. Editors can append items and edit/delete only their own work. Viewers can only view.</p>
      </div>
      <div className="card-industrial overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Email</th>
              <th className="p-3">Created</th>
              <th className="p-3">Role</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No users</td></tr>
            ) : rows.map(r => (
              <tr key={r.user_id} className="border-t">
                <td className="p-3">{r.email}{r.user_id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</td>
                <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    r.role === 'admin' ? 'bg-primary text-primary-foreground'
                    : r.role === 'editor' ? 'bg-amber-500 text-white'
                    : 'bg-muted'
                  }`}>
                    {r.role}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button
                    disabled={saving === r.user_id || r.role === 'admin'}
                    onClick={() => setUserRole(r.user_id, 'admin')}
                    className="h-8 px-3 text-xs rounded border hover:bg-muted disabled:opacity-40"
                  >Make admin</button>
                  <button
                    disabled={saving === r.user_id || r.role === 'editor'}
                    onClick={() => setUserRole(r.user_id, 'editor')}
                    className="h-8 px-3 text-xs rounded border hover:bg-muted disabled:opacity-40"
                  >Make editor</button>
                  <button
                    disabled={saving === r.user_id || r.role === 'viewer'}
                    onClick={() => setUserRole(r.user_id, 'viewer')}
                    className="h-8 px-3 text-xs rounded border hover:bg-muted disabled:opacity-40"
                  >Make viewer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
