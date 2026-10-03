// Livello features/study (4.4): l'INDICATORE di sincronizzazione, PRESENTAZIONALE
// e DERIVATO (AD-1: features→domain/ui/i18n + `@tanstack/react-query`, MAI data).
// Non ha stato proprio: legge la coda REALE delle mutation via `useMutationState`,
// filtrata per `REVIEW_MUTATION_KEY`. La fonte di verità è la coda TanStack
// (UX-DR17), così l'indicatore non può divergere dallo stato reale.
//
// Conta SOLO le valutazioni BLOCCATE: in pausa perché manca la rete (`isPaused`) o
// con almeno un invio fallito che si sta ritentando (`failureCount > 0`). Il
// salvataggio normale, che parte a ogni «Prossimo esercizio» e dura un attimo, NON
// conta (03-10-2026): prima la scritta «riprovo appena c'è rete» lampeggiava a ogni
// risposta anche con la rete perfetta.
//
// A coda sbloccata rende `null` (ASSENTE, non «tutto sincronizzato»). Altrimenti un
// riquadro discreto, fisso e NON bloccante (`pointer-events-none`, nessun
// overlay/backdrop, nessun controllo interattivo): non è un modale né un toast.
// `role="status"` + `aria-live="polite"` con un testo STABILE e SENZA conteggio
// (`t('sync.pending')`): il contenuto della live region non varia col numero di
// risposte accodate, quindi l'annuncio avviene UNA volta alla comparsa (cambio di
// stato) e non a ogni risposta che entra in coda. Colore d'accento SOTTOTONO (mai
// `danger`): una risposta in coda è il funzionamento previsto, non un errore.
// Angoli vivi, come il resto della rivista.
import { useMutationState } from '@tanstack/react-query';
import { useTranslation } from '../../i18n';
import { REVIEW_MUTATION_KEY } from './reviewMutation';

export function SyncIndicator() {
  const { t } = useTranslation();
  // Le valutazioni non ancora salvate E bloccate: offline in pausa, o in ritentativo
  // dopo un invio fallito. Nessuno stato proprio del componente: la coda è la sola
  // fonte.
  const stuck = useMutationState({
    filters: {
      mutationKey: [...REVIEW_MUTATION_KEY],
      status: 'pending',
      predicate: (mutation) => mutation.state.isPaused || mutation.state.failureCount > 0,
    },
    select: () => true,
  }).length;

  if (stuck === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 pointer-events-none border-[1.5px] border-accent bg-accent-subtle px-3 py-1.5 text-caption text-accent"
    >
      {t('sync.pending')}
    </div>
  );
}
