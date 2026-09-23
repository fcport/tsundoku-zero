// Livello i18n: infrastruttura di internazionalizzazione e UNICO punto d'accesso
// (funnel). Solo qui si importano i18next/react-i18next; ui/features passano da
// questo re-export, rispettando gli archi AD-1 (ui→i18n, features→i18n).
//
// I cataloghi tipizzati e il declaration merging su CustomTypeOptions (vedi
// en.ts / i18next.d.ts) rendono t() type-safe: una chiave inesistente è un
// errore di compilazione `tsc` (storia 1.4).

// Import del solo side-effect: al primo load di questo modulo, config.ts esegue
// l'init singleton di i18next. Deve precedere il re-export dell'istanza.
import './config';

// Re-export del funnel: i consumatori (ui/features) NON importano i18next né
// react-i18next direttamente, ma passano da qui (AD-1). supportedLocales/Locale
// vivono nel modulo foglia ./locales (grafo aciclico) ma restano parte
// dell'API pubblica di questo funnel: i consumatori li importano da '../i18n'.
export { supportedLocales, type Locale } from './locales';
export { default as i18n } from './config';
export { useTranslation } from 'react-i18next';
export { resources, defaultNS } from './resources';
