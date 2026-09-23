// Livello i18n: infrastruttura di internazionalizzazione. Come domain, non
// dipende da nessun altro livello (AD-1). I cataloghi tipizzati e il
// declaration merging su CustomTypeOptions arrivano nella storia 1.4.
export const supportedLocales = ['en', 'it'] as const;

export type Locale = (typeof supportedLocales)[number];
