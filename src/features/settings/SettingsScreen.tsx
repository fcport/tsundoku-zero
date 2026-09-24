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
import {
  resolveLocale,
  useTranslation,
  type Locale,
} from '../../i18n';
import type { SettingsRepository } from '../../domain/ports/settingsRepository';
import { LanguageOptions } from './LanguageOptions';
import { changeLocale } from './changeLocale';

export interface SettingsScreenProps {
  readonly settings: SettingsRepository;
}

export function SettingsScreen({ settings }: SettingsScreenProps) {
  const { t, i18n } = useTranslation();
  const current: Locale = resolveLocale(i18n.language);

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
    </section>
  );
}
