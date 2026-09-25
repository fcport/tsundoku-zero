// Livello app (AD-1): la radice protetta minima resa quando l'utente è
// autenticato. PRESENTAZIONALE — nessuno stato, nessuna chiamata alla porta:
// riceve `onSignOut`/`signOutPending`/`userId` per props ed è reso staticamente.
//
// Compone un <header> con il bottone Disconnetti (`auth.signOut`, da t()) SOPRA
// la dashboard (<DashboardScreen>, il primo consumatore del read-model, 3.12) che
// sostituisce il branding placeholder. Solo classi token del sistema di design
// (1.3): ogni interattivo con `border-strong`, nessuna ombra, nessun verde di
// successo.
//
// La shell compone TRE feature come sibling — la dashboard (l'unico <main>),
// Impostazioni (<SettingsScreen>) e Account (<DeleteAccountSection>) — così l'app
// resta l'unico livello che le mette insieme, evitando un arco features→features
// vietato da AD-1. Impostazioni e Account sono <section>: l'unico <main> è quello
// della dashboard (single-main di 1.7/1.8).
import { useTranslation } from '../i18n';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { DeleteAccountSection } from '../features/account/DeleteAccountSection';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';

export interface AuthenticatedShellProps {
  /** La porta delle impostazioni, inoltrata alla feature Impostazioni. */
  readonly settings: SettingsRepository;
  /** La porta di cancellazione account, inoltrata alla feature Account. */
  readonly account: AccountGateway;
  /** L'id dell'utente corrente (o `null` finché non risolto), passato alla dashboard. */
  readonly userId: string | null;
  readonly onSignOut: () => void;
  /** Vero durante la disconnessione: disabilita il bottone. */
  readonly signOutPending: boolean;
  /** Invocato dopo una cancellazione riuscita: torna anonimo (AuthRoot). */
  readonly onAccountDeleted: () => void;
}

export function AuthenticatedShell({
  settings,
  account,
  userId,
  onSignOut,
  signOutPending,
  onAccountDeleted,
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
      <DashboardScreen userId={userId} settings={settings} />
      <SettingsScreen settings={settings} userId={userId} />
      <DeleteAccountSection
        account={account}
        onAccountDeleted={onAccountDeleted}
      />
    </>
  );
}
