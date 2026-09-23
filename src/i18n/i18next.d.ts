// Declaration merging su i18next: è QUESTO che rende t() type-safe (AD-14).
// Dichiarando CustomTypeOptions con `resources: { translation: typeof en }`,
// i18next tipizza t() sulle SOLE chiavi presenti in `en`. Una chiave assente
// diventa un errore di compilazione `tsc`, non un fallimento a runtime — la
// porta meccanica del confine, verificata in CI da `tsc --noEmit`.
//
// La fonte è `en` (il catalogo inglese): `it` porta lo stesso insieme di chiavi
// (parità verificata da test), quindi tiparlo su `en` è sufficiente e corretto.
import 'i18next';
import type { en } from './en';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
