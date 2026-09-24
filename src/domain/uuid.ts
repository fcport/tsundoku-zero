// Livello domain: `uuidv5` PURO (RFC 4122 v5) scritto in TypeScript, senza
// alcun import né global di piattaforma (AD-1). Il dominio vieta ogni pacchetto
// npm (`uuid` incluso, retto in CI da `boundaries/external`) e la sua filosofia
// esclude i global di piattaforma: `crypto`/`crypto.subtle` e `TextEncoder` sono
// FUORI. In più `crypto.subtle.digest` è ASYNC — renderebbe l'identità una
// `Promise`, contaminando ogni consumatore. Perciò SHA-1 e l'encoding UTF-8 si
// scrivono a mano: deterministici, senza stato né I/O, verificati contro vettori
// RFC 4122 noti (`./uuid.test.ts`). È esattamente ciò che il pacchetto `uuid`
// fa internamente nel suo fallback JS.
//
// Tutte le operazioni sono a 32 bit non segnati: si normalizza con `>>> 0` e si
// combina con `| 0` dove serve, replicando l'aritmetica a parola di SHA-1.

/**
 * Helper interno: codifica una stringa in UTF-8 come array di byte (0..255),
 * iterando per CODE POINT (`for…of` sfrutta l'iteratore di stringa, che
 * restituisce code point interi, gestendo le COPPIE SURROGATE senza spezzarle).
 * Puro, nessun `TextEncoder` (global di piattaforma vietato nel dominio, AD-1).
 */
function utf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return bytes;
}

/** Rotazione a sinistra di `n` bit su una parola di 32 bit non segnata. */
function rotl(value: number, n: number): number {
  return ((value << n) | (value >>> (32 - n))) >>> 0;
}

/**
 * Helper interno: SHA-1 (RFC 3174) PURO su un array di byte, restituisce 20 byte
 * di digest. Padding: si appende `0x80`, poi zeri fino a lunghezza ≡ 56 (mod 64),
 * poi la lunghezza in BIT come intero big-endian a 64 bit. La hi-word della
 * lunghezza usa `Math.floor(len / 2^29)` (funzione pura del linguaggio) così
 * l'aritmetica resta corretta anche oltre i 2^29 byte, senza dipendere dai 53 bit
 * dei `number` per lo shift. Deterministico, senza stato, senza I/O.
 */
function sha1(bytes: readonly number[]): number[] {
  const message = bytes.slice();
  const bitLenLow = (message.length * 8) >>> 0;
  const bitLenHigh = Math.floor(message.length / 0x20000000) >>> 0;

  message.push(0x80);
  while (message.length % 64 !== 56) {
    message.push(0);
  }
  // Lunghezza in bit, 64 bit big-endian (hi word poi lo word).
  message.push(
    (bitLenHigh >>> 24) & 0xff,
    (bitLenHigh >>> 16) & 0xff,
    (bitLenHigh >>> 8) & 0xff,
    bitLenHigh & 0xff,
    (bitLenLow >>> 24) & 0xff,
    (bitLenLow >>> 16) & 0xff,
    (bitLenLow >>> 8) & 0xff,
    bitLenLow & 0xff,
  );

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Array<number>(80);
  for (let chunk = 0; chunk < message.length; chunk += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = chunk + i * 4;
      w[i] =
        ((message[j] << 24) |
          (message[j + 1] << 16) |
          (message[j + 2] << 8) |
          message[j + 3]) >>>
        0;
    }
    for (let i = 16; i < 80; i += 1) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (((rotl(a, 5) + f) >>> 0) + ((e + k) >>> 0) + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const digest: number[] = [];
  for (const h of [h0, h1, h2, h3, h4]) {
    digest.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
  }
  return digest;
}

/**
 * Helper interno: interpreta la forma canonica `8-4-4-4-12` di un UUID come 16
 * byte. Ignora i trattini e legge le coppie di nibble esadecimali. Puro; usato
 * per convertire i namespace in byte prima dell'hashing.
 */
function parseUuid(uuid: string): number[] {
  const hex = uuid.replace(/-/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

/**
 * Helper interno: formatta 16 byte nella forma canonica `8-4-4-4-12` in
 * minuscolo. Ogni byte è due nibble esadecimali con zero-padding. Puro.
 */
function formatUuid(bytes: readonly number[]): string {
  const hex = bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * UUID v5 (RFC 4122): SHA-1 di `namespace(16 byte) ++ utf8(name)`, si prendono i
 * primi 16 byte del digest, si impostano il nibble di VERSIONE a `5`
 * (`b[6] = (b[6] & 0x0f) | 0x50`) e i bit di VARIANTE a `10xx`
 * (`b[8] = (b[8] & 0x3f) | 0x80`), infine si formatta canonico minuscolo.
 * Deterministico e SINCRONO: stessa coppia `(name, namespace)` ⇒ stesso id.
 */
export function uuidv5(name: string, namespace: string): string {
  const message = parseUuid(namespace).concat(utf8Bytes(name));
  const hash = sha1(message);
  const bytes = hash.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // versione 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122 (10xx)
  return formatUuid(bytes);
}

/** Namespace standard RFC 4122 per i nomi DNS. */
export const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/** Namespace standard RFC 4122 per gli URL. */
export const URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
