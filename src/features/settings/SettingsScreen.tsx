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

export interface SettingsScreenProps {
  readonly settings: SettingsRepository;
  /**
   * L'id dell'utente corrente (o `null` finché non risolto): la chiave per-utente
   * del tetto di sblocco, CONDIVISA con la dashboard.
   */
  readonly userId: string | null;
}

export function SettingsScreen({ settings, userId }: SettingsScreenProps) {
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
      className="flex flex-col gap-6 p-6"
    >
      <h2 id="settings-title" className="text-display">
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
    </section>
  );
}
