import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signOut, user } = useAuth();
  const { isViewer } = useRole();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-primary text-primary-foreground px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <span className="font-mono text-lg font-semibold tracking-tight hidden sm:inline">
                SHREE DYEING
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
