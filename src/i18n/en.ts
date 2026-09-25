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
  },
  settings: {
    title: 'Settings',
    language: {
      label: 'Language',
      en: 'English',
      it: 'Italian',
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
} as const;
