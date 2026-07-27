import React, { createContext, useContext, useState, useEffect } from 'react';
import { ar } from './ar.js';
import { en } from './en.js';

type Language = 'ar' | 'en';
type Dictionary = typeof ar;
type TranslationKey = keyof Dictionary;

interface I18nContextType {
  language: Language;
  dir: 'rtl' | 'ltr';
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Arabic-first by default, load from localStorage if present
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('ats_lang');
    return (saved === 'ar' || saved === 'en') ? saved : 'ar';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('ats_lang', lang);
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  // Apply attributes to document before paint
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  const t = (key: TranslationKey, params?: Record<string, string>): string => {
    const dict = language === 'ar' ? ar : en;
    let value = dict[key] || en[key] || String(key);
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`{${k}}`, 'g'), v);
      });
    }
    
    return value;
  };

  return (
    <I18nContext.Provider value={{ language, dir, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
