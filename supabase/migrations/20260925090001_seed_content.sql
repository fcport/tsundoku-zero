-- Seed del contenuto (lezioni ed esercizi), generato da
-- scripts/generate-content-seed.ts a partire da content/lessons/.
-- NON modificare a mano: rigenera con `npm run generate-content-seed`.
-- Idempotente: upsert su `id`; gli id derivano dal contenuto
-- (lessonId/deriveExerciseId), quindi un contenuto invariato non cambia nulla.

insert into lesson (id, ordinal, title_en, title_it, grammar_points) values
  ('を-で示す目的語', 1, 'Marking the object with を', 'Marcare l''oggetto con を', array['「を」で示す目的語', '熟字訓の読み'])
on conflict (id) do update set
  ordinal = excluded.ordinal,
  title_en = excluded.title_en,
  title_it = excluded.title_it,
  grammar_points = excluded.grammar_points;

insert into exercise (id, lesson_id, kind, payload, grammar_point, explanation_en, explanation_it) values
  ('8fed4be3-4edc-5561-af8c-ca448d7603bc', 'を-で示す目的語', 'single-select', '{"sentence":{"kanji":"今日は日本語を勉強します","kana":"きょうはにほんごをべんきょうします"},"answer":"きょう","distractors":["こんにち","いまび","きょうび"]}'::jsonb, '熟字訓の読み', 'The word 今日 is a jukujikun: the reading きょう is assigned to the whole compound, not to each kanji, so it cannot be spelled out character by character. Here を marks 日本語 as the object being studied.', 'La parola 今日 è un jukujikun: la lettura きょう è assegnata all''intero composto, non ai singoli kanji, quindi non si può ricostruire carattere per carattere. Qui を marca 日本語 come oggetto studiato.'),
  ('56f118fd-9f93-5298-a813-00080f91554c', 'を-で示す目的語', 'assemble', '{"sentence":{"kanji":"私は図書館で新しい本を借りて、毎晩少しずつ読みます","kana":"わたしはとしょかんであたらしいほんをかりて、まいばんすこしずつよみます"},"answer":["私は","図書館で","新しい","本を","借りて、","毎晩","少しずつ","読みます"]}'::jsonb, '「を」で示す目的語', 'を marks 本 (the book) as the object of the verbs 借りる and 読む. Note the okurigana that carry the inflection outside the kanji: 新しい (adjective ending), 借りて (te-form), and 読みます (polite ending).', null),
  ('733ee3d9-8e04-54d4-9f6b-a869d546037a', 'を-で示す目的語', 'select-span', '{"sentence":{"kanji":"果物を買います","kana":"くだものをかいます"},"answer":{"start":0,"end":1}}'::jsonb, '「を」で示す目的語', 'Select the object marked by を. 果物 (fruit) is a jukujikun read くだもの as a single unit — 果 and 物 are not read separately — so it forms one furigana segment: the object at segment index 0.', 'Seleziona l''oggetto marcato da を. 果物 (frutta) è un jukujikun letto くだもの come unità — 果 e 物 non si leggono separatamente — quindi forma un solo segmento di furigana: l''oggetto all''indice di segmento 0.')
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  kind = excluded.kind,
  payload = excluded.payload,
  grammar_point = excluded.grammar_point,
  explanation_en = excluded.explanation_en,
  explanation_it = excluded.explanation_it;
