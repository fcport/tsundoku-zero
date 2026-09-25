// Livello ui: il PRIMITIVO che RENDE una frase giapponese già allineata come
// ruby accessibile (3.11). AD-1 (imposto in CI: `ui → ['ui','i18n']`) vieta a
// `src/ui/` OGNI import da `domain`, TIPI inclusi (`alwaysTryTypes`): perciò il
// componente DICHIARA il proprio tipo strutturale `RubySegment`, identico a
// `FuriganaSegment` (3.6). L'output di `alignFurigana()` vi fluisce per
// COMPATIBILITÀ STRUTTURALE (tipizzazione strutturale di TypeScript), senza
// alcuna dipendenza nominale — stesso spirito di `AuthForm`, che riceve chiavi
// i18n invece di raggiungere l'i18n.
//
// Rende SOLO i segmenti ricevuti, VERBATIM: nessuna logica di allineamento
// (AD-21 vive in `src/domain/furigana.ts`, non qui), nessun romaji (UX-DR25).
// L'involucro porta `lang="ja"` (AD-14/UX-DR24: il giapponese è DATO, non passa
// da i18n) SEMPRE, anche quando la furigana è nascosta. `<rt>` è
// `aria-hidden="true"` (UX-DR28: uno screen reader con voce giapponese legge già
// il testo base; un `<rt>` non nascosto lo farebbe leggere due volte), con `<rp>`
// di ripiego a parentesi dove il browser non supporta il ruby.
//
// La VISIBILITÀ arriva già risolta come `showFurigana: boolean` (dal resolver
// `furiganaVisible` del dominio, 3.11/AC5): con `false` il componente rende il
// solo testo base (nessun `<rt>`), l'involucro resta `lang="ja"`.
import { Fragment } from 'react';

/**
 * Un segmento allineato da RENDERE: `text` da mostrare e la sua lettura kana
 * `ruby` sopra, oppure `null` se il segmento non porta ruby. STRUTTURALMENTE
 * identico a `FuriganaSegment` (3.6): l'output di `alignFurigana()` vi fluisce
 * senza cast e senza import da `domain` (AD-1).
 *
 * Un `ruby` FALSY — `null` OPPURE la stringa vuota `''` — significa «nessun
 * ruby»: il segmento è reso come solo testo base, mai come annotazione ruby
 * vuota.
 */
export interface RubySegment {
  readonly text: string;
  readonly ruby: string | null;
}

/**
 * Props di `JapaneseText`: i segmenti GIÀ allineati e la visibilità GIÀ risolta.
 * Il componente non allinea né decide il predefinito — riceve entrambi (AD-21,
 * `furiganaVisible`).
 */
export interface JapaneseTextProps {
  readonly segments: readonly RubySegment[];
  readonly showFurigana: boolean;
}

/**
 * Rende i segmenti VERBATIM dentro un unico `<span lang="ja">`, nell'ordine
 * ricevuto. Per ciascun segmento: se la furigana è visibile E il segmento porta
 * un `ruby` NON FALSY (né `null` né `''`) ⇒
 * `<ruby>{text}<rp>(</rp><rt aria-hidden="true">{ruby}</rt><rp>)</rp></ruby>`;
 * altrimenti il SOLO `{text}` (in un `<Fragment>` per la chiave di lista) —
 * così un `ruby` vuoto non produce mai un'annotazione ruby vuota. Nessuna
 * logica di allineamento, nessun romaji.
 */
export function JapaneseText({ segments, showFurigana }: JapaneseTextProps) {
  return (
    <span lang="ja">
      {segments.map((seg, i) =>
        showFurigana && seg.ruby ? (
          <ruby key={i}>
            {seg.text}
            <rp>(</rp>
            <rt aria-hidden="true">{seg.ruby}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </span>
  );
}
