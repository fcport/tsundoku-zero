// Modulo foglia: le lingue supportate, senza alcun import. Vive qui (non in
// index.ts né config.ts) per spezzare il ciclo index↔config — entrambi lo
// importano, nessuno importa loro. Usato come `supportedLngs` nell'init di
// i18next (config.ts) e dalla persistenza per-utente (storia 1.5/1.9).
export const supportedLocales = ['en', 'it'] as const;

export type Locale = (typeof supportedLocales)[number];
