import { describe, expect, it } from 'vitest';
import { isSupportedLocale, resolveLocale, FALLBACK_LOCALE } from './resolveLocale';

// Righe della I/O & Edge-Case Matrix per il confine di validazione della lingua
// (storia 1.9). `resolveLocale` è PURO: testabile senza i18next né DB. È la
// decisione che rende sicura la persistenza `text` senza `check` (1.5) — ogni
// valore non supportato/assente/malformato degrada al fallback 'en' invece di
// rompere.

describe('resolveLocale — valore supportato ⇒ quel Locale', () => {
  it("'it' ⇒ 'it'", () => {
    expect(resolveLocale('it')).toBe('it');
  });

  it("'en' ⇒ 'en'", () => {
    expect(resolveLocale('en')).toBe('en');
  });
});

describe('resolveLocale — assente/non supportato/malformato ⇒ fallback en', () => {
  it('null ⇒ en', () => {
    expect(resolveLocale(null)).toBe('en');
  });

  it('undefined ⇒ en', () => {
    expect(resolveLocale(undefined)).toBe('en');
  });

  it("'fr' (non supportato) ⇒ en", () => {
    expect(resolveLocale('fr')).toBe('en');
  });

  it("'en-US' (variante regionale) ⇒ en", () => {
    expect(resolveLocale('en-US')).toBe('en');
  });

  it("'' (stringa vuota) ⇒ en", () => {
    expect(resolveLocale('')).toBe('en');
  });

  it('il fallback è esattamente FALLBACK_LOCALE', () => {
    expect(resolveLocale('fr')).toBe(FALLBACK_LOCALE);
  });
});

describe('isSupportedLocale — type guard', () => {
  it("'en'/'it' ⇒ true", () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('it')).toBe(true);
  });

  it('valori non supportati / non stringa ⇒ false', () => {
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});
