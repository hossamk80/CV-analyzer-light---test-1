import React from 'react';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { ShieldAlert, LogOut, Globe, Moon, Sun, Monitor } from 'lucide-react';
import { hasPermission } from '../utils/rbac.js';

interface TopNavbarProps {
  onToggleSidebar: () => void;
  title: string;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onToggleSidebar, title }) => {
  const { t, language, setLanguage, dir } = useI18n();
  const { role, username, gdprActive, capabilities, toggleGdpr, logout } = useRole();

  const handleLanguageToggle = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const showGdprToggle = role && hasPermission(role, 'toggle_gdpr', capabilities);

  return (
    <nav className="h-16 border-b border-border-main bg-bg-card/75 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6 no-print">
      {/* Title / Breadcrumb */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-text-main tracking-tight">{title}</h1>
      </div>

      {/* Action items */}
      <div className="flex items-center gap-3">
        {/* GDPR Toggle */}
        {showGdprToggle && (
          <button
            onClick={toggleGdpr}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              gdprActive
                ? 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse'
                : 'bg-bg-hover border-border-main text-text-muted hover:text-text-main'
            }`}
            title="Toggle GDPR anonymization mode to mask contact details"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {gdprActive ? t('gdprMode') : t('gdprMode')}
            </span>
          </button>
        )}

        {/* Language Toggle */}
        <button
          onClick={handleLanguageToggle}
          className="p-2 rounded-xl bg-bg-hover hover:bg-border-main border border-border-main/50 text-text-muted hover:text-text-main transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <Globe className="w-4 h-4" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        {/* Divider */}
        <div className="h-5 w-[1px] bg-border-main mx-1"></div>

        {/* User Card */}
        {username && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-text-main leading-3">{username}</p>
              <span className="text-[10px] text-brand font-medium tracking-wide uppercase">
                {t(role as any)}
              </span>
            </div>
            
            <button
              onClick={logout}
              className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all cursor-pointer"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
export default TopNavbar;
