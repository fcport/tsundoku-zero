// Le risorse i18next INLINE (nessun backend HTTP/filesystem): i cataloghi sono
// bundle statici. Un solo namespace, `translation`, che è anche il defaultNS —
// così t('app.tagline') non richiede prefisso di namespace.
//
// `en` è la fonte delle chiavi tipizzate (vedi i18next.d.ts). `it` porta le
// stesse chiavi (parità verificata da test). `as const` mantiene i letterali.
import { en } from './en';
import { it } from './it';

export const defaultNS = 'translation' as const;

export const resources = {
  en: { translation: en },
  it: { translation: it },
} as const;
