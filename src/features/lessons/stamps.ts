// Livello features/lessons: i caratteri dei TIMBRI (07-10-2026), con la furigana.
// 習得 per la lezione imparata; per i traguardi un carattere per famiglia: 習
// (imparare) le lezioni imparate, 覚 (ricordare) gli esercizi al livello più alto, 続 (continuare)
// la serie. Condivisi da Lezioni, fine sessione e statistiche.
import type { MilestoneFamily } from '../../domain/milestones';

export const READ_STAMP = [
  { text: '習', ruby: 'しゅう' },
  { text: '得', ruby: 'とく' },
] as const;

export const MILESTONE_STAMPS: Readonly<
  Record<MilestoneFamily, readonly { readonly text: string; readonly ruby: string }[]>
> = {
  lessonsRead: [{ text: '習', ruby: 'しゅう' }],
  topLevel: [{ text: '覚', ruby: 'かく' }],
  streak: [{ text: '続', ruby: 'ぞく' }],
};
