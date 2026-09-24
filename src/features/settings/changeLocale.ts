// Livello features/settings: orchestrazione PURA del cambio lingua. Riceve le
// dipendenze INIETTATE (features non importa data né i18next direttamente,
// AD-1): `changeLanguage` (il metodo del singleton i18next, imbutato da app/il
// container) e la porta `SettingsRepository`. Modello: features/auth/signOut.ts.
//
// Due effetti in ordine: PRIMA il cambio a runtime (ri-render immediato di ogni
// consumatore di t(), senza ricaricare la pagina), POI la persistenza. La
// persistenza è secondaria: se `saveLocale` fallisse, la lingua è comunque già
// cambiata sotto gli occhi dell'utente. Confine TOTALE: né un throw di
// `changeLanguage` né un reject/throw di `saveLocale` propaga — `changeLocale`
// risolve sempre `void`.
import type { SettingsRepository } from '../../domain/ports/settingsRepository';

/** Firma del cambio lingua a runtime (il metodo `changeLanguage` di i18next). */
export type ChangeLanguage = (locale: string) => unknown;

export interface ChangeLocaleDeps {
  /** Commuta la lingua del singleton i18next (ri-render dei consumatori). */
  readonly changeLanguage: ChangeLanguage;
  /** La porta di persistenza (upsert su user_settings). */
  readonly settings: SettingsRepository;
}

/**
 * Cambia la lingua a runtime e la persiste. `changeLanguage(locale)` prima (lo
 * switch visibile, nessun reload), poi `settings.saveLocale(locale)`. Confine
 * TOTALE: risolve sempre `void`, mai reject — un fallimento della persistenza
 * (rete, sessione scaduta) non annulla né sporca lo switch già avvenuto.
 */
export async function changeLocale(
  locale: string,
  { changeLanguage, settings }: ChangeLocaleDeps,
): Promise<void> {
  try {
    // changeLanguage PRIMA (lo switch visibile), poi la persistenza. Entrambi
    // dentro il try: un throw sincrono di changeLanguage non deve rompere il
    // contratto «risolve sempre void» (confine TOTALE), come per saveLocale.
    changeLanguage(locale);
    await settings.saveLocale(locale);
  } catch {
    // Confine totale: la persistenza è best-effort, la lingua è già cambiata.
  }
}
