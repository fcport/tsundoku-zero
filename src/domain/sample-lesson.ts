// Livello domain: la FIXTURE canonica della lezione campione (Story 2.7, AC4).
// NON è una copia sintetica del contenuto: fa l'`import` STATICO del file di
// lezione REALE spedito in `content/lessons/`, lo valida con `parseLesson`
// (fonte UNICA dello schema di 2.1/2.2) ed esporta `sampleLesson: Lesson`. Così
// i test di componente di Epic 3 e l'end-to-end di Epic 7 consumano il contenuto
// vero, non dati fabbricati — e rinominare o rompere il file rompe subito il
// typecheck/il caricamento, non un test lontano.
//
// Dominio puro (AD-1): l'import di un file DATI JSON per path relativo NON è un
// pacchetto npm esterno (nessun `*`/`@*/*`), non è I/O runtime (il bundler +
// `resolveJsonModule` lo risolvono a build-time) e non tocca alcun global
// vietato. Nessun `any`: `raw` è `unknown` e diventa `Lesson` solo attraverso
// `parseLesson`.
import { parseLesson, type Lesson } from './lesson';
// Import statico del file REALE (bundler mode + resolveJsonModule ON). Import
// per path relativo di un file dati: non è un pacchetto esterno (boundaries).
import raw from '../../content/lessons/01-la-particella-wo.json';

/**
 * Carica la lezione campione dal file reale e la valida con `parseLesson`. Se il
 * contenuto divergesse dallo schema, LANCIA riportando i path degli issue —
 * guardia d'INTEGRITÀ della fixture. In pratica non scatta mai, perché il
 * CANCELLO di 2.6 (`npm run validate-content`) tiene il contenuto conforme; è la
 * rete di sicurezza che rende la divergenza rumorosa invece che silenziosa.
 */
function loadSampleLesson(): Lesson {
  const result = parseLesson(raw);
  if (!result.ok) {
    const where = result.issues
      .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `La fixture della lezione campione (content/lessons/01-la-particella-wo.json) non è conforme allo schema: ${where}`,
    );
  }
  return result.value;
}

/**
 * La lezione campione come FIXTURE typed e canonica (AC4): È il file reale
 * spedito, non una copia. `Lesson` garantisce l'uso tipato ai consumatori a
 * valle (Epic 3, Epic 7) senza contenuto sintetico.
 */
export const sampleLesson: Lesson = loadSampleLesson();
