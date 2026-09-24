import { describe, expect, it } from 'vitest';
import { DNS_NAMESPACE, URL_NAMESPACE, uuidv5 } from './uuid';

// Prova che l'implementazione PURA di uuidv5 (SHA-1 + UTF-8 scritti a mano) è
// CORRETTA, non solo auto-coerente: la si confronta con VETTORI RFC 4122 NOTI,
// pubblicati e riproducibili con qualsiasi altra implementazione conforme. Se un
// bit di padding, di versione o di variante fosse sbagliato, questi vettori
// fallirebbero.

describe('uuidv5 puro (RFC 4122 v5)', () => {
  it('vettore noto DNS: www.example.com', () => {
    expect(uuidv5('www.example.com', DNS_NAMESPACE)).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('vettore noto DNS: python.org', () => {
    expect(uuidv5('python.org', DNS_NAMESPACE)).toBe(
      '886313e1-3b8a-5372-9b90-0c9aee199e5d',
    );
  });

  it('vettore noto URL: https://www.w3.org/', () => {
    expect(uuidv5('https://www.w3.org/', URL_NAMESPACE)).toBe(
      'c106a26a-21bb-5538-8bf2-57095d1976c1',
    );
  });

  it('vettore noto astrale (UTF-8 a 4 byte, U+20BB7 「𠮷」)', () => {
    // Copre il ramo a 4 byte di utf8Bytes (coppia surrogate / piano astrale):
    // valore pinnato contro ground truth calcolato con Node crypto.
    expect(uuidv5('\u{20BB7}', URL_NAMESPACE)).toBe('cb538b39-a61d-5315-9081-2f53bb9a8e23');
  });

  it('forma v5 canonica: 8-4-4-4-12, nibble versione 5, variante 8/9/a/b', () => {
    // Copre più coppie (name, namespace) per non appoggiarsi a un solo caso.
    const samples = [
      uuidv5('www.example.com', DNS_NAMESPACE),
      uuidv5('python.org', DNS_NAMESPACE),
      uuidv5('https://www.w3.org/', URL_NAMESPACE),
      uuidv5('', URL_NAMESPACE),
      uuidv5('猫が好きです', URL_NAMESPACE),
    ];
    for (const id of samples) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it('determinismo: stessa coppia (name, namespace) ⇒ id identico', () => {
    expect(uuidv5('python.org', DNS_NAMESPACE)).toBe(uuidv5('python.org', DNS_NAMESPACE));
    expect(uuidv5('猫が好きです', URL_NAMESPACE)).toBe(uuidv5('猫が好きです', URL_NAMESPACE));
  });
});
