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
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submit: 'Crea account',
    error: {
      emailAlreadyRegistered: 'Questa email è già registrata.',
      invalidEmail: 'Inserisci un indirizzo email valido.',
      weakPassword: 'Scegli una password più forte.',
      wrongPassword: 'Password errata.',
      unknown: 'Impossibile creare l\'account. Riprova.',
    },
  },
} as const;
