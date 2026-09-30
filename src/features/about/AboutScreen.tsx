// Livello features/about: la pagina «Come funziona?». Pubblica come privacy e
// riconoscimenti (raggiungibile prima e dopo l'accesso): chi scrive il sito, perché
// esiste e come si usa, in prima persona. PRESENTAZIONALE: nessuna porta, nessuno
// stato. AD-1: importa solo i18n e ui; il ritorno è una CALLBACK (`onExit`)
// iniettata dal livello app, come in `AcknowledgementsScreen`.
//
// L'unico collegamento esterno è la guida di TheMoeWay: un vero `<a href>` perché
// punta fuori dall'app.
import { useTranslation } from '../../i18n';
import { RESPONSIVE_CONTAINER } from '../../ui/layout';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { FOCUS_RING, KICKER, SCREEN_TITLE } from '../../ui/magazine';

export interface AboutScreenProps {
  /** Il ritorno: autenticato → dashboard, anonimo → accesso (cablato in AppRoutes). */
  readonly onExit: () => void;
}

const MOE_GUIDE_URL = 'https://learnjapanese.moe/routine/';

// Ogni sezione si apre con un filetto e un occhiello, come le colonne della rivista.
const SECTION = 'flex flex-col gap-3 border-t-[1.5px] border-border-strong pt-4';

export function AboutScreen({ onExit }: AboutScreenProps) {
  const { t } = useTranslation();

  return (
    <MagazineFrame brandAsHeading>
    <main className={`${RESPONSIVE_CONTAINER} flex flex-col gap-8 py-8 sm:py-14`}>
      <h2 className={`${SCREEN_TITLE} text-ink-primary`}>{t('about.title')}</h2>

      <section className={SECTION}>
        <p className={KICKER}>{t('about.whoKicker')}</p>
        <p className="text-[22px] font-medium leading-snug text-ink-primary">
          {t('about.who')}
        </p>
        <a
          href={MOE_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className={`self-start text-body font-semibold text-ink-primary underline underline-offset-4 ${FOCUS_RING}`}
        >
          {t('about.guideLabel')}
        </a>
      </section>

      <section className={SECTION}>
        <p className={KICKER}>{t('about.whyKicker')}</p>
        <p className="text-body text-ink-primary">{t('about.lessons')}</p>
        <p className="text-body text-ink-primary">{t('about.idea')}</p>
      </section>

      <section className={SECTION}>
        <p className={KICKER}>{t('about.howKicker')}</p>
        <p className="text-body text-ink-primary">{t('about.how')}</p>
        <p className="text-body text-ink-primary">{t('about.lessonsPage')}</p>
      </section>

      <section className={SECTION}>
        <p className={KICKER}>{t('about.passionKicker')}</p>
        <p className="text-body text-ink-primary">{t('about.passion')}</p>
        <p className="text-body text-ink-secondary">{t('about.independent')}</p>
      </section>

      <button
        type="button"
        onClick={onExit}
        className={`min-h-[56px] self-start border-[1.5px] border-border-strong bg-surface-raised px-6 text-label font-bold uppercase tracking-[0.04em] text-ink-primary hover:bg-surface-sunken ${FOCUS_RING}`}
      >
        {t('about.back')}
      </button>
    </main>
    </MagazineFrame>
  );
}
