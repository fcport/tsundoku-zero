import { describe, expect, it } from 'vitest';
import { DataError } from './dataError';

// Il contratto del fallimento tipizzato del ciclo (AC2): `instanceof Error`,
// `name === 'DataError'`, porta l'`operation` fallita e preserva la causa
// sottostante. È ciò su cui gli stati di errore/retry di TanStack Query fanno
// affidamento — una promise rifiutata con un errore riconoscibile, non un valore
// degradato.

describe('DataError — fallimento tipizzato degli adattatori del ciclo', () => {
  it('è instanceof Error', () => {
    expect(new DataError('listDue')).toBeInstanceOf(Error);
  });

  it("ha name === 'DataError'", () => {
    expect(new DataError('listDue').name).toBe('DataError');
  });

  it("porta l'operation fallita", () => {
    expect(new DataError('listLessons').operation).toBe('listLessons');
  });

  it('preserva la causa sottostante', () => {
    const cause = { message: 'rls denied' };
    const error = new DataError('listDue', cause);
    expect(error.cause).toBe(cause);
  });

  it('è lanciabile e catturabile come DataError', () => {
    const throwing = () => {
      throw new DataError('listUnlockedLessonIds', new Error('boom'));
    };
    expect(throwing).toThrow(DataError);
  });
});
