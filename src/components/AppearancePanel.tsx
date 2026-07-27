import React from 'react';
import { Check } from 'lucide-react';
import { ThemeMode, ACCENT_SWATCHES, computeOnAccent } from '../utils/theme.js';

interface AppearancePanelProps {
  themeMode: ThemeMode;
  accent: string;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (hex: string) => void;
}

const THEME_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light Mode' },
  { id: 'dark', label: 'Dark Mode' },
  { id: 'midnight', label: 'Midnight Accent' },
];

/** Theme pills + accent swatches — des-2.txt §4.1, reused in the header popover and Settings → General. */
export const AppearancePanel: React.FC<AppearancePanelProps> = ({ themeMode, accent, onThemeChange, onAccentChange }) => (
  <div className="flex flex-wrap gap-7">
    <div>
      <span className="block text-[11px] font-bold uppercase tracking-[.1em] mb-3" style={{ color: 'var(--tk-muted)' }}>
        Theme selection
      </span>
      <div className="flex flex-wrap gap-2.5">
        {THEME_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onThemeChange(id)}
            className="px-[15px] py-[9px] rounded-[10px] text-[12.5px] font-semibold cursor-pointer transition-all tk-focusable"
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
            {label}
          </button>
        ))}
      </div>
    </div>

    <div>
      <span className="block text-[11px] font-bold uppercase tracking-[.1em] mb-3" style={{ color: 'var(--tk-muted)' }}>
        Primary color accent
      </span>
      <div className="flex flex-wrap gap-2.5">
        {ACCENT_SWATCHES.map(({ name, hex }) => (
          <button
            key={hex}
            type="button"
            onClick={() => onAccentChange(hex)}
            title={name}
            aria-label={name}
            aria-pressed={accent === hex}
            className="w-[30px] h-[30px] rounded-full transition-transform relative flex items-center justify-center cursor-pointer tk-focusable"
            style={{
              background: hex,
              boxShadow:
                accent === hex
                  ? `0 0 0 2px var(--tk-text), 0 0 0 5px color-mix(in srgb, ${hex} 30%, transparent)`
                  : 'none'
            }}
          >
            {accent === hex && <Check className="w-3.5 h-3.5" style={{ color: computeOnAccent(hex) }} />}
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default AppearancePanel;
