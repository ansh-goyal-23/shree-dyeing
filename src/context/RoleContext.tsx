import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type AppRole = 'admin' | 'viewer';

interface RoleContextType {
  role: AppRole | null;
  loading: boolean;
  isViewer: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | null>(null);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setRole(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    if (error) { console.error('role fetch error', error); setRole('viewer'); }
    else {
      const roles = (data || []).map(r => r.role as AppRole);
      if (roles.includes('admin')) setRole('admin');
      else if (roles.includes('viewer')) setRole('viewer');
      else setRole('viewer'); // default: viewer if no row
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const value: RoleContextType = {
    role,
    loading,
    isViewer: role === 'viewer',
    isAdmin: role === 'admin',
    refresh: load,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
};
