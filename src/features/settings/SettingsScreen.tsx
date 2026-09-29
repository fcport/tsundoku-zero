// Livello features/settings: container della superficie Impostazioni. Riceve la
// porta `SettingsRepository` INIETTATA (features non importa data, AD-1) e
// compone il selettore di lingua. È un <section aria-labelledby> — NON un <main>:
// vive dentro la shell autenticata che possiede già l'unico landmark <main>
// (invariante single-main di 1.7/1.8).
//
// `useTranslation()` espone `t` (testo tipizzato) e `i18n` (l'istanza singleton):
// `current = resolveLocale(i18n.language)` normalizza la lingua attiva al confine
// (un valore stantio degrada al fallback). Alla scelta, `changeLocale` commuta la
// lingua a runtime via `i18n.changeLanguage` (ri-render di ogni consumatore di
// t(), SENZA ricaricare la pagina) e la persiste attraverso la porta. Il
// click→handler è glue d'effetto, coperto dalla verifica live differita; lo
// switch a runtime del singleton è provato come integrazione i18n
// (SettingsScreen.test).
//
// Il secondo gruppo (storia 3.17) è il tetto giornaliero di sblocco: legge il
// valore corrente dalla STESSA chiave `['lessonsPerDay', userId]` della dashboard
// (un cambio qui si riflette subito nel cancello, `setQueryData` ottimistico) e lo
// persiste via `changeLessonsPerDay`. La <section> contiene ESATTAMENTE due gruppi
// (`role="group"`): lingua e tetto; la cancellazione account resta la sua
// <section> separata (1.10, invariata) nella shell.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  resolveLocale,
  useTranslation,
  type Locale,
} from '../../i18n';
import type { SettingsRepository } from '../../domain/ports/settingsRepository';
import { DEFAULT_LESSONS_PER_DAY } from '../../domain/unlockPace';
import { LanguageOptions } from './LanguageOptions';
import { changeLocale } from './changeLocale';
import { LessonsPerDayOptions } from './LessonsPerDayOptions';
import { changeLessonsPerDay } from './changeLessonsPerDay';
import { SCREEN_TITLE } from '../../ui/magazine';

// ANELLO DI FOCUS visibile: lo STESSO token degli interattivi delle schermate-rotta
// (`StatsScreen`, `PrivacyScreen`). `focus-visible:` mostra l'anello solo per
// navigazione da tastiera. Token `focus-ring`: nessun colore letterale (UX-DR1).
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

// I collegamenti legali come righe d'indice della rivista: testo a sinistra, filetto
// sotto, alte 56px.
const LEGAL_ROW =
  'flex min-h-[56px] w-full items-center border-b-[1.5px] border-border-strong text-left text-body font-medium text-ink-primary hover:underline';

export interface SettingsScreenProps {
  readonly settings: SettingsRepository;
  /**
   * L'id dell'utente corrente (o `null` finché non risolto): la chiave per-utente
   * del tetto di sblocco, CONDIVISA con la dashboard.
   */
  readonly userId: string | null;
  /**
   * La navigazione alla privacy policy (7.1): una CALLBACK dal livello app (AD-1:
   * le features non importano react-router). Il cablaggio vive in
   * `AuthenticatedShell` (`() => navigate(PRIVACY_PATH)`). Obbligatoria.
   */
  readonly onViewPrivacy: () => void;
  /**
   * La navigazione ai riconoscimenti (7.2): una CALLBACK dal livello app (AD-1: le
   * features non importano react-router). Il cablaggio vive in `AuthenticatedShell`
   * (`() => navigate(ACKNOWLEDGEMENTS_PATH)`), gemella di `onViewPrivacy`.
   * Obbligatoria.
   */
  readonly onViewAcknowledgements: () => void;
}

export function SettingsScreen({
  settings,
  userId,
  onViewPrivacy,
  onViewAcknowledgements,
}: SettingsScreenProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const current: Locale = resolveLocale(i18n.language);

  // Il tetto corrente dalla STESSA chiave della dashboard: `null`/assente degrada
  // al DEFAULT del dominio. `enabled: !!userId`: senza id nessuna fetch.
  const lessonsPerDayQ = useQuery({
    queryKey: ['lessonsPerDay', userId],
    enabled: !!userId,
    queryFn: () => settings.loadLessonsPerDay(),
  });
  const currentLessonsPerDay = lessonsPerDayQ.data ?? DEFAULT_LESSONS_PER_DAY;

  return (
    <section
      aria-labelledby="settings-title"
      className="flex flex-col gap-8"
    >
      <h2
        id="settings-title"
        className={`${SCREEN_TITLE} text-ink-primary`}
      >
        {t('settings.title')}
      </h2>
      <LanguageOptions
        current={current}
        onSelect={(locale) =>
          void changeLocale(locale, {
            changeLanguage: i18n.changeLanguage.bind(i18n),
            settings,
          })
        }
      />
      <LessonsPerDayOptions
        current={currentLessonsPerDay}
        onSelect={(value) =>
          void changeLessonsPerDay(value, {
            apply: (val) =>
              queryClient.setQueryData(['lessonsPerDay', userId], val),
            settings,
          })
        }
      />
      {/* Il collegamento alla privacy policy (7.1): un'affordance SECONDARIA
          (button, idioma del repo) DENTRO la <section> ma FUORI dai due
          `role="group"` (lingua e tetto), cosi il conteggio dei gruppi resta 2.
          -> `onViewPrivacy` (cablato in AuthenticatedShell). */}
      <div className="flex flex-col border-t-[1.5px] border-border-strong">
      <button
        type="button"
        onClick={onViewPrivacy}
        className={`${LEGAL_ROW} ${FOCUS_RING}`}
      >
        {t('legal.privacy.linkLabel')}
      </button>
      {/* Il collegamento ai riconoscimenti (7.2): gemello di quello alla privacy,
          un'affordance SECONDARIA (button, idioma del repo) DENTRO la <section> ma
          FUORI dai due `role="group"` (lingua e tetto), cosi il conteggio dei gruppi
          resta 2. -> `onViewAcknowledgements` (cablato in AuthenticatedShell). */}
      <button
        type="button"
        onClick={onViewAcknowledgements}
        className={`${LEGAL_ROW} ${FOCUS_RING}`}
      >
        {t('legal.acknowledgements.linkLabel')}
      </button>
      </div>
    </section>
  );
}
