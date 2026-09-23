---
name: 'Tsundoku Zero — UX Delta'
type: ux-contract-delta
purpose: input-to-epics
status: draft
created: '2026-09-22'
supersedes_partially:
  - '../ux-tsundoku-zero-2026-08-19/DESIGN.md'
  - '../ux-tsundoku-zero-2026-08-19/EXPERIENCE.md'
sources:
  - '_bmad-output/planning-artifacts/prds/prd-tsundoku-zero-2026-09-22/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-tsundoku-zero-2026-09-22/SPINE-DELTA.md'
---

# UX Delta — pivot alla grammatica strutturale

Documento di transizione, non un contratto completo. Dice **cosa resta, cosa muore e cosa manca** nella coppia `DESIGN.md` + `EXPERIENCE.md` del 19 agosto, che resta valida per tutto ciò che non è elencato qui.

Le voci `[DA DECIDERE]` sono rimandate **dopo l'autorazione di tre lezioni vere**, per la stessa ragione registrata in `OQ-7` del PRD: dipendono da quali tipi di esercizio esistono davvero, e deciderle a tavolino significa indovinare.

---

## 1. Il rovesciamento che governa tutto il resto

Nel prodotto vecchio la card mostrava **una parola** e l'utente dichiarava quanto bene la ricordasse. Nel prodotto nuovo la card mostra **una frase** e l'utente sceglie una risposta che è oggettivamente giusta o sbagliata.

Da questo rovesciamento discendono tre conseguenze, e ognuna rompe qualcosa:

1. L'autovalutazione sparisce (`FR5.2`) → muore `rating-button`
2. Il prompt passa da parola a frase → la scala tipografica dell'eroe non regge
3. Alla risposta segue una spiegazione (`FR4.3`) → la card passa da due stati a tre

Tutto il resto del contratto UX sopravvive.

---

## 2. Design token — verdetto

**I 27 token colore sopravvivono interi.** Nessun valore cambia, la modalità scura resta pari e senza interruttore, la verifica del contrasto per calcolo su entrambi i fondi resta obbligatoria. Il fondo carta, l'inchiostro non nero, l'accento unico e l'assenza di ombre sono decisioni di identità che il pivot non tocca.

**La scala di spaziatura, i raggi e i due token di bordo sopravvivono interi.** `border-strong` cambia solo destinatario: delimitava i quattro pulsanti di valutazione, ora delimita i pulsanti di risposta. `thumb-zone` resta un vincolo derivato da UJ-1, che il pivot non ha cambiato.

**La scala tipografica ha un problema reale, ed è il ritrovamento meno atteso di questa revisione.**

`word-hero` è 64px con interlinea `1.75`, e il documento ne difende esplicitamente la dimensione: *"la card di studio contiene una parola sola, e quella parola è tutto il motivo per cui l'utente ha aperto l'app"*.

La premessa è appena caduta. Una card di esercizio contiene una **frase**: 日本語がわかります è nove caratteri. A 64px sono circa 576px di larghezza, oltre il limite di colonna `measure` (34rem ≈ 544px) — e questo prima di aggiungere la furigana. Su mobile, a `word-hero-mobile` 44px, va a capo due volte su un telefono stretto.

Serve un **ruolo nuovo per il giapponese di frase**, distinto da quello di parola singola. Non è una rifinitura: senza, la prima schermata di esercizio o sfonda la colonna o manda a capo la frase in punti arbitrari, che su una lingua senza spazi fra le parole è attivamente dannoso — spezzare 日本語 fra 本 e 語 cambia quello che l'occhio legge.

`[DA DECIDERE]` Corpo e interlinea del nuovo ruolo, e se `word-hero` sopravviva per gli esercizi che presentano una parola sola. Dipende da quanto sono lunghe le frasi reali, che è una cosa che si misura sulle prime tre lezioni, non si stima.

Ne discende che anche la verifica empirica dell'interlinea `1.75` — l'unico numero che `DESIGN.md` dichiarava deciso ma non misurato — va rifatta sul ruolo nuovo, non su `word-hero`.

---

## 3. Componenti — verdetto sui nove

| Componente | Sorte |
|---|---|
| `pile-counter` | **Intatto.** Conta esercizi invece di item; la regola — a zero non mostra "0", la dashboard cambia stato — è identica |
| `button-primary` | **Intatto.** Uno per schermata, etichetta che cambia con lo stato della pila |
| `study-card` | **Rinominato ed esteso** → `exercise-card`, da due stati a tre |
| `rating-button` ×4 | **Morto.** Era il componente dell'autovalutazione |
| `rating-button-again` | **Morto** con il precedente. La *tecnica* sopravvive, vedi sotto |
| `progress-meter` | **Intatto.** Rappresenta il completato, riflette lo stato ottimistico locale |
| `attribution-bar` | **Declassato.** Da presenza obbligatoria su tre layout a pagina di riconoscimenti (`FR10.2`) |
| `sync-indicator` | **Intatto.** Deriva da `useMutationState`, assente a coda vuota, non usa `danger` |
| `empty-state` | **Intatto.** Dichiara perché è vuoto, al massimo un'azione |
| `streak-badge` | **Intatto.** Derivato da `review_log` a ogni lettura |

**Sette su nove sopravvivono.** I due che muoiono sono entrambi l'autovalutazione.

### Componenti nuovi

- **`answer-option` ×n** — sostituisce `rating-button`. Differenza strutturale, non cosmetica: i pulsanti di valutazione erano **sempre quattro, in ordine fisso**; le opzioni di risposta sono di numero variabile secondo il tipo di esercizio. Ogni assunzione di layout che dipendeva dal quattro va rifatta.
- **`explanation-panel`** — la spiegazione di `FR2.2`, mostrata dopo la risposta (`FR4.3`) o consultata prima (`FR4.8`). È l'unico contenuto di prosa lunga dell'applicazione: la scala latina attuale non ha un ruolo pensato per un paragrafo, ha `body` a 16px che va verificato su testo vero.
- **`curriculum-progress`** — `FR3.6`, quante lezioni sbloccate su quante esistono. Non ha precedente nel contratto vecchio.

`[DA DECIDERE]` Forma, disposizione e numero massimo di `answer-option`. Vincolo noto e non negoziabile: bersagli da 56px dentro `thumb-zone` su mobile. Se un tipo di esercizio richiedesse sei opzioni, il vincolo si scontra con l'altezza dello schermo, ed è una ragione per tenere basso il numero di opzioni — cioè un vincolo di UX che ricade sul *contenuto*, e va detto a chi autora.

### La domanda del colore, che è più seria di come sembra

`DESIGN.md` dichiara: **nessun verde nel sistema**, perché il verde di successo introdurrebbe la grammatica della celebrazione, rifiutata. Lo stato di completamento usa spazio e accento.

Il pivot introduce qualcosa che prima non esisteva: **una risposta può essere sbagliata, oggettivamente**. Se l'interfaccia colora di rosso l'errore, il sistema diventa asimmetrico nella direzione peggiore — nessuna ricompensa per il successo, ma una punizione per l'errore. Sarebbe un tradimento della postura, non un'applicazione.

Il contratto vecchio aveva già la risposta giusta per un caso analogo, ed è riusabile: *"il colore deve dire conseguenza, non colpa"*, e l'item ripresentato nella stessa sessione non porta **alcuna segnalazione**, perché *"marcarlo già sbagliato aggiunge vergogna a un meccanismo che esiste per essere neutro"*.

`[DA DECIDERE]` Come si comunica l'esito di una risposta. Vincolo ereditato: la soluzione non può essere verde per il giusto e rossa per lo sbagliato. La direzione da esplorare è che **la spiegazione sia la risposta** — si mostra cosa è vero, non come ti devi sentire — e che l'esito si legga dal contenuto invece che dalla tinta.

---

## 4. State pattern — verdetto sui tredici

| Stato | Sorte |
|---|---|
| Caricamento a freddo | **Intatto** — scheletro all'altezza finale, nessuno spinner |
| Primo avvio, mai studiato | **Intatto** nella logica, cambia il testo: l'azione è "sblocca la prima lezione" |
| Pila piena | **Intatto** |
| Pila a zero, materiale disponibile | **Intatto** nella logica: quest 1 chiusa, quest 2 aperta. Quest 2 è ora *sblocca la lezione successiva* |
| Pila a zero, materiale esaurito | **Intatto** — resta l'unica schermata senza azione primaria, ora significa "curriculum finito" |
| Tetto giornaliero raggiunto | **Intatto**, conta lezioni invece di item |
| Sessione in corso | **Intatto** |
| Item ripresentato senza segnalazione | **Intatto**, e più importante di prima (vedi §3 sul colore) |
| Coda vuota → completamento | **Intatto** |
| Sessione abbandonata | **Intatto** — nessun "riprendi dove eri", la sessione si ricostruisce |
| Rete assente durante la sessione | **Intatto** |
| Riapertura con coda non svuotata | **Intatto** |
| Dati insufficienti nelle statistiche | **Intatto** |
| Errore prevedibile di autenticazione | **Intatto** |

**Quattordici stati, tutti sopravvivono**, alcuni con il testo da riscrivere. Nessuno muore. Il pivot non ha toccato la macchina a stati della dashboard, che è la cosa che la struttura a quest aveva progettato bene.

### Stati nuovi da progettare

- **Lezione senza esercizi sbloccata** (`FR2.4`, `FR6.4`) — la progressione avanza, la pila non si muove. Senza uno stato dedicato sembra che lo sblocco non abbia funzionato
- **Risposta data, spiegazione mostrata** (`FR4.3`) — il nuovo terzo stato di `exercise-card`
- **Spiegazione consultata prima di rispondere** (`FR4.8`) — l'interfaccia non deve far sentire l'utente in colpa per averla aperta: è un percorso previsto, e il suo unico effetto è sull'esito calcolato

---

## 5. Sezioni comportamentali — verdetto

**La struttura a quest sopravvive intera**, ed è la parte migliore del contratto vecchio. Due quest mai simultanee, sequenziate da un cancello, nessun pulsante grigio "non ancora". Cambia solo il nome della seconda: *introduci nuovi item* → *sblocca la lezione successiva*. Il cancello di `FR6.1` è identico.

**Voce e tono sopravvivono interi.** Le tre regole — il conteggio prima del verbo, nessun punto esclamativo né emoji né lode, un fallimento dice cosa è successo e non come sentirsi — valgono identiche, e la terza diventa più importante perché ora esistono risposte sbagliate. Due righe della tabella del microcopy vanno riscritte perché nominano gli item.

**Resilienza e sincronizzazione sopravvivono interi.** Nessun modale, nessun toast, nessun pulsante "riprova", indicatore che sparisce da solo. `FR5.2` la rende anzi più solida: l'esito si calcola sul client, quindi anche senza rete la risposta è valutata all'istante.

**Responsive sopravvive intero.** Tre breakpoint, telefono primario, contenuto centrato a `measure` senza allargarsi, nessuna funzione esclusiva di una superficie.

**Il pavimento di accessibilità sopravvive quasi intero.** WCAG 2.2 AA, `lang="ja"` ovunque, `<rt>` in `aria-hidden` con `<rp>`, una sola live region per sessione, anello di focus visibile, bersagli da 56px, contrasto verificato per calcolo. La verifica manuale su NVDA o VoiceOver resta obbligatoria e resta l'unica affermazione non coperta da test automatico.

Due voci cadono: *"i quattro esiti non si distinguono mai per solo colore"* e *"ordine di tabulazione: card, poi i quattro pulsanti"* nominano quattro pulsanti che non esistono più. Il **principio** va trasferito: nessuna opzione di risposta si distingue per solo colore, e l'ordine di tabulazione segue l'ordine di lettura e quello dei tasti numerici.

**Il contratto tastiera è morto.** *Spazio rivela, `1`–`4` valutano, Esc abbandona* — di queste tre, sopravvive solo Esc.

`[DA DECIDERE]` Il contratto nuovo. La forma probabile è *tasti numerici selezionano un'opzione, invio conferma, un tasto apre la spiegazione, Esc abbandona*, ma il numero variabile di opzioni la complica e non va fissata prima di sapere quanti tipi esistono. È un aggiornamento di `AD-15`, quindi passa anche dallo Spine.

### La furigana cambia significato, ed è una decisione di prodotto

Il contratto vecchio nascondeva la furigana nello stato prompt, con un argomento solido: *"la furigana è la risposta"*. Su una card di vocabolario è vero — `FR4.2` chiedeva di richiamare la lettura, e mostrarla annullava l'atto di richiamo.

**In un esercizio di grammatica non è più vero.** 日本語がわかります con la furigana visibile non rivela quale sia il soggetto: la lettura è supporto, non soluzione. Nasconderla per inerzia renderebbe gli esercizi inutilmente più difficili su un asse che non è quello misurato — si finirebbe a testare la lettura dei kanji mentre si crede di testare la grammatica.

`[DA DECIDERE]` Quando mostrare la furigana. Va deciso **per tipo di esercizio**, non globalmente: esiste almeno un caso in cui resta la risposta, ed è un ipotetico esercizio sulla lettura. La regola probabile — visibile per default, nascosta solo dove il tipo dichiara che la lettura è la soluzione — è un campo dello schema di lezione, quindi ricade su `AD-22`.

Resta invariato tutto il resto della sezione: `<ruby>`/`<rt>`/`<rp>`, `lang="ja"`, il romaji che non compare mai e non ha impostazione per riattivarlo, e `alignFurigana()` puro nel dominio con `src/ui/` che riceve segmenti già calcolati.

---

## 6. Cosa questo documento non decide

Consegnato alla prossima sessione UX come agenda, e tutto rimandato **dopo tre lezioni autorate**:

1. **Corpo e interlinea del ruolo tipografico di frase**, e se `word-hero` sopravviva per gli esercizi a parola singola (§2)
2. **Forma e numero massimo di `answer-option`**, con il vincolo dei 56px dentro `thumb-zone` (§3)
3. **Come si comunica l'esito**, senza verde per il giusto né rosso per lo sbagliato (§3)
4. **Il contratto tastiera**, che è anche un aggiornamento di `AD-15` (§5)
5. **Quando mostrare la furigana**, per tipo di esercizio, che ricade su `AD-22` e sullo schema di lezione (§5)

Le cinque hanno la stessa causa e la stessa condizione di sblocco. Nessuna è un dettaglio di rifinitura: la 1 e la 2 determinano se una schermata di esercizio sta fisicamente su un telefono, la 3 determina se il prodotto tradisce la propria postura, e la 5 determina se gli esercizi misurano la grammatica o la lettura dei kanji.
