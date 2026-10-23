// Livello features/auth: container BIMODALE della schermata di Accesso. Tiene lo
// stato dei campi, dell'errore/pending e del MODO (`sign-up` default / `sign-in`),
// chiama l'orchestrazione pura selezionata da `submitForMode` con la porta
// INIETTATA (features non importa data, AD-1) e, su successo, invoca
// `onAuthenticated` — la commutazione di vista vive in app (AuthRoot).
//
// Il wiring modo→orchestratore e modo→chiavi di vista vive nel modulo PURO
// ./authMode, così è verificabile in ambiente node senza lo stato React
// (invertire la selezione modo→submit sarebbe colto da un test).
//
// Una SOLA schermata (EXPERIENCE.md §Superfici) ospita registrazione (1.6) e
// accesso (1.7): il default è `sign-up` (metrica M4 registration-first, coerente
// con 1.6). Un solo landmark <main>: contiene la sola AuthForm (che ha già la
// propria intestazione <h2>). Il branding <App/> vive SOLO sulla radice protetta
// autenticata (AuthenticatedShell), per non annidare due <main>.
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { RESPONSIVE_CONTAINER } from '../../ui/layout';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { Tanuki } from '../../ui/Tanuki';
import { FOCUS_RING, HEADLINE, KICKER } from '../../ui/magazine';
import { ArrowIcon, ExternalIcon, GitHubIcon } from '../../ui/icons';
import { REPO_URL } from '../about/links';
import type { AuthGateway } from '../../domain/ports/authGateway';
import { AuthForm, type AuthFormValues } from './AuthForm';
import { applyAuthOutcome } from './authOutcome';
import { AUTH_MODE_COPY, submitForMode, type AuthMode } from './authMode';
import { submitGuest } from './guest';
import type { AuthErrorMessage } from './authFailureMessage';

export interface AuthScreenProps {
  readonly gateway: AuthGateway;
  /** Invocata quando l'autenticazione va a buon fine: l'utente atterra dentro. */
  readonly onAuthenticated: () => void;
  /**
   * La navigazione alla privacy policy (7.1): una CALLBACK dal livello app (AD-1:
   * le features non importano react-router). Il cablaggio vive in `AppRoutes`
   * (`() => navigate(PRIVACY_PATH)`), cosi lo sconosciuto puo leggere cosa si
   * memorizza PRIMA di consegnare la propria email. Obbligatoria.
   */
  readonly onViewPrivacy: () => void;
  /**
   * La navigazione ai riconoscimenti (7.2): una CALLBACK dal livello app (AD-1: le
   * features non importano react-router). Il cablaggio vive in `AppRoutes`
   * (`() => navigate(ACKNOWLEDGEMENTS_PATH)`), gemella di `onViewPrivacy`: la pagina
   * dei riconoscimenti e PUBBLICA, raggiungibile PRIMA della registrazione.
   * Obbligatoria.
   */
  readonly onViewAcknowledgements: () => void;
  /** Apre «Come funziona?» (cablata in `AppRoutes`), per chi arriva da fuori. */
  readonly onViewAbout: () => void;
}

export function AuthScreen({
  gateway,
  onAuthenticated,
  onViewPrivacy,
  onViewAcknowledgements,
  onViewAbout,
}: AuthScreenProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<AuthFormValues>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<AuthErrorMessage | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<AuthMode>('sign-up');
  // La prova senza account ha il suo errore: non va ancorato ai campi del modulo.
  const [guestError, setGuestError] = useState<AuthErrorMessage | null>(null);

  const copy = AUTH_MODE_COPY[mode];

  // Direzione «rivista» (29-09-2026): il dorso col marchio (l'<h1> della pagina), poi
  // una colonna di lettura con l'occhiello del sottotitolo, il modulo senza cornice
  // e i due collegamenti legali in fondo.
  return (
    <MagazineFrame brandAsHeading>
    <main
      className={`${RESPONSIVE_CONTAINER} flex flex-col gap-8 py-8 sm:py-14`}
    >
      {/* Il sottotitolo e, accanto, il tanuki che saluta chi arriva (09-10-2026). */}
      <div className="flex items-end justify-between gap-4">
        <p className={`${KICKER} text-balance`}>{t('app.tagline')}</p>
        <Tanuki pose="waving" height={80} className="sm:h-[112px] sm:w-auto" />
      </div>
      {/* La prova senza account (23-10-2026), PRIMA del modulo: chi arriva per
          curiosità entra con un clic, senza email. */}
      <section aria-labelledby="guest-title" className="flex flex-col gap-3">
        <p id="guest-title" className={KICKER}>
          {t('auth.guest.kicker')}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setGuestError(null);
            void submitGuest(gateway)
              .then((outcome) =>
                applyAuthOutcome(outcome, { onAuthenticated, onError: setGuestError }),
              )
              .finally(() => setPending(false));
          }}
          className={`flex min-h-[56px] w-full items-center justify-between gap-4 border-[1.5px] border-border-strong px-5 py-3 text-left text-[22px] leading-none text-ink-primary hover:bg-surface-raised hover:[&>svg]:translate-x-1.5 *:transition-transform sm:min-h-[64px] sm:text-[26px] ${HEADLINE} ${FOCUS_RING}`}
        >
          {t('auth.guest.action')}
          <ArrowIcon />
        </button>
        <p className="text-caption text-ink-secondary">{t('auth.guest.note')}</p>
        {guestError ? (
          <p role="alert" className="text-caption text-danger">
            {t(guestError.key)}
          </p>
        ) : null}
      </section>
      <div className="border-t-[1.5px] border-border-strong" aria-hidden="true" />
      <AuthForm
        values={values}
        error={error}
        pending={pending}
        titleKey={copy.titleKey}
        submitKey={copy.submitKey}
        toggleKey={copy.toggleKey}
        onChange={(field, value) =>
          setValues((prev) => ({ ...prev, [field]: value }))
        }
        onToggle={() => {
          setMode(copy.toggleTo);
          setError(null);
        }}
        onSubmit={() => {
          setPending(true);
          setError(null);
          void submitForMode(mode)(gateway, values)
            .then((outcome) =>
              applyAuthOutcome(outcome, { onAuthenticated, onError: setError }),
            )
            .finally(() => setPending(false));
        }}
      />
      {/* I collegamenti di servizio, affiancati sotto un filetto. */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t-[1.5px] border-border-strong pt-4">
        {/* «Come funziona?» per primo: è la domanda di chi non conosce il sito. */}
        <button
          type="button"
          onClick={onViewAbout}
          className={`min-h-[44px] text-label text-ink-secondary underline underline-offset-4 ${FOCUS_RING}`}
        >
          {t('about.linkLabel')}
        </button>
        {/* Il collegamento alla privacy policy (7.1): un'affordance SECONDARIA
            (button, idioma del repo: `onExit`/`onViewStats` sono gia button), DENTRO
            il `<main>`, DOPO il form. Cosi lo sconosciuto legge cosa si memorizza
            PRIMA di registrarsi. -> `onViewPrivacy` (cablato in AppRoutes). */}
        <button
          type="button"
          onClick={onViewPrivacy}
          className={`min-h-[44px] text-label text-ink-secondary underline underline-offset-4 ${FOCUS_RING}`}
        >
          {t('legal.privacy.linkLabel')}
        </button>
        {/* Il collegamento ai riconoscimenti (7.2): gemello di quello alla privacy,
            un'affordance SECONDARIA (button, idioma del repo) DENTRO il `<main>`,
            accanto ad esso. La pagina e PUBBLICA: lo sconosciuto puo leggere la fonte
            del metodo PRIMA di registrarsi. -> `onViewAcknowledgements`. */}
        <button
          type="button"
          onClick={onViewAcknowledgements}
          className={`min-h-[44px] text-label text-ink-secondary underline underline-offset-4 ${FOCUS_RING}`}
        >
          {t('legal.acknowledgements.linkLabel')}
        </button>
        {/* Il codice del sito: un vero <a>, punta fuori dall'app. */}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex min-h-[44px] items-center gap-1 text-label text-ink-secondary underline underline-offset-4 ${FOCUS_RING}`}
        >
          <GitHubIcon />
          {t('about.repoShortLabel')} <ExternalIcon />
        </a>
      </div>
    </main>
    </MagazineFrame>
  );
}
