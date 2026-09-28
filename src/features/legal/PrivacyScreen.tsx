// Livello features/legal (7.1): la schermata-rotta della PRIVACY POLICY. Una
// pagina PUBBLICA `/privacy` che dichiara, PRIMA della registrazione, cosa il
// sistema memorizza (`stored`), cosa NON raccoglie (`notCollected`) e come
// cancellare l'account (`deletion`). PRESENTAZIONALE: nessuna porta, nessuno
// stato, nessuna query. AD-1: importa SOLO i18n (via `useTranslation`), MAI data
// ne react-router — il ritorno e una CALLBACK (`onExit`) iniettata dal livello
// app, come `onExit`/`onViewStats` delle altre schermate.
//
// Una schermata-rotta col PROPRIO `<main>` (come `StatsScreen`): l'unico landmark
// della pagina. Tutta la copy passa da `t()` (AD-14): nessuna stringa cablata, le
// chiavi vivono in `legal.privacy.*` con parita en/it. Le dichiarazioni sono
// FATTUALI (un impegno, non boilerplate): nominano esattamente i dati memorizzati
// e quelli non raccolti.
//
// Nessuna grammatica della celebrazione (nessun `!`, nessuna emoji, nessun
// avverbio di lode): solo token del sistema di design (nessun colore letterale).
// L'affordance di ritorno e SECONDARIA (nessun fill accent), con l'anello di focus
// da tastiera, modellata su quella di `StatsScreen`.
import { useTranslation } from '../../i18n';
import { RESPONSIVE_CONTAINER } from '../../ui/layout';

export interface PrivacyScreenProps {
  /**
   * Il ritorno alla schermata precedente: navigazione come CALLBACK dal livello
   * app (AD-1: le features non importano react-router). Il cablaggio vive in
   * `AppRoutes` (`() => navigate(authenticated ? ROOT_PATH : LOGIN_PATH)`), cosi
   * un deep-link diretto non e un vicolo cieco. Obbligatoria.
   */
  readonly onExit: () => void;
}

// ANELLO DI FOCUS visibile: lo STESSO token condiviso dagli interattivi delle
// altre schermate-rotta (`StatsScreen`, `SessionScreen`). `focus-visible:` mostra
// l'anello solo per navigazione da tastiera. Token `focus-ring` (in scuro
// `accent-dark`): nessun colore letterale (UX-DR1).
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring dark:focus-visible:outline-accent-dark';

export function PrivacyScreen({ onExit }: PrivacyScreenProps) {
  const { t } = useTranslation();

  return (
    <main className={`${RESPONSIVE_CONTAINER} flex flex-col gap-6 py-6`}>
      <h2 className="text-display text-ink-primary">{t('legal.privacy.title')}</h2>
      {/* Le tre dichiarazioni fattuali: cosa si memorizza, cosa non si raccoglie,
          come si cancella. Ognuna un paragrafo autonomo, tutta copy da t(). */}
      <p className="text-body text-ink-primary">{t('legal.privacy.stored')}</p>
      <p className="text-body text-ink-primary">
        {t('legal.privacy.notCollected')}
      </p>
      <p className="text-body text-ink-primary">{t('legal.privacy.deletion')}</p>
      {/* L'affordance di ritorno (7.1): SECONDARIA — chiaramente non il
          button-primary (nessun fill accent, ink muto, nessun verde). -> `onExit`. */}
      <button
        type="button"
        onClick={onExit}
        className={`self-center rounded-md border border-border-strong bg-surface-base text-ink-primary px-6 py-3 text-body ${FOCUS_RING}`}
      >
        {t('legal.privacy.back')}
      </button>
    </main>
  );
}
