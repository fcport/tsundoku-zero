// Livello features/drill: quali notti sono già state giocate (candela spenta, timbro
// preso), ricordato sul dispositivo come le scelte dell'allenamento. Una prova: se le
// notti restano, il progresso passa su Supabase e conta su ogni dispositivo.
import { browserStorage } from './drillSelection';

export const NIGHTS_DONE_STORAGE_KEY = 'tsundoku.nights.done';

export function readDoneNights(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): string[] {
  try {
    const raw = storage?.getItem(NIGHTS_DONE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function markNightDone(id: string): void {
  try {
    const done = readDoneNights();
    if (!done.includes(id)) browserStorage()?.setItem(NIGHTS_DONE_STORAGE_KEY, JSON.stringify([...done, id]));
  } catch {
    // Storage pieno o negato: la notte resta giocata solo per questa visita.
  }
}
