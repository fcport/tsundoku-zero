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
// landmark, ora col contenitore responsive condiviso di `src/ui/layout.ts`, 3.23),
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
import { RESPONSIVE_CONTAINER } from '../../ui/layout';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { SCREEN_TITLE } from '../../ui/magazine';

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
// solo per navigazione da tastiera. Token `focus-ring`: nessun colore
// letterale (UX-DR1).
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

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
    // Direzione «rivista» (29-09-2026): il dorso col marchio, poi la colonna di lettura
    // col titolo a testata e il primo paragrafo in corpo grande, come l'attacco di un
    // articolo.
    <MagazineFrame brandAsHeading>
    <main className={`${RESPONSIVE_CONTAINER} flex flex-col gap-6 py-8 sm:py-14`}>
      <h2 className={`${SCREEN_TITLE} text-ink-primary`}>
        {t('legal.acknowledgements.title')}
      </h2>
      {/* L'attribuzione della fonte + il collegamento REALE al canale. Il link e un
          vero `<a href>` (non una callback) perche punta FUORI dall'app; testo del
          link da t() (`channelLabel`), URL in forma channel-id per stabilita. */}
      <p className="border-t-[1.5px] border-border-strong pt-4 text-[22px] font-medium leading-snug text-ink-primary">
        {t('legal.acknowledgements.method')}
      </p>
      <a
        href={CURE_DOLLY_CHANNEL_URL}
        target="_blank"
        rel="noreferrer"
        className={`self-start text-body font-semibold text-ink-primary underline underline-offset-4 ${FOCUS_RING}`}
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
        className={`min-h-[56px] self-start border-[1.5px] border-border-strong bg-surface-raised px-6 text-label font-bold uppercase tracking-[0.04em] text-ink-primary hover:bg-surface-sunken ${FOCUS_RING}`}
      >
        {t('legal.acknowledgements.back')}
      </button>
    </main>
    </MagazineFrame>
  );
}
