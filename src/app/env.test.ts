import { describe, expect, it } from 'vitest';
import { ConfigError, readConfig, type AppConfig } from './env';

// Righe della I/O Matrix del validatore (storia 1.2), esercitate passando
// `source` espliciti: nessuna dipendenza dall'ambiente Vite. Ogni asserzione
// verifica che il messaggio d'errore NOMINI la variabile responsabile.

const validSource = {
  VITE_SUPABASE_URL: 'https://xyzcompany.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key-abc123',
} as const;

describe('readConfig', () => {
  it('config valida ⇒ AppConfig tipizzato e congelato', () => {
    const config = readConfig({ ...validSource });

    expect(config).toEqual<AppConfig>({
      supabaseUrl: 'https://xyzcompany.supabase.co',
      supabaseAnonKey: 'anon-key-abc123',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('accetta anche uno schema http', () => {
    const config = readConfig({
      ...validSource,
      VITE_SUPABASE_URL: 'http://localhost:54321',
    });
    expect(config.supabaseUrl).toBe('http://localhost:54321');
  });

  it('var mancante ⇒ ConfigError che nomina VITE_SUPABASE_URL', () => {
    const call = () =>
      readConfig({ VITE_SUPABASE_ANON_KEY: validSource.VITE_SUPABASE_ANON_KEY });

    expect(call).toThrow(ConfigError);
    expect(call).toThrow(/VITE_SUPABASE_URL/);
  });

  it('stringa vuota o di soli spazi ⇒ trattata come mancante', () => {
    for (const empty of ['', '   ', '\t\n']) {
      const call = () =>
        readConfig({ ...validSource, VITE_SUPABASE_URL: empty });
      expect(call).toThrow(ConfigError);
      expect(call).toThrow(/VITE_SUPABASE_URL/);
    }
  });

  it('anon key mancante ⇒ ConfigError che nomina VITE_SUPABASE_ANON_KEY', () => {
    const call = () =>
      readConfig({ VITE_SUPABASE_URL: validSource.VITE_SUPABASE_URL });

    expect(call).toThrow(ConfigError);
    expect(call).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('URL malformato (non http/https) ⇒ ConfigError che nomina la variabile e il motivo', () => {
    const call = () => readConfig({ ...validSource, VITE_SUPABASE_URL: 'pippo' });

    expect(call).toThrow(ConfigError);
    expect(call).toThrow(/VITE_SUPABASE_URL/);
    // Il messaggio spiega il motivo, non solo il nome.
    expect(call).toThrow(/URL valido/);
  });

  it('URL con schema non http (es. ftp) ⇒ ConfigError che nomina la variabile', () => {
    const call = () =>
      readConfig({ ...validSource, VITE_SUPABASE_URL: 'ftp://example.com' });

    expect(call).toThrow(ConfigError);
    expect(call).toThrow(/VITE_SUPABASE_URL/);
  });

  it('raccoglie TUTTI i problemi, non si ferma al primo', () => {
    let error: unknown;
    try {
      readConfig({ VITE_SUPABASE_URL: 'pippo' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ConfigError);
    const configError = error as ConfigError;
    // URL malformato E anon key mancante: entrambe nominate.
    expect(configError.message).toMatch(/VITE_SUPABASE_URL/);
    expect(configError.message).toMatch(/VITE_SUPABASE_ANON_KEY/);
    expect(configError.variables).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
    ]);
  });
});
