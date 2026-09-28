// Livello app: la PAGINA delle impostazioni (rotta `SETTINGS_PATH`). Compone le due
// feature che prima stavano in coda alla dashboard — `SettingsScreen` (lingua,
// tetto giornaliero, collegamenti legali) e `DeleteAccountSection` — sotto un'azione
// di ritorno. La navigazione è cablata qui, nel livello app (AD-1): le features
// ricevono solo callback.
import { useNavigate } from "react-router";
import { useTranslation } from "../i18n";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { DeleteAccountSection } from "../features/account/DeleteAccountSection";
import { RESPONSIVE_CONTAINER } from "../ui/layout";
import { ACKNOWLEDGEMENTS_PATH, PRIVACY_PATH, ROOT_PATH } from "./routes";
import type { SettingsRepository } from "../domain/ports/settingsRepository";
import type { AccountGateway } from "../domain/ports/accountGateway";

export interface SettingsPageProps {
  readonly settings: SettingsRepository;
  readonly account: AccountGateway;
  readonly userId: string | null;
  /** Invocato dopo una cancellazione riuscita: torna anonimo (AuthRoot). */
  readonly onAccountDeleted: () => void;
}

export function SettingsPage({
  settings,
  account,
  userId,
  onAccountDeleted,
}: SettingsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className={`${RESPONSIVE_CONTAINER} flex flex-col gap-2 py-6`}>
      <button
        type="button"
        onClick={() => navigate(ROOT_PATH)}
        className="self-start text-label text-ink-secondary underline"
      >
        {t("settings.back")}
      </button>
      <SettingsScreen
        settings={settings}
        userId={userId}
        onViewPrivacy={() => navigate(PRIVACY_PATH)}
        onViewAcknowledgements={() => navigate(ACKNOWLEDGEMENTS_PATH)}
      />
      <DeleteAccountSection
        account={account}
        onAccountDeleted={onAccountDeleted}
      />
    </div>
  );
}
