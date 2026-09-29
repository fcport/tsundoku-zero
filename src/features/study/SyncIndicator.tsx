// Livello features/study (4.4): l'INDICATORE di sincronizzazione, PRESENTAZIONALE
// e DERIVATO (AD-1: features→domain/ui/i18n + `@tanstack/react-query`, MAI data).
// Non ha stato proprio: legge la coda REALE delle mutation via
// `useIsMutating({ mutationKey: REVIEW_MUTATION_KEY })` — il conteggio delle
// valutazioni `pending` (in volo O in pausa offline). La fonte di verità è la
// coda TanStack (UX-DR17), così l'indicatore non può divergere dallo stato reale.
//
// A coda vuota rende `null` (ASSENTE, non «tutto sincronizzato»). A coda non vuota
// rende una PASTIGLIA discreta, fissa e NON bloccante (`pointer-events-none`,
// nessun overlay/backdrop, nessun controllo interattivo): non è un modale né un
// toast. `role="status"` + `aria-live="polite"` con un testo STABILE e SENZA
// conteggio (`t('sync.pending')`): il contenuto della live region non varia col
// numero di risposte accodate, quindi l'annuncio avviene UNA volta alla comparsa
// (cambio di stato) e non a ogni risposta che entra in coda. Colore d'accento
// SOTTOTONO (mai `danger`): una risposta in coda è il funzionamento previsto, non
// un errore. Modello: `ProgressMeter.tsx` (`null` a stato vuoto, `aria-*`, solo
// classi-token).
import { useIsMutating } from '@tanstack/react-query';
import { useTranslation } from '../../i18n';
import { REVIEW_MUTATION_KEY } from './reviewMutation';

export function SyncIndicator() {
  const { t } = useTranslation();
  // `useIsMutating(filters)` = `useMutationState({ filters: { ...filters, status:
  // 'pending' } }).length`: il numero di valutazioni non ancora sincronizzate (in
  // volo o in pausa offline) filtrate per la `REVIEW_MUTATION_KEY`. Nessuno stato
  // proprio del componente: la coda è la sola fonte.
  const pending = useIsMutating({ mutationKey: [...REVIEW_MUTATION_KEY] });

  // Coda vuota: indicatore ASSENTE (nessuna pastiglia, nessun «sincronizzato»).
  if (pending === 0) {
    return null;
  }

  // Coda non vuota: pastiglia discreta, non bloccante, senza conteggio.
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 pointer-events-none rounded-full bg-accent-subtle px-3 py-1 text-caption text-accent"
    >
      {t('sync.pending')}
    </div>
  );
}
