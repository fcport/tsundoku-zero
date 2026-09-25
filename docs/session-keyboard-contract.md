# Il contratto tastiera della sessione (aggiornamento di AD-15)

Questo documento è la fonte del **contratto tastiera** della schermata di esercizio,
registrato come **aggiornamento di AD-15** — non come convenzione locale sparsa nel
codice. Segue lo stesso precedente durevole di `docs/i18n-boundary.md` per AD-14: un
file di documentazione con un test che ne verifica esistenza e contenuti.

## Sostituisce il vecchio contratto

Il vecchio contratto di AD-15 diceva **«spazio rivela, `1`-`4` valutano»**. Non
descrive più niente: descriveva un'**autovalutazione** (l'utente dichiarava la
difficoltà con i tasti `1`-`4`) che il prodotto non ha più — l'esito è **calcolato,
non dichiarato** (AD-24). E la scala non poteva essere fissa a `1`-`4`, perché
`assemble` (AD-22) è un **ordinamento**, non una selezione singola: il contratto deve
coprire tre interazioni diverse (`single-select`, `select-span`, `assemble`).

Questo documento **sostituisce** quel contratto per intero.

## Il contratto

### 1. Tasto numerico → posizione (stessa associazione per ogni tipo)

Un tasto numerico `1`-`9` seleziona l'opzione alla **posizione corrispondente**:
`'1'` → prima opzione, `'2'` → seconda, ... L'associazione numero↔posizione è la
**stessa** per single-select, select-span e assemble: per costruzione, perché la
regola vive in una sola funzione **pura e agnostica al tipo**,
`keyboardSelectionIndex(key, optionCount)` in `src/domain/keyboard.ts`, che riceve la
stringa del tasto e il numero di opzioni — mai il tipo di esercizio. L'ordine delle
opzioni è quello del dominio (`answerOptions`), che è anche l'ordine di lettura e
l'ordine di tabulazione.

Per `assemble` il tasto **aggiunge** la tessera alla sequenza (append in ordine, come
il click); una tessera già scelta è saltata. Per gli altri tipi il tasto sceglie
l'unica opzione. Il tasto numerico chiama la **stessa** funzione di risposta del
click: nessuna seconda pipeline. È attivo solo in fase di **consegna** (prima di
rispondere); i tasti con `Ctrl`/`Meta`/`Alt` sono ignorati per non dirottare le
scorciatoie del browser.

### 2. Comportamento di overflow (dichiarato)

La **fila numerica** copre le posizioni `1`-`9` (`NUMERIC_ROW_SIZE = 9`). Il
comportamento oltre la fila è **dichiarato esplicitamente**, non indefinito:

- Una cifra **senza opzione corrispondente** (es. `'4'` con 3 opzioni) è un **no-op**.
- Le opzioni **oltre la nona** non sono raggiungibili da tasto numerico: si
  raggiungono con `Tab` + `Enter`/`Space` (il percorso di focus, sempre valido per
  ogni opzione).
- `'0'`, ogni tasto non-cifra e la stringa vuota sono no-op.

### 3. Una sola live region

Esiste **esattamente una** live region `aria-live="polite"` per l'intera sessione,
resa solo nel ramo di sessione **attiva** (con la card). Annuncia l'**esito** della
risposta più l'**avanzamento** (`{{completed}} di {{total}}`). È `sr-only` (l'esito
visibile lo porta già l'`ExplanationPanel`, l'avanzamento la barra). **Non** è resa su
scheletro, completamento o stato vuoto — così resta una sola per l'intera sessione.

### 4. Tab-order = ordine di lettura = ordine dei tasti numerici

L'ordine dei nodi interattivi nel DOM è l'ordine di `answerOptions` (dominio), che è
anche l'ordine di lettura e l'ordine dei tasti numerici. Nessun `tabindex` positivo.

### 5. Anello di focus visibile

Ogni elemento interattivo della sessione (opzioni, «mostra la spiegazione»,
«prossimo esercizio», «esci») mostra un **anello di focus visibile** via `focus-visible:`
col token `focus-ring` (in scuro `accent-dark`, cfr. `src/ui/theme.css`).

### 6. `Enter` avanza, `Esc` esce

In fase di **spiegazione** (dopo aver risposto), `Enter` con target non interattivo
(non un `<button>`/`<a>`/input) avanza al prossimo esercizio; sul bottone focalizzato
agisce l'attivazione nativa (nessun doppio avanzamento). `Esc` esce dalla sessione in
qualunque fase (già parte del contratto dalla storia 3.20, ora unificato in un solo
listener `keydown` a livello window).

## Fuori scope

L'anello di focus **app-wide** (auth/settings/shell) è DW-10, di competenza
dell'audit di accessibilità (storia 7.6). La verifica manuale con **screen reader
reale** (NVDA/VoiceOver) è anch'essa competenza della 7.6, non di questa storia.
