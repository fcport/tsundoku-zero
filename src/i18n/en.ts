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
