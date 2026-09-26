// Storia 6.3 — Il confronto che impedisce la contaminazione.
//
// NUCLEO PURO del controllo di autorazione anti-contaminazione (FR11.7, AC1/AC2).
// PURO e TOTALE: nessun `console`, nessun `process`, nessun I/O. Il glob dei
// transcript, la lettura dei file e l'exit code vivono nel CLI
// (`scripts/check-contamination.ts`), esattamente come `validateLessons`
// (dominio puro) è separato dal suo runner `scripts/validate-content.ts`.
//
// Il controllo confronta OGNI frase giapponese (`sentence.kanji`, `sentence.kana`)
// e OGNI spiegazione (`explanation.en`, `explanation.it`) prodotte in una lezione
// contro il testo dei transcript, e segnala le SOVRAPPOSIZIONI VERBATIM non banali
// — i run condivisi ≥ soglia dopo normalizzazione NFKC. Il giapponese non ha
// spazi: la soglia è un run di CARATTERI contigui. La prosa (en/it) usa n-gram di
// PAROLE consecutive.
//
// `String.prototype.normalize('NFKC')` è una funzione PURA del linguaggio
// (precedente in `src/domain/lesson.ts`), non un accesso a global di piattaforma.
import type { Lesson } from '../../src/domain/lesson.ts';

/**
 * Soglia di «non banale» per il giapponese: il numero MINIMO di caratteri
 * contigui (dopo NFKC + strip di spazi e punteggiatura) che un run condiviso deve
 * raggiungere per essere segnalato. È una COSTANTE DICHIARATA e TARABILE: come i
 * trenta minuti di 6.4, è una stima da tarare sull'esperienza reale, non una
 * verità. Un valore troppo basso segnala coincidenze (una particella, un に), uno
 * troppo alto lascia passare frasi copiate quasi intere.
 */
export const MIN_JA_RUN = 8;

/**
 * Soglia di «non banale» per la prosa (en/it): il numero MINIMO di PAROLE
 * consecutive che un run condiviso deve raggiungere. Anch'essa DICHIARATA e
 * TARABILE. Un valore troppo basso segnala locuzioni comuni («the subject is»),
 * uno troppo alto lascia passare intere proposizioni parafrasate solo in parte.
 */
export const MIN_PROSE_WORDS = 6;

/**
 * La NATURA di un testo prodotto: `ja` si confronta per run di CARATTERE (il
 * giapponese non ha spazi), `prose` per n-gram di PAROLA.
 */
export type ProducedKind = 'ja' | 'prose';

/**
 * Un testo prodotto da confrontare: la sua ORIGINE (`lessonPath`), l'ETICHETTA di
 * campo (`field`, es. `exercises.0.sentence.kanji` o `exercises.2.explanation.it`),
 * la NATURA (`kind`) e il TESTO grezzo (`text`, non ancora normalizzato). La
 * normalizzazione avviene dentro `detectOverlaps`, così l'etichetta e il testo
 * originale restano disponibili per il report.
 */
export interface ProducedText {
  readonly lessonPath: string;
  readonly field: string;
  readonly kind: ProducedKind;
  readonly text: string;
}

/**
 * Il testo di un transcript da confrontare: la sua ORIGINE (`path`, per nominare
 * il file nel report) e il TESTO grezzo (`text`). La lettura del file è del CLI;
 * qui arriva già come stringa.
 */
export interface TranscriptText {
  readonly path: string;
  readonly text: string;
}

/**
 * Una voce di ALLOWLIST: uno `span` VERBATIM (nella forma normalizzata che il
 * report emette) e la `reason` che lo motiva. La motivazione è MECCANICA: una
 * `reason` NON vuota riclassifica la sovrapposizione come «motivata» e non fa
 * fallire il controllo; una `reason` VUOTA NON la sopprime (resta un fallimento).
 * Così un esempio canonico pubblico si può motivare per iscritto (AC2), ma non si
 * può zittire una segnalazione svuotando il campo.
 */
export interface MotivatedException {
  readonly span: string;
  readonly reason: string;
}

/**
 * Una SOVRAPPOSIZIONE segnalata: dove è (campo del contenuto prodotto e file del
 * transcript), il testo VERBATIM condiviso (`span`, nella forma normalizzata), la
 * sua lunghezza (in caratteri per `ja`, in parole per `prose`), la posizione nel
 * testo prodotto (`start`, indice sulla sequenza normalizzata), e se è stata
 * riclassificata come MOTIVATA da una voce di allowlist (`motivated`, con la
 * `reason`). Il CLI fa fallire il controllo SE E SOLO SE resta almeno una
 * sovrapposizione con `motivated === undefined`.
 */
export interface ContaminationOverlap {
  readonly lessonPath: string;
  readonly field: string;
  readonly kind: ProducedKind;
  readonly transcriptPath: string;
  readonly span: string;
  readonly length: number;
  readonly start: number;
  readonly motivated?: string;
}

/**
 * Opzioni tarabili di `detectOverlaps`. Assenti ⇒ le costanti dichiarate
 * (`MIN_JA_RUN`/`MIN_PROSE_WORDS`) e nessuna allowlist. Esposte per il test (che
 * abbassa le soglie sulle fixture sintetiche) e per un eventuale futuro override
 * del CLI.
 */
export interface DetectOptions {
  readonly minJaRun?: number;
  readonly minProseWords?: number;
  readonly allowlist?: ReadonlyArray<MotivatedException>;
}

/**
 * Normalizza il testo GIAPPONESE per il confronto per CARATTERE: NFKC, poi STRIP
 * di ogni whitespace e di ogni punteggiatura/simbolo. Il giapponese non ha spazi,
 * quindi un run «verbatim» è una sequenza di caratteri di CONTENUTO contigui:
 * togliere spazi e punteggiatura evita che un 。 o uno spazio a metà spezzi un
 * run reale, o che una virgola in comune conti come sovrapposizione. NFKC unifica
 * le forme half/full-width (半角↔全角), come `exerciseNaturalKey`.
 *
 * PURA. `\s` copre lo whitespace; `\p{P}` la punteggiatura Unicode (giapponese
 * inclusa: 、。「」・…) e `\p{S}` i simboli.
 */
export function normalizeJa(text: string): string {
  return text.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
}

/**
 * Normalizza la PROSA (en/it) per il confronto per PAROLA: NFKC, minuscolo,
 * whitespace collassato, poi SPLIT in parole. La punteggiatura ai bordi di ogni
 * parola è tolta così che «です.» e «です» siano la stessa parola. Restituisce la
 * sequenza di parole non vuote, che `detectOverlaps` confronta per n-gram.
 *
 * PURA. Minuscolo e NFKC così due formulazioni identiche a meno di
 * capitalizzazione/forma di compatibilità coincidono.
 */
export function normalizeProse(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''))
    .filter((word) => word.length > 0);
}

/**
 * Estrae da una lezione OGNI testo prodotto da confrontare (AC1): per ogni
 * esercizio, le due facce della frase (`sentence.kanji`, `sentence.kana` — JA) e
 * le due lingue della spiegazione (`explanation.en`, `explanation.it` — prosa;
 * `it` solo se presente). Il `title` (en/it) è pure prosa autorata dal concetto e
 * quindi soggetto allo stesso confine, perciò è incluso.
 *
 * Ogni `ProducedText` porta l'ETICHETTA di campo che il report userà per
 * localizzare la sovrapposizione. PURA: riceve una `Lesson` GIÀ validata (il CLI
 * la parsa con `parseLesson`) e non fa I/O.
 */
export function collectProducedTexts(lesson: Lesson, lessonPath: string): ProducedText[] {
  const produced: ProducedText[] = [];

  // Il titolo è prosa autorata dal concetto (mai dal titolo della fonte): stesso
  // confine delle spiegazioni.
  produced.push({ lessonPath, field: 'title.en', kind: 'prose', text: lesson.title.en });
  if (lesson.title.it !== undefined) {
    produced.push({ lessonPath, field: 'title.it', kind: 'prose', text: lesson.title.it });
  }

  lesson.exercises.forEach((exercise, i) => {
    const at = `exercises.${i}`;
    produced.push({
      lessonPath,
      field: `${at}.sentence.kanji`,
      kind: 'ja',
      text: exercise.sentence.kanji,
    });
    produced.push({
      lessonPath,
      field: `${at}.sentence.kana`,
      kind: 'ja',
      text: exercise.sentence.kana,
    });
    produced.push({
      lessonPath,
      field: `${at}.explanation.en`,
      kind: 'prose',
      text: exercise.explanation.en,
    });
    if (exercise.explanation.it !== undefined) {
      produced.push({
        lessonPath,
        field: `${at}.explanation.it`,
        kind: 'prose',
        text: exercise.explanation.it,
      });
    }
  });

  return produced;
}

/**
 * Il run condiviso MASSIMALE che parte dall'indice `i` del prodotto e dall'indice
 * `j` del transcript: estende finché gli elementi coincidono. Riportare il run
 * massimale (non ogni sotto-run) evita di moltiplicare la stessa sovrapposizione.
 * Restituisce la lunghezza (0 se `prod[i] !== tr[j]`).
 */
function matchLength(
  prod: ReadonlyArray<string>,
  tr: ReadonlyArray<string>,
  i: number,
  j: number,
): number {
  let len = 0;
  while (i + len < prod.length && j + len < tr.length && prod[i + len] === tr[j + len]) {
    len += 1;
  }
  return len;
}

/**
 * Trova nel `produced` (sequenza normalizzata di elementi: caratteri per JA,
 * parole per prosa) i run MASSIMALI ≥ `min` condivisi con QUALSIASI transcript. Un
 * run è massimale se non è il prefisso di un run condiviso più lungo che parte una
 * posizione prima: avanziamo l'indice del prodotto PAST la fine del run trovato,
 * così non riemettiamo i suoi sotto-run.
 *
 * Restituisce le sovrapposizioni con la posizione `start` (nella sequenza
 * normalizzata) e lo `span` (gli elementi, ri-uniti). PURA.
 */
function findRuns(
  producedElems: ReadonlyArray<string>,
  transcripts: ReadonlyArray<{ readonly path: string; readonly elems: ReadonlyArray<string> }>,
  min: number,
  joiner: string,
): ReadonlyArray<{ readonly start: number; readonly span: string; readonly length: number; readonly transcriptPath: string }> {
  const runs: Array<{ start: number; span: string; length: number; transcriptPath: string }> = [];
  let i = 0;
  while (i < producedElems.length) {
    // Il run più lungo che parte da `i` in un qualsiasi transcript.
    let best = 0;
    let bestPath = '';
    for (const { path, elems } of transcripts) {
      for (let j = 0; j < elems.length; j += 1) {
        if (elems[j] !== producedElems[i]) {
          continue;
        }
        const len = matchLength(producedElems, elems, i, j);
        if (len > best) {
          best = len;
          bestPath = path;
        }
      }
    }
    if (best >= min) {
      runs.push({
        start: i,
        span: producedElems.slice(i, i + best).join(joiner),
        length: best,
        transcriptPath: bestPath,
      });
      // Avanza past il run: i suoi sotto-run non sono sovrapposizioni distinte.
      i += best;
    } else {
      i += 1;
    }
  }
  return runs;
}

/**
 * Riclassifica una sovrapposizione come MOTIVATA se una voce di allowlist con
 * `reason` NON vuota copre esattamente il suo `span`. La `reason` vuota NON
 * sopprime: la voce è ignorata e la sovrapposizione resta un fallimento (AC2). Il
 * confronto dello span è per uguaglianza della forma normalizzata che il report
 * emette — così la motivazione si scrive copiando ciò che il controllo ha stampato.
 */
function motivationFor(
  span: string,
  allowlist: ReadonlyArray<MotivatedException>,
): string | undefined {
  for (const entry of allowlist) {
    if (entry.span === span && entry.reason.trim().length > 0) {
      return entry.reason;
    }
  }
  return undefined;
}

/**
 * Le voci di allowlist INUTILIZZATE: quelle con `reason` non vuota (una vera
 * motivazione) il cui `span` non compare in ALCUNA sovrapposizione rilevata. Sono
 * un segnale d'igiene: un refuso nello `span`, o un esempio che non esiste più,
 * farebbe credere all'autore di aver motivato qualcosa che invece resta un
 * fallimento (o non esiste). Le voci con `reason` VUOTA non sono motivazioni,
 * quindi non contano come «inutilizzate»: non promettono nulla.
 *
 * PURA. Il CLI la usa per emettere un AVVISO (non un fallimento): l'allowlist
 * inutilizzata non fa fallire il controllo, ma va segnalata.
 */
export function unusedAllowlistEntries(
  overlaps: ReadonlyArray<ContaminationOverlap>,
  allowlist: ReadonlyArray<MotivatedException>,
): MotivatedException[] {
  const spans = new Set(overlaps.map((o) => o.span));
  return allowlist.filter((entry) => entry.reason.trim().length > 0 && !spans.has(entry.span));
}

/**
 * IL CONTROLLO (AC1/AC2). PURO e TOTALE. Per ogni testo prodotto, trova i run
 * verbatim MASSIMALI ≥ soglia condivisi con QUALSIASI transcript — per CARATTERE
 * se `kind === 'ja'`, per PAROLA se `kind === 'prose'` — e li emette come
 * sovrapposizioni. Una voce di allowlist con `reason` non vuota riclassifica la
 * sovrapposizione come «motivata» (`motivated` valorizzato); il CLI la considera
 * non-fatale. Contenuto sotto soglia non produce alcuna sovrapposizione.
 *
 * Le soglie sono DICHIARATE e TARABILI (`options` le sovrascrive; assenti ⇒
 * `MIN_JA_RUN`/`MIN_PROSE_WORDS`). Non fa I/O: riceve i testi già letti.
 */
export function detectOverlaps(
  produced: ReadonlyArray<ProducedText>,
  transcripts: ReadonlyArray<TranscriptText>,
  options?: DetectOptions,
): ContaminationOverlap[] {
  // Le soglie sono almeno 1: una soglia 0 o negativa (via `DetectOptions`)
  // renderebbe `best >= min` vero anche a `best === 0`, emettendo sovrapposizioni
  // a lunghezza zero spurie. `Math.max(1, …)` chiude quel buco senza vietare
  // l'override legittimo verso il basso (utile nei test sulle fixture sintetiche).
  const minJa = Math.max(1, options?.minJaRun ?? MIN_JA_RUN);
  const minProse = Math.max(1, options?.minProseWords ?? MIN_PROSE_WORDS);
  const allowlist = options?.allowlist ?? [];

  // Pre-normalizza i transcript UNA volta per natura (carattere vs parola).
  const jaTranscripts = transcripts.map((t) => ({
    path: t.path,
    elems: Array.from(normalizeJa(t.text)),
  }));
  const proseTranscripts = transcripts.map((t) => ({
    path: t.path,
    elems: normalizeProse(t.text),
  }));

  const overlaps: ContaminationOverlap[] = [];

  for (const item of produced) {
    if (item.kind === 'ja') {
      const elems = Array.from(normalizeJa(item.text));
      const runs = findRuns(elems, jaTranscripts, minJa, '');
      for (const run of runs) {
        overlaps.push({
          lessonPath: item.lessonPath,
          field: item.field,
          kind: 'ja',
          transcriptPath: run.transcriptPath,
          span: run.span,
          length: run.length,
          start: run.start,
          motivated: motivationFor(run.span, allowlist),
        });
      }
    } else {
      const elems = normalizeProse(item.text);
      const runs = findRuns(elems, proseTranscripts, minProse, ' ');
      for (const run of runs) {
        overlaps.push({
          lessonPath: item.lessonPath,
          field: item.field,
          kind: 'prose',
          transcriptPath: run.transcriptPath,
          span: run.span,
          length: run.length,
          start: run.start,
          motivated: motivationFor(run.span, allowlist),
        });
      }
    }
  }

  return overlaps;
}
