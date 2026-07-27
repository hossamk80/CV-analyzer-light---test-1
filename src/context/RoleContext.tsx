import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../utils/rbac.js';
import { apiRequest } from '../utils/api.js';

interface RoleContextType {
  token: string | null;
  role: UserRole | null;
  username: string | null;
  gdprActive: boolean;
  login: (tokenOrRole: string, roleOrUsername?: string, userName?: string) => void;
  logout: () => void;
  toggleGdpr: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [gdprActive, setGdprActive] = useState<boolean>(() => localStorage.getItem('ats_gdpr') === 'true');

  useEffect(() => {
    // Verify session on boot via httpOnly cookie /api/auth/me (Phase 1.2)
    apiRequest('GET', '/api/auth/me')
      .then(user => {
        setRole(user.role as UserRole);
        setUsername(user.username);
      })
      .catch(() => {
        setRole(null);
        setUsername(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = (tokenOrRole: string, roleOrUsername?: string, userName?: string) => {
    let finalRole: UserRole;
    let finalUsername: string;

    if (userName) {
      finalRole = roleOrUsername as UserRole;
      finalUsername = userName;
    } else {
      finalRole = tokenOrRole as UserRole;
      finalUsername = roleOrUsername || '';
    }

    setRole(finalRole);
    setUsername(finalUsername);
  };

  const logout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
    } catch (e) {}
    setRole(null);
    setUsername(null);
  };

  const toggleGdpr = () => {
    const nextVal = !gdprActive;
    setGdprActive(nextVal);
    localStorage.setItem('ats_gdpr', String(nextVal));
  };

  const isAuthenticated = !!role;
  const token = role ? 'session_cookie' : null;

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bg-main text-text-muted text-sm font-semibold">
        Verifying security session...
      </div>
    );
  }

  return (
    <RoleContext.Provider
      value={{
        token,
        role,
        username,
        gdprActive,
        login,
        logout,
        toggleGdpr,
        isAuthenticated,
        loading
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
