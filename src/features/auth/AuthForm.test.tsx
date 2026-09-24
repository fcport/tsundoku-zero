import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import {
  AuthForm,
  type AuthFormSubmitKey,
  type AuthFormTitleKey,
  type AuthFormToggleKey,
} from './AuthForm';
import type { AuthErrorMessage } from './authFailureMessage';

// Righe della I/O Matrix per la presentazione (storie 1.6/1.7): ambiente node,
// nessun jsdom, resa statica con renderToStaticMarkup per ciascuno stato.
// L'ancoraggio del messaggio è verificato sulla POSIZIONE nel markup: il testo
// d'errore deve seguire il campo responsabile e precedere il successivo. Il
// form è ora PARAMETRIZZATO dal modo (registrazione / accesso).

const VALUES = { email: '', password: '' };
const NOOP = () => {};

interface ModeKeys {
  readonly titleKey: AuthFormTitleKey;
  readonly submitKey: AuthFormSubmitKey;
  readonly toggleKey: AuthFormToggleKey;
}

const SIGN_UP: ModeKeys = {
  titleKey: 'auth.title',
  submitKey: 'auth.submit',
  toggleKey: 'auth.switchToSignIn',
};

const SIGN_IN: ModeKeys = {
  titleKey: 'auth.signInTitle',
  submitKey: 'auth.signInSubmit',
  toggleKey: 'auth.switchToSignUp',
};

function render(
  error: AuthErrorMessage | null,
  pending = false,
  keys: ModeKeys = SIGN_UP,
): string {
  return renderToStaticMarkup(
    <AuthForm
      values={VALUES}
      error={error}
      pending={pending}
      onSubmit={NOOP}
      onChange={NOOP}
      onToggle={NOOP}
      titleKey={keys.titleKey}
      submitKey={keys.submitKey}
      toggleKey={keys.toggleKey}
    />,
  );
}

// ---- Assertion di 1.6 preservate col modo sign-up (default) ----

describe('AuthForm (sign-up) — campi e label da t()', () => {
  const markup = render(null);

  it('rende le label email/password, il titolo e il submit da t()', () => {
    expect(markup).toContain(en.auth.emailLabel);
    expect(markup).toContain(en.auth.passwordLabel);
    expect(markup).toContain(en.auth.title);
    expect(markup).toContain(en.auth.submit);
  });

  it('senza errore, nessun testo d\'errore compare', () => {
    for (const msg of Object.values(en.auth.error)) {
      expect(markup).not.toContain(msg);
    }
  });

  it('ha gli input email e password', () => {
    expect(markup).toContain('id="auth-email"');
    expect(markup).toContain('id="auth-password"');
  });
});

describe('AuthForm — ancoraggio del messaggio al campo responsabile', () => {
  it('errore email: accanto al campo email, NON al password né in cima', () => {
    const markup = render({
      key: 'auth.error.emailAlreadyRegistered',
      field: 'email',
    });
    const text = en.auth.error.emailAlreadyRegistered;

    expect(markup).toContain(text);

    // Il messaggio segue l'input email e precede l'input password: sta nel
    // gruppo del campo email.
    const emailInputAt = markup.indexOf('id="auth-email"');
    const passwordInputAt = markup.indexOf('id="auth-password"');
    const messageAt = markup.indexOf(text);
    expect(messageAt).toBeGreaterThan(emailInputAt);
    expect(messageAt).toBeLessThan(passwordInputAt);

    // NON in cima: il messaggio non precede il titolo.
    const titleAt = markup.indexOf(en.auth.title);
    expect(messageAt).toBeGreaterThan(titleAt);
  });

  it('errore password: accanto al campo password', () => {
    const markup = render({ key: 'auth.error.weakPassword', field: 'password' });
    const text = en.auth.error.weakPassword;

    expect(markup).toContain(text);

    const passwordInputAt = markup.indexOf('id="auth-password"');
    const submitAt = markup.indexOf(en.auth.submit);
    const messageAt = markup.indexOf(text);
    // Segue l'input password e precede il submit: sta nel gruppo password.
    expect(messageAt).toBeGreaterThan(passwordInputAt);
    expect(messageAt).toBeLessThan(submitAt);
  });

  it('errore email non compare nel gruppo password (nessuna perdita di ancoraggio)', () => {
    const markup = render({
      key: 'auth.error.emailAlreadyRegistered',
      field: 'email',
    });
    // La chiave della password NON compare: solo il campo colpevole ha lo slot.
    expect(markup).not.toContain(en.auth.error.weakPassword);
  });

  it('errore form (unknown): a livello form dopo il submit, non in cima', () => {
    const markup = render({ key: 'auth.error.unknown', field: 'form' });
    const text = en.auth.error.unknown;

    expect(markup).toContain(text);

    // Dopo il submit: segue il submit, non precede il titolo.
    const submitAt = markup.indexOf(en.auth.submit);
    const titleAt = markup.indexOf(en.auth.title);
    const messageAt = markup.indexOf(text);
    expect(messageAt).toBeGreaterThan(submitAt);
    expect(messageAt).toBeGreaterThan(titleAt);
  });

  it('nessuna stringa grezza di Supabase compare nel markup', () => {
    // Anche con un errore reso, il markup non contiene code o messaggi vendor:
    // il traduttore ha per ingresso una union chiusa.
    const markup = render({
      key: 'auth.error.emailAlreadyRegistered',
      field: 'email',
    });
    for (const raw of [
      'user_already_exists',
      'weak_password',
      'validation_failed',
      'invalid_credentials',
      'AuthApiError',
    ]) {
      expect(markup).not.toContain(raw);
    }
  });
});

describe('AuthForm — associazione errore↔input per l\'assistive tech', () => {
  it('errore email: input con aria-invalid e aria-describedby; <p> con id', () => {
    const markup = render({
      key: 'auth.error.emailAlreadyRegistered',
      field: 'email',
    });
    // L'input email dichiara l'errore e lo referenzia; il <p> porta quell'id.
    const emailInputTag = markup.slice(
      markup.indexOf('<input id="auth-email"'),
      markup.indexOf('>', markup.indexOf('<input id="auth-email"')) + 1,
    );
    expect(emailInputTag).toContain('aria-invalid="true"');
    expect(emailInputTag).toContain('aria-describedby="auth-email-error"');
    expect(markup).toContain('id="auth-email-error"');
  });

  it('errore password: input con aria-invalid e aria-describedby; <p> con id', () => {
    const markup = render({ key: 'auth.error.weakPassword', field: 'password' });
    const pwInputTag = markup.slice(
      markup.indexOf('<input id="auth-password"'),
      markup.indexOf('>', markup.indexOf('<input id="auth-password"')) + 1,
    );
    expect(pwInputTag).toContain('aria-invalid="true"');
    expect(pwInputTag).toContain('aria-describedby="auth-password-error"');
    expect(markup).toContain('id="auth-password-error"');
  });

  it('senza errore: gli input non portano aria-invalid né aria-describedby', () => {
    const markup = render(null);
    expect(markup).not.toContain('aria-invalid');
    expect(markup).not.toContain('aria-describedby');
  });

  it('errore form (unknown): il <p> porta role="alert"', () => {
    const markup = render({ key: 'auth.error.unknown', field: 'form' });
    expect(markup).toContain('role="alert"');
  });
});

describe('AuthForm — pending disabilita il submit', () => {
  it('pending={true} ⇒ il bottone di submit è disabled', () => {
    const markup = render(null, true);
    // Il PRIMO <button> è il submit primario (il toggle è type="button" dopo).
    const buttonTag = markup.slice(
      markup.indexOf('<button'),
      markup.indexOf('>', markup.indexOf('<button')) + 1,
    );
    expect(buttonTag).toContain('type="submit"');
    expect(buttonTag).toContain('disabled');
  });
});

// ---- Nuove assertion 1.7: modo bimodale + toggle ----

describe('AuthForm — modo della schermata (sign-up vs sign-in)', () => {
  it('sign-up: titolo/submit/toggle di registrazione', () => {
    const markup = render(null, false, SIGN_UP);
    // Il titolo è reso nell'<h2> (il submit sign-in "Sign in" è sottostringa del
    // toggle "…? Sign in", perciò asseriamo il titolo sulla sua posizione <h2>).
    expect(markup).toContain(`>${en.auth.title}</h2>`);
    expect(markup).toContain(en.auth.submit);
    // Il toggle porta al modo accesso.
    expect(markup).toContain('Already have an account');
    // Non il titolo dell'accesso nell'<h2>.
    expect(markup).not.toContain(`>${en.auth.signInTitle}</h2>`);
  });

  it('sign-in: titolo/submit/toggle di accesso', () => {
    const markup = render(null, false, SIGN_IN);
    expect(markup).toContain(`>${en.auth.signInTitle}</h2>`);
    expect(markup).toContain(`>${en.auth.signInSubmit}</button>`);
    // Il toggle porta al modo registrazione ("Don't have an account? Sign up",
    // con l'apostrofo codificato come entità HTML nel markup).
    expect(markup).toContain('have an account? Sign up');
    // Non il toggle di registrazione.
    expect(markup).not.toContain(en.auth.switchToSignIn);
  });

  it('un SOLO submit primario (type="submit"); il toggle è type="button"', () => {
    const markup = render(null);
    const submitCount = (markup.match(/type="submit"/g) ?? []).length;
    expect(submitCount).toBe(1);
    // Il toggle esiste come bottone secondario type="button".
    expect(markup).toContain('type="button"');
  });

  it('il toggle segue lo slot d\'errore a livello form (in fondo)', () => {
    const markup = render({ key: 'auth.error.unknown', field: 'form' });
    const formErrorAt = markup.indexOf(en.auth.error.unknown);
    const toggleAt = markup.indexOf(en.auth.switchToSignIn);
    expect(toggleAt).toBeGreaterThan(formErrorAt);
  });
});
