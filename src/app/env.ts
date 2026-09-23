// Livello app (AD-1): l'UNICO punto che legge la configurazione da
// import.meta.env. Nessun altro modulo deve toccare le VITE_* direttamente,
// così i consumatori futuri (client Supabase, storia 1.5) ricevono un
// AppConfig tipizzato invece di frugare nell'ambiente.
//
// Validazione fail-fast a mano, senza dipendenze esterne (niente zod): due
// variabili e un controllo URL non giustificano una dip runtime. Lo schema
// resta strict e senza `any`. Il livello app può usare i global di piattaforma
// (qui `URL`) — è il confine di AD-1 a permetterlo.

/**
 * Configurazione validata dell'applicazione. Congelata: i consumatori la
 * leggono, non la mutano.
 */
export interface AppConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}

/**
 * Errore di configurazione. Il messaggio ELENCA ogni variabile problematica
 * per nome, così l'operatore sa esattamente cosa manca o è malformato. Il boot
 * lo intercetta e interrompe il mount di React (stato parzialmente configurato
 * proibito, storia 1.2).
 */
export class ConfigError extends Error {
  /** I nomi delle variabili responsabili, nell'ordine dei descrittori. */
  readonly variables: readonly string[];

  constructor(problems: readonly string[], variables: readonly string[]) {
    super(
      'Configurazione non valida: impossibile avviare l\'applicazione.\n' +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
    this.name = 'ConfigError';
    this.variables = variables;
    // Ripristina la catena del prototipo dopo l'estensione di un built-in,
    // così `instanceof ConfigError` regge anche transpilato a ES5-like.
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

/**
 * Descrittore di una variabile richiesta. `validate` è opzionale: se presente,
 * riceve il valore già garantito come stringa non vuota e ritorna un motivo di
 * errore (stringa) oppure `undefined` se il valore è accettabile.
 */
interface VarDescriptor {
  readonly name: string;
  readonly assign: (config: MutableConfig, value: string) => void;
  readonly validate?: (value: string) => string | undefined;
}

type MutableConfig = { -readonly [K in keyof AppConfig]: AppConfig[K] };

/** Vero se `value` è una stringa con almeno un carattere non-spazio. */
function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Il valore deve essere un URL assoluto con schema http o https. */
function validateHttpUrl(value: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'non è un URL valido (atteso http(s)://…)';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `usa lo schema "${parsed.protocol}"; atteso http o https`;
  }
  return undefined;
}

// Insieme richiesto: le due VITE_* dichiarate in .env.example. Nessun altro
// modulo aggiunge chiavi qui — è il contratto centrale della config.
const DESCRIPTORS: readonly VarDescriptor[] = [
  {
    name: 'VITE_SUPABASE_URL',
    validate: validateHttpUrl,
    assign: (config, value) => {
      config.supabaseUrl = value;
    },
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    assign: (config, value) => {
      config.supabaseAnonKey = value;
    },
  },
];

/**
 * Legge e valida la configurazione dell'ambiente. `source` è iniettabile
 * (default `import.meta.env`) così i test passano oggetti espliciti senza
 * dipendere dall'ambiente Vite.
 *
 * Raccoglie TUTTI i problemi prima di lanciare: chi corregge la config vede
 * ogni variabile mancante o malformata in un colpo solo, non una alla volta.
 *
 * @throws {ConfigError} se una variabile richiesta manca, è vuota o malformata.
 */
export function readConfig(
  source: Record<string, unknown> = import.meta.env,
): AppConfig {
  const config: MutableConfig = { supabaseUrl: '', supabaseAnonKey: '' };
  const problems: string[] = [];
  const badVariables: string[] = [];

  for (const descriptor of DESCRIPTORS) {
    const value = source[descriptor.name];

    if (!isNonBlankString(value)) {
      problems.push(`${descriptor.name} è mancante o vuota`);
      badVariables.push(descriptor.name);
      continue;
    }

    const trimmed = value.trim();
    const reason = descriptor.validate?.(trimmed);
    if (reason !== undefined) {
      problems.push(`${descriptor.name} ${reason}`);
      badVariables.push(descriptor.name);
      continue;
    }

    descriptor.assign(config, trimmed);
  }

  if (problems.length > 0) {
    throw new ConfigError(problems, badVariables);
  }

  return Object.freeze(config);
}

/**
 * Esito della decisione di boot: o la config è valida (`ok` con l'AppConfig),
 * o è invalida per una `ConfigError` (`config-error` con l'errore da mostrare).
 * Un errore INATTESO (non ConfigError) non è un esito: `decideBoot` lo rilancia.
 */
export type BootDecision =
  | { readonly kind: 'ok'; readonly config: AppConfig }
  | { readonly kind: 'config-error'; readonly error: ConfigError };

/**
 * Decide se l'applicazione può avviarsi, SENZA toccare il DOM: la decisione è
 * così testabile in ambiente node, separata dal montaggio di React che vive in
 * main.tsx. Discrimina la ConfigError (config invalida ⇒ non montare) da ogni
 * altro errore, che rilancia invece di mascherare.
 */
export function decideBoot(
  source: Record<string, unknown> = import.meta.env,
): BootDecision {
  try {
    return { kind: 'ok', config: readConfig(source) };
  } catch (error) {
    if (error instanceof ConfigError) return { kind: 'config-error', error };
    throw error; // errore inatteso: non lo mascheriamo
  }
}
