import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext.js';
import { UserRole, Capability, hasPermission } from '../utils/rbac.js';
import { useI18n } from '../i18n/I18nContext.js';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredCapability?: Capability;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredCapability }) => {
  const { isAuthenticated, role, capabilities } = useRole();
  const { t } = useI18n();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const deniedByRole = allowedRoles && role && !allowedRoles.includes(role);
  const deniedByCapability = requiredCapability && (!role || !hasPermission(role, requiredCapability, capabilities));

  if (deniedByRole || deniedByCapability) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl max-w-md">
          <h2 className="text-xl font-bold text-red-500 mb-2">Access Denied / غير مصرح بالدخول</h2>
          <p className="text-text-muted text-sm">
            {t('assistant_admin') ? "You do not have the required permission settings to view this page." : "ليس لديك الصلاحيات الكافية لعرض هذه الصفحة."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
