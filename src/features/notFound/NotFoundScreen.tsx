// Livello features/notFound (10-10-2026): la pagina per un indirizzo che non porta
// da nessuna parte. Prima ogni indirizzo sconosciuto mostrava la dashboard senza
// dire niente; ora lo dice, con il tanuki che si è messo la foglia in testa (nelle
// storie giapponesi così si trasforma: la pagina è «sparita» per uno scherzo).
//
// PRESENTAZIONALE: nessuna porta, nessuna query. AD-1: importa SOLO ui e i18n, MAI
// react-router: l'indirizzo e il ritorno arrivano dal livello app (`path`,
// `onExit`), come in `AcknowledgementsScreen`. Pubblica in entrambi gli stati: da
// autenticato riporta alla dashboard, da anonimo all'accesso (`signedIn`).
import { useTranslation } from '../../i18n';
import { RESPONSIVE_CONTAINER } from '../../ui/layout';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { FOCUS_RING, SCREEN_TITLE } from '../../ui/magazine';
import { Tanuki } from '../../ui/Tanuki';

export interface NotFoundScreenProps {
  /** L'indirizzo aperto, così com'è (`/statss`): il fatto concreto da mostrare. */
  readonly path: string;
  /** Autenticato: il ritorno porta alla dashboard; anonimo, all'accesso. */
  readonly signedIn: boolean;
  /** Il ritorno, cablato dal livello app. */
  readonly onExit: () => void;
}

export function NotFoundScreen({ path, signedIn, onExit }: NotFoundScreenProps) {
  const { t } = useTranslation();

  return (
    <MagazineFrame brandAsHeading>
      <main className={`${RESPONSIVE_CONTAINER} flex flex-col gap-6 py-8 sm:py-14`}>
        <Tanuki pose="leaf" height={160} className="self-start sm:h-[220px] sm:w-auto" />
        <h2 className={`${SCREEN_TITLE} text-ink-primary`}>{t('notFound.title')}</h2>
        {/* L'indirizzo aperto, in monospazio e senza maiuscole forzate: va a capo
            ovunque, anche se è lunghissimo. */}
        <p className="break-all border-t-[1.5px] border-border-strong pt-4 font-mono text-label text-ink-secondary">
          {path}
        </p>
        <p className="text-[22px] font-medium leading-snug text-ink-primary">{t('notFound.body')}</p>
        <button
          type="button"
          onClick={onExit}
          className={`min-h-[56px] self-start border-[1.5px] border-border-strong bg-surface-raised px-6 text-label font-bold uppercase tracking-[0.04em] text-ink-primary hover:bg-surface-sunken ${FOCUS_RING}`}
        >
          {signedIn ? t('notFound.toDashboard') : t('notFound.toSignIn')}
        </button>
      </main>
    </MagazineFrame>
  );
}
