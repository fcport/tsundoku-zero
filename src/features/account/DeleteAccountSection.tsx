// Livello features/account: container della superficie di cancellazione account.
// Riceve la porta `AccountGateway` INIETTATA e il callback `onAccountDeleted`
// (features non importa data, AD-1) e tiene lo stato di fase/pending/errore.
// Modello: features/auth/AuthScreen.tsx (container con stato) + SettingsScreen.
//
// È un <section aria-labelledby> — NON un <main>: vive dentro la shell
// autenticata che possiede già l'unico landmark <main> (invariante single-main
// di 1.7/1.8). Alla conferma chiama l'orchestrazione pura `submitDeleteAccount`
// con la porta; su `ok` invoca `onAccountDeleted` (la transizione a anonimo vive
// in app/AuthRoot: scarica la sessione morta e torna al login), su fallimento
// setta l'errore e resta in `confirming` per un ritentativo. Il click→handler è
// glue d'effetto, coperto dalla verifica live differita; la resa statica per
// fase è provata da DeleteAccountConfirm.test.
import { useState } from 'react';
import type { AccountGateway } from '../../domain/ports/accountGateway';
import {
  DeleteAccountConfirm,
  type DeleteAccountPhase,
} from './DeleteAccountConfirm';
import { submitDeleteAccount } from './deleteAccount';
import { useTranslation } from '../../i18n';

export interface DeleteAccountSectionProps {
  readonly account: AccountGateway;
  /**
   * Invocato quando la cancellazione va a buon fine: l'app scarica la sessione
   * ormai morta e torna anonima (AuthRoot). La feature non conosce la sessione.
   */
  readonly onAccountDeleted: () => void;
}

export function DeleteAccountSection({
  account,
  onAccountDeleted,
}: DeleteAccountSectionProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<DeleteAccountPhase>('idle');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  return (
    <section
      aria-labelledby="account-delete-title"
      className="flex flex-col gap-6 p-6"
    >
      <h2 id="account-delete-title" className="text-display">
        {t('account.delete.title')}
      </h2>
      <DeleteAccountConfirm
        phase={phase}
        pending={pending}
        error={error}
        onRequestDelete={() => {
          setError(false);
          setPhase('confirming');
        }}
        onConfirm={() => {
          setPending(true);
          setError(false);
          void submitDeleteAccount(account)
            .then((result) => {
              if (result.ok) {
                // La transizione di vista vive in app: scarica la sessione morta
                // e torna al login. La feature non tocca la sessione (AD-1).
                onAccountDeleted();
              } else {
                setError(true);
              }
            })
            .finally(() => setPending(false));
        }}
        onCancel={() => {
          setError(false);
          setPhase('idle');
        }}
      />
    </section>
  );
}
