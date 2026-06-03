import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';

/**
 * Admin-only route. Editors and viewers are redirected.
 * Used for master-data create/bulk-write pages (e.g. opening stock).
 */
const AdminRoute: React.FC<{ children: React.ReactNode; redirectTo?: string }> = ({
  children,
  redirectTo = '/shade-management',
}) => {
  const { isAdmin, loading } = useRole();
  if (loading) return <div className="text-muted-foreground p-6">Loading...</div>;
  if (!isAdmin) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
};

export default AdminRoute;
