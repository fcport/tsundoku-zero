import { describe, expect, it } from 'vitest';
import { projectName } from './scaffold';

describe('projectName', () => {
  it('restituisce il nome canonico del prodotto', () => {
    expect(projectName()).toBe('Tsundoku Zero');
  });
});
