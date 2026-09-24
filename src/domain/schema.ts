// Livello domain: un kit di schema PURO, senza dipendenze esterne (AD-1).
// Non importa react, @supabase/supabase-js, né alcun pacchetto npm (Zod incluso):
// AD-1 vieta al dominio ogni import di pacchetto, imposto in CI da
// `boundaries/external`. La fonte UNICA tipo⇄validatore va quindi costruita in
// TypeScript puro — si scrive lo schema una volta e il tipo si INFERISCE
// (`Infer<typeof schema>`), mai da un secondo elenco parallelo (AC1).
//
// Uno `Schema<T>` è un oggetto con `parse(input): ParseResult<T>` più il marchio
// di fantasma `_output` da cui `Infer` estrae il tipo. Il parse NON lancia:
// raccoglie gli errori come lista di `SchemaIssue` — `{ path, message }` — così
// il campo malformato è localizzabile e 2.6 potrà riferirlo in CI. La
// convenzione d'esito (`{ ok: true; value } | { ok: false; issues }`) segue
// quella di `src/features/auth/authOutcome.ts`.

/**
 * Un errore di validazione localizzato. `path` è la sequenza di chiavi/indici
 * che porta al campo malformato (es. `['exercises', 1, 'kind']`), `message` lo
 * descrive. Il validatore raccoglie una lista di questi invece di lanciare.
 */
export interface SchemaIssue {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Esito di un parse: successo con il valore tipizzato, oppure fallimento con la
 * lista degli errori localizzati. Stessa forma discriminata su `ok` di
 * `AuthSubmitOutcome`.
 */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: ReadonlyArray<SchemaIssue> };

/**
 * Uno schema per il tipo `T`. Porta il validatore `parse` e il marchio di
 * fantasma `_output` (mai letto a runtime, `undefined`) da cui `Infer` deriva il
 * tipo prodotto. È la fonte unica: da uno `Schema<T>` si ottengono sia il
 * validatore (`.parse`) sia il tipo (`Infer<typeof schema>`), che quindi non
 * possono disallinearsi (AC1).
 */
export interface Schema<T> {
  readonly parse: (input: unknown, path?: ReadonlyArray<string | number>) => ParseResult<T>;
  /** Marchio di fantasma per l'inferenza; mai valorizzato a runtime. */
  readonly _output?: T;
}

/** Estrae il tipo prodotto da uno `Schema`. `Infer<Schema<T>>` è `T`. */
export type Infer<S> = S extends Schema<infer T> ? T : never;

/** Un issue singolo, come esito di fallimento. Helper interno. */
function fail(path: ReadonlyArray<string | number>, message: string): ParseResult<never> {
  return { ok: false, issues: [{ path, message }] };
}

/** Un successo. Helper interno. */
function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

/** Schema per una stringa qualsiasi. */
export function string(): Schema<string> {
  return {
    parse(input, path = []) {
      if (typeof input !== 'string') {
        return fail(path, `atteso string, ricevuto ${typeName(input)}`);
      }
      return ok(input);
    },
  };
}

/** Schema per un numero finito (esclude `NaN`/`Infinity`). */
export function number(): Schema<number> {
  return {
    parse(input, path = []) {
      if (typeof input !== 'number' || !Number.isFinite(input)) {
        return fail(path, `atteso number, ricevuto ${typeName(input)}`);
      }
      return ok(input);
    },
  };
}

/** Schema per un booleano. */
export function boolean(): Schema<boolean> {
  return {
    parse(input, path = []) {
      if (typeof input !== 'boolean') {
        return fail(path, `atteso boolean, ricevuto ${typeName(input)}`);
      }
      return ok(input);
    },
  };
}

/**
 * Marca uno schema come opzionale: accetta `undefined` (e la chiave assente in
 * un oggetto) oltre ai valori validi dello schema di base. È il segnale su cui
 * `object()` deriva le chiavi `?` — un valore il cui `Infer` include `undefined`
 * diventa una chiave opzionale.
 */
export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    parse(input, path = []) {
      if (input === undefined) {
        return ok(undefined);
      }
      return schema.parse(input, path);
    },
  };
}

/**
 * Restringe uno schema con un predicato puro: se `predicate(value)` è falso,
 * l'issue riporta `message` sul path corrente. Usato per i vincoli «non vuoto»,
 * «intero», ecc. Non altera il tipo prodotto.
 */
export function refine<T>(
  schema: Schema<T>,
  predicate: (value: T) => boolean,
  message: string,
): Schema<T> {
  return {
    parse(input, path = []) {
      const result = schema.parse(input, path);
      if (!result.ok) {
        return result;
      }
      if (!predicate(result.value)) {
        return fail(path, message);
      }
      return result;
    },
  };
}

/** Stringa non vuota (dopo trim). Helper su `string()` + `refine()`. */
export function nonEmptyString(): Schema<string> {
  return refine(string(), (value) => value.trim().length > 0, 'stringa non vuota richiesta');
}

/** Intero (numero finito senza parte frazionaria). Helper su `number()`. */
export function integer(): Schema<number> {
  return refine(number(), (value) => Number.isInteger(value), 'intero richiesto');
}

/**
 * Schema per un array omogeneo. Ogni elemento è validato con `element` e il suo
 * indice entra nel `path` (`[...path, i]`), così l'errore localizza la posizione
 * esatta. Raccoglie TUTTI gli errori degli elementi, non solo il primo.
 */
export function array<T>(element: Schema<T>): Schema<T[]> {
  return {
    parse(input, path = []) {
      if (!Array.isArray(input)) {
        return fail(path, `atteso array, ricevuto ${typeName(input)}`);
      }
      const value: T[] = [];
      const issues: SchemaIssue[] = [];
      input.forEach((item, i) => {
        const result = element.parse(item, [...path, i]);
        if (result.ok) {
          value.push(result.value);
        } else {
          issues.push(...result.issues);
        }
      });
      if (issues.length > 0) {
        return { ok: false, issues };
      }
      return ok(value);
    },
  };
}

/** Array con almeno un elemento. Helper su `array()` + `refine()`. */
export function nonEmptyArray<T>(element: Schema<T>): Schema<T[]> {
  return refine(array(element), (value) => value.length > 0, 'almeno un elemento richiesto');
}

/** Mappa di schemi per le proprietà di un oggetto. */
export type ObjectShape = Record<string, Schema<unknown>>;

/**
 * Tipo prodotto da `object()`: le chiavi il cui schema ammette `undefined`
 * (quelle passate per `optional()`) diventano opzionali (`?`), le altre
 * obbligatorie. `OptionalKeys` seleziona le chiavi il cui `Infer` include
 * `undefined`; `ObjectOutput` le rende `?` e mantiene obbligatorie le restanti.
 */
type OptionalKeys<S extends ObjectShape> = {
  [K in keyof S]: undefined extends Infer<S[K]> ? K : never;
}[keyof S];

type RequiredKeys<S extends ObjectShape> = Exclude<keyof S, OptionalKeys<S>>;

type ObjectOutput<S extends ObjectShape> = {
  [K in RequiredKeys<S>]: Infer<S[K]>;
} & {
  [K in OptionalKeys<S>]?: Infer<S[K]>;
};

// Appiattisce l'intersezione `{required} & {optional?}` in un unico tipo
// oggetto, così `Infer` mostra una forma leggibile invece dell'intersezione.
type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Schema per un oggetto con forma fissa. Ogni proprietà è validata con lo schema
 * corrispondente e la sua chiave entra nel `path`. Le chiavi opzionali (definite
 * con `optional()`) sono inferite come `?`; le altre come obbligatorie. Le chiavi
 * extra dell'input vengono ignorate (non producono un valore, non un errore).
 * Raccoglie TUTTI gli errori delle proprietà.
 */
export function object<S extends ObjectShape>(shape: S): Schema<Prettify<ObjectOutput<S>>> {
  return {
    parse(input, path = []) {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return fail(path, `atteso object, ricevuto ${typeName(input)}`);
      }
      const record = input as Record<string, unknown>;
      const value: Record<string, unknown> = {};
      const issues: SchemaIssue[] = [];
      for (const key of Object.keys(shape)) {
        const result = shape[key].parse(record[key], [...path, key]);
        if (result.ok) {
          // Le chiavi opzionali assenti restano assenti (non `key: undefined`),
          // così il valore prodotto rispecchia la forma inferita.
          if (result.value !== undefined) {
            value[key] = result.value;
          }
        } else {
          issues.push(...result.issues);
        }
      }
      if (issues.length > 0) {
        return { ok: false, issues };
      }
      return ok(value as Prettify<ObjectOutput<S>>);
    },
  };
}

/** Nome leggibile del tipo runtime di `input`, per i messaggi d'errore. */
function typeName(input: unknown): string {
  if (input === null) {
    return 'null';
  }
  if (Array.isArray(input)) {
    return 'array';
  }
  return typeof input;
}
