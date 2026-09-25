// Livello features/study (3.19): la BARRA di avanzamento, PRESENTAZIONALE e
// CONTROLLATA (AD-1: features→domain/ui/i18n, MAI data). Rappresenta il COMPLETATO
// (non il rimanente): il chiamante deriva `completed = total − remainingCount(session)`
// dallo store di sessione, che si evolve allo `dispatch` locale — quindi la barra
// è OTTIMISTICA per costruzione (non attende il server).
//
// `role="progressbar"` con `aria-valuenow/min/max` (il contratto tastiera/live
// region completo è 3.22): l'AT legge lo stato numerico. `aria-label` da i18n
// (`session.progress.label`). Larghezza ~4px; il riempimento è `completed/total`.
// Reso SOLO se `total > 0` (a total 0 non c'è progresso da mostrare — la
// schermata di completamento/zero è 3.21).
import { useTranslation } from '../../i18n';

export interface ProgressMeterProps {
  /** Gli esercizi COMPLETATI (usciti dalla coda): `total − remainingCount`. */
  readonly completed: number;
  /** Il totale degli esercizi con cui la sessione è iniziata (dallo store). */
  readonly total: number;
}

export function ProgressMeter({ completed, total }: ProgressMeterProps) {
  const { t } = useTranslation();

  // Nessun progresso da mostrare a total 0 (deep-link a pila vuota): non reso.
  if (total <= 0) {
    return null;
  }

  // Frazione del riempimento, clampata in [0, 1] per robustezza (completed non
  // dovrebbe superare total, ma non produciamo mai una larghezza fuori scala).
  const fraction = Math.max(0, Math.min(1, completed / total));

  return (
    <div
      role="progressbar"
      aria-label={t('session.progress.label')}
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      className="h-[4px] w-full overflow-hidden rounded-md bg-surface-sunken"
    >
      <div
        className="h-full rounded-md bg-ink-secondary"
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}
