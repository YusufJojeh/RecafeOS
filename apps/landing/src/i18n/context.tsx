import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ar } from './ar';
import { en } from './en';
import type { ContentMap, Dir, Locale } from './types';

interface LanguageContextValue {
  locale: Locale;
  dir: Dir;
  t: ContentMap;
  setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem('restocafe-lang');
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    // localStorage unavailable
  }
  if (typeof navigator !== 'undefined' && navigator.language.startsWith('ar')) {
    return 'ar';
  }
  return 'en';
}

const contentByLocale: Record<Locale, ContentMap> = { ar, en };

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleRaw] = useState<Locale>(detectInitialLocale);

  const dir: Dir = locale === 'ar' ? 'rtl' : 'ltr';
  const t = contentByLocale[locale];

  const setLocale = useCallback((next: Locale) => {
    setLocaleRaw(next);
    try {
      localStorage.setItem('restocafe-lang', next);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo(
    () => ({ locale, dir, t, setLocale }),
    [locale, dir, t, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
