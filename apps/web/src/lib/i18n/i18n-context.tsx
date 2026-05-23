'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from './locales/en';
import { vi } from './locales/vi';

export type Locale = 'en' | 'vi';

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('vi'); // default to Vietnamese for standard local markets

  useEffect(() => {
    const savedLocale = localStorage.getItem('stock_intel_locale') as Locale;
    if (savedLocale === 'en' || savedLocale === 'vi') {
      setLocaleState(savedLocale);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('stock_intel_locale', newLocale);
    document.cookie = `stock_intel_locale=${newLocale}; path=/; max-age=31536000`; // sync to cookie for server layouts
  };

  const t = (path: string): string => {
    const dictionary = locale === 'en' ? en : vi;
    
    // Safety nested path getter
    const value = path.split('.').reduce((obj, key) => {
      return obj && (obj as any)[key] !== undefined ? (obj as any)[key] : undefined;
    }, dictionary);

    if (typeof value === 'string') {
      return value;
    }

    return path; // Fallback to key if not found
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
