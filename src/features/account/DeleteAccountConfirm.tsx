// Livello features/account: componente PRESENTAZIONALE della conferma di
// cancellazione account, CONTROLLATO da props. Nessuno stato, nessuna chiamata
// alla porta: riceve tutto per props ed è reso staticamente per ciascuna fase
// (renderToStaticMarkup, ambiente node). Modello: features/auth/AuthForm.tsx.
//
// La conferma è ESPLICITA e a due passi (AC1): in `idle` un SOLO grilletto; alla
// richiesta la fase passa a `confirming`, che rende la CONSEGUENZA dichiarata
// (tutti i dati di studio distrutti, statistiche non sopravvivono, irreversibile)
// da t(), più conferma/annulla e lo slot d'errore. Nessun one-click: senza il
// passo `confirming` non esiste alcun bottone che cancella.
//
// Solo classi token del sistema di design (1.3): nessun colore letterale (regola
// ERROR su features), ogni interattivo con `border-strong`, nessuna ombra,
// nessun verde. L'azione distruttiva usa il token `danger` (mai un verde di
// successo). La voce è dichiarativa: nessun punto esclamativo, emoji o avverbio
// di lode (UX-DR40) — la copy vive nei cataloghi i18n, non qui.
import { useTranslation } from '../../i18n';

/** Fase della conferma: `idle` (solo grilletto) o `confirming` (due passi). */
export type DeleteAccountPhase = 'idle' | 'confirming';

export interface DeleteAccountConfirmProps {
  readonly phase: DeleteAccountPhase;
  /**
   * Vero durante l'invio della cancellazione: disabilita ENTRAMBI i bottoni
   * (conferma e annulla). Annullare mentre la cancellazione è in volo non
   * abortirebbe la richiesta — su un'azione irreversibile è un'affordance
   * ingannevole, perciò anche Annulla è disabilitato in pending.
   */
  readonly pending: boolean;
  /** Vero quando l'ultima cancellazione è fallita: rende lo slot d'errore. */
  readonly error: boolean;
  /** Avvia il passo di conferma (idle → confirming). */
  readonly onRequestDelete: () => void;
  /** Conferma la cancellazione (invoca la porta a cura del container). */
  readonly onConfirm: () => void;
  /** Annulla e torna a idle. */
  readonly onCancel: () => void;
}

export function DeleteAccountConfirm({
  phase,
  pending,
  error,
  onRequestDelete,
  onConfirm,
  onCancel,
}: DeleteAccountConfirmProps) {
  const { t } = useTranslation();

  // Fase idle: un SOLO grilletto, nessuna conseguenza né conferma finché
  // l'utente non la richiede esplicitamente (nessun one-click).
  if (phase === 'idle') {
    return (
      <button
        type="button"
        onClick={onRequestDelete}
        className="rounded-md border border-border-strong bg-surface-raised text-danger p-3 text-label"
      >
        {t('account.delete.trigger')}
      </button>
    );
  }

  // Fase confirming: la conseguenza dichiarata, i due bottoni (conferma/annulla)
  // e lo slot d'errore quando l'ultima cancellazione è fallita.
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-primary">
        {t('account.delete.consequence')}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-md border border-border-strong bg-danger text-surface-raised p-3 text-label"
        >
          {t('account.delete.confirm')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-border-strong bg-surface-raised text-ink-primary p-3 text-label"
        >
          {t('account.delete.cancel')}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {t('account.delete.error')}
        </p>
      ) : null}
    </div>
  );
}
