import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, PlusCircle, Database, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lots', label: 'Lot List', icon: List },
  { to: '/lots/create', label: 'Create Lot', icon: PlusCircle },
  { to: '/master', label: 'Master Data', icon: Database },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-primary text-primary-foreground">
        <div className="container flex items-center justify-between h-14 px-4">
          <Link to="/" className="font-mono text-lg font-semibold tracking-tight">
            SHREE DYEING - FACTORY MANAGEMENT SOFTWARE
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md btn-transition ${
                    active ? 'bg-primary-foreground/15 font-medium' : 'hover:bg-primary-foreground/10'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md btn-transition hover:bg-primary-foreground/10 ml-2"
              title={user?.email || 'Sign out'}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </nav>
        </div>
      </header>
      <main className="container px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
