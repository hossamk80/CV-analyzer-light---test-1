import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n/I18nContext.js';
import { RoleProvider, useRole } from './context/RoleContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { hasPermission } from './utils/rbac.js';

// Import Views
import Login from './views/Login.js';
import Dashboard from './views/Dashboard.js';
import Jobs from './views/Jobs.js';
import Upload from './views/Upload.js';
import Results from './views/Results.js';
import CandidateDetail from './views/CandidateDetail.js';
import Settings from './views/Settings.js';
import PromptSettings from './views/PromptSettings.js';
import IntegrationsSettings from './views/Settings/IntegrationsSettings.js';
import Analytics from './views/Analytics.js';

// Icons
import {
  LayoutDashboard,
  Briefcase,
  UploadCloud,
  ListOrdered,
  Settings as SettingsIcon,
  MessageSquareCode,
  BrainCircuit,
  Link2,
  BarChart3,
  LogOut
} from 'lucide-react';
import TopNavbar from './components/TopNavbar.js';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  capability: string;
}

// Rail avatar → small dropdown surfacing identity + logout (des-2.txt §4 "34px avatar with a 1px ring";
// the spec doesn't detail its click behavior, so this is the pragmatic real-world fill-in — logout has
// to live somewhere).
const RailAvatar: React.FC = () => {
  const { username, role, logout } = useRole();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!username) return null;

  const initial = username.charAt(0).toUpperCase();

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={username}
        aria-label={username}
        aria-expanded={open}
        className="tk-focusable"
        style={{
          width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
          background: 'var(--tk-accent)', color: 'var(--tk-on-accent)',
          border: '1px solid var(--tk-border-strong)',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        {initial}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('logout')}
          className="tk-panel"
          style={{
            position: 'absolute',
            bottom: 0,
            insetInlineStart: '100%',
            marginInlineStart: 10,
            zIndex: 40,
            width: 180,
            borderRadius: 14,
            border: '1px solid var(--tk-border-strong)',
            boxShadow: '0 22px 50px rgba(0,0,0,.35)',
            padding: '12px 14px'
          }}
        >
          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--tk-text)' }}>{username}</p>
          <p className="text-[10px] font-bold uppercase tracking-[.1em] mb-3" style={{ color: 'var(--tk-accent-text)' }}>
            {role ? t(role as any) : ''}
          </p>
          <button
            type="button"
            onClick={logout}
            className="tk-btn-neutral tk-focusable"
            style={{ width: '100%', height: 32, fontSize: 12 }}
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
};

// Navigation rail — des-2.txt §4 (60–76px sticky icon rail, 8 nav buttons, logo mark, bottom avatar).
const Rail: React.FC = () => {
  const { t } = useI18n();
  const { role, capabilities } = useRole();
  const location = useLocation();

  const navItems: NavItem[] = [
    { path: '/', label: t('navDashboard'), icon: LayoutDashboard, capability: 'view_dashboard' },
    { path: '/jobs', label: t('navJobs'), icon: Briefcase, capability: 'manage_jobs' },
    { path: '/upload', label: t('navUpload'), icon: UploadCloud, capability: 'upload_cvs' },
    { path: '/results', label: t('navResults'), icon: ListOrdered, capability: 'view_dashboard' },
    { path: '/analytics', label: t('navAnalytics'), icon: BarChart3, capability: 'view_dashboard' },
    { path: '/settings', label: t('navSettings'), icon: SettingsIcon, capability: 'manage_settings' },
    { path: '/settings/prompts', label: t('navPrompts'), icon: MessageSquareCode, capability: 'manage_settings' },
    { path: '/settings/integrations', label: t('navIntegrations'), icon: Link2, capability: 'manage_settings' }
  ];

  const visibleNavs = navItems.filter(item => role && hasPermission(role, item.capability as any, capabilities));

  return (
    <aside
      className="no-print"
      style={{
        width: 'clamp(60px, 6vw, 76px)', flex: 'none', position: 'sticky', top: 0,
        height: '100vh', background: 'var(--tk-rail)', borderInlineEnd: '1px solid var(--tk-border)',
        padding: '18px 0 14px', display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}
    >
      <div
        title="Home"
        style={{
          width: 40, height: 40, borderRadius: 12, marginBottom: 14, flex: 'none',
          background: 'linear-gradient(150deg, var(--tk-accent), color-mix(in srgb, var(--tk-accent) 55%, #000))',
          boxShadow: '0 6px 20px color-mix(in srgb, var(--tk-accent) 45%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <BrainCircuit className="w-5 h-5" style={{ color: 'var(--tk-on-accent)' }} />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {visibleNavs.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              aria-label={item.label}
              className="tk-focusable"
              style={{
                position: 'relative', width: 44, height: 44, borderRadius: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isActive ? 'var(--tk-accent-text)' : 'var(--tk-muted)',
                background: isActive ? 'var(--tk-accent-soft)' : 'transparent',
                boxShadow: isActive ? '0 0 0 1px var(--tk-accent-line)' : 'none'
              }}
            >
              {isActive && (
                // -8px lands exactly on the rail's inline-start edge at its narrowest
                // (60px rail - 44px button = 8px gutter). Going further out (the spec's
                // -14px) pushes the bar past the page edge in RTL, where the rail is on
                // the right, and creates a horizontal scrollbar at small widths.
                <span
                  style={{
                    position: 'absolute', insetInlineStart: -8, width: 3, height: 20, borderRadius: 3,
                    background: 'var(--tk-accent)', boxShadow: '0 0 12px color-mix(in srgb, var(--tk-accent) 70%, transparent)'
                  }}
                />
              )}
              <Icon className="w-[19px] h-[19px]" />
            </Link>
          );
        })}
      </nav>

      <div style={{ width: 22, borderTop: '1px solid var(--tk-border)', margin: '14px 0' }} />
      <RailAvatar />
    </aside>
  );
};

// Navigation layout wrapper
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const { isAuthenticated } = useRole();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return t('navDashboard');
    if (path.startsWith('/jobs')) return t('definePosition');
    if (path.startsWith('/upload')) return t('navUpload');
    if (path.startsWith('/results')) return t('navResults');
    if (path.startsWith('/analytics')) return t('navAnalytics');
    if (path.startsWith('/settings/prompts')) return t('navPrompts');
    if (path.startsWith('/settings/integrations')) return t('navIntegrations');
    if (path.startsWith('/settings')) return t('navSettings');
    if (path.startsWith('/candidate')) return t('reportTitle');
    return t('appName');
  };

  const kicker = t('cvAnalyzer');

  if (!isAuthenticated) {
    return <div className="tk-page">{children}</div>;
  }

  return (
    <div className="tk-page" style={{ display: 'flex' }}>
      <Rail />
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <main style={{ padding: 'clamp(16px,2vw,24px) clamp(14px,2.2vw,30px) 44px' }}>
          <TopNavbar kicker={kicker} title={getPageTitle()} />
          <div className="print-container">{children}</div>
        </main>
      </div>
    </div>
  );
};

export const AppContent: React.FC = () => {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* Public login */}
          <Route path="/login" element={<Login />} />

          {/* Protected views with RBAC restrictions */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/jobs" element={
            <ProtectedRoute requiredCapability="manage_jobs">
              <Jobs />
            </ProtectedRoute>
          } />

          <Route path="/upload" element={
            <ProtectedRoute requiredCapability="upload_cvs">
              <Upload />
            </ProtectedRoute>
          } />

          <Route path="/results" element={
            <ProtectedRoute>
              <Results />
            </ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          } />

          <Route path="/candidate/:id" element={
            <ProtectedRoute>
              <CandidateDetail />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute requiredCapability="manage_settings">
              <Settings />
            </ProtectedRoute>
          } />

          <Route path="/settings/prompts" element={
            <ProtectedRoute requiredCapability="manage_settings">
              <PromptSettings />
            </ProtectedRoute>
          } />

          <Route path="/settings/integrations" element={
            <ProtectedRoute requiredCapability="manage_settings">
              <IntegrationsSettings />
            </ProtectedRoute>
          } />

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <ThemeProvider>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </ThemeProvider>
    </I18nProvider>
  );
};

export default App;
