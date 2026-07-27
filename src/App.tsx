import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n/I18nContext.js';
import { RoleProvider, useRole } from './context/RoleContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { initTheme } from './utils/theme.js';
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
  Menu,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  Link2,
  BarChart3
} from 'lucide-react';
import TopNavbar from './components/TopNavbar.js';

// Navigation layout wrapper
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, dir } = useI18n();
  const { role, isAuthenticated } = useRole();
  const location = useLocation();

  // Collapsible sidebar state, persisted
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('ats_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const nextVal = !collapsed;
    setCollapsed(nextVal);
    localStorage.setItem('ats_sidebar_collapsed', String(nextVal));
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return t('navDashboard');
    if (path.startsWith('/jobs')) return t('navJobs');
    if (path.startsWith('/upload')) return t('navUpload');
    if (path.startsWith('/results')) return t('navResults');
    if (path.startsWith('/settings/prompts')) return t('navPrompts');
    if (path.startsWith('/settings/integrations')) return t('navIntegrations');
    if (path.startsWith('/settings')) return t('navSettings');
    if (path.startsWith('/candidate')) return t('reportTitle');
    return t('appName');
  };

  // Nav links definitions with required permissions
  const navItems = [
    { path: '/', label: t('navDashboard'), icon: LayoutDashboard, capability: 'view_dashboard' },
    { path: '/jobs', label: t('navJobs'), icon: Briefcase, capability: 'manage_jobs' },
    { path: '/upload', label: t('navUpload'), icon: UploadCloud, capability: 'upload_cvs' },
    { path: '/results', label: t('navResults'), icon: ListOrdered, capability: 'view_dashboard' },
    { path: '/analytics', label: 'Analytics & Funnel', icon: BarChart3, capability: 'view_dashboard' },
    { path: '/settings', label: t('navSettings'), icon: SettingsIcon, capability: 'manage_settings' },
    { path: '/settings/prompts', label: t('navPrompts'), icon: MessageSquareCode, capability: 'manage_settings' },
    { path: '/settings/integrations', label: t('navIntegrations') || 'Integrations', icon: Link2, capability: 'manage_settings' }
  ];

  // Filter based on roles permissions
  const visibleNavs = navItems.filter(item => {
    if (!role) return false;
    return hasPermission(role, item.capability as any);
  });

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-bg-main text-text-main">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-bg-main text-text-main transition-colors duration-300">
      {/* Collapsible Sidebar (no-print hides it in prints/PDFs) */}
      <aside 
        className={`bg-bg-card border-border-main no-print flex flex-col transition-all duration-300 ${
          dir === 'rtl' ? 'border-l' : 'border-r'
        } ${collapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border-main/50 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 font-black text-brand tracking-wider">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
              <span className="text-sm uppercase">{t('cvAnalyzer')}</span>
            </div>
          )}
          {collapsed && (
            <BrainCircuit className="w-6 h-6 text-brand mx-auto animate-pulse" />
          )}

          {!collapsed && (
            <button 
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-main transition-colors"
            >
              {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Navigation Rail */}
        <nav className="flex-1 py-4 space-y-1.5 px-3 overflow-y-auto">
          {visibleNavs.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center rounded-xl p-3 text-sm font-semibold transition-all group ${
                  isActive
                    ? 'bg-brand text-white shadow-md shadow-brand/10'
                    : 'text-text-muted hover:bg-bg-hover hover:text-text-main'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 sidebar-item-icon ${isActive ? 'text-white' : 'text-text-muted group-hover:text-brand'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer collapse trigger for collapsed mode */}
        {collapsed && (
          <div className="p-3 border-t border-border-main/50 flex justify-center shrink-0">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl hover:bg-bg-hover text-text-muted hover:text-text-main transition-colors"
            >
              {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        )}
      </aside>

      {/* Main Layout Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar title={getPageTitle()} onToggleSidebar={toggleSidebar} />

        {/* View Port Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto print-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export const AppContent: React.FC = () => {
  // Initialize Visual design themes (Light/Dark/Yellow)
  useEffect(() => {
    initTheme();
  }, []);

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
            <ProtectedRoute allowedRoles={['admin', 'recruiter']}>
              <Jobs />
            </ProtectedRoute>
          } />

          <Route path="/upload" element={
            <ProtectedRoute allowedRoles={['admin', 'recruiter']}>
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
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          } />

          <Route path="/settings/prompts" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PromptSettings />
            </ProtectedRoute>
          } />

          <Route path="/settings/integrations" element={
            <ProtectedRoute allowedRoles={['admin']}>
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
      <RoleProvider>
        <AppContent />
      </RoleProvider>
    </I18nProvider>
  );
};

export default App;
