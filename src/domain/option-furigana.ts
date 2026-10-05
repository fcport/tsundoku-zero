// Livello domain: la furigana delle OPZIONI di risposta (29-09-2026). PURA, sincrona,
// totale: stesso esercizio ⇒ stessi segmenti. Il contenuto porta la lettura della
// sola FRASE (`sentence.kana`), non di ogni opzione: qui la si ricava, e SOLO quando
// il ricavo è certo. Una furigana sbagliata insegna male; una furigana assente no.
//
// - `select-span`: le opzioni sono i pezzi della frase (`spanSegments`): di norma le
//   glosse, con la loro lettura scritta; si allineano alla lettura della frase come
//   le tessere. Senza glosse, i segmenti di `alignFurigana` con la loro lettura.
// - `assemble`: le tessere, nell'ordine della risposta, ricompongono la frase. Si
//   allinea la sequenza delle tessere alla lettura della frase: i kana delle tessere
//   sono ancore letterali, ogni corsa di kanji prende la lettura fra due ancore. Se
//   una corsa non ha lo stesso tratto di lettura in TUTTI gli allineamenti possibili
//   resta senza furigana; se due corse di kanji di
//   tessere diverse sono attaccate (毎朝|歌) la loro lettura comune non si può
//   dividere, e quelle tessere restano senza.
// - `single-select`: dalla frase completa si ricava la lettura di ogni corsa di
//   kanji, poi la si applica alle opzioni. Se anche UNA opzione ha una corsa di
//   kanji senza lettura nota, nessuna opzione ha furigana: altrimenti la furigana
//   distinguerebbe la risposta giusta (presa dalla frase) dai distrattori.
import type { Exercise } from './exercise';
import { answerOptions, spanFromGlosses } from './exercise-presentation';
import { alignFurigana, isKana, type FuriganaSegment } from './furigana';

/** Una corsa massimale di caratteri: kana (letterale) o no (da leggere). */
interface Run {
  readonly text: string;
  readonly literal: boolean;
}

// Un carattere si confronta alla lettera se è kana o se non è un ideogramma
// (punteggiatura, cifre, lettere latine compaiono uguali nella lettura).
const isIdeograph = (ch: string): boolean => /[\p{Script=Han}々〆]/u.test(ch);
const isLiteral = (ch: string): boolean => isKana(ch) || !isIdeograph(ch);

function toRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (const ch of text) {
    const literal = isLiteral(ch);
    const last = runs[runs.length - 1];
    if (last && last.literal === literal) {
      runs[runs.length - 1] = { text: last.text + ch, literal };
    } else {
      runs.push({ text: ch, literal });
    }
  }
  return runs;
}

/** Un elemento del modello da allineare: un'ancora letterale o un blocco da leggere. */
type Item =
  | { readonly kind: 'lit'; readonly text: string }
  | { readonly kind: 'var'; readonly parts: ReadonlyArray<{ token: number; run: number }> };

/**
 * Allinea `tokens` (che concatenati ricompongono la frase) alla lettura `kana`.
 * Ritorna, per ogni tessera e ogni sua corsa, la lettura della corsa: `null` se è
 * letterale o se gli allineamenti possibili non le danno tutti lo stesso tratto.
 * Ritorna `null` intero se nessun allineamento esiste.
 */
function alignTokens(
  tokens: readonly string[],
  kana: string,
): (string | null)[][] | null {
  const tokenRuns = tokens.map(toRuns);
  // Il modello: le ancore letterali in ordine; le corse di kanji ADIACENTI (anche fra
  // tessere diverse) si fondono in un solo blocco, perché la loro lettura non ha
  // un'ancora in mezzo a cui dividersi.
  const items: Item[] = [];
  tokenRuns.forEach((runs, token) =>
    runs.forEach((r, run) => {
      const last = items[items.length - 1];
      if (r.literal) {
        if (last?.kind === 'lit') items[items.length - 1] = { kind: 'lit', text: last.text + r.text };
        else items.push({ kind: 'lit', text: r.text });
      } else if (last?.kind === 'var') {
        items[items.length - 1] = { kind: 'var', parts: [...last.parts, { token, run }] };
      } else {
        items.push({ kind: 'var', parts: [{ token, run }] });
      }
    }),
  );

  // Numero di allineamenti (troncato a 2: basta sapere se è unico) da `(i, pos)`.
  const memo = new Map<string, number>();
  const count = (i: number, pos: number): number => {
    if (i === items.length) return pos === kana.length ? 1 : 0;
    const key = `${i}:${pos}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const item = items[i]!;
    let n = 0;
    if (item.kind === 'lit') {
      n = kana.startsWith(item.text, pos) ? count(i + 1, pos + item.text.length) : 0;
    } else {
      for (let end = pos + 1; end <= kana.length && n < 2; end++) n += count(i + 1, end);
    }
    const capped = Math.min(n, 2);
    memo.set(key, capped);
    return capped;
  };
  if (count(0, 0) === 0) return null;

  // Le posizioni da cui può iniziare ciascun elemento in ALMENO un allineamento
  // completo. Un blocco ha una lettura CERTA quando tutti gli allineamenti gli danno
  // lo stesso tratto di `kana` (un'ambiguità altrove, come 母は = は|はは, non tocca
  // le corse certe della stessa frase).
  const readings = tokenRuns.map((runs) => runs.map(() => null as string | null));
  let starts = new Set([0]);
  items.forEach((item, i) => {
    const next = new Set<number>();
    const spans: [number, number][] = [];
    for (const pos of starts) {
      if (item.kind === 'lit') {
        const end = pos + item.text.length;
        if (kana.startsWith(item.text, pos) && count(i + 1, end) > 0) next.add(end);
      } else {
        for (let end = pos + 1; end <= kana.length; end++) {
          if (count(i + 1, end) > 0) {
            next.add(end);
            spans.push([pos, end]);
          }
        }
      }
    }
    // Un blocco di una sola corsa con un solo tratto possibile prende la sua
    // lettura; un blocco fuso fra più corse non si può dividere.
    if (item.kind === 'var' && spans.length === 1 && item.parts.length === 1) {
      const { token, run } = item.parts[0]!;
      readings[token]![run] = kana.slice(spans[0]![0], spans[0]![1]);
    }
    starts = next;
  });
  return readings;
}

/** I segmenti di una tessera dalle letture delle sue corse; `null` se ne manca una. */
function segmentsOf(runs: readonly Run[], readings: readonly (string | null)[]): FuriganaSegment[] | null {
  const segments: FuriganaSegment[] = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    if (run.literal) {
      segments.push({ text: run.text, ruby: null });
    } else {
      const ruby = readings[i];
      if (!ruby) return null;
      segments.push({ text: run.text, ruby });
    }
  }
  return segments.some((s) => s.ruby) ? segments : null;
}

/**
 * I segmenti di un testo giapponese di cui si conosce la lettura intera (`kana`),
 * con la lettura su ciascuna corsa di kanji quando è certa. Se l'allineamento non
 * esiste (lettura incoerente col testo) ripiega sulla furigana di gruppo di
 * `alignFurigana`, che non sbaglia mai: mette la lettura intera sul nucleo.
 */
export function readingSegments(text: string, kana: string): FuriganaSegment[] {
  const readings = alignTokens([text], kana);
  if (!readings) return alignFurigana(text, kana);
  return toRuns(text).map((run, i) => ({
    text: run.text,
    ruby: run.literal ? null : (readings[0]![i] ?? null),
  }));
}

/**
 * I segmenti di ruby di una FRASE da mostrare: la lettura sopra ogni corsa di
 * kanji (`readingSegments`) quando è certa per TUTTE; se anche una sola resta
 * scoperta (lettura ambigua, es. la が di がくせいだ), il gruppo unico di
 * `alignFurigana`, che copre tutto anche se meno preciso. Misurato il 30-09-2026:
 * 241 frasi su 249 prendono la lettura per kanji.
 */
export function sentenceSegments(text: string, kana: string): FuriganaSegment[] {
  const segments = readingSegments(text, kana);
  return segments.some((s) => s.ruby === null && /\p{Script=Han}/u.test(s.text))
    ? alignFurigana(text, kana)
    : segments;
}

/**
 * Le letture CERTE delle corse di kanji di un insieme di frasi (testo + lettura):
 * `corsa → lettura`. Una corsa che compare con due letture diverse è scartata.
 */
export function knownReadings(
  sentences: readonly { readonly kanji: string; readonly kana: string }[],
): ReadonlyMap<string, string> {
  const seen = new Map<string, string | null>();
  const add = (text: string, reading: string) => {
    const prev = seen.get(text);
    seen.set(text, prev === undefined || prev === reading ? reading : null);
  };
  for (const { kanji, kana } of sentences) {
    for (const seg of readingSegments(kanji, kana)) {
      if (seg.ruby && ![...seg.text].some(isLiteral)) add(seg.text, seg.ruby);
    }
  }
  const known = new Map<string, string>();
  for (const [text, reading] of seen) if (reading) known.set(text, reading);
  return known;
}

/**
 * Un testo misto (una spiegazione in italiano o inglese con parole giapponesi) a
 * segmenti: ogni corsa di kanji che `known` conosce ESATTA prende la sua lettura,
 * tutto il resto resta com'è. Nessuna lettura indovinata.
 */
export function annotateKnownKanji(
  text: string,
  known: ReadonlyMap<string, string>,
): FuriganaSegment[] {
  const runs = toRuns(text);
  return runs.map((run, i) => ({
    text: run.text,
    ruby: run.literal
      ? null
      : run.text === '来'
        ? kuruReading(runs[i + 1]?.text ?? '')
        : (known.get(run.text) ?? null),
  }));
}

// 来 da solo è sempre il verbo 来る, l'unico kanji che cambia lettura con la forma:
// la frase dell'esercizio (来た, き) non dice come si legge nella spiegazione o nella
// domanda (来る, く; 来られる, こ). La decide la sillaba che segue.
const KURU_READINGS: Readonly<Record<string, string>> = {
  る: 'く',
  ら: 'こ',
  れ: 'こ',
  な: 'こ',
  よ: 'こ',
  さ: 'こ',
  い: 'こ',
  ず: 'こ',
  た: 'き',
  て: 'き',
  ま: 'き',
};

/** La lettura di 来 dalla sillaba che lo segue; `null` se non basta a deciderla. */
function kuruReading(following: string): string | null {
  return KURU_READINGS[following.charAt(0)] ?? null;
}

/**
 * La furigana di ciascuna opzione, nello STESSO ordine di `answerOptions`. Ogni voce
 * è la lista dei segmenti (come `alignFurigana`) oppure `null`: nessuna furigana
 * (l'opzione è solo kana, o la lettura non si ricava con certezza).
 */
export function optionFurigana(
  exercise: Exercise,
): readonly (readonly FuriganaSegment[] | null)[] {
  const derived = derivedOptionFurigana(exercise);
  // La lettura ESPLICITA delle glosse (scritta nel contenuto, validata allineata
  // al testo) vince su quella ricavata: copre i casi che la frase non permette di
  // dividere (毎晩|日記を) e, nella scelta singola, i kanji dei distrattori.
  const explicit = new Map(
    (exercise.glosses ?? [])
      .filter((g) => g.reading !== undefined)
      .map((g) => [g.text, readingSegments(g.text, g.reading!)] as const),
  );
  const options = answerOptions(exercise);
  const merged = options.map((o, i) => explicit.get(o) ?? derived[i] ?? null);
  if (exercise.kind === 'single-select') {
    // Tutto o niente: se un'opzione con kanji resta senza lettura (né esplicita né
    // ricavata), nessuna la mostra — la furigana distinguerebbe la risposta giusta
    // (letta dalla frase) dai distrattori.
    const unreadable = options.some((o, i) => /\p{Script=Han}/u.test(o) && merged[i] === null);
    return unreadable ? options.map(() => null) : merged;
  }
  return merged;
}

function derivedOptionFurigana(
  exercise: Exercise,
): readonly (readonly FuriganaSegment[] | null)[] {
  const options = answerOptions(exercise);
  switch (exercise.kind) {
    case 'select-span': {
      if (!spanFromGlosses(exercise)) {
        return alignFurigana(exercise.sentence.kanji, exercise.sentence.kana).map((segment) =>
          segment.ruby ? [segment] : null,
        );
      }
      // I pezzi ricompongono la frase, come le tessere: stesso allineamento.
      const readings = alignTokens(options, exercise.sentence.kana);
      return options.map((option, i) => (readings ? segmentsOf(toRuns(option), readings[i]!) : null));
    }
    case 'assemble': {
      const tokens = exercise.answer;
      const readings =
        tokens.join('') === exercise.sentence.kanji
          ? alignTokens(tokens, exercise.sentence.kana)
          : null;
      if (!readings) return options.map(() => null);
      const byText = new Map<string, FuriganaSegment[] | null>();
      tokens.forEach((token, i) => {
        if (!byText.has(token)) byText.set(token, segmentsOf(toRuns(token), readings[i]!));
      });
      return options.map((option) => byText.get(option) ?? null);
    }
    case 'single-select': {
      // Le letture delle corse di kanji della frase completa (una corsa che compare
      // con due letture diverse non è affidabile e si scarta).
      const known = new Map<string, string | null>();
      const readings = alignTokens([exercise.sentence.kanji], exercise.sentence.kana);
      if (readings) {
        toRuns(exercise.sentence.kanji).forEach((run, i) => {
          const reading = readings[0]![i];
          if (run.literal || !reading) return;
          const seen = known.get(run.text);
          known.set(run.text, seen === undefined || seen === reading ? reading : null);
        });
      }
      // Per opzione; il «tutto o niente» lo applica `optionFurigana` DOPO aver
      // aggiunto le letture esplicite delle glosse.
      return options.map((option) => {
        const runs = toRuns(option);
        if (runs.every((r) => r.literal)) return null;
        return segmentsOf(runs, runs.map((r) => (r.literal ? null : known.get(r.text) ?? null)));
      });
    }
    default: {
      const _exhaustive: never = exercise;
      void _exhaustive;
      return [];
    }
  }
}
