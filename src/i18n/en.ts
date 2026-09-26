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
    tagline: 'A Japanese grammar exercise generator',
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
      'The lesson you just unlocked has no exercises. It is a concept to read, so nothing was added to review and the pile stays at zero.',
    // Pila svuotata (3.16): resa SSE la pila è a zero, qualcosa è già sbloccato e
    // l'ultima sbloccata AVEVA esercizi (li hai risolti). Dichiara il perché la
    // pila è vuota — hai finito il ripasso di adesso, non un errore. Distinta da
    // noExercisesNotice (mai riempita) e da curriculumCompleteBody (niente altro
    // da sbloccare). Nessun conteggio, nessun `!`, nessuna emoji, nessun avverbio
    // di lode; ASCII.
    clearedBody:
      'Your review pile is empty. Everything due has been cleared for now, so there is nothing to review at the moment.',
    // Curriculum esaurito (3.16): resa SSE la pila è a zero e non c'è una lezione
    // successiva da sbloccare. Dichiara il perché non c'è azione — hai sbloccato
    // ogni lezione, non ce ne sono altre. È l'unico stato senza azione primaria.
    // Nessun conteggio, nessun `!`, nessuna emoji, nessun avverbio di lode; ASCII.
    curriculumCompleteBody:
      'Every lesson is unlocked. There are no more lessons to unlock and nothing is due, so there is nothing left to do here for now.',
    // Primo avvio (3.15): reso SSE nulla è ancora sbloccato (unlocked === 0).
    // Dichiara cosa fa l'app — non c'è ancora niente da contare, quindi nessun
    // conteggio/streak/curriculum a zero. Copy neutra, ASCII: nessun `!`, nessuna
    // emoji, nessun avverbio di lode.
    firstRunBody:
      'This app builds your Japanese grammar one lesson at a time. Unlock the first lesson to fill your review pile, then work through it exercise by exercise.',
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
      'The daily unlock limit of {{limit}} has been reached for today. The limit resets at midnight, so the next lesson can be unlocked then. The limit can be changed in Settings.',
    // Affordance di navigazione verso le statistiche (5.1): resa nel ramo contenuto
    // della dashboard. Verbale e concreta, mai "Continue"; nessun `!`, nessuna
    // emoji, nessun avverbio di lode; ASCII.
    viewStats: 'See your statistics',
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
        'This chart needs at least {{needed}} days of answers. Days with answers so far: {{soFar}}.',
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
      heading: 'Exercises by review stage',
      stageLabel: 'Stage {{stage}} - exercises: {{exercises}}',
      empty: 'This view needs at least one reviewed exercise. Review an exercise and its stage will appear here.',
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
      heading: 'Grammar points by error rate',
      entryLabel: 'errors: {{errors}} of {{total}}',
      lessonLabel: 'Lesson:',
      unknownLesson: 'No lesson teaches this point anymore',
      empty: 'This view needs at least one answer. Answer an exercise and how often you miss each rule will appear here.',
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
      label: 'Daily unlock limit',
      option: '{{value}} per day',
    },
  },
  account: {
    delete: {
      title: 'Delete account',
      trigger: 'Delete account',
      consequence:
        'Deleting your account destroys all of your study data. Your statistics do not survive it. This cannot be undone.',
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
    pending: 'Sync pending',
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
        'This service stores only what it needs to teach you: your email, a hash of your password, which lessons you have unlocked, your review state, a log of your answers, and your preferences. Nothing else is kept.',
      notCollected:
        'This service does not collect your name, your date of birth, or any analytics about you as an individual.',
      deletion:
        'You can delete your account from Settings, through Delete account. Deletion also destroys the log of your answers, and it cannot be undone.',
      back: 'Back',
    },
  },
} as const;
