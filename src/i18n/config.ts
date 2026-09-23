// Init SINGLETON di i18next (side-effect al load del modulo): eseguito una sola
// volta grazie alla cache dei moduli ESM. `src/i18n/` è l'UNICO livello che
// importa i18next/react-i18next (AD-1: ui→i18n, features→i18n via re-export).
//
// Risorse INLINE (nessun backend), lingua fissa a 'en' (nessuna commutazione a
// runtime né LanguageDetector: è la storia 1.9), useSuspense:false così che
// useTranslation sia pronto sincrono con risorse inline — necessario per
// renderToStaticMarkup in ambiente node (nessun jsdom).
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, defaultNS } from './resources';
import { supportedLocales } from './locales';

void i18n.use(initReactI18next).init({
  resources,
  defaultNS,
  supportedLngs: supportedLocales,
  fallbackLng: 'en',
  lng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
