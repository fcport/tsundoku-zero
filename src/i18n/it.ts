// Catalogo italiano: STESSO insieme di chiavi di `en` (parità ricorsiva,
// verificata da un test). Solo i valori cambiano. Se una chiave qui divergesse
// da `en`, la parità fallirebbe (test rosso). Nessun carattere CJK: il
// giapponese è dato, non passa da t().
export const it = {
  app: {
    tagline: 'Un generatore di esercizi di grammatica giapponese',
  },
  auth: {
    title: 'Registrazione',
    signInTitle: 'Accesso',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submit: 'Crea account',
    signInSubmit: 'Accedi',
    switchToSignIn: 'Hai già un account? Accedi',
    switchToSignUp: 'Non hai un account? Registrati',
    signOut: 'Disconnetti',
    error: {
      emailAlreadyRegistered: 'Questa email è già registrata.',
      invalidEmail: 'Inserisci un indirizzo email valido.',
      weakPassword: 'Scegli una password più forte.',
      wrongPassword: 'Password errata.',
      unknown: 'Qualcosa è andato storto. Riprova.',
    },
  },
  dashboard: {
    // Etichetta resa SOTTO il conteggio: il numero PRECEDE il verbo
    // ("23 da rivedere"), mai "hai 23". Nessun `!`, nessuna emoji, nessun
    // avverbio di lode (nessuna grammatica della celebrazione).
    dueLabel: 'da rivedere',
    // Streak: i giorni PRECEDONO il sostantivo ("7 giorni di fila"), neutro. La
    // variabile è `days` (non `count`), per non innescare il pluralizzatore di
    // i18next che richiederebbe chiavi `_one`/`_other` fuori dalla parità.
    streakLabel: '{{days}} giorni di fila',
    // Progresso del curriculum: sbloccate su totale.
    curriculumLabel: '{{unlocked}} di {{total}} lezioni',
    // L'UNICA azione primaria: verbale e concreta, mai "Continua".
    primaryAction: 'Svuota la pila',
    // L'azione di SBLOCCO (3.13): resa SOLO a pila vuota (il cancello). Verbale e
    // concreta, mai "Continua"; nessun `!`, nessuna emoji, nessun avverbio di lode.
    unlockAction: 'Sblocca la lezione successiva',
    // Dichiarazione della lezione CONCETTUALE (3.14): resa SSE la pila è a zero e
    // l'ultima lezione sbloccata non ha esercizi. Dichiara il fatto E il perché —
    // è concettuale, nulla da rivedere, la pila resta a zero, non è un fallimento.
    // Nessun `!`, nessuna emoji, nessun avverbio di lode, nessun verde/rosso.
    noExercisesNotice:
      'La lezione appena sbloccata non ha esercizi. È un concetto da leggere, quindi non è stato aggiunto nulla da rivedere e la pila resta a zero.',
    // Pila svuotata (3.16): resa SSE la pila è a zero, qualcosa è già sbloccato e
    // l'ultima sbloccata AVEVA esercizi (li hai risolti). Dichiara il perché la
    // pila è vuota — hai finito il ripasso di adesso, non un errore. Distinta da
    // noExercisesNotice (mai riempita) e da curriculumCompleteBody (niente altro
    // da sbloccare). Nessun conteggio, nessun `!`, nessuna emoji, nessun avverbio
    // di lode.
    clearedBody:
      'La pila di ripasso è vuota. Tutto quello che era dovuto è stato completato per ora, quindi non resta nulla da rivedere al momento.',
    // Curriculum esaurito (3.16): resa SSE la pila è a zero e non c'è una lezione
    // successiva da sbloccare. Dichiara il perché non c'è azione — hai sbloccato
    // ogni lezione, non ce ne sono altre. È l'unico stato senza azione primaria.
    // Nessun conteggio, nessun `!`, nessuna emoji, nessun avverbio di lode.
    curriculumCompleteBody:
      'Ogni lezione è sbloccata. Non ci sono altre lezioni da sbloccare e nulla risulta dovuto, quindi per ora non resta altro da fare qui.',
    // Primo avvio (3.15): reso SSE nulla è ancora sbloccato (unlocked === 0).
    // Dichiara cosa fa l'app — non c'è ancora niente da contare, quindi nessun
    // conteggio/streak/curriculum a zero. Copy neutra: nessun `!`, nessuna emoji,
    // nessun avverbio di lode.
    firstRunBody:
      'Questa app costruisce la tua grammatica giapponese una lezione per volta. Sblocca la prima lezione per riempire la pila di ripasso, poi affrontala esercizio per esercizio.',
    // L'azione di primo avvio: significa *comincia*, distinta da unlockAction
    // («procedi» dalla pila svuotata). Verbale e concreta, mai "Continua"; nessun
    // `!`, nessuna emoji, nessun avverbio di lode.
    startAction: 'Comincia dalla prima lezione',
    // Tetto giornaliero raggiunto (3.17): resa SSE la pila è a zero, c'è una
    // lezione successiva e gli sblocchi di oggi hanno raggiunto il tetto. Dichiara
    // il limite (`{{limit}}` = il tetto, MAI `{{count}}` che innescherebbe il
    // pluralizzatore), che riapre a mezzanotte e si cambia da Impostazioni. Al
    // posto del pulsante di sblocco, NESSUNA azione. Nessun conteggio da rivedere,
    // nessun `!`, nessuna emoji, nessun avverbio di lode.
    dailyLimitReachedBody:
      'Il tetto giornaliero di sblocco di {{limit}} è stato raggiunto per oggi. Il tetto si azzera a mezzanotte, quindi la lezione successiva si potrà sbloccare allora. Il tetto si cambia dalle Impostazioni.',
    // Affordance di navigazione verso le statistiche (5.1): resa nel ramo contenuto
    // della dashboard. Verbale e concreta, mai "Continua"; nessun `!`, nessuna
    // emoji, nessun avverbio di lode.
    viewStats: 'Vedi le tue statistiche',
  },
  // Le statistiche (Epic 5): STESSE chiavi di `en` (parità ricorsiva). Gli stati a
  // dati insufficienti DICHIARANO «cosa manca e quanto» (5.4, FR7.5): il grafico
  // temporale nomina la soglia e i giorni finora; distribuzione e tassi nominano il
  // minimo onesto («almeno uno»). Nessun `!`, nessuna emoji, nessun avverbio di lode.
  stats: {
    title: 'Statistiche',
    // Risposte nel tempo (5.1/5.4): `heading` intitola la serie; `dayLabel` etichetta
    // ogni giorno (`{{date}}` = YYYY-MM-DD, `{{answers}}` = conteggio del giorno,
    // MAI `{{count}}` che innescherebbe il pluralizzatore i18next e romperebbe la
    // parità en/it). `insufficient` è la dichiarazione quantificata sotto soglia
    // (`{{needed}}` = `MIN_ANSWER_DAYS`, l'unica fonte del numero; `{{soFar}}` = giorni
    // con risposte finora): dice COSA manca e QUANTO, mai un grafico sparso.
    answersOverTime: {
      heading: 'Risposte nel tempo',
      dayLabel: '{{date}} - risposte: {{answers}}',
      insufficient:
        'Servono almeno {{needed}} giorni di risposte per disegnare questo grafico. Giorni con risposte finora: {{soFar}}.',
    },
    // Distribuzione per stadio (5.2, FR7.2): STESSE chiavi di `en` (parita
    // ricorsiva). `heading` intitola la sezione; `stageLabel` etichetta ogni stadio
    // (`{{stage}}` = indice 0-5, `{{exercises}}` = numero di esercizi, MAI
    // `{{count}}` che innescherebbe il pluralizzatore i18next); `empty` e la
    // dichiarazione quantificata a log vuoto (5.4): asse CATEGORIALE, meaningful con
    // qualunque dato, quindi il minimo onesto e «almeno un esercizio ripassato».
    // Nessuna etichetta mnemonica ne intervallo in giorni: l'AC chiede «sei stadi, 0-5».
    stageDistribution: {
      heading: 'Esercizi per stadio di ripasso',
      stageLabel: 'Stadio {{stage}} - esercizi: {{exercises}}',
      empty: 'Questa vista ha bisogno di almeno un esercizio ripassato. Ripassa un esercizio e il suo stadio comparira qui.',
    },
    // Tassi d'errore per punto grammaticale (5.3, FR7.3): STESSE chiavi di `en`
    // (parita ricorsiva). `heading` intitola la sezione; `entryLabel` etichetta ogni
    // voce col tasso come TESTO (`{{errors}}` = risposte fallite, `{{total}}` =
    // risposte totali, MAI `{{count}}` che innescherebbe il pluralizzatore); il
    // punto grammaticale e reso a parte in `lang="ja"`. `lessonLabel` e un'etichetta
    // STATICA (nessun `{{lesson}}`): il titolo della lezione e CONTENUTO reso a parte
    // in un nodo con `lang` sulla lingua effettivamente resa (WCAG 3.1.2
    // Language-of-Parts). `unknownLesson` e il fallback neutro per un punto orfano;
    // `empty` e la dichiarazione quantificata a log vuoto (5.4): asse CATEGORIALE,
    // meaningful con qualunque dato, quindi il minimo onesto e «almeno una risposta».
    // Nessun `!`, nessuna emoji, nessun avverbio di lode.
    grammarPointErrorRates: {
      heading: 'Punti grammaticali per tasso di errore',
      entryLabel: 'errori: {{errors}} su {{total}}',
      lessonLabel: 'Lezione:',
      unknownLesson: 'Nessuna lezione insegna piu questo punto',
      empty: 'Questa vista ha bisogno di almeno una risposta. Rispondi a un esercizio e quanto spesso sbagli ogni regola comparira qui.',
    },
    // L'affordance di ritorno alla dashboard (5.1): SECONDARIA, verbale e concreta,
    // mai "Continua"/"Indietro" generico.
    back: 'Torna alla dashboard',
  },
  session: {
    // La CONSEGNA di un esercizio, per `kind` (3.18): descrive COME si risponde,
    // non celebra. Nessun `!`, nessuna emoji, nessun avverbio di lode. `single-select`
    // sceglie una parola; `select-span` indica una porzione della frase; `assemble`
    // ordina le tessere.
    prompt: {
      singleSelect: "Scegli l'opzione che completa la frase.",
      selectSpan: 'Seleziona la parte della frase che risponde alla domanda.',
      assemble: 'Metti in ordine le tessere per costruire la frase.',
    },
    // L'esito DICHIARATO in testo (3.19), da `check().correct`: nessun verde/rosso,
    // l'informazione la porta il contenuto della spiegazione. Nessun `!`, nessuna
    // emoji, nessun avverbio di lode.
    outcome: {
      correct: 'La risposta è corretta.',
      incorrect: 'La risposta non è corretta.',
    },
    // La spiegazione bilingue (3.19, FR8.5): `reveal` è l'azione di consulto
    // pre-risposta (verbale e concreta, mai "Continua"); `heading` la etichetta il
    // blocco; `fallbackNotice` dichiara che l'italiano non c'è ancora e mostra
    // l'inglese. Nessun `!`, nessuna emoji, nessun avverbio di lode.
    explanation: {
      reveal: 'Mostra la spiegazione',
      heading: 'Spiegazione',
      fallbackNotice: 'Questa spiegazione non è ancora stata tradotta.',
    },
    // L'azione di avanzamento al prossimo esercizio (3.19): verbale e concreta,
    // mai "Continua". Nessun `!`, nessuna emoji, nessun avverbio di lode.
    next: 'Prossimo esercizio',
    // L'affordance di ABBANDONO della sessione (3.20): verbale e concreta, mai
    // "Continua"/"Indietro" generico. L'esito già dato resta acquisito (persistenza
    // per-risposta), nessuna penalità. Nessun `!`, nessuna emoji, nessun avverbio di
    // lode.
    exit: 'Esci dalla sessione',
    // La barra di avanzamento (3.19): l'`aria-label` che l'AT legge. Rappresenta il
    // completato; nessun conteggio interpolato (`{{count}}` innescherebbe il
    // pluralizzatore). Nessun `!`, nessuna emoji.
    //
    // `announce` (3.22): l'avanzamento annunciato dalla live region unica
    // `aria-live="polite"` del contratto tastiera. Interpola `{{completed}}` e
    // `{{total}}` (MAI `{{count}}`, che innescherebbe il pluralizzatore i18next e
    // romperebbe la parità en/it). Nessun `!`, nessuna emoji.
    progress: {
      label: 'Avanzamento della sessione',
      announce: '{{completed}} di {{total}} completati',
    },
    // La schermata di COMPLETAMENTO (3.21): resa SSE la coda si svuota DOPO una
    // sessione avviata (`total > 0`). Chiusura SOBRIA, nessuna celebrazione: `body`
    // conferma di aver finito il ripasso; `streakLabel` mostra i giorni consecutivi
    // (`{{days}}`, MAI `{{count}}` che innescherebbe il pluralizzatore, coerente con
    // `dashboard.streakLabel`); `dismiss` torna alla dashboard, verbale e concreta,
    // mai "Continua". Nessun `!`, nessuna emoji, nessun avverbio di lode.
    complete: {
      body: 'La pila di ripasso è a zero. Hai completato ogni esercizio di questa sessione.',
      streakLabel: '{{days}} giorni di fila',
      dismiss: 'Torna alla dashboard',
    },
  },
  settings: {
    title: 'Impostazioni',
    language: {
      label: 'Lingua',
      en: 'Inglese',
      it: 'Italiano',
    },
    // Tetto giornaliero di sblocco (3.17): l'etichetta del gruppo e il testo di
    // ogni bottone. `option` interpola `{{value}}` (MAI `{{count}}`, che
    // innescherebbe il pluralizzatore i18next e romperebbe la parità en/it):
    // "1 al giorno"/"2 al giorno", grammaticale per ogni N. Nessun `!`, nessuna emoji.
    lessonsPerDay: {
      label: 'Tetto di sblocco giornaliero',
      option: '{{value}} al giorno',
    },
  },
  account: {
    delete: {
      title: 'Cancella account',
      trigger: 'Cancella account',
      consequence:
        'Cancellare il tuo account distrugge tutti i tuoi dati di studio. Le tue statistiche non sopravvivono. Questa azione non si può annullare.',
      confirm: 'Cancella definitivamente',
      cancel: 'Mantieni account',
      error: "L'account non è stato cancellato. Riprova.",
    },
  },
  // Indicatore di sincronizzazione (4.4): STESSA chiave di `en` (parità
  // ricorsiva). Testo STABILE e SENZA conteggio annunciato quando la coda ha
  // risposte non ancora sincronizzate. Non è un errore: nessun `!`, nessuna
  // emoji, nessun allarme.
  sync: {
    pending: 'Sincronizzazione in sospeso',
  },
} as const;
