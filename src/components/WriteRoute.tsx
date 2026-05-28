import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';

/** Blocks viewers from create/edit pages by redirecting elsewhere. */
const WriteRoute: React.FC<{ children: React.ReactNode; redirectTo?: string }> = ({
  children,
  redirectTo = '/shade-management',
}) => {
  const { isViewer, loading } = useRole();
  if (loading) return <div className="text-muted-foreground p-6">Loading...</div>;
  if (isViewer) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
};

export default WriteRoute;
