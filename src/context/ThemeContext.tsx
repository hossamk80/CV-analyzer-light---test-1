import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode, FontScale, getSavedTheme, getSavedAccent, getSavedFontScale, applyTheme, applyAccentAndSave, applyFontScale, initTheme } from '../utils/theme.js';

interface ThemeContextType {
  themeMode: ThemeMode;
  accent: string;
  fontScale: FontScale;
  setThemeMode: (theme: ThemeMode) => void;
  setAccent: (hex: string) => void;
  setFontScale: (scale: FontScale) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Single source of truth for theme + accent so the header's appearance popover
 * and the Settings → General panel (des-2.txt §4.1 / §10.1.1) never drift out
 * of sync — both read/write through this context instead of local state.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getSavedTheme);
  const [fontScale, setFontScaleState] = useState<FontScale>(getSavedFontScale);
  const [accent, setAccentState] = useState<string>(getSavedAccent);

  useEffect(() => {
    initTheme();
    setAccentState(getSavedAccent()); // pick up any auto-switch (e.g. Midnight → Amber) applied by initTheme()
  }, []);

  const setThemeMode = (theme: ThemeMode) => {
    setThemeModeState(theme);
    applyTheme(theme);
    setAccentState(getSavedAccent());
  };

  const setFontScale = (scale: FontScale) => { setFontScaleState(scale); applyFontScale(scale); };

  const setAccent = (hex: string) => {
    setAccentState(hex);
    applyAccentAndSave(hex);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, accent, fontScale, setThemeMode, setAccent, setFontScale }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
