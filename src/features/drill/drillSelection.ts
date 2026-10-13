// Livello features/drill: la SCELTA di forme e gruppi dell'allenamento libero,
// ricordata sul dispositivo (localStorage) come le preferenze del dorso. Niente
// server: l'allenamento libero non salva progresso, solo cosa si vuole allenare.
import {
  CONJUGATION_FORMS,
  VERB_GROUPS,
  type ConjugationForm,
  type VerbGroup,
} from '../../domain/conjugation';
import { RECIPE_IDS } from '../../domain/form-builder';

export const DRILL_FORMS_STORAGE_KEY = 'tsundoku.drill.forms';
export const DRILL_GROUPS_STORAGE_KEY = 'tsundoku.drill.groups';
export const DRILL_RECIPES_STORAGE_KEY = 'tsundoku.drill.recipes';
export const DRILL_MODE_STORAGE_KEY = 'tsundoku.drill.mode';

/** Le due modalità: una forma alla volta, o più forme in catena (costruttore). */
export type DrillMode = 'forms' | 'builder';
export const DRILL_MODES: readonly DrillMode[] = ['forms', 'builder'];

/**
 * Legge un elenco salvato tenendo solo i valori conosciuti, nell'ordine canonico.
 * Assente, illeggibile o vuoto ⇒ tutti.
 */
export function readSelection<T extends string>(
  storage: Pick<Storage, 'getItem'> | undefined,
  key: string,
  known: readonly T[],
): T[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [...known];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...known];
    const kept = known.filter((value) => parsed.includes(value));
    return kept.length > 0 ? kept : [...known];
  } catch {
    return [...known];
  }
}

export function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function saveSelection(key: string, values: readonly string[]): void {
  try {
    browserStorage()?.setItem(key, JSON.stringify(values));
  } catch {
    // Storage pieno o negato: la scelta vale solo per questa visita.
  }
}

export function readFormSelection(
  storage: Pick<Storage, 'getItem'> | undefined = browserStorage(),
): ConjugationForm[] {
  return readSelection(storage, DRILL_FORMS_STORAGE_KEY, CONJUGATION_FORMS);
}

export function readGroupSelection(
  storage: Pick<Storage, 'getItem'> | undefined = browserStorage(),
): VerbGroup[] {
  return readSelection(storage, DRILL_GROUPS_STORAGE_KEY, VERB_GROUPS);
}

/**
 * Aggiunge o toglie un valore, tenendo l'ordine canonico. La scelta può restare
 * vuota mentre si sceglie: è «Comincia» a non partire senza domande.
 */
export function toggleValue<T extends string>(
  selected: readonly T[],
  value: T,
  known: readonly T[],
): T[] {
  return selected.includes(value)
    ? selected.filter((v) => v !== value)
    : known.filter((v) => v === value || selected.includes(v));
}

export function readRecipeSelection(
  storage: Pick<Storage, 'getItem'> | undefined = browserStorage(),
): string[] {
  return readSelection(storage, DRILL_RECIPES_STORAGE_KEY, RECIPE_IDS);
}

/** L'ultima modalità usata; assente o sconosciuta ⇒ una forma alla volta. */
export function readModeSelection(
  storage: Pick<Storage, 'getItem'> | undefined = browserStorage(),
): DrillMode {
  try {
    const raw = storage?.getItem(DRILL_MODE_STORAGE_KEY);
    return DRILL_MODES.find((mode) => mode === raw) ?? 'forms';
  } catch {
    return 'forms';
  }
}

export function saveMode(mode: DrillMode): void {
  try {
    browserStorage()?.setItem(DRILL_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage pieno o negato: la scelta vale solo per questa visita.
  }
}
