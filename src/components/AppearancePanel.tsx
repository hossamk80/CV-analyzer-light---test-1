import React from 'react';
import { Check } from 'lucide-react';
import { ThemeMode, ACCENT_SWATCHES, computeOnAccent } from '../utils/theme.js';
import { useI18n } from '../i18n/I18nContext.js';

interface AppearancePanelProps {
  themeMode: ThemeMode;
  accent: string;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (hex: string) => void;
}

const THEME_KEYS = ['light', 'dark', 'midnight'] as const;
const THEME_LABEL_KEY = {
  light: 'themeLight',
  dark: 'themeDark',
  midnight: 'themeMidnightYellow'
} as const;

/** Theme pills + accent swatches — des-2.txt §4.1, reused in the header popover and Settings → General. */
export const AppearancePanel: React.FC<AppearancePanelProps> = ({ themeMode, accent, onThemeChange, onAccentChange }) => {
  const { t } = useI18n();

  return (
  <div className="flex flex-wrap gap-6">
    <div>
      <span className="block text-[10.5px] font-bold uppercase tracking-[.1em] mb-2.5" style={{ color: 'var(--tk-muted)' }}>
        {t('themeSelection')}
      </span>
      <div className="flex flex-wrap gap-2">
        {THEME_KEYS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onThemeChange(id)}
            className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-semibold cursor-pointer transition-all tk-focusable"
            style={
              themeMode === id
                ? {
                    background: 'var(--tk-accent)',
                    color: 'var(--tk-on-accent)',
                    boxShadow: '0 6px 18px color-mix(in srgb, var(--tk-accent) 38%, transparent)',
                    border: '1px solid transparent'
                  }
                : { background: 'transparent', color: 'var(--tk-soft)', border: '1px solid var(--tk-border-strong)' }
            }
          >
            {t(THEME_LABEL_KEY[id])}
          </button>
        ))}
      </div>
    </div>

    <div>
      <span className="block text-[10.5px] font-bold uppercase tracking-[.1em] mb-2.5" style={{ color: 'var(--tk-muted)' }}>
        {t('primaryColor')}
      </span>
      <div className="flex flex-wrap gap-2">
        {ACCENT_SWATCHES.map(({ name, hex }) => (
          <button
            key={hex}
            type="button"
            onClick={() => onAccentChange(hex)}
            title={name}
            aria-label={name}
            aria-pressed={accent === hex}
            className="w-[26px] h-[26px] rounded-full transition-transform relative flex items-center justify-center cursor-pointer tk-focusable"
            style={{
              background: hex,
              boxShadow:
                accent === hex
                  ? `0 0 0 2px var(--tk-text), 0 0 0 5px color-mix(in srgb, ${hex} 30%, transparent)`
                  : 'none'
            }}
          >
            {accent === hex && <Check className="w-3 h-3" style={{ color: computeOnAccent(hex) }} />}
          </button>
        ))}
      </div>
    </div>
  </div>
  );
};

export default AppearancePanel;
