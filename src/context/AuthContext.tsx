import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { logBusinessEvent, logSystemEvent, startUserSession, endUserSession, setActivityUserContext } from '@/lib/activityCenter';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_IN' && session?.user) {
        setActivityUserContext({ id: session.user.id, name: session.user.email || null });
        void startUserSession(session.user.id, session.user.email || null, null);
        logBusinessEvent({
          module: 'auth', eventType: 'user.logged_in', severity: 'info',
          entityType: 'user', entityId: session.user.id, entityName: session.user.email || undefined,
          summary: `${session.user.email || 'User'} logged in`,
        });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) setActivityUserContext({ id: session.user.id, name: session.user.email || null });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logSystemEvent({
        severity: 'warning', eventType: 'auth.failed', module: 'auth',
        description: `Failed login for ${email}`,
        technicalDetails: { message: error.message },
      });
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    const u = user;
    if (u) {
      logBusinessEvent({
        module: 'auth', eventType: 'user.logged_out', severity: 'info',
        entityType: 'user', entityId: u.id, entityName: u.email || undefined,
        summary: `${u.email || 'User'} logged out`,
      });
    }
    await endUserSession();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
