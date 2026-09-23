---
name: Tsundoku Zero
description: Ripetizione dilazionata per il vocabolario JLPT N5. Carta e inchiostro, una sola azione, il giapponese è l'eroe. Nessuna mascotte, nessuna celebrazione.
status: final
sources:
  - '{planning_artifacts}/prds/prd-tsundoku-zero-2026-08-19/prd.md'
  - '{planning_artifacts}/architecture/architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md'
updated: 2026-08-19
colors:
  surface-base: '#FAF7F0'
  surface-raised: '#FFFFFF'
  surface-sunken: '#F1ECE1'
  ink-primary: '#1C1A17'
  ink-secondary: '#6B6459'
  ink-muted: '#797065'
  border-hairline: '#E3DCCE'
  border-strong: '#9B8D7B'
  accent: '#1F4A7A'
  accent-hover: '#173A61'
  accent-subtle: '#E8EEF6'
  danger: '#9B3A2F'
  danger-subtle: '#F7E9E6'
  focus-ring: '#2F6FB0'
  surface-base-dark: '#161513'
  surface-raised-dark: '#1F1E1B'
  surface-sunken-dark: '#100F0E'
  ink-primary-dark: '#F2EEE6'
  ink-secondary-dark: '#A8A196'
  ink-muted-dark: '#8D8477'
  border-hairline-dark: '#332F2A'
  border-strong-dark: '#70675B'
  accent-dark: '#7FB0DC'
  accent-hover-dark: '#9CC4E6'
  accent-subtle-dark: '#1B2A38'
  danger-dark: '#E08476'
  danger-subtle-dark: '#38211E'
  focus-ring-dark: '#7FB0DC'
typography:
  word-hero:
    fontFamily: Noto Sans JP
    fontSize: 64px
    fontWeight: '500'
    lineHeight: '1.75'
  word-hero-mobile:
    fontFamily: Noto Sans JP
    fontSize: 44px
    fontWeight: '500'
    lineHeight: '1.8'
  word-ruby:
    fontFamily: Noto Sans JP
    fontSize: 0.42em
    fontWeight: '400'
    letterSpacing: 0.04em
  reading:
    fontFamily: Noto Sans JP
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.5'
  meaning:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '400'
    lineHeight: '1.45'
  count-hero:
    fontFamily: Inter
    fontSize: 72px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: -0.03em
  count-hero-mobile:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: -0.03em
  display:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.25'
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.08em
  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  attribution:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  '8': 64px
  gutter-mobile: 20px
  gutter-desktop: 32px
  measure: 34rem
  thumb-zone: 120px
components:
  button-primary:
    background: '{colors.accent}'
    color: '{colors.surface-raised}'
    radius: '{rounded.md}'
    paddingBlock: '{spacing.4}'
    minHeight: 56px
    typography: '{typography.label}'
  rating-button:
    background: '{colors.surface-raised}'
    color: '{colors.ink-primary}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.md}'
    minHeight: 56px
    typography: '{typography.label}'
  rating-button-again:
    background: '{colors.danger-subtle}'
    color: '{colors.danger}'
    border: '1px solid {colors.danger}'
    radius: '{rounded.md}'
    minHeight: 56px
    typography: '{typography.label}'
  study-card:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.border-hairline}'
    radius: '{rounded.lg}'
    padding: '{spacing.6}'
  pile-counter:
    typography: '{typography.count-hero}'
    color: '{colors.ink-primary}'
  progress-meter:
    track: '{colors.surface-sunken}'
    fill: '{colors.accent}'
    height: 4px
    radius: '{rounded.full}'
  attribution-bar:
    typography: '{typography.attribution}'
    color: '{colors.ink-muted}'
    borderTop: '1px solid {colors.border-hairline}'
    paddingBlock: '{spacing.3}'
  sync-indicator:
    typography: '{typography.caption}'
    color: '{colors.ink-muted}'
    radius: '{rounded.full}'
---

## Brand & Style

積ん読 è la pila di libri comprati e non letti. Il nome del prodotto promette di svuotarla, e l'identità visiva non deve promettere niente di più.

Tsundoku Zero si presenta come **carta e inchiostro**: un fondo caldo non bianco, testo nero-inchiostro, una sola tinta d'accento che si guadagna la presenza comparendo raramente. Il calore viene dal fondo e dalla generosità dello spazio, non dal colore e non da un personaggio.

Questa è una scelta contro il riferimento dichiarato. Renshuu — che l'owner ama — costruisce la sua identità su una mascotte disegnata a mano, pastelli e gamification. Federico ne ha preso **la struttura** (obiettivi finiti e completabili, visibili all'apertura) e **rifiutato l'identità**. La distinzione governa ogni decisione qui sotto: dove Renshuu aggiunge un personaggio, Tsundoku Zero aggiunge silenzio.

C'è una seconda ragione, e viene dal PRD. L'anti-pattern dichiarato è *"molto difficile da capire"*, e Renshuu ne dichiara la causa in vetrina come pregio: **everything can be adjusted or disabled**. La configurabilità totale è ciò che rende un prodotto opaco. Qui la difesa è strutturale: una schermata mostra una cosa, `FR3.3` ammette una sola azione primaria, e non esiste un pannello di personalizzazione visiva.

Il contenuto giapponese è l'eroe tipografico. Tutto ciò che non è giapponese si fa piccolo, grigio e si toglie di mezzo.

## Colors

Il sistema ha **una sola tinta d'accento** e **una sola tinta di allarme**. Non ce ne sono altre, e l'assenza è il punto.

- **`{colors.surface-base}`** — 生成り, tessuto non tinto. Il fondo di ogni schermata. Non è bianco di proposito: alle 8:10 in metropolitana un bianco puro a piena luminosità è aggressivo, e questa app si apre appena svegli.
- **`{colors.surface-raised}`** — il bianco vero, riservato alla card di studio. È l'unica superficie che si stacca dal fondo, perché è l'unica cosa che conta mentre è visibile.
- **`{colors.surface-sunken}`** — il binario della barra di avanzamento e i fondali degli stati vuoti. Più scuro del fondo: incavato, non sollevato.
- **`{colors.ink-primary}`** — 墨, inchiostro. Testo giapponese, significati, numeri. Non è nero puro: il nero puro su carta calda vibra.
- **`{colors.ink-secondary}`** — etichette, metadati, testo di supporto.
- **`{colors.ink-muted}`** — attribuzione del dataset, timestamp, testo che deve esserci per obbligo ma non deve competere. **Non usare per testo che l'utente deve leggere per agire.**

  Il valore è vincolato dal contrasto, non dal gusto: a `4.54:1` su `{colors.surface-base}` è il grigio **più chiaro** che superi ancora AA. La prima stesura usava `#9A9287`, che stava a `2.87:1` — visivamente più elegante e non conforme, sull'unico testo che una licenza obbliga a mostrare. La recessività qui la portano il corpo e il peso, non il colore.
- **`{colors.border-hairline}`** — separazione **decorativa**: divisori, bordo della barra di attribuzione. A `1.27:1` non è conforme a un requisito di contrasto, e non deve esserlo: WCAG 1.4.11 esenta gli elementi puramente decorativi. **Non usarlo mai come unico confine di un componente interattivo.**
- **`{colors.border-strong}`** — confine di componente interattivo: `rating-button`, campi di input. A `3.02:1` supera 1.4.11. La distinzione fra i due bordi esiste perché i quattro pulsanti di valutazione vanno colpiti a una mano su un treno in movimento, e un contorno che sparisce a piena luminosità è un bersaglio che sparisce.
- **`{colors.accent}`** — 紺, indaco scuro. Significa **una sola cosa: "questo fa avanzare"**. L'azione primaria della dashboard, il riempimento della barra di avanzamento, il link attivo. Non usato per bordi decorativi, non per titoli, mai due volte nella stessa schermata come richiamo all'azione — `FR3.3` lo vieta di fatto.
- **`{colors.accent-subtle}`** — tinta d'accento per fondali di stato informativo. L'unico uso ammesso dell'indaco che non sia un'azione.
- **`{colors.danger}`** — 茜, robbia. Significa **una sola cosa: "questo ti riporta indietro"**. L'esito `again` e i messaggi di errore di `FR1.5`. Non è "male": `again` è una risposta onesta e legittima, e il colore deve dire *conseguenza*, non *colpa*.

**Cosa non esiste in questo sistema, deliberatamente:** nessun verde. Lo stato di completamento — la pila a zero, `FR4.4` — usa l'accento e lo spazio bianco, non una spunta verde. Un verde di successo introdurrebbe la grammatica della celebrazione, che è esattamente ciò che è stato rifiutato scegliendo A e non B.

**Modalità scura.** Ratificata: entra in v1 come **pari**, non come opzione secondaria, perché la persona di `§4` studia sul portatile la sera. I token `*-dark` sono l'insieme completo; nessun colore ha la sua unica definizione dentro un blocco scuro.

Segue `prefers-color-scheme` e **non ha un interruttore**: le impostazioni restano due, e il tema non è la terza. Vale a una condizione, imposta da `UX-DR1`: **nessun componente scrive un colore letterale**. A quella condizione la modalità scura è uno scambio di variabili; senza, è una riscrittura per componente.

## Typography

Due famiglie, con confine netto e motivato.

| Ruolo | Famiglia | Perché |
|---|---|---|
| Contenuto giapponese | **Noto Sans JP** | Copertura kanji/kana completa, licenza aperta, servita da Google Fonts. È l'unica famiglia gratuita con copertura piena che si possa servire senza self-hosting. Marcata `lang="ja"` per `AD-14` |
| Interfaccia latina (en/it) | **Inter** | Neutra, altezza-x generosa, tiene bene agli 11px dell'attribuzione — il corpo più piccolo del sistema, e quello che una licenza obbliga a rendere leggibile |

**La scala del giapponese è l'evento della pagina.** `{typography.word-hero}` a 64px non è vanità: la card di studio contiene una parola sola, e quella parola è tutto il motivo per cui l'utente ha aperto l'app. Su mobile scende a `{typography.word-hero-mobile}`.

**Il `lineHeight` di `1.75` su `{typography.word-hero}` è funzionale, non estetico.** Serve spazio sopra il glifo per la furigana. Con un'interlinea normale il ruby collide con la riga precedente o viene tagliato.

**Il valore è deciso ma non ancora misurato**, ed è l'unico numero di questo documento in quel dubbio. Va confermato sul rendering reale prima di chiudere la storia della card di studio, sui tre casi che `AD-21` distingue: nucleo con okurigana (難しい), prefisso kana (お茶) e ruby di gruppo su nucleo lungo (日本語). Se collide, si alza qui — non si accorcia la furigana, che ha già il suo minimo di leggibilità a `0.42em`.

**Furigana** — `{typography.word-ruby}` a `0.42em` del corpo base. Sotto il 40% diventa illeggibile ai corpi mobile; sopra il 50% compete con la parola invece di annotarla.

**La scala latina è volutamente corta.** Sette ruoli oltre alla furigana. Un'interfaccia a sei schermate che ne usasse dodici starebbe descrivendo un prodotto che non esiste.

`{typography.count-hero}` esiste per un numero solo: quanti item sono dovuti. È il numero più grande dell'applicazione, più grande del titolo della schermata, e ha una ragione — è la quest.

`{typography.attribution}` a 11px è il corpo minimo del sistema. Serve `AD-16`, che impone l'attribuzione EDRDG/JMdict su **ogni** schermata che mostra voci del vocabolario. Deve essere leggibile e non deve competere; 11px in `{colors.ink-muted}` è il compromesso, e a quel corpo **non esiste alcuna soglia di contrasto agevolata** — 11px non raggiunge la definizione WCAG di testo grande in nessuna combinazione di peso. Serve `4.5:1` pieno, ed è la ragione per cui `{colors.ink-muted}` è più scuro di quanto l'occhio vorrebbe. **Non scendere sotto**, ed è un obbligo di licenza, non una preferenza.

## Layout & Spacing

Scala a 4px, mobile-first. Gutter `{spacing.gutter-mobile}` sotto 640px, `{spacing.gutter-desktop}` sopra.

Colonna di lettura limitata a `{spacing.measure}`. Su portatile il contenuto non si allarga: si centra. Una card di studio larga 1200px con una parola dentro è una schermata progettata male in cerca di contenuto che non arriverà.

**`{spacing.thumb-zone}` è un vincolo derivato da UJ-1.** Il percorso dichiarato è *metropolitana, 8:10, una mano*. I quattro pulsanti di valutazione vivono nella fascia inferiore dello schermo su mobile, entro 120px dal bordo basso, mai in cima. La parola sta in alto, la mano sta in basso, e non si incontrano.

Ogni bersaglio interattivo è alto almeno 56px. Nessuna eccezione su mobile.

## Elevation & Depth

**Il sistema non ha ombre.** La separazione si ottiene con i bordi e con il salto tonale fra `{colors.surface-base}` e `{colors.surface-raised}`.

I bordi sono **due, e non sono intercambiabili**: `{colors.border-hairline}` separa, `{colors.border-strong}` delimita qualcosa che si tocca. Scegliere il primo dove serviva il secondo è il modo in cui questo sistema fallisce l'accessibilità senza che si veda in una revisione visiva.

È coerente con la metafora della carta, ma la ragione vera è un'altra: le ombre sono il modo più comune di far sembrare "progettata" una schermata vuota. Qui le schermate vuote sono un risultato desiderato — la pila a zero è la vittoria — e non vanno mascherate.

## Shapes

Raggi contenuti: `{rounded.sm}` per i tag, `{rounded.md}` per pulsanti e campi, `{rounded.lg}` per la card di studio. `{rounded.full}` solo per la barra di avanzamento e la pastiglia dello streak.

La moderazione è deliberatamente in opposizione al riferimento: la forma-firma di Renshuu è il rettangolo molto stondato con bordo nero spesso, da fumetto. Ereditare quella forma reintrodurrebbe dalla porta di servizio l'identità che è stata rifiutata scegliendo A.

## Components

**`pile-counter`** — Il numero degli item dovuti in `{typography.count-hero}`, con l'etichetta in `{typography.label-caps}` **sotto**, non sopra. Il numero arriva per primo all'occhio. A zero il numero non diventa "0": la dashboard cambia stato (vedi `EXPERIENCE.md`, State Patterns).

**`button-primary`** — Piena larghezza su mobile, `{colors.accent}` pieno. **Ne esiste al massimo uno per schermata**, imposto da `FR3.3`. Testo verbale e concreto, mai "Continua".

**`rating-button`** — Quattro, in riga singola, ordine fisso `again` · `hard` · `good` · `easy` da sinistra a destra, coerente con i tasti `1`–`4` di `AD-15`. Tre sono neutri e identici; **solo `again` porta colore**, tramite `rating-button-again`.

Questa asimmetria è una decisione, e va difesa così: la tinta è il canale più debole per codificare un dato ordinato ed è il peggiore per chi ha una deficienza cromatica. L'ordine è già codificato da posizione, etichetta e numero — tre canali. Il colore resta libero per l'unico bit che ha una conseguenza reale: *questo item torna allo stadio 0*.

**`study-card`** — L'unica superficie `{colors.surface-raised}` dell'app. Contiene il prompt e, dopo la rivelazione, lettura e significato.

**`progress-meter`** — Alta 4px, senza etichetta numerica accanto. Serve `FR4.5`. Si riempie verso destra man mano che la pila si svuota: la barra rappresenta **il completato**, non il rimanente, perché la quest è arrivare a zero.

**`attribution-bar`** — Fissa in fondo al layout di dashboard, studio e statistiche. Governata da `AD-16`. Non è localizzabile in modo da poter sparire, e non è comprimibile dietro un "About".

**`sync-indicator`** — Serve `FR9.4`: visibile ma non invasivo. Pastiglia in `{typography.caption}` e `{colors.ink-muted}`, in alto. **Non usa `{colors.danger}`**: una valutazione in coda non è un errore, è il funzionamento previsto di `F9`.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Un solo `{colors.accent}` per schermata, sull'azione che fa avanzare | Accento su titoli, bordi, icone decorative |
| Stato di completamento con spazio e accento | Verde, spunte, coriandoli, animazioni celebrative |
| Giapponese in `{typography.word-hero}`, tutto il resto sotto i 28px | Titolo di schermata più grande del contenuto giapponese |
| `lang="ja"` su ogni nodo che contiene giapponese (`AD-14`, `AD-15`) | Giapponese dentro le stringhe i18n — è dato, non interfaccia |
| Attribuzione presente su dashboard, studio e statistiche | Attribuzione in una sola pagina "About" — viola la licenza EDRDG |
| `{colors.border-hairline}` per separare, `{colors.border-strong}` per delimitare ciò che si tocca | Ombre, glow, gradienti — e hairline come unico confine di un bersaglio |
| Verificare il contrasto con un calcolo, sui **due** fondi (base e card) | Fidarsi dell'occhio: `{colors.ink-muted}` sembrava giusto a `2.87:1` |
| Pulsanti di valutazione nella fascia bassa su mobile | Valutazione in cima allo schermo |
| `again` è l'unico pulsante colorato | Quattro pulsanti in quattro tinte diverse |
| Modalità scura come pari, definita per intero | Colori definiti solo dentro un blocco scuro |
