import React, { useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';
import { ThemeMode } from '../utils/theme.js';
import AppearancePanel from './AppearancePanel.js';
import { useI18n } from '../i18n/I18nContext.js';

interface AppearancePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeMode: ThemeMode;
  accent: string;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (hex: string) => void;
}

/** Header palette button + its anchored popover — des-2.txt §4/§4.1. */
export const AppearancePopover: React.FC<AppearancePopoverProps> = ({
  open, onOpenChange, themeMode, accent, onThemeChange, onAccentChange
}) => {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        title={t('appearance')}
        aria-label={t('appearance')}
        aria-expanded={open}
        className="tk-icon-btn tk-focusable"
        style={{
          width: 32, height: 32,
          ...(open ? { background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' } : {})
        }}
      >
        <Palette className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('visualAppearance')}
          className="tk-panel"
          style={{
            position: 'absolute',
            top: 42,
            insetInlineEnd: 0,
            zIndex: 40,
            width: 'min(360px, 84vw)',
            borderRadius: 16,
            border: '1px solid var(--tk-border-strong)',
            boxShadow: '0 22px 50px rgba(0,0,0,.35)',
            padding: '16px 18px 18px'
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ borderBottom: '1px solid var(--tk-border)', paddingBottom: 10, marginBottom: 14 }}
          >
            <Palette className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
            <span className="text-[10.5px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--tk-accent-text)' }}>
              {t('visualAppearance')}
            </span>
          </div>
          <AppearancePanel themeMode={themeMode} accent={accent} onThemeChange={onThemeChange} onAccentChange={onAccentChange} />
        </div>
      )}
    </div>
  );
};

export default AppearancePopover;
