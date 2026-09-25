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
  },
  settings: {
    title: 'Impostazioni',
    language: {
      label: 'Lingua',
      en: 'Inglese',
      it: 'Italiano',
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
} as const;
