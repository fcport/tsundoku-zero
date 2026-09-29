// Catalogo inglese: la FONTE UNICA delle chiavi tipizzate (AD-14).
// `as const` congela la forma dell'oggetto: le sue chiavi diventano un tipo
// letterale, non `string`. È `typeof en` che, via declaration merging su
// CustomTypeOptions (i18next.d.ts), rende `t('chiave')` type-safe — una chiave
// assente è un errore di compilazione `tsc`, non un fallimento a runtime.
//
// Catalogo MINIMO e deliberato: una sola chiave reale (app.tagline, dalla
// descrizione stessa del prodotto). I consumatori d'interfaccia arrivano dalle
// storie successive (auth 1.6+); nessuna copy inventata per schermate
// inesistenti. Nessun carattere CJK: il giapponese è dato, non passa da t().
export const en = {
  app: {
    tagline: 'Japanese grammar exercises, one lesson at a time',
    name: 'Tsundoku Zero',
    // L'interruttore rapido della furigana, scritto in verticale sul dorso di ogni
    // schermata: una parola sola, uguale nelle due lingue.
    furiganaToggle: 'Furigana',
    // Il secondo interruttore del dorso: la traduzione sotto il giapponese.
    translationsToggle: 'Translations',
    // La traduzione del marchio, sotto il marchio quando le traduzioni sono accese.
    brandMeaning: 'The unread pile, at zero',
  },
  auth: {
    title: 'Sign up',
    signInTitle: 'Sign in',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submit: 'Create account',
    signInSubmit: 'Sign in',
    switchToSignIn: 'Already have an account? Sign in',
    switchToSignUp: "Don't have an account? Sign up",
    signOut: 'Sign out',
    error: {
      emailAlreadyRegistered: 'This email is already registered.',
      invalidEmail: 'Enter a valid email address.',
      weakPassword: 'Choose a stronger password.',
      wrongPassword: 'Wrong password.',
      unknown: 'Something went wrong. Try again.',
    },
  },
  dashboard: {
    // Etichetta resa SOTTO il conteggio: il numero PRECEDE il verbo
    // ("23 to review"), mai "you have 23". Nessun `!`, nessuna emoji, nessun
    // avverbio di lode (nessuna grammatica della celebrazione).
    dueLabel: 'to review',
    // Streak: i giorni PRECEDONO il sostantivo ("7 day streak"), neutro. La
    // variabile è `days` (non `count`), per non innescare il pluralizzatore di
    // i18next che richiederebbe chiavi `_one`/`_other` fuori dalla parità.
    streakLabel: '{{days}} day streak',
    // Gli occhielli della rivista sopra i due dati (streak e curriculum).
    streakKicker: 'Streak',
    curriculumKicker: 'Curriculum',
    // Progresso del curriculum: sbloccate su totale.
    curriculumLabel: '{{unlocked}} of {{total}} lessons',
    // L'UNICA azione primaria: verbale e concreta, mai "Continue".
    primaryAction: 'Empty the pile',
    // L'azione di SBLOCCO (3.13): resa SOLO a pila vuota (il cancello). Verbale e
    // concreta, mai "Continue"; nessun `!`, nessuna emoji, nessun avverbio di lode.
    unlockAction: 'Unlock the next lesson',
    // Dichiarazione della lezione CONCETTUALE (3.14): resa SSE la pila è a zero e
    // l'ultima lezione sbloccata non ha esercizi. Dichiara il fatto E il perché —
    // è concettuale, nulla da rivedere, la pila resta a zero, non è un fallimento.
    // Nessun `!`, nessuna emoji, nessun avverbio di lode, nessun verde/rosso.
    noExercisesNotice:
      'The lesson you just unlocked is only for reading: it has no exercises, so there is nothing to review.',
    // Pila svuotata (3.16): resa SSE la pila è a zero, qualcosa è già sbloccato e
    // l'ultima sbloccata AVEVA esercizi (li hai risolti). Dichiara il perché la
    // pila è vuota — hai finito il ripasso di adesso, non un errore. Distinta da
    // noExercisesNotice (mai riempita) e da curriculumCompleteBody (niente altro
    // da sbloccare). Nessun conteggio, nessun `!`, nessuna emoji, nessun avverbio
    // di lode; ASCII.
    clearedBody:
      'The pile is empty: everything is reviewed for now. Exercises come back here when it is time to see them again.',
    // Curriculum esaurito (3.16): resa SSE la pila è a zero e non c'è una lezione
    // successiva da sbloccare. Dichiara il perché non c'è azione — hai sbloccato
    // ogni lezione, non ce ne sono altre. È l'unico stato senza azione primaria.
    // Nessun conteggio, nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII.
    curriculumCompleteBody:
      'Every lesson is unlocked and there is nothing to review. That is all for now.',
    // Primo avvio (3.15): reso SSE nulla è ancora sbloccato (unlocked === 0).
    // Dichiara cosa fa l'app — non c'è ancora niente da contare, quindi nessun
    // conteggio/streak/curriculum a zero. Copy neutra, ASCII: nessun `!`, nessuna
    // emoji, nessun avverbio di lode.
    firstRunBody:
      'Here you learn Japanese grammar one lesson at a time. Unlock the first lesson: its exercises go into your review pile, and you empty it one exercise at a time.',
    // L'azione di primo avvio: significa *comincia*, distinta da unlockAction
    // («procedi» dalla pila svuotata). Verbale e concreta, mai "Continue"; nessun
    // `!`, nessuna emoji, nessun avverbio di lode.
    startAction: 'Start with the first lesson',
    // Tetto giornaliero raggiunto (3.17): resa SSE la pila è a zero, c'è una
    // lezione successiva e gli sblocchi di oggi hanno raggiunto il tetto. Dichiara
    // il limite (`{{limit}}` = il tetto, MAI `{{count}}` che innescherebbe il
    // pluralizzatore), che riapre a mezzanotte e si cambia da Impostazioni. Al
    // posto del pulsante di sblocco, NESSUNA azione. Nessun conteggio da rivedere,
    // nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII.
    dailyLimitReachedBody:
      'The new lessons for today are all unlocked (limit: {{limit}}). The next one unlocks after midnight. The limit can be changed in Settings.',
    // Affordance di navigazione verso le statistiche (5.1): resa nel ramo contenuto
    // della dashboard. Verbale e concreta, mai "Continue"; nessun `!`, nessuna
    // emoji, nessun avverbio di lode; ASCII.
    viewStats: 'See your statistics',
    currentLesson: 'Lesson {{order}}: {{title}}',
    openSettings: 'Settings',
    // La collocazione nella testata, prima della data ("Today · Tuesday 29 September").
    today: 'Today',
    // Il collegamento al video di riferimento della lezione in corso: apre YouTube
    // in una scheda nuova, niente video incorporato. Nome della fonte assente di
    // proposito: compare solo nei Riconoscimenti.
    referenceVideo: 'Reference video',
  },
  // Le statistiche (Epic 5): la vista delle risposte nel tempo (5.1, FR7.1),
  // distribuzione per stadio (5.2), tassi d'errore per punto (5.3). Gli stati a dati
  // insufficienti DICHIARANO «cosa manca e quanto» (5.4, FR7.5): il grafico temporale
  // nomina la soglia e i giorni finora; distribuzione e tassi nominano il minimo
  // onesto («almeno uno»). Nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII
  // (il giapponese non passa da t()).
  stats: {
    title: 'Statistics',
    // Risposte nel tempo (5.1/5.4): `heading` intitola la serie; `dayLabel` etichetta
    // ogni giorno (`{{date}}` = YYYY-MM-DD, `{{answers}}` = conteggio del giorno,
    // MAI `{{count}}` che innescherebbe il pluralizzatore i18next e romperebbe la
    // parità en/it). `insufficient` è la dichiarazione quantificata sotto soglia
    // (`{{needed}}` = `MIN_ANSWER_DAYS`, l'unica fonte del numero; `{{soFar}}` = giorni
    // con risposte finora): dice COSA manca (giorni di risposte) e QUANTO (soglia +
    // finora), mai un grafico sparso a 1-2 giorni (5.4).
    answersOverTime: {
      heading: 'Answers over time',
      dayLabel: '{{date}} - answers: {{answers}}',
      insufficient:
        'The chart appears once you have answered on at least {{needed}} different days. Days so far: {{soFar}}.',
    },
    // Distribuzione per stadio (5.2, FR7.2): `heading` intitola la sezione;
    // `stageLabel` etichetta ogni stadio (`{{stage}}` = indice 0-5, `{{exercises}}`
    // = numero di esercizi in quello stadio, MAI `{{count}}` che innescherebbe il
    // pluralizzatore i18next e romperebbe la parita en/it); `empty` è la dichiarazione
    // quantificata a log vuoto (5.4): asse CATEGORIALE, meaningful con qualunque dato,
    // quindi il minimo onesto è «almeno un esercizio ripassato» (nessuna soglia
    // numerica fabbricata). Nessuna etichetta mnemonica ne intervallo in giorni: l'AC
    // chiede «sei stadi, 0-5».
    stageDistribution: {
      heading: 'How well you know the exercises',
      stageLabel: 'Level {{stage}} - exercises: {{exercises}}',
      // Cosa sono i livelli (0-5): senza, «level 1» non dice niente.
      hint: 'Each right answer moves an exercise up one level and brings it back later. A wrong answer sends it back to level 0.',
      empty: 'After your first review you will see the level of each exercise here.',
    },
    // Tassi d'errore per punto grammaticale (5.3, FR7.3): `heading` intitola la
    // sezione; `entryLabel` etichetta ogni voce col tasso come TESTO (`{{errors}}` =
    // risposte fallite, `{{total}}` = risposte totali, MAI `{{count}}` che
    // innescherebbe il pluralizzatore i18next e romperebbe la parita en/it); il
    // punto grammaticale e reso a parte in `lang="ja"` (e giapponese, non passa da
    // t()). `lessonLabel` e un'etichetta STATICA (nessun `{{lesson}}`): il titolo
    // della lezione e CONTENUTO reso a parte in un nodo con `lang` sulla lingua
    // effettivamente resa (WCAG 3.1.2 Language-of-Parts: un titolo inglese in ripiego
    // non deve essere annunciato con pronuncia italiana). `unknownLesson` e il
    // fallback neutro per un punto orfano (drift contenuti); `empty` e la dichiarazione
    // quantificata a log vuoto (5.4): asse CATEGORIALE, meaningful con qualunque dato,
    // quindi il minimo onesto e «almeno una risposta» (nessuna soglia numerica
    // fabbricata). Nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII (il
    // giapponese non passa da t()).
    grammarPointErrorRates: {
      heading: 'The rules you miss most',
      entryLabel: 'errors: {{errors}} of {{total}}',
      lessonLabel: 'Lesson:',
      unknownLesson: 'No lesson teaches this rule anymore',
      empty: 'After your first answer you will see how often you miss each rule here.',
    },
    // L'affordance di ritorno alla dashboard (5.1): SECONDARIA, verbale e concreta,
    // mai "Continue"/"Back" generico.
    back: 'Back to the dashboard',
  },
  session: {
    // La CONSEGNA di un esercizio, per `kind` (3.18): descrive COME si risponde,
    // non celebra. Nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII (il
    // giapponese non passa da t()). `single-select` sceglie una parola; `select-span`
    // indica una porzione della frase; `assemble` ordina le tessere.
    prompt: {
      singleSelect: 'Choose the option that completes the sentence.',
      selectSpan: 'Select the part of the sentence that answers the question.',
      assemble: 'Put the tiles in order to build the sentence.',
    },
    option: {
      correct: 'Correct answer',
      yours: 'Your answer',
    },
    assembled: {
      label: 'Your sentence',
      empty: 'Tap the tiles in order.',
    },
    // L'esito DICHIARATO in testo (3.19), da `check().correct`: nessun verde/rosso,
    // l'informazione la porta il contenuto della spiegazione. Nessun `!`, nessuna
    // emoji, nessun avverbio di lode; ASCII.
    outcome: {
      correct: 'That answer is correct.',
      incorrect: 'That answer is not correct.',
    },
    // La spiegazione bilingue (3.19, FR8.5): `reveal` è l'azione di consulto
    // pre-risposta (verbale e concreta, mai "Continue"); `heading` la etichetta il
    // blocco; `fallbackNotice` dichiara che l'italiano non c'è ancora e mostra
    // l'inglese. Nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII.
    explanation: {
      reveal: 'Show the explanation',
      heading: 'Explanation',
      fallbackNotice: 'This explanation has not been translated yet.',
    },
    // L'azione di avanzamento al prossimo esercizio (3.19): verbale e concreta,
    // mai "Continue". Nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII.
    next: 'Next exercise',
    // L'affordance di ABBANDONO della sessione (3.20): verbale e concreta, mai
    // "Continue"/"Back" generico. L'esito già dato resta acquisito (persistenza
    // per-risposta), nessuna penalità. Nessun `!`, nessuna emoji, nessun avverbio di
    // lode; ASCII.
    exit: 'Leave the session',
    // L'occhiello sopra il numero dell'esercizio ("QUESTION 01").
    questionKicker: 'Question',
    // La traduzione dei timbri dell'esito (sotto il timbro, con le traduzioni accese).
    stampMeaning: {
      correct: 'right',
      incorrect: 'wrong',
    },
    // La barra di avanzamento (3.19): l'`aria-label` che l'AT legge. Rappresenta il
    // completato; nessun conteggio interpolato (`{{count}}` innescherebbe il
    // pluralizzatore). Nessun `!`, nessuna emoji; ASCII.
    //
    // `announce` (3.22): l'avanzamento annunciato dalla live region unica
    // `aria-live="polite"` del contratto tastiera. Interpola `{{completed}}` e
    // `{{total}}` (MAI `{{count}}`, che innescherebbe il pluralizzatore i18next e
    // romperebbe la parità en/it). Nessun `!`, nessuna emoji; ASCII.
    progress: {
      label: 'Session progress',
      announce: '{{completed}} of {{total}} completed',
    },
    // La schermata di COMPLETAMENTO (3.21): resa SSE la coda si svuota DOPO una
    // sessione avviata (`total > 0`). Chiusura SOBRIA, nessuna celebrazione: `body`
    // conferma di aver finito il ripasso; `streakLabel` mostra i giorni consecutivi
    // (`{{days}}`, MAI `{{count}}` che innescherebbe il pluralizzatore, coerente con
    // `dashboard.streakLabel`); `dismiss` torna alla dashboard, verbale e concreta,
    // mai "Continue". Nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII.
    complete: {
      body: 'Your review pile is at zero. You have worked through every exercise in this session.',
      streakLabel: '{{days}} day streak',
      dismiss: 'Back to the dashboard',
    },
  },
  settings: {
    title: 'Settings',
    back: 'Back to the dashboard',
    language: {
      label: 'Language',
      en: 'English',
      it: 'Italian',
    },
    // Tetto giornaliero di sblocco (3.17): l'etichetta del gruppo e il testo di
    // ogni bottone. `option` interpola `{{value}}` (MAI `{{count}}`, che
    // innescherebbe il pluralizzatore i18next e romperebbe la parità en/it):
    // "1 per day"/"2 per day", grammaticale per ogni N. Nessun `!`, nessuna emoji.
    lessonsPerDay: {
      label: 'New lessons per day',
      option: '{{value}} per day',
    },
  },
  account: {
    delete: {
      title: 'Delete account',
      trigger: 'Delete account',
      consequence:
        'Deleting your account erases all of your study data, statistics included. This cannot be undone.',
      confirm: 'Delete permanently',
      cancel: 'Keep account',
      error: 'The account could not be deleted. Try again.',
    },
  },
  // Indicatore di sincronizzazione (4.4): il testo STABILE annunciato quando la
  // coda di valutazioni ha risposte non ancora sincronizzate. SENZA conteggio —
  // il contenuto della live region non deve variare col numero di risposte
  // accodate, così `aria-live="polite"` annuncia UNA volta alla comparsa e non a
  // ogni risposta. Non è un errore: nessun `!`, nessuna emoji, nessun allarme;
  // ASCII, terso.
  sync: {
    pending: 'Answers not saved yet: retrying when you are online',
  },
  // La privacy policy (7.1): la pagina pubblica `/privacy` che dichiara, PRIMA
  // della registrazione, cosa il sistema memorizza, cosa NON raccoglie e come
  // cancellare l'account. Dichiarazioni FATTUALI (un impegno, non boilerplate):
  // `stored` nomina i soli dati memorizzati (email, hash della password, lezioni
  // sbloccate, stato di revisione, log delle risposte, preferenze — corrispondenti
  // ad auth + lesson_progress + review_state + review_log + user_settings);
  // `notCollected` nomina cio che NON si raccoglie (nome, data di nascita, analitica
  // sul singolo individuo); `deletion` spiega la cancellazione da Impostazioni ->
  // Cancella account e dichiara che distrugge ANCHE il log delle risposte.
  // `linkLabel` e l'affordance dal login e dalle Impostazioni; `back` e il ritorno.
  // Nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII.
  legal: {
    privacy: {
      title: 'Privacy policy',
      linkLabel: 'Read the privacy policy',
      stored:
        'We keep only what you need to study: your email, your password in encrypted form (nobody can read it), the lessons you unlocked, where you are with each exercise, the list of your answers, and your preferences. Nothing else.',
      notCollected:
        'We do not collect your name, your date of birth, or any data to track you.',
      deletion:
        'You can delete your account in Settings, with Delete account. The list of your answers is deleted too, and this cannot be undone.',
      back: 'Back',
    },
    // I riconoscimenti (7.2): la pagina pubblica `/riconoscimenti` che attribuisce
    // la FONTE del metodo e ne delimita i confini. `method` attribuisce a Cure
    // Dolly la divulgazione del modello strutturale (il nome della fonte compare
    // SOLO qui, MAI nel namespace `app` di branding ne nel percorso di rotta);
    // `channelLabel` e il testo del link al canale reale; `originalContent`
    // dichiara che gli esercizi sono originali e non riproducono materiale della
    // fonte; `noAffiliation` nega affiliazione/approvazione/continuita;
    // `scholarship` attesta la sostanza linguistica citando una fonte accademica
    // indipendente, verificabile e specifica (autore, titolo, editore, anno).
    // Dichiarazioni FATTUALI: nessun `!`, nessuna emoji, nessun avverbio di lode;
    // ASCII.
    acknowledgements: {
      title: 'Acknowledgements',
      linkLabel: 'Read the acknowledgements',
      method:
        'The structural way of explaining Japanese grammar used here was made widely known by Cure Dolly, whose lessons brought this model to a broad audience. The source is the channel:',
      channelLabel: 'Organic Japanese with Cure Dolly',
      originalContent:
        'The exercises and their explanations are original to this project. They do not reproduce, copy, or adapt any material from that channel.',
      noAffiliation:
        'This project is independent. It is not affiliated with, endorsed by, or a continuation of that channel.',
      scholarship:
        'The grammar taught here is established linguistics, not a private theory. This structural description of Japanese is documented in the academic literature, for example in Susumu Kuno, The Structure of the Japanese Language (MIT Press, 1973).',
      back: 'Back',
    },
  },
} as const;
