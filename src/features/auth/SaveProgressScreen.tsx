// Livello features/auth: la pagina che trasforma l'OSPITE in un account (23-10-2026).
// Chi è entrato con «Prova senza account» sceglie email e password e tiene tutto:
// stesso id, stesse lezioni, stessa pila. Riusa il modulo presentazionale `AuthForm`
// con le chiavi della prova; il passaggio di modo diventa «Hai già un account?»,
// che chiude la prova e porta all'accesso (la frase sotto dice cosa si perde).
//
// Le navigazioni sono CALLBACK dal livello app (AD-1: niente react-router qui).
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { RESPONSIVE_CONTAINER } from '../../ui/layout';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { Masthead } from '../../ui/Masthead';
import { FOCUS_RING } from '../../ui/magazine';
import { ArrowIcon } from '../../ui/icons';
import type { AuthGateway } from '../../domain/ports/authGateway';
import { AuthForm, type AuthFormValues } from './AuthForm';
import { applyAuthOutcome } from './authOutcome';
import type { AuthErrorMessage } from './authFailureMessage';
import { submitSaveGuest } from './guest';

export interface SaveProgressScreenProps {
  readonly gateway: AuthGateway;
  /** L'ospite ora ha un account: l'app torna alla dashboard. */
  readonly onSaved: () => void;
  /** Torna indietro senza salvare. */
  readonly onBack: () => void;
  /** Chiude la prova e apre l'accesso a un account che esiste già. */
  readonly onSignInInstead: () => void;
}

export function SaveProgressScreen({
  gateway,
  onSaved,
  onBack,
  onSignInInstead,
}: SaveProgressScreenProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<AuthFormValues>({ email: '', password: '' });
  const [error, setError] = useState<AuthErrorMessage | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <MagazineFrame>
      <Masthead
        start={
          <button
            type="button"
            onClick={onBack}
            className={`flex min-h-[44px] items-center gap-2 uppercase hover:underline ${FOCUS_RING}`}
          >
            <ArrowIcon className="rotate-180" />
            {t('auth.guest.back')}
          </button>
        }
      />
      <main className={`${RESPONSIVE_CONTAINER} flex flex-col gap-6 py-8 sm:py-14`}>
        <AuthForm
          intro={<p className="text-body text-ink-primary">{t('auth.guest.saveIntro')}</p>}
          values={values}
          error={error}
          pending={pending}
          titleKey="auth.guest.saveTitle"
          submitKey="auth.guest.saveSubmit"
          toggleKey="auth.guest.haveAccount"
          onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
          onToggle={onSignInInstead}
          onSubmit={() => {
            setPending(true);
            setError(null);
            void submitSaveGuest(gateway, values)
              .then((outcome) =>
                applyAuthOutcome(outcome, { onAuthenticated: onSaved, onError: setError }),
              )
              .finally(() => setPending(false));
          }}
        />
        <p className="-mt-3 text-caption text-ink-secondary">{t('auth.guest.haveAccountNote')}</p>
      </main>
    </MagazineFrame>
  );
}
