import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ─── EN namespaces ────────────────────────────────────────────────────────────
import enCommon  from './locales/en/common.json';
import enAuth    from './locales/en/auth.json';
import enLanding from './locales/en/landing.json';
import enDoctor  from './locales/en/doctor.json';
import enLab     from './locales/en/lab.json';
import enManager from './locales/en/manager.json';

// ─── AR namespaces ────────────────────────────────────────────────────────────
import arCommon  from './locales/ar/common.json';
import arAuth    from './locales/ar/auth.json';
import arLanding from './locales/ar/landing.json';
import arDoctor  from './locales/ar/doctor.json';
import arLab     from './locales/ar/lab.json';
import arManager from './locales/ar/manager.json';

// ─── Detect saved language ────────────────────────────────────────────────────
const savedLang = localStorage.getItem('app_lang') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common:  enCommon,
        auth:    enAuth,
        landing: enLanding,
        doctor:  enDoctor,
        lab:     enLab,
        manager: enManager,
      },
      ar: {
        common:  arCommon,
        auth:    arAuth,
        landing: arLanding,
        doctor:  arDoctor,
        lab:     arLab,
        manager: arManager,
      },
    },
    lng: savedLang,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'landing', 'doctor', 'lab', 'manager'],
    interpolation: {
      escapeValue: false, // React already does XSS protection
    },
  });

// Set initial document direction and lang
document.documentElement.lang = savedLang;
document.documentElement.dir  = savedLang === 'ar' ? 'rtl' : 'ltr';

export default i18n;
