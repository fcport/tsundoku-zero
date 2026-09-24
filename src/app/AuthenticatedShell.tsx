// Livello app (AD-1): la radice protetta minima resa quando l'utente è
// autenticato. PRESENTAZIONALE — nessuno stato, nessuna chiamata alla porta:
// riceve `onSignOut` e `signOutPending` per props ed è reso staticamente.
//
// Compone un <header> con il bottone Disconnetti (`auth.signOut`, da t()) SOPRA
// il branding <App/>. Non modifica App. La dashboard reale arriva in Epic 3;
// nessuna storia di Epic 1 la presuppone. Solo classi token del sistema di
// design (1.3): ogni interattivo con `border-strong`, nessuna ombra, nessun
// verde di successo.
import { useTranslation } from '../i18n';
import { App } from '../ui/App';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import type { SettingsRepository } from '../domain/ports/settingsRepository';

export interface AuthenticatedShellProps {
  /** La porta delle impostazioni, inoltrata alla feature Impostazioni. */
  readonly settings: SettingsRepository;
  readonly onSignOut: () => void;
  /** Vero durante la disconnessione: disabilita il bottone. */
  readonly signOutPending: boolean;
}

export function AuthenticatedShell({
  settings,
  onSignOut,
  signOutPending,
}: AuthenticatedShellProps) {
  const { t } = useTranslation();

  return (
    <>
      <header className="flex justify-end p-6">
        <button
          type="button"
          onClick={onSignOut}
          disabled={signOutPending}
          className="rounded-md border border-border-strong bg-surface-raised text-ink-primary p-3 text-label"
        >
          {t('auth.signOut')}
        </button>
      </header>
      <App />
      <SettingsScreen settings={settings} />
    </>
  );
}
