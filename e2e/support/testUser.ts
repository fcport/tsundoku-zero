// Support e2e (storia 7.4): l'identità UNICA per run. Ogni run crea utenti con
// email unica PER QUEL RUN — nessuna fixture condivisa, nessun utente di test
// permanente, la password è generata qui. L'unicità evita che due run
// concorrenti (o un teardown fallito di un run precedente) si calpestino sul
// progetto Supabase reale.
//
// NON importa moduli di `src/` (nessun accoppiamento ai confini AD-1): è uno
// helper del solo toolchain e2e, che gira in Node. `randomUUID` è importato
// esplicitamente da `node:crypto` (coerente con `answers.ts`, che importa
// `node:fs`/`node:path`), non dal global.
import { randomUUID } from 'node:crypto';

/** Credenziali di un utente di test effimero, valide per un solo run. */
export interface TestUser {
  readonly email: string;
  readonly password: string;
}

/**
 * Conia un utente di test UNICO. L'email combina un timestamp e un token casuale
 * (`randomUUID`) su un dominio `example.com` non instradabile: mai una casella
 * reale, mai riusata fra run. La password è generata così supera qualunque soglia
 * di robustezza dell'auth senza essere cablata.
 */
export function makeTestUser(): TestUser {
  const unique = `${Date.now()}-${randomUUID()}`;
  return {
    // L'unicità dell'email è data da timestamp + UUID; `example.com` è riservato
    // (RFC 2606) e non consegna posta a nessuno. Il `+` è solo un separatore
    // leggibile nel local-part: non compra isolamento (il plus-addressing non
    // ha effetto su un dominio non instradabile), l'unicità è già garantita.
    email: `tsundoku-e2e+${unique}@example.com`,
    // Robusta e generata: il prefisso `Aa1-` garantisce da solo maiuscola,
    // minuscola e cifra (l'UUID è hex+trattini, senza cifre decimali garantite);
    // l'UUID aggiunge lunghezza ed entropia, mai la stessa fra due run.
    password: `Aa1-${randomUUID()}`,
  };
}
