// Livello features/settings: orchestrazione PURA del cambio tetto giornaliero di
// sblocco (storia 3.17). Riceve le dipendenze INIETTATE (features non importa
// data, AD-1): `apply` (l'aggiornamento ottimistico della cache, imbutato dal
// container) e la porta `SettingsRepository`. Modello: `./changeLocale`.
//
// Due effetti in ordine: PRIMA l'aggiornamento ottimistico (il cancello della
// dashboard e il selettore riflettono subito la scelta, senza attendere la rete),
// POI la persistenza. La persistenza è secondaria: se `saveLessonsPerDay`
// fallisse, il valore è comunque già cambiato sotto gli occhi dell'utente.
// Confine TOTALE: né un throw di `apply` né un reject/throw di `saveLessonsPerDay`
// propaga — `changeLessonsPerDay` risolve sempre `void`.
import type { SettingsRepository } from '../../domain/ports/settingsRepository';

/** Applica il nuovo valore in modo ottimistico (es. `queryClient.setQueryData`). */
export type ApplyLessonsPerDay = (value: number) => unknown;

export interface ChangeLessonsPerDayDeps {
  /** Aggiornamento ottimistico della cache (riflette subito la scelta). */
  readonly apply: ApplyLessonsPerDay;
  /** La porta di persistenza (upsert su user_settings). */
  readonly settings: SettingsRepository;
}

/**
 * Cambia il tetto giornaliero di sblocco in modo ottimistico e lo persiste.
 * `apply(value)` prima (l'aggiornamento visibile, nessun attesa), poi
 * `settings.saveLessonsPerDay(value)`. Confine TOTALE: risolve sempre `void`, mai
 * reject — un fallimento della persistenza (rete, sessione scaduta) non annulla né
 * sporca l'aggiornamento già avvenuto.
 */
export async function changeLessonsPerDay(
  value: number,
  { apply, settings }: ChangeLessonsPerDayDeps,
): Promise<void> {
  try {
    // apply PRIMA (l'aggiornamento visibile), poi la persistenza. Entrambi dentro
    // il try: un throw sincrono di apply non deve rompere il contratto «risolve
    // sempre void» (confine TOTALE), come per saveLessonsPerDay.
    apply(value);
    await settings.saveLessonsPerDay(value);
  } catch {
    // Confine totale: la persistenza è best-effort, il valore è già cambiato.
  }
}
