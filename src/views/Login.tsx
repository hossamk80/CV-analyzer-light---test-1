import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import { apiRequest } from '../utils/api.js';
import { Shield, BrainCircuit, Globe } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isAuthenticated } = useRole();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest('POST', '/api/auth/login', { username, password });
      login(data.role, data.username);
      navigate('/');
    } catch (err: any) {
      setError(err.message || t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageToggle = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-main px-4 py-12 relative overflow-hidden transition-colors duration-300">
      {/* Dynamic Background Blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/5 rounded-full blur-3xl -z-10"></div>

      {/* Floating Language Switcher */}
      <button
        onClick={handleLanguageToggle}
        className="tk-btn-neutral tk-focusable absolute"
        style={{ top: 20, insetInlineEnd: 20 }}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{language === 'ar' ? 'English' : 'العربية'}</span>
      </button>

      {/* Login Card */}
      <div className="tk-panel w-full max-w-md" style={{ padding: 26, boxShadow: '0 22px 50px rgba(0,0,0,.25)' }}>
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center mb-3" style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--tk-accent-soft)', border: '1px solid var(--tk-accent-line)', color: 'var(--tk-accent-text)' }}>
            <BrainCircuit className="w-6 h-6" />
          </div>
          <h2 className="text-[20px] font-medium tracking-tight text-center" style={{ color: 'var(--tk-text)' }}>{t('appName')}</h2>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--tk-muted)' }}>{t('cvAnalyzer')}</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium rounded-xl flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
              {t('username')}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('usernamePlaceholder')}
              className="tk-field tk-focusable"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
              {t('password')}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="tk-field tk-focusable"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="tk-btn-primary tk-focusable w-full mt-4 disabled:opacity-50 disabled:pointer-events-none"
            style={{ height: 36, fontSize: 12.5 }}
          >
            {loading ? (
              <div
                className="w-4 h-4 rounded-full animate-spin"
                style={{ border: '2px solid var(--tk-accent-soft)', borderTopColor: 'var(--tk-accent)' }}
              />
            ) : null}
            <span>{t('signIn')}</span>
          </button>
        </form>

        {/* Demo Credentials Reminder - Gated by VITE_SHOW_DEMO_CREDENTIALS */}
        {(import.meta as any).env?.VITE_SHOW_DEMO_CREDENTIALS === 'true' && (
          <div className="mt-8 pt-6 border-t border-border-main/50 text-center">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[.1em] mb-2">{t('demoAccounts')}</p>
            <div className="grid grid-cols-3 gap-1 text-[11px] font-medium text-text-muted/80">
              <div>
                <p className="font-bold text-brand">{t('admin')}</p>
                <p dir="ltr">admin / admin123</p>
              </div>
              <div>
                <p className="font-bold text-brand">{t('recruiter')}</p>
                <p dir="ltr">recruiter / recruiter123</p>
              </div>
              <div>
                <p className="font-bold text-brand">{t('manager')}</p>
                <p dir="ltr">manager / manager123</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
