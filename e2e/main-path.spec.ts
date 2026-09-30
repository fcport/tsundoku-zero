// e2e (storia 7.4): il PERCORSO PRINCIPALE del prodotto, verificato da una
// macchina. Un solo test pilota dal browser l'intero flusso contro il progetto
// Supabase REALE (AD-12/AD-13, nessun mock né `supabase start`):
//
//   registrazione (email unica) → sblocco della prima lezione → risoluzione dei
//   tre esercizi → pila a zero (asserzione `session.complete.body`).
//
// Vincoli di questa storia, resi qui:
// - Pilota SOLO superfici reali: rotte, ruoli accessibili + testo i18n, e gli id
//   `#auth-email`/`#auth-password` già presenti. NON importa moduli di `src/`
//   (nessun accoppiamento AD-1); non inventa `data-testid`.
// - Email UNICA per run (`makeTestUser`), nessuna fixture condivisa, password
//   generata nel test.
// - Le risposte sono DERIVATE dal contenuto canonico (`loadFirstLessonSolutions`),
//   mai cablate a mano — coerenti con `answerOptions`/`composeResponse`.
// - Teardown (`afterEach`) che invoca la STESSA Edge Function `delete-account` e
//   VERIFICA l'esito 2xx; gira SEMPRE, anche su fallimento del test.
// - Determinismo: contesto pulito ⇒ atterraggio su `/login`; ancore testuali
//   robuste alla lingua (regex en|it), perché la lingua persistita può variare.
import { test, expect, type Page } from '@playwright/test';
import { makeTestUser, type TestUser } from './support/testUser';
import { deleteTestUser } from './support/teardown';
import {
  loadFirstLessonSolutions,
  type ExerciseSolution,
} from './support/answers';

// Ancore testuali BILINGUI (regex en|it): la lingua della sessione dipende dallo
// stato persistito, quindi ogni testo di UI è ancorato in ENTRAMBE le lingue.
// Corrispondono 1:1 alle chiavi i18n `src/i18n/en.ts` / `src/i18n/it.ts`.
const TEXT = {
  // auth.submit — il button-primary di registrazione (default `sign-up`).
  authSubmit: /^(Crea account|Create account)$/,
  // dashboard.startAction — sblocca la PRIMA lezione (primo avvio, unlocked===0).
  startAction: /^(Comincia dalla prima lezione|Start with the first lesson)$/,
  // dashboard.primaryAction — «svuota la pila» (pila piena ⇒ naviga a /studia).
  primaryAction: /^(Svuota la pila|Empty the pile)$/,
  // session.prompt.* — la CONSEGNA, distingue il `kind` della card corrente.
  promptSingleSelect: /^(Scegli l'opzione che completa la frase\.|Choose the option that completes the sentence\.)$/,
  promptAssemble: /^(Metti in ordine le tessere per costruire la frase\.|Put the tiles in order to build the sentence\.)$/,
  promptSelectSpan: /^(Seleziona la parte della frase che risponde alla domanda\.|Select the part of the sentence that answers the question\.)$/,
  // session.next — avanza al prossimo esercizio.
  next: /^(Prossimo esercizio|Next exercise)$/,
  // session.complete.body — la pila è a zero (l'ASSERZIONE finale del percorso).
  completeBody:
    /(La pila di ripasso è a zero|Your review pile is at zero)/,
} as const;

// L'utente effimero del run, coniato in `beforeEach` così il teardown lo vede
// anche quando il corpo del test fallisce a metà.
let currentUser: TestUser | null = null;

test.beforeEach(() => {
  currentUser = makeTestUser();
});

// Il teardown VERIFICATO (gira SEMPRE): cancella l'utente creato invocando la
// stessa `delete-account` e verificando il 2xx. Se il test è fallito PRIMA della
// registrazione l'accesso non riuscirà: in quel caso non c'è nulla da cancellare
// e non vogliamo mascherare il fallimento originale del test, quindi ci proviamo
// e lasciamo emergere l'eventuale errore di teardown come tale.
test.afterEach(async () => {
  const user = currentUser;
  currentUser = null;
  if (user) {
    await deleteTestUser(user);
  }
});

// Risolve la card CORRENTE: legge la consegna per capire il `kind`, poi la
// DOMANDA propria dell'esercizio per capire quale, e applica la sua soluzione
// derivata dal contenuto (robusto all'ordine della pila, `listDue`). La lezione
// ha più esercizi per tipo: il solo `kind` sceglierebbe l'esercizio sbagliato.
async function solveCurrentExercise(
  page: Page,
  solutions: readonly ExerciseSolution[],
): Promise<void> {
  const article = page.locator('article');
  await expect(article).toBeVisible();

  const has = async (prompt: RegExp | string): Promise<boolean> =>
    (await article.getByText(prompt, { exact: true }).count()) > 0;

  // Le frasi della card SENZA le letture: la domanda porta la furigana sulle parole
  // giapponesi (出す ⇒ 出<rt>だ</rt>す), e il testo grezzo sarebbe «出だす».
  const paragraphs = await article.locator('p').evaluateAll((nodes) =>
    nodes.map((node) => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('rt').forEach((rt) => rt.remove());
      return (clone.textContent ?? '').trim();
    }),
  );

  // Fra gli esercizi di quel `kind`, quello la cui domanda è a schermo (in una
  // delle due lingue); senza domande nel contenuto, l'unico di quel tipo.
  const pick = async (kind: ExerciseSolution['kind']): Promise<ExerciseSolution | undefined> => {
    const ofKind = solutions.filter((s) => s.kind === kind);
    for (const s of ofKind) {
      for (const prompt of s.prompts) {
        if (paragraphs.includes(prompt)) return s;
      }
    }
    return ofKind.length === 1 ? ofKind[0] : undefined;
  };

  if (await has(TEXT.promptSingleSelect)) {
    const solution = await pick('single-select');
    if (solution?.kind !== 'single-select') {
      throw new Error('Soluzione single-select assente dal contenuto.');
    }
    // Bottone-opzione col TESTO = answer (single-select è auto-sottomesso).
    await article
      .getByRole('button', { name: solution.choiceText, exact: true })
      .click();
    return;
  }

  if (await has(TEXT.promptSelectSpan)) {
    const solution = await pick('select-span');
    if (solution?.kind !== 'select-span') {
      throw new Error('Soluzione select-span assente dal contenuto.');
    }
    // Bottone-segmento all'INDICE `answer.start` (0): i bottoni delle opzioni
    // vivono nella <ul>; l'indice di opzione = indice di segmento (dominio).
    await article
      .locator('ul button')
      .nth(solution.optionIndex)
      .click();
    return;
  }

  if (await has(TEXT.promptAssemble)) {
    const solution = await pick('assemble');
    if (solution?.kind !== 'assemble') {
      throw new Error('Soluzione assemble assente dal contenuto.');
    }
    // I token NELL'ORDINE: una tessera scelta diventa `disabled` con un badge di
    // posizione ("N. ") che ENTRA nel nome accessibile, quindi `exact: true` la
    // esclude naturalmente (il nome non è più il solo token); il `.filter` sui
    // `[disabled]` resta come cintura+bretelle. Con `exact: true` un token che
    // fosse sottostringa di un altro non innescherebbe un match spurio.
    for (const token of solution.tokensInOrder) {
      await article
        .getByRole('button', { name: token, exact: true })
        .filter({ hasNot: page.locator('[disabled]') })
        .first()
        .click();
    }
    return;
  }

  throw new Error('Consegna della card non riconosciuta (kind ignoto).');
}

test('percorso principale: registrazione, sblocco, esercizi, pila a zero', async ({
  page,
}) => {
  const user = currentUser;
  if (!user) throw new Error('Utente di test non coniato.');
  const solutions = loadFirstLessonSolutions();

  // 1) Contesto pulito ⇒ nessuna sessione ⇒ atterraggio su /login (guard).
  await page.goto('/');
  await expect(page.locator('#auth-email')).toBeVisible();

  // 2) Registrazione con email UNICA (default `sign-up`): riempie gli id reali e
  //    invia col button-primary `auth.submit`.
  await page.locator('#auth-email').fill(user.email);
  await page.locator('#auth-password').fill(user.password);
  await page.getByRole('button', { name: TEXT.authSubmit }).click();

  // 3) Autenticato ⇒ dashboard di PRIMO AVVIO (unlocked===0): solo la
  //    descrizione + `startAction`. Sblocca la prima lezione ⇒ la pila si riempie.
  const startAction = page.getByRole('button', { name: TEXT.startAction });
  await expect(startAction).toBeVisible();
  await startAction.click();

  // 4) Pila piena ⇒ il cancello mostra SOLO `primaryAction` («svuota la pila»),
  //    che naviga a /studia (precarico + useNavigate lato app).
  const primaryAction = page.getByRole('button', { name: TEXT.primaryAction });
  await expect(primaryAction).toBeVisible();
  await primaryAction.click();
  await expect(page).toHaveURL(/\/studia$/);

  // 5) Risolve i TRE esercizi. Dopo ogni risposta, ULTIMA COMPRESA, il riscontro
  //    appare con `session.next`; dopo l'ultima, `next` porta alla schermata di
  //    completamento. `next.or(complete)` resta come attesa robusta: distingue i
  //    due casi in modo
  //    DETERMINISTICO: dopo aver risolto la card ATTENDIAMO lo stato post-risposta
  //    (una delle due affordance visibile) PRIMA di decidere. Senza questa attesa,
  //    un `isVisible()` sincrono letto prima del re-render tornerebbe false e il
  //    ciclo rientrerebbe su una card ormai risposta (opzioni `disabled` ⇒ click
  //    in timeout).
  const completeBody = page.getByText(TEXT.completeBody);
  const nextButton = page.getByRole('button', { name: TEXT.next });

  // Al più tanti esercizi quanti ne ha la prima lezione: le risposte sono sempre
  // corrette ⇒ nessun re-accodamento, il limite `solutions.length` basta. Il
  // ciclo termina alla comparsa della schermata di completamento.
  for (let i = 0; i < solutions.length; i++) {
    await solveCurrentExercise(page, solutions);
    // Attesa DETERMINISTICA dello stato post-risposta: o `session.next` (risposta
    // NON finale) o `session.complete.body` (coda drenata dopo l'ultima). Se
    // nessuna delle due comparisse, `expect(...)` fallisce con messaggio chiaro.
    await expect(nextButton.or(completeBody)).toBeVisible();
    if (await completeBody.isVisible()) break;
    await nextButton.click();
  }

  // 6) LA PILA A ZERO: `session.complete.body`. È il cuore dell'AC1 — il percorso
  //    principale ha attraversato tutte le epiche funzionali fino allo zero.
  await expect(completeBody).toBeVisible();
});
