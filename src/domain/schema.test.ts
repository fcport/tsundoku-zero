import { describe, expect, it } from 'vitest';
import {
  array,
  discriminatedUnion,
  integer,
  literal,
  nonEmptyArray,
  nonEmptyString,
  number,
  object,
  optional,
  refine,
  string,
  type Infer,
} from './schema';

// Test del kit di schema puro (AC1): il validatore deriva dallo schema e
// raccoglie gli issue con il `path` annidato, senza lanciare.

describe('primitivi', () => {
  it('string() accetta una stringa e rifiuta i non-stringa col path', () => {
    expect(string().parse('ciao')).toEqual({ ok: true, value: 'ciao' });
    const bad = string().parse(42, ['campo']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues).toHaveLength(1);
      expect(bad.issues[0].path).toEqual(['campo']);
    }
  });

  it('number() rifiuta NaN e Infinity', () => {
    expect(number().parse(3.14).ok).toBe(true);
    expect(number().parse(Number.NaN).ok).toBe(false);
    expect(number().parse(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(number().parse(Number.NEGATIVE_INFINITY).ok).toBe(false);
    expect(number().parse('1').ok).toBe(false);
  });
});

describe('refine / nonEmptyString / integer', () => {
  it('nonEmptyString() rifiuta stringa vuota e soli spazi', () => {
    expect(nonEmptyString().parse('x').ok).toBe(true);
    expect(nonEmptyString().parse('').ok).toBe(false);
    expect(nonEmptyString().parse('   ').ok).toBe(false);
  });

  it('integer() rifiuta i non-interi', () => {
    expect(integer().parse(5).ok).toBe(true);
    expect(integer().parse(1.5).ok).toBe(false);
  });

  it('refine() riporta il message sul path corrente quando il predicato è falso', () => {
    const positive = refine(number(), (n) => n > 0, 'positivo richiesto');
    const bad = positive.parse(-1, ['n']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0]).toEqual({ path: ['n'], message: 'positivo richiesto' });
    }
  });
});

describe('array', () => {
  it('valida ogni elemento e propaga l’indice nel path', () => {
    const schema = array(nonEmptyString());
    expect(schema.parse(['a', 'b']).ok).toBe(true);
    const bad = schema.parse(['a', '', 3]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      // due elementi malformati (indice 1 vuoto, indice 2 non-stringa).
      expect(bad.issues.map((i) => i.path)).toEqual([[1], [2]]);
    }
  });

  it('nonEmptyArray() rifiuta l’array vuoto', () => {
    expect(nonEmptyArray(string()).parse([]).ok).toBe(false);
    expect(nonEmptyArray(string()).parse(['x']).ok).toBe(true);
  });

  it('rifiuta un input non-array col path', () => {
    const bad = array(string()).parse('nope', ['xs']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['xs']);
    }
  });
});

describe('optional', () => {
  const schema = object({ req: string(), opt: optional(string()) });

  it('accetta la chiave opzionale ASSENTE', () => {
    const result = schema.parse({ req: 'x' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ req: 'x' });
      // la chiave assente resta assente, non `opt: undefined`.
      expect('opt' in result.value).toBe(false);
    }
  });

  it('accetta la chiave opzionale PRESENTE e valida', () => {
    const result = schema.parse({ req: 'x', opt: 'y' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ req: 'x', opt: 'y' });
    }
  });

  it('rifiuta la chiave opzionale PRESENTE ma di tipo errato', () => {
    const bad = schema.parse({ req: 'x', opt: 42 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['opt']);
    }
  });
});

describe('object', () => {
  it('rifiuta un input non-object col path', () => {
    const bad = object({ a: string() }).parse(null, ['root']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['root']);
    }
  });

  it('ignora le chiavi extra dell’input', () => {
    const result = object({ a: string() }).parse({ a: 'x', b: 'ignorato' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ a: 'x' });
    }
  });

  it('raccoglie TUTTI gli errori: due chiavi malformate ⇒ due issue coi rispettivi path', () => {
    const schema = object({ a: string(), b: number() });
    const bad = schema.parse({ a: 1, b: 'nope' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues).toHaveLength(2);
      expect(bad.issues.map((i) => i.path)).toEqual([['a'], ['b']]);
    }
  });

  it('propaga il path ANNIDATO fino al campo malformato', () => {
    const schema = object({
      outer: object({
        inner: array(object({ leaf: nonEmptyString() })),
      }),
    });
    const bad = schema.parse({ outer: { inner: [{ leaf: 'ok' }, { leaf: '' }] } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['outer', 'inner', 1, 'leaf']);
    }
  });
});

describe('literal', () => {
  it('accetta SOLO il valore esatto e inferisce il letterale', () => {
    const schema = literal('single-select');
    const result = schema.parse('single-select');
    expect(result).toEqual({ ok: true, value: 'single-select' });
    if (result.ok) {
      // Il tipo prodotto è il letterale, non `string`.
      const narrowed: 'single-select' = result.value;
      expect(narrowed).toBe('single-select');
    }
  });

  it('rifiuta un valore diverso col path corrente', () => {
    const bad = literal('single-select').parse('assemble', ['kind']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['kind']);
    }
  });
});

describe('discriminatedUnion', () => {
  const union = discriminatedUnion('kind', {
    a: object({ kind: literal('a'), x: nonEmptyString() }),
    b: object({ kind: literal('b'), y: integer() }),
  });

  it('delega alla variante giusta secondo il discriminante', () => {
    const ra = union.parse({ kind: 'a', x: 'ciao' });
    expect(ra.ok).toBe(true);
    if (ra.ok && ra.value.kind === 'a') {
      expect(ra.value.x).toBe('ciao');
    }
    const rb = union.parse({ kind: 'b', y: 3 });
    expect(rb.ok).toBe(true);
    if (rb.ok && rb.value.kind === 'b') {
      expect(rb.value.y).toBe(3);
    }
  });

  it('discriminante sconosciuto ⇒ issue sul path del discriminante', () => {
    const bad = union.parse({ kind: 'c', z: 1 }, ['root']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['root', 'kind']);
    }
  });

  it('discriminante NON stringa ⇒ issue sul path del discriminante', () => {
    const bad = union.parse({ kind: 42 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['kind']);
    }
  });

  it('input non-object ⇒ issue sul path corrente', () => {
    const bad = union.parse('nope', ['root']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['root']);
    }
  });

  it('propaga il path ANNIDATO della variante scelta fino al campo malformato', () => {
    // Discriminante noto (delega alla variante), ma un campo interno è malformato:
    // l'issue localizza il campo, non il discriminante.
    const bad = union.parse({ kind: 'a', x: '' }, ['exercises', 1]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0].path).toEqual(['exercises', 1, 'x']);
    }
  });
});

describe('Infer (fonte unica, AC1)', () => {
  const inferSchema = object({ req: string(), opt: optional(number()) });

  it('le chiavi optional sono `?` nel tipo inferito', () => {
    type Shape = Infer<typeof inferSchema>;
    // Assegnabilità: un valore senza `opt` è valido ⇒ `opt` è opzionale nel tipo.
    const withoutOpt: Shape = { req: 'x' };
    const withOpt: Shape = { req: 'x', opt: 1 };
    expect(withoutOpt.req).toBe('x');
    expect(withOpt.opt).toBe(1);
    // E lo schema che PRODUCE quel tipo valida coerentemente a runtime (AC1).
    expect(inferSchema.parse(withoutOpt).ok).toBe(true);
    expect(inferSchema.parse(withOpt).ok).toBe(true);
  });
});
