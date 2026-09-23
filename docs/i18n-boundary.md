# Il confine a tre di AD-14

Nessuna stringa d'interfaccia visibile è cablata nel codice. La regola è imposta
**meccanicamente** dal compilatore (`tsc` strict): le chiavi i18n sono tipizzate
via declaration merging su `CustomTypeOptions` di i18next, così che `t()` con una
chiave inesistente sia un **errore di compilazione**, non un fallimento a runtime
(vedi `src/i18n/i18next.d.ts` e `src/i18n/en.ts`).

Ma non tutto il testo reso passa dal traduttore. Il confine ha **tre lati**, e
ogni testo appartiene a uno solo di essi:

## 1. Interfaccia — da `t()`

Ogni stringa d'interfaccia (etichette, messaggi, titoli, testo dei bottoni) passa
dal traduttore tipizzato `t()`, con chiavi definite nei cataloghi `src/i18n/en.ts`
e `src/i18n/it.ts` (stesso insieme di chiavi, parità verificata da test). È il
livello `src/i18n/` — e solo lui — a importare `i18next`/`react-i18next`;
`ui`/`features` ricevono `t`/`useTranslation` dal re-export (archi AD-1). Oggi il
catalogo è minimo (`app.tagline`); i consumatori d'interfaccia arrivano con
l'autenticazione (storia 1.6+).

## 2. Contenuto delle lezioni — dal file di lezione

Il contenuto didattico (frasi, esercizi, spiegazioni delle lezioni) **non** passa
da `t()`: è dato di contenuto, non stringa d'interfaccia, e vive nel proprio file
di lezione. Tradurlo con `t()` confonderebbe due assi distinti (la lingua
dell'interfaccia contro la lingua/contenuto della lezione).

In Epic 1 questo lato **non ha ancora consumatori**: il contenuto delle lezioni
arriva in Epic 2. Il confine è però documentato e imposto già qui, perché AD-14
si autoimpone da questo punto in avanti invece di diventare un'epica di pulizia
finale.

## 3. Giapponese — da nessuno dei due

Il giapponese reso come tale (a partire dal nome proprio del prodotto,
積ん読ゼロ) è **dato**: non passa da `t()` **né** dal file di lezione. Il nodo che
lo contiene porta l'attributo `lang="ja"` (per la resa tipografica e
l'accessibilità), e **nessun carattere CJK** compare nei cataloghi `en`/`it`
(verificato da test). Non si introduce romaji.

Esempio nel codice (`src/ui/App.tsx`):

```tsx
<h1 lang="ja">積ん読ゼロ</h1>   {/* dato: giapponese, mai da t() */}
<p>{t('app.tagline')}</p>       {/* interfaccia: da t() */}
```
