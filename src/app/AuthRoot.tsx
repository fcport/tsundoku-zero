// Livello app: container che tiene lo stato di autenticazione e rende AuthGate.
// In questa storia lo stato nasce a `false` (non autenticato) e passa a `true`
// quando il signup va a buon fine. La persistenza della sessione fra riavvii
// (1.7) è fuori scope: qui non si legge né si scrive storage.
import { useState } from 'react';
import { AuthGate } from './AuthGate';
import type { AuthGateway } from '../domain/ports/authGateway';

export interface AuthRootProps {
  readonly gateway: AuthGateway;
}

export function AuthRoot({ gateway }: AuthRootProps) {
  const [authenticated, setAuthenticated] = useState(false);

  return (
    <AuthGate
      authenticated={authenticated}
      gateway={gateway}
      onAuthenticated={() => setAuthenticated(true)}
    />
  );
}
