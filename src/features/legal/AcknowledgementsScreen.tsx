// Livello features/legal (7.2): la schermata-rotta dei RICONOSCIMENTI. Una pagina
// PUBBLICA `/riconoscimenti` che, PRIMA o DOPO l'autenticazione, attribuisce la
// FONTE del metodo (Cure Dolly ha divulgato il modello strutturale) e ne delimita
// i confini: gli esercizi sono ORIGINALI e non riproducono materiale della fonte
// (`originalContent`); il progetto NON e affiliato, approvato ne una continuazione
// del canale (`noAffiliation`); la sostanza grammaticale e linguistica consolidata,
// documentata in una fonte accademica indipendente e verificabile (`scholarship`).
// PRESENTAZIONALE: nessuna porta, nessuno stato, nessuna query. AD-1: importa SOLO
// i18n (via `useTranslation`), MAI data ne react-router — il ritorno e una CALLBACK
// (`onExit`) iniettata dal livello app, come in `PrivacyScreen`.
//
// Gemella di `PrivacyScreen` (7.1): stessa struttura, stesso `<main>` unico (l'unico
// landmark della pagina), stesso token `FOCUS_RING`, stesso `onExit` deterministico.
// L'UNICA novita e un vero collegamento ESTERNO: un `<a href>` (non un
// `<button>`-callback) perche punta FUORI dall'app, al canale della fonte. L'URL e
// in forma channel-id (`/channel/UC...`) per stabilita: gli id-canale non cambiano,
// gli handle si. `target="_blank"` + `rel="noreferrer"`.
//
// Il nome della fonte compare SOLO nel contenuto di questa pagina (via `t()`): mai
// nel nome del prodotto, nella copy di branding (namespace `app`) ne nel percorso di
// rotta (`/riconoscimenti`, non `/cure-dolly`). Nessuna grammatica della
// celebrazione (nessun `!`, nessuna emoji, nessun avverbio di lode) e nessuna
// formulazione che suggerisca affiliazione/approvazione/continuita: solo token del
// sistema di design (nessun colore letterale).
import { useTranslation } from '../../i18n';

export interface AcknowledgementsScreenProps {
  /**
   * Il ritorno alla schermata precedente: navigazione come CALLBACK dal livello
   * app (AD-1: le features non importano react-router). Il cablaggio vive in
   * `AppRoutes` (`() => navigate(authenticated ? ROOT_PATH : LOGIN_PATH)`), cosi
   * un deep-link diretto non e un vicolo cieco. Obbligatoria.
   */
  readonly onExit: () => void;
}

// ANELLO DI FOCUS visibile: lo STESSO token condiviso dagli interattivi delle altre
// schermate-rotta (`PrivacyScreen`, `StatsScreen`). `focus-visible:` mostra l'anello
// solo per navigazione da tastiera. Token `focus-ring` (in scuro `accent-dark`):
// nessun colore letterale (UX-DR1).
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring dark:focus-visible:outline-accent-dark';

// L'URL STABILE del canale della fonte, in forma channel-id (gli id-canale non
// cambiano, gli handle si). Il nome della fonte vive nel CONTENUTO (via `t()`), non
// nell'URL della rotta: questa costante e l'unico riferimento tecnico al canale.
const CURE_DOLLY_CHANNEL_URL =
  'https://www.youtube.com/channel/UCkdmU8hGK4Fg3LghTVtKltQ';

export function AcknowledgementsScreen({
  onExit,
}: AcknowledgementsScreenProps) {
  const { t } = useTranslation();

  return (
    <main className="flex flex-col gap-6 p-6">
      <h2 className="text-display text-ink-primary">
        {t('legal.acknowledgements.title')}
      </h2>
      {/* L'attribuzione della fonte + il collegamento REALE al canale. Il link e un
          vero `<a href>` (non una callback) perche punta FUORI dall'app; testo del
          link da t() (`channelLabel`), URL in forma channel-id per stabilita. */}
      <p className="text-body text-ink-primary">
        {t('legal.acknowledgements.method')}
      </p>
      <a
        href={CURE_DOLLY_CHANNEL_URL}
        target="_blank"
        rel="noreferrer"
        className={`self-start text-body text-ink-primary underline ${FOCUS_RING}`}
      >
        {t('legal.acknowledgements.channelLabel')}
      </a>
      {/* I confini dichiarati come fatti: originalita del contenuto, nessuna
          affiliazione, sostanza linguistica con fonte accademica verificabile. */}
      <p className="text-body text-ink-primary">
        {t('legal.acknowledgements.originalContent')}
      </p>
      <p className="text-body text-ink-primary">
        {t('legal.acknowledgements.noAffiliation')}
      </p>
      <p className="text-body text-ink-primary">
        {t('legal.acknowledgements.scholarship')}
      </p>
      {/* L'affordance di ritorno (gemella di 7.1): SECONDARIA — chiaramente non il
          button-primary (nessun fill accent, ink muto, nessun verde). -> `onExit`. */}
      <button
        type="button"
        onClick={onExit}
        className={`self-center rounded-md border border-border-strong bg-surface-base text-ink-primary px-6 py-3 text-body ${FOCUS_RING}`}
      >
        {t('legal.acknowledgements.back')}
      </button>
    </main>
  );
}
