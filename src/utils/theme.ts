// Talenta theme engine (des-2.txt §3). Two inputs drive every color in the app:
// `theme` (light/dark/midnight, applied as a data-attribute) and `accent` (one hex,
// applied as the single --tk-accent custom property everything else is color-mix()'d from).

export type ThemeMode = 'light' | 'dark' | 'midnight';

export interface AccentSwatch {
  name: string;
  hex: string;
}

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Amber', hex: '#f5b301' },
];

const DEFAULT_ACCENT = '#8b5cf6'; // violet
const MIDNIGHT_DEFAULT_ACCENT = '#f5b301'; // amber

const THEME_STORAGE_KEY = 'talenta_theme';
const ACCENT_STORAGE_KEY = 'talenta_accent';

export function getSavedTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return saved === 'light' || saved === 'dark' || saved === 'midnight' ? saved : 'dark';
}

export function getSavedAccent(): string {
  const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
  return saved && /^#[0-9a-fA-F]{6}$/.test(saved) ? saved : DEFAULT_ACCENT;
}

/**
 * Picks the higher-contrast foreground (near-black or white) for a filled accent
 * surface, from the accent's own relative luminance — des-2.txt §3.2.
 */
export function computeOnAccent(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
  const contrast = (a: number, bLum: number) => (Math.max(a, bLum) + 0.05) / (Math.min(a, bLum) + 0.05);
  // 0.0086 = relative luminance of #14161f (the dark candidate)
  return contrast(lum, 0.0086) >= contrast(lum, 1) ? '#14161f' : '#ffffff';
}

export function applyAccent(hex: string) {
  document.documentElement.style.setProperty('--tk-accent', hex);
  document.documentElement.style.setProperty('--tk-on-accent', computeOnAccent(hex));
}

export function applyAccentAndSave(hex: string) {
  applyAccent(hex);
  localStorage.setItem(ACCENT_STORAGE_KEY, hex);
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  // Entering Midnight from the untouched default accent switches to Amber;
  // an accent the user already customized is left alone (des-2.txt §3.3).
  if (theme === 'midnight' && getSavedAccent() === DEFAULT_ACCENT) {
    applyAccentAndSave(MIDNIGHT_DEFAULT_ACCENT);
  }
}

export function initTheme() {
  applyAccent(getSavedAccent());
  applyTheme(getSavedTheme());
}
