// Livello features/kotodama: i progressi del gioco dei kana (punti e nemici
// battuti), ricordati sul dispositivo come le notti della pila. Una prova: se il
// gioco resta, i progressi passano su Supabase e valgono su ogni dispositivo.
import { EMPTY_PROGRESS, type KotodamaProgress } from '../../domain/kotodama';
import { browserStorage } from '../drill/drillSelection';

export const KOTODAMA_STORAGE_KEY = 'tsundoku.kotodama';

export function readProgress(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): KotodamaProgress {
  try {
    const raw = storage?.getItem(KOTODAMA_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_PROGRESS;
    const { xp, wins } = parsed as { xp?: unknown; wins?: unknown };
    const cleanWins: Record<string, number> = {};
    if (typeof wins === 'object' && wins !== null) {
      for (const [id, n] of Object.entries(wins)) if (typeof n === 'number' && n > 0) cleanWins[id] = Math.floor(n);
    }
    return { xp: typeof xp === 'number' && xp > 0 ? Math.floor(xp) : 0, wins: cleanWins };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(progress: KotodamaProgress): void {
  try {
    browserStorage()?.setItem(KOTODAMA_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage pieno o negato: i progressi restano solo per questa visita.
  }
}
