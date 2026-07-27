import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { ShieldCheck, Globe, Search } from 'lucide-react';
import { hasPermission } from '../utils/rbac.js';
import AppearancePopover from './AppearancePopover.js';

interface TopNavbarProps {
  kicker: string;
  title: string;
}

/** Header — kicker/title + search, GDPR, language and appearance controls (des-2.txt §4). */
export const TopNavbar: React.FC<TopNavbarProps> = ({ kicker, title }) => {
  const { t, language, setLanguage } = useI18n();
  const { role, gdprActive, capabilities, toggleGdpr } = useRole();
  const { themeMode, accent, setThemeMode, setAccent } = useTheme();
  const [search, setSearch] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const showGdprToggle = role && hasPermission(role, 'toggle_gdpr', capabilities);

  return (
    <header
      className="flex flex-wrap items-center gap-3 justify-between no-print"
      style={{ marginBottom: 'clamp(18px,2vw,26px)' }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: '.22em', color: 'var(--tk-accent-text)' }}
        >
          {kicker}
        </div>
        <h1
          className="font-medium truncate"
          style={{ fontSize: 'clamp(21px,2.4vw,30px)', letterSpacing: '-.02em', color: 'var(--tk-text)' }}
        >
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2.5" style={{ justifyContent: 'flex-end' }}>
        <div className="relative" style={{ flex: '1 1 170px', maxWidth: 260, minWidth: 150 }}>
          <Search
            className="w-4 h-4 absolute pointer-events-none"
            style={{ insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--tk-muted)' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search') || 'Search'}
            className="tk-field tk-focusable"
            style={{ height: 36, borderRadius: 10, background: 'var(--tk-input)', paddingInlineStart: 34, width: '100%' }}
          />
        </div>

        {showGdprToggle && (
          <button
            type="button"
            onClick={toggleGdpr}
            title="Toggle GDPR anonymization mode"
            aria-pressed={gdprActive}
            className="flex items-center gap-1.5 px-3 tk-focusable"
            style={{
              height: 36, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: gdprActive ? 'var(--tk-accent-soft)' : 'transparent',
              color: gdprActive ? 'var(--tk-accent-text)' : 'var(--tk-soft)',
              border: `1px solid ${gdprActive ? 'var(--tk-accent-line)' : 'var(--tk-border-strong)'}`
            }}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">{t('gdprMode')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1.5 px-3 tk-focusable"
          style={{
            height: 36, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: 'transparent', color: 'var(--tk-soft)', border: '1px solid var(--tk-border-strong)'
          }}
        >
          <Globe className="w-4 h-4" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        <AppearancePopover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          themeMode={themeMode}
          accent={accent}
          onThemeChange={setThemeMode}
          onAccentChange={setAccent}
        />
      </div>
    </header>
  );
};
export default TopNavbar;
