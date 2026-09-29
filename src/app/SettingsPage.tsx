// Livello app: la PAGINA delle impostazioni (rotta `SETTINGS_PATH`). Compone le due
// feature che prima stavano in coda alla dashboard — `SettingsScreen` (lingua,
// tetto giornaliero, collegamenti legali) e `DeleteAccountSection` — sotto un'azione
// di ritorno. La navigazione è cablata qui, nel livello app (AD-1): le features
// ricevono solo callback.
//
// Direzione «rivista» (29-09-2026): il dorso col marchio, la testata col ritorno alla
// dashboard e l'UNICO <main> della pagina (prima mancava del tutto), che raccoglie le
// due sezioni in una colonna di lettura.
import { useNavigate } from 'react-router';
import { useTranslation } from '../i18n';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { DeleteAccountSection } from '../features/account/DeleteAccountSection';
import { ACKNOWLEDGEMENTS_PATH, PRIVACY_PATH, ROOT_PATH } from './routes';
import { MagazineFrame } from '../ui/MagazineFrame';
import { Masthead } from '../ui/Masthead';
import { FOCUS_RING } from '../ui/magazine';
import { ArrowIcon } from '../ui/icons';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';

export interface SettingsPageProps {
  readonly settings: SettingsRepository;
  readonly account: AccountGateway;
  readonly userId: string | null;
  /** Invocato dopo una cancellazione riuscita: torna anonimo (AuthRoot). */
  readonly onAccountDeleted: () => void;
}

export function SettingsPage({ settings, account, userId, onAccountDeleted }: SettingsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <MagazineFrame furiganaToggle>
      <Masthead
        start={
          <button
            type="button"
            onClick={() => navigate(ROOT_PATH)}
            className={`flex min-h-[44px] items-center gap-2 uppercase hover:underline ${FOCUS_RING}`}
          >
            <ArrowIcon className="rotate-180" />
            {t('settings.back')}
          </button>
        }
      />
      <main className="mx-auto flex w-full max-w-measure flex-col gap-10 px-gutter-mobile py-6 sm:px-gutter-desktop sm:py-10">
        <SettingsScreen
          settings={settings}
          userId={userId}
          onViewPrivacy={() => navigate(PRIVACY_PATH)}
          onViewAcknowledgements={() => navigate(ACKNOWLEDGEMENTS_PATH)}
        />
        <DeleteAccountSection account={account} onAccountDeleted={onAccountDeleted} />
      </main>
    </MagazineFrame>
  );
}
