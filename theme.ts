export type ThemeMode = 'light' | 'dark' | 'midnight-yellow';
export type PrimaryColor = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'red';

export function getSavedTheme(): ThemeMode {
  const saved = localStorage.getItem('ats_theme');
  return (saved === 'light' || saved === 'dark' || saved === 'midnight-yellow') ? saved : 'light';
}

export function getSavedPrimaryColor(): PrimaryColor {
  const saved = localStorage.getItem('ats_primary');
  return (saved === 'blue' || saved === 'green' || saved === 'purple' || saved === 'orange' || saved === 'pink' || saved === 'red') ? saved : 'blue';
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ats_theme', theme);
}

export function applyPrimaryColor(color: PrimaryColor) {
  document.documentElement.setAttribute('data-primary', color);
  localStorage.setItem('ats_primary', color);
}

export function initTheme() {
  applyTheme(getSavedTheme());
  applyPrimaryColor(getSavedPrimaryColor());
}
