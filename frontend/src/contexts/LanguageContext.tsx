import {
  createContext, useContext, useCallback,
  useState, useEffect, type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '@/api/apiClient';
import { useAuth } from './AuthContext';

type Lang = 'en' | 'ar';
type Dir  = 'ltr' | 'rtl';

interface LanguageContextValue {
  lang: Lang;
  dir:  Dir;
  toggleLanguage: () => void;
  setLanguage:    (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyLang(lang: Lang) {
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir  = dir;
  localStorage.setItem('app_lang', lang);
  return dir;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth();

  const [lang, setLangState] = useState<Lang>(
    (localStorage.getItem('app_lang') as Lang) || 'en'
  );
  const [dir, setDir] = useState<Dir>(lang === 'ar' ? 'rtl' : 'ltr');

  // Apply language on mount
  useEffect(() => {
    const d = applyLang(lang);
    setDir(d);
    if (i18n.language !== lang) i18n.changeLanguage(lang);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLanguage = useCallback((newLang: Lang) => {
    const d = applyLang(newLang);
    setLangState(newLang);
    setDir(d);
    i18n.changeLanguage(newLang);

    // Sync to backend if authenticated
    if (isAuthenticated) {
      apiClient.patch('/auth/profile', { preferred_lang: newLang }).catch(() => {});
    }
  }, [i18n, isAuthenticated]);

  const toggleLanguage = useCallback(() => {
    setLanguage(lang === 'en' ? 'ar' : 'en');
  }, [lang, setLanguage]);

  return (
    <LanguageContext.Provider value={{ lang, dir, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
