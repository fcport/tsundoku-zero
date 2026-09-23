import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { SignUpForm } from './SignUpForm';
import type { AuthErrorMessage } from './authFailureMessage';

// Righe della I/O Matrix per la presentazione (storia 1.6): ambiente node,
// nessun jsdom, resa statica con renderToStaticMarkup per ciascuno stato.
// L'ancoraggio del messaggio è verificato sulla POSIZIONE nel markup: il testo
// d'errore deve seguire il campo responsabile e precedere il successivo.

const VALUES = { email: '', password: '' };
const NOOP = () => {};
const NOOP_CHANGE = () => {};

function render(error: AuthErrorMessage | null, pending = false): string {
  return renderToStaticMarkup(
    <SignUpForm
      values={VALUES}
      error={error}
      pending={pending}
      onSubmit={NOOP}
      onChange={NOOP_CHANGE}
    />,
  );
}

describe('SignUpForm — campi e label da t()', () => {
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

describe('SignUpForm — ancoraggio del messaggio al campo responsabile', () => {
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

  it('errore form (unknown): a livello form in fondo, non in cima', () => {
    const markup = render({ key: 'auth.error.unknown', field: 'form' });
    const text = en.auth.error.unknown;

    expect(markup).toContain(text);

    // In fondo: segue il submit, non precede il titolo.
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

describe('SignUpForm — associazione errore↔input per l\'assistive tech', () => {
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

describe('SignUpForm — pending disabilita il submit', () => {
  it('pending={true} ⇒ il bottone di submit è disabled', () => {
    const markup = render(null, true);
    const buttonTag = markup.slice(
      markup.indexOf('<button'),
      markup.indexOf('>', markup.indexOf('<button')) + 1,
    );
    expect(buttonTag).toContain('disabled');
  });
});
