import React, { useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { heartbeatSession, setActivityUserContext, endUserSession } from '@/lib/activityCenter';
import { isStaging } from '@/integrations/supabase/client';

const moduleFromPath = (p: string): string => {
  if (p.startsWith('/shade-management')) return 'shade';
  if (p.startsWith('/sampling')) return 'sampling';
  if (p.startsWith('/dispatch')) return 'dispatch';
  if (p.startsWith('/expenses')) return 'expense';
  if (p.startsWith('/store')) return 'store';
  if (p.startsWith('/users') || p.startsWith('/activity')) return 'admin';
  if (p.startsWith('/item-master')) return 'item-master';
  return 'other';
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signOut, user } = useAuth();
  const { isViewer, role } = useRole();
  const location = useLocation();

  useEffect(() => {
    if (role) setActivityUserContext({ role });
  }, [role]);

  useEffect(() => {
    const mod = moduleFromPath(location.pathname);
    void heartbeatSession(mod);
    const id = window.setInterval(() => { void heartbeatSession(mod); }, 60_000);
    const onUnload = () => { void endUserSession(); };
    window.addEventListener('beforeunload', onUnload);
    return () => { window.clearInterval(id); window.removeEventListener('beforeunload', onUnload); };
  }, [location.pathname]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {isStaging && (
            <div className="h-7 flex items-center justify-center bg-amber-500 text-amber-950 text-xs font-semibold tracking-wide uppercase">
              Staging / Test Environment — not for daily production use
            </div>
          )}
          <header className="h-14 flex items-center justify-between border-b bg-primary text-primary-foreground px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <span className="font-mono text-lg font-semibold tracking-tight hidden sm:inline">
                SHREE DYEING{isStaging && ' (STAGING)'}
              </span>
              {isViewer && (
                <span className="text-xs px-2 py-0.5 rounded bg-primary-foreground/15 border border-primary-foreground/20">
                  View only
                </span>
              )}
            </div>
            <button
              data-viewer-allow
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md btn-transition hover:bg-primary-foreground/10"
              title={user?.email || 'Sign out'}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </header>
          <main className="flex-1 container px-4 py-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
