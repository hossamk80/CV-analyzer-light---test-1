import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext.js';
import { UserRole, Capability, hasPermission } from '../utils/rbac.js';
import AccessDenied from './AccessDenied.js';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredCapability?: Capability;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredCapability }) => {
  const { isAuthenticated, role, capabilities } = useRole();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const deniedByRole = allowedRoles && role && !allowedRoles.includes(role);
  const deniedByCapability = requiredCapability && (!role || !hasPermission(role, requiredCapability, capabilities));

  if (deniedByRole || deniedByCapability) {
    // Same localized panel the data views use when the API returns 403.
    return <AccessDenied />;
  }

  return <>{children}</>;
};
