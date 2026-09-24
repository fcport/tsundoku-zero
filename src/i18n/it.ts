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
