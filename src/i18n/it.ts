// Catalogo italiano: STESSO insieme di chiavi di `en` (parità ricorsiva,
// verificata da un test). Solo i valori cambiano. Se una chiave qui divergesse
// da `en`, la parità fallirebbe (test rosso). Nessun carattere CJK: il
// giapponese è dato, non passa da t().
export const it = {
  app: {
    tagline: 'Esercizi di grammatica giapponese, una lezione alla volta',
    name: 'Tsundoku Zero',
    // L'interruttore rapido della furigana, scritto in verticale sul dorso di ogni
    // schermata: una parola sola, uguale nelle due lingue.
    furiganaToggle: 'Furigana',
    // Il secondo interruttore del dorso: la traduzione sotto il giapponese.
    translationsToggle: 'Traduzioni',
    // La traduzione del marchio 積ん読ゼロ, sotto il marchio quando le traduzioni
    // sono accese.
    brandMeaning: 'La pila di libri non letti, a zero',
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
    // La pila come libri (30-09-2026): un dorso per esercizio dovuto, il prossimo in
    // cima. 冊 è il contatore giapponese dei libri; `satsuMeaning` la sua traduzione.
    // Le variabili non si chiamano `count` (pluralizzatore di i18next).
    satsuMeaning: 'libri',
    pileLabel: 'La pila da rivedere, dal prossimo esercizio',
    pileBook: 'Lezione {{lesson}}: {{point}}',
    pileNext: 'prossimo',
    pileMore: '+{{extra}} nella pila',
    // Streak: forma etichetta-valore ("Giorni di fila: 7"), come `entryLabel` delle
    // statistiche: nessuna concordanza di numero, quindi niente «1 giorni». La
    // variabile è `days` (non `count`), per non innescare il pluralizzatore di
    // i18next che richiederebbe chiavi `_one`/`_other` fuori dalla parità.
    streakLabel: 'Giorni di fila: {{days}}',
    // Gli occhielli della rivista sopra i due dati (streak e curriculum): parole
    // sole, senza numero, quindi senza concordanza.
    streakKicker: 'Di fila',
    curriculumKicker: 'Curriculum',
    // Progresso del curriculum: sbloccate su totale.
    curriculumLabel: '{{unlocked}} di {{total}} lezioni',
    // L'UNICA azione primaria: verbale e concreta, mai "Continua".
    primaryAction: 'Svuota la pila',
    // L'azione di SBLOCCO (3.13): resa SOLO a pila vuota (il cancello). Verbale e
    // concreta, mai "Continua"; nessun `!`, nessuna emoji, nessun avverbio di lode.
    unlockAction: 'Sblocca la lezione successiva',
    // «Esercitati di più» a pila vuota: altri esercizi della lezione in corso.
    moreAction: 'Esercitati di più sulla lezione {{order}}',
    moreReserve: 'Altri {{value}} esercizi aspettano in riserva.',
    // Dichiarazione della lezione CONCETTUALE (3.14): resa SSE la pila è a zero e
    // l'ultima lezione sbloccata non ha esercizi. Dichiara il fatto E il perché —
    // è concettuale, nulla da rivedere, la pila resta a zero, non è un fallimento.
    // Nessun `!`, nessuna emoji, nessun avverbio di lode, nessun verde/rosso.
    noExercisesNotice:
      'La lezione appena sbloccata è solo da leggere: non ha esercizi, quindi non resta niente da ripassare.',
    // Pila svuotata (3.16): resa SSE la pila è a zero, qualcosa è già sbloccato e
    // l'ultima sbloccata AVEVA esercizi (li hai risolti). Dichiara il perché la
    // pila è vuota — hai finito il ripasso di adesso, non un errore. Distinta da
    // noExercisesNotice (mai riempita) e da curriculumCompleteBody (niente altro
    // da sbloccare). Nessun conteggio, nessun `!`, nessuna emoji, nessun avverbio
    // di lode.
    clearedBody:
      'La pila è vuota: per ora è tutto ripassato. Gli esercizi tornano qui quando è il momento di rivederli.',
    // Curriculum esaurito (3.16): resa SSE la pila è a zero e non c'è una lezione
    // successiva da sbloccare. Dichiara il perché non c'è azione — hai sbloccato
    // ogni lezione, non ce ne sono altre. È l'unico stato senza azione primaria.
    // Nessun conteggio, nessun `!`, nessuna emoji, nessun avverbio di lode.
    curriculumCompleteBody:
      'Tutte le lezioni sono sbloccate e non resta niente da ripassare. Per ora è tutto.',
    // Primo avvio (3.15): reso SSE nulla è ancora sbloccato (unlocked === 0).
    // Dichiara cosa fa l'app — non c'è ancora niente da contare, quindi nessun
    // conteggio/streak/curriculum a zero. Copy neutra: nessun `!`, nessuna emoji,
    // nessun avverbio di lode.
    // Dal 30-09-2026 nomina Cure Dolly come origine del METODO (PRD §2: riconoscere
    // l'origine dell'approccio è consentito), mai gli esercizi come derivati dalle sue
    // lezioni: sono originali, come dichiarano i riconoscimenti.
    firstRunBody:
      'Qui impari la grammatica giapponese una lezione alla volta, con il metodo reso famoso dalle lezioni di Cure Dolly: ogni lezione rimanda al suo video di riferimento, mentre gli esercizi sono scritti da zero per questa app. Sblocca la prima lezione: i suoi esercizi finiscono nella pila da ripassare, e tu la svuoti un esercizio alla volta.',
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
      'Le lezioni nuove di oggi sono tutte sbloccate (massimo: {{limit}}). La prossima si sblocca da mezzanotte. Il limite si cambia nelle Impostazioni.',
    // Affordance di navigazione verso le statistiche (5.1): resa nel ramo contenuto
    // della dashboard. Verbale e concreta, mai "Continua"; nessun `!`, nessuna
    // emoji, nessun avverbio di lode.
    viewStats: 'Vedi le tue statistiche',
    currentLesson: 'Lezione {{order}}: {{title}}',
    openSettings: 'Impostazioni',
    // La collocazione nella testata, prima della data ("Oggi · martedì 29 settembre").
    today: 'Oggi',
    // Il collegamento al video di riferimento della lezione in corso: apre YouTube
    // in una scheda nuova, niente video incorporato. Nome della fonte assente di
    // proposito: compare solo nei Riconoscimenti.
    referenceVideo: 'Video di riferimento',
    practice: 'Allenamento',
    practiceKicker: 'Forme del verbo',
    lessonsKicker: 'Le lezioni · in corso',
    lessonsOpen: 'Apri le lezioni',
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
        'Il grafico compare quando avrai risposto in almeno {{needed}} giorni diversi. Giorni finora: {{soFar}}.',
    },
    // Distribuzione per stadio (5.2, FR7.2): STESSE chiavi di `en` (parita
    // ricorsiva). `heading` intitola la sezione; `stageLabel` etichetta ogni stadio
    // (`{{stage}}` = indice 0-5, `{{exercises}}` = numero di esercizi, MAI
    // `{{count}}` che innescherebbe il pluralizzatore i18next); `empty` e la
    // dichiarazione quantificata a log vuoto (5.4): asse CATEGORIALE, meaningful con
    // qualunque dato, quindi il minimo onesto e «almeno un esercizio ripassato».
    // Nessuna etichetta mnemonica ne intervallo in giorni: l'AC chiede «sei stadi, 0-5».
    stageDistribution: {
      heading: 'Quanto conosci gli esercizi',
      stageLabel: 'Livello {{stage}} - esercizi: {{exercises}}',
      // Cosa sono i livelli (0-5): senza, «livello 1» non dice niente.
      hint: 'Ogni risposta giusta fa salire l\'esercizio di un livello, e lo fa tornare più avanti nel tempo. Una risposta sbagliata lo riporta al livello 0.',
      empty: 'Qui vedrai a che livello è ogni esercizio, dopo il primo ripasso.',
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
      heading: 'Le regole su cui sbagli di più',
      entryLabel: 'errori: {{errors}} su {{total}}',
      lessonLabel: 'Lezione:',
      unknownLesson: 'Nessuna lezione insegna più questa regola',
      empty: 'Qui vedrai quanto spesso sbagli ogni regola, dopo la prima risposta.',
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
    // Dopo la risposta: quale opzione era giusta e quale hai scelto, in TESTO (non
    // solo col colore). Nessun `!`, nessuna emoji.
    option: {
      correct: 'Risposta corretta',
      yours: 'La tua risposta',
    },
    // La frase che si compone toccando le tessere (assemble), al posto della frase
    // intera che prima rivelava la soluzione.
    assembled: {
      label: 'La tua frase',
      empty: 'Tocca le tessere in ordine.',
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
    // Il pulsante che fa ascoltare la frase, a risposta data.
    listen: 'Ascolta la frase',
    // L'azione di avanzamento al prossimo esercizio (3.19): verbale e concreta,
    // mai "Continua". Nessun `!`, nessuna emoji, nessun avverbio di lode.
    next: 'Prossimo esercizio',
    // «Facile» (dopo una risposta giusta senza spiegazione): sale di due livelli.
    // `easyHint*` dice in concreto fra quanti giorni torna l'esercizio. `{{easy}}` è
    // sempre almeno 3; con `good` = 1 si dice «domani» (niente «1 giorni»).
    easy: 'Facile',
    easyHint: 'Ti è venuta senza pensarci? Con Facile la rivedi tra {{easy}} giorni invece che tra {{good}}.',
    easyHintTomorrow: 'Ti è venuta senza pensarci? Con Facile la rivedi tra {{easy}} giorni invece che domani.',
    // L'affordance di ABBANDONO della sessione (3.20): verbale e concreta, mai
    // "Continua"/"Indietro" generico. L'esito già dato resta acquisito (persistenza
    // per-risposta), nessuna penalità. Nessun `!`, nessuna emoji, nessun avverbio di
    // lode.
    exit: 'Esci dalla sessione',
    // L'occhiello sopra il numero dell'esercizio ("DOMANDA 01").
    questionKicker: 'Domanda',
    // La traduzione dei timbri dell'esito (sotto il timbro, con le traduzioni accese).
    stampMeaning: {
      correct: 'giusto',
      incorrect: 'sbagliato',
    },
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
      streakLabel: 'Giorni di fila: {{days}}',
      dismiss: 'Torna alla dashboard',
    },
  },
  // La pagina Lezioni: tutto il curriculum in ordine, con lo stato di ciascuna, e il
  // ripasso libero di una lezione già sbloccata (fuori dalla pila, niente si salva).
  // Le variabili non si chiamano `count` (pluralizzatore di i18next).
  lessons: {
    back: 'Torna alla dashboard',
    kicker: 'Curriculum',
    title: 'Le lezioni',
    intro:
      'Tutte le lezioni del corso, in ordine. Una lezione nuova mette nella pila 12 esercizi; gli altri li aggiungi tu, 6 alla volta, con «Esercitati di più». Le lezioni sbloccate si possono anche ripassare liberamente: il ripasso libero non cambia la pila. Le altre si sbloccano una alla volta dalla dashboard, quando la pila è vuota.',
    lessonNumber: 'Lezione {{order}}',
    status: {
      current: 'In corso',
      unlocked: 'Sbloccata',
      next: 'La prossima',
      locked: 'Bloccata',
    },
    nextHint: 'Si sblocca dalla dashboard, quando la pila è vuota.',
    exercises: 'Esercizi: {{value}}',
    exercisesInPile: 'Nella pila {{active}} esercizi su {{total}}',
    more: 'Esercitati di più',
    moreDone: 'Aggiunti {{value}} esercizi alla pila.',
    moreNone: 'Non ci sono altri esercizi da aggiungere.',
    // «Da ripassare»: le lezioni dove sbagli di più (sbagliata = «di nuovo»).
    weak: {
      kicker: 'Da ripassare · ultimi {{days}} giorni',
      title: 'Dove sbagli di più',
      note: 'Contano le lezioni con almeno {{min}} risposte.',
      rank: '{{value}}°',
      worstRule: 'Il punto debole',
      ruleErrors: '{{value}} errori',
      ruleErrorsOne: '1 errore',
      wrong: 'sbagliate',
      answers: '{{errors}} su {{total}} risposte',
    },
    noExercises: 'Solo da leggere, senza esercizi.',
    rules: 'Cosa insegna',
    practice: 'Ripassa gli esercizi',
    video: 'Video di riferimento',
  },
  lessonPractice: {
    back: 'Torna alle lezioni',
    kicker: 'Ripasso libero',
    notice: 'Ripasso libero: le risposte non cambiano la pila.',
    score: 'Risposte corrette: {{right}} su {{total}}',
    completeBody:
      'Hai fatto tutti gli esercizi di questa lezione. Risposte corrette: {{right}} su {{total}}. La pila non è cambiata.',
    again: 'Ripassala di nuovo',
    locked:
      'Questa lezione non è ancora sbloccata. Le lezioni si sbloccano una alla volta dalla dashboard, quando la pila è vuota.',
    empty: 'Questa lezione è solo da leggere: non ha esercizi da ripassare.',
    notFound: 'Questa lezione non esiste.',
  },
  // L'allenamento libero sulle forme del verbo: fuori dalla pila, niente si salva.
  // Nessun carattere CJK: le forme in giapponese e i passaggi sono dati del dominio.
  drill: {
    back: 'Torna alla dashboard',
    title: 'Allenamento',
    kicker: 'Forme del verbo · fuori dalla pila',
    askKicker: 'Trasforma in',
    inputLabel: 'La tua risposta',
    inputHint: 'Scrivi in kana, o in romaji: diventa kana mentre scrivi.',
    check: 'Controlla',
    next: 'Avanti',
    correct: 'Corretto',
    incorrect: 'Sbagliato',
    yourAnswer: 'Hai scritto',
    rightAnswer: 'La forma giusta',
    steps: 'Come si fa',
    score: 'Risposte corrette: {{right}} su {{total}}',
    empty: 'Scegli almeno una forma e un gruppo di verbi.',
    changeSelection: 'Cambia cosa allenare',
    chooseIntro:
      'Scegli i gruppi di verbi e le forme da allenare, poi comincia. Le domande arrivano a caso fra quelle scelte, finché vuoi.',
    selectAll: 'Tutte',
    selectNone: 'Nessuna',
    poolSize: '{{value}} combinazioni di verbo e forma',
    start: 'Comincia',
    settingsHeading: 'Cosa allenare',
    formsLabel: 'Forme',
    groupsLabel: 'Gruppi di verbi',
    groups: {
      godan: "Godan (cambiano l'ultimo kana)",
      ichidan: 'Ichidan (perdono ru)',
      irregular: 'Irregolari (suru, kuru)',
    },
    forms: {
      masu: 'Cortese',
      masen: 'Negativo cortese',
      mashita: 'Passato cortese',
      nai: 'Negativo',
      nakatta: 'Passato negativo',
      ta: 'Passato',
      te: 'Forma in te',
      teiru: 'Azione in corso',
      tai: 'Voglio fare',
      potential: 'Potenziale (posso fare)',
      volitional: 'Volitivo (facciamo)',
      causative: 'Causativo (far fare)',
      passive: 'Passivo',
    },
    rules: {
      ichidan: 'Verbo ichidan: si toglie ru e si aggiunge la terminazione. Il resto non cambia.',
      godanA: "Verbo godan: l'ultimo kana passa al suono a (ku diventa ka), poi la terminazione.",
      godanWa: "Verbo godan in u: l'ultimo kana diventa wa, non a (kau diventa kawa).",
      godanI: "Verbo godan: l'ultimo kana passa al suono i (ku diventa ki), poi la terminazione.",
      godanE: "Verbo godan: l'ultimo kana passa al suono e (ku diventa ke) e si aggiunge ru.",
      godanO: "Verbo godan: l'ultimo kana passa al suono o (ku diventa ko) e si allunga con u.",
      godanTeSmallTsu: 'Verbi godan in u, tsu e ru: una piccola tsu, poi te o ta.',
      godanTeN: 'Verbi godan in mu, bu e nu: una n, poi de o da.',
      godanTeI: 'Verbi godan in ku: una i, poi te o ta.',
      godanTeGi: 'Verbi godan in gu: una i, poi de o da (non te o ta).',
      godanTeShi: 'Verbi godan in su: shi, poi te o ta.',
      iku: 'Eccezione: iku fa itte e itta, con la piccola tsu, non come gli altri verbi in ku.',
      aru: 'Eccezione: il negativo di aru è solo nai.',
      suru: 'Suru è irregolare: shi davanti a quasi tutto, sa per far fare e per il passivo, dekiru per il potenziale.',
      kuru: 'Kuru è irregolare: la vocale cambia, ko per negativo, potenziale, volitivo, causativo e passivo, ki per il resto.',
      looksIchidan: "Attenzione: finisce in -iru o -eru ma è godan, quindi cambia l'ultimo kana invece di perdere ru.",
    },
  },
  settings: {
    title: 'Impostazioni',
    back: 'Torna alla dashboard',
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
      label: 'Lezioni nuove al giorno',
      option: '{{value}} al giorno',
    },
  },
  account: {
    delete: {
      title: 'Cancella account',
      trigger: 'Cancella account',
      consequence:
        'Cancellando l\'account perdi tutti i tuoi dati di studio, statistiche comprese. Non si può annullare.',
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
    pending: 'Risposte non ancora salvate: riprovo appena c\'è rete',
  },
  // La privacy policy (7.1): STESSE chiavi di `en` (parità ricorsiva). Dichiara
  // cosa il sistema memorizza, cosa NON raccoglie e come cancellare l'account.
  // `stored` nomina i soli dati memorizzati (email, hash della password, lezioni
  // sbloccate, stato di revisione, log delle risposte, preferenze); `notCollected`
  // nomina cio che NON si raccoglie (nome, data di nascita, analitica sul singolo
  // individuo); `deletion` spiega la cancellazione da Impostazioni -> Cancella
  // account e dichiara che distrugge ANCHE il log delle risposte. Nessun `!`,
  // nessuna emoji, nessun avverbio di lode.
  legal: {
    privacy: {
      title: 'Informativa sulla privacy',
      linkLabel: "Leggi l'informativa sulla privacy",
      stored:
        "Conserviamo solo ciò che serve per farti studiare: la tua email, la password in forma cifrata (nessuno può leggerla), le lezioni che hai sbloccato, a che punto sei con ogni esercizio, la lista delle tue risposte e le tue preferenze. Nient'altro.",
      notCollected:
        'Non raccogliamo il tuo nome, la tua data di nascita né dati per tracciarti.',
      deletion:
        'Puoi cancellare il tuo account dalle Impostazioni, con Cancella account. Si cancella anche la lista delle tue risposte, e non si può annullare.',
      back: 'Indietro',
    },
    // I riconoscimenti (7.2): STESSE chiavi di `en` (parità ricorsiva). Attribuisce
    // la FONTE del metodo (Cure Dolly) SOLO nel contenuto di questa pagina — mai nel
    // namespace `app` di branding né nel percorso di rotta — e ne delimita i
    // confini: `originalContent` dichiara che gli esercizi sono originali e non
    // riproducono materiale della fonte; `noAffiliation` nega
    // affiliazione/approvazione/continuazione; `scholarship` cita una fonte
    // accademica indipendente e verificabile (proper-noun della citazione identici a
    // `en`). Nessun `!`, nessuna emoji, nessun avverbio di lode.
    acknowledgements: {
      title: 'Riconoscimenti',
      linkLabel: 'Leggi i riconoscimenti',
      method:
        'Il modo strutturale di spiegare la grammatica giapponese usato qui è stato reso ampiamente noto da Cure Dolly, le cui lezioni hanno divulgato questo modello a un vasto pubblico. La fonte è il canale:',
      channelLabel: 'Organic Japanese with Cure Dolly',
      originalContent:
        'Gli esercizi e le loro spiegazioni sono originali di questo progetto. Non riproducono, copiano o adattano alcun materiale di quel canale.',
      noAffiliation:
        'Questo progetto è indipendente. Non è affiliato, approvato, né una continuazione di quel canale.',
      scholarship:
        'La grammatica insegnata qui è linguistica consolidata, non una teoria privata. Questa descrizione strutturale del giapponese è documentata nella letteratura accademica, per esempio in Susumu Kuno, The Structure of the Japanese Language (MIT Press, 1973).',
      voice:
        "L'audio delle frasi giapponesi è generato con VOICEVOX:No.7, una voce sintetica gratuita per usi non commerciali.",
      back: 'Indietro',
    },
  },
  // La pagina «Come funziona?»: STESSE chiavi di `en` (parità ricorsiva). In prima
  // persona: chi scrive il sito, perché esiste e come si usa. Nessun `!`, nessuna
  // emoji.
  about: {
    title: 'Come funziona?',
    linkLabel: 'Come funziona?',
    whoKicker: 'Chi sono',
    who:
      'Sono uno studente di giapponese. Sto seguendo 30 Day Japanese, il percorso di TheMoeWay, che per la grammatica consiglia le lezioni di Cure Dolly.',
    guideLabel: '30 Day Japanese su TheMoeWay',
    whyKicker: 'Perché questo sito',
    lessons:
      "Trovo quelle lezioni fantastiche, ma di esercizi per accompagnarle ce ne sono pochissimi. E andando avanti, quello che non si esercita tende a essere dimenticato.",
    idea:
      'Per questo ho creato questa piattaforma. Man mano che vado avanti con le lezioni le aggiungo qui e ne scrivo gli esercizi, così che chiunque, anche in futuro, possa usarla per esercitarsi su quello che ha imparato con Cure Dolly.',
    howKicker: 'Come si usa',
    how:
      "Ogni lezione corrisponde a un video. Quando sblocchi una lezione, 12 dei suoi esercizi entrano nella tua pila; se ne vuoi altri, li aggiungi con «Esercitati di più». Un esercizio a cui rispondi bene torna dopo un intervallo sempre più lungo; uno che sbagli torna prima. Ogni giorno svuoti la pila e, quando è vuota, sblocchi la lezione successiva.",
    lessonsPage:
      'Dalla pagina Lezioni puoi rivedere il video e ripassare quando vuoi qualsiasi lezione che hai sbloccato.',
    passionKicker: 'Perché lo faccio',
    passion:
      "Il progetto nasce solo dalla mia passione per il Giappone, dove un giorno mi piacerebbe trasferirmi. Spero che possa essere utile anche a te.",
    independent:
      "Questo sito non è affiliato a Cure Dolly né a TheMoeWay: gli esercizi li scrivo io.",
    linksKicker: 'Link',
    siteLabel: 'Il mio sito: federicocasadei.dev',
    githubLabel: 'Il mio profilo GitHub',
    repoLabel: 'Il codice di questo sito su GitHub',
    back: 'Indietro',
  },
} as const;
