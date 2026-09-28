-- Seed del contenuto (lezioni ed esercizi), generato da
-- scripts/generate-content-seed.ts a partire da content/lessons/.
-- NON modificare a mano: rigenera con `npm run generate-content-seed`.
-- Idempotente: upsert su `id`; gli id derivano dal contenuto
-- (lessonId/deriveExerciseId), quindi un contenuto invariato non cambia nulla.

insert into lesson (id, ordinal, title_en, title_it, grammar_points) values
  ('が-が示す主語', 1, 'The subject with が, and the three predicates', 'Il soggetto con が, e i tre predicati', array['「が」が示す主語', '述語の三つの形']),
  ('を-で示す目的語', 900, 'Marking the object with を', 'Marcare l''oggetto con を', array['「を」で示す目的語', '熟字訓の読み'])
on conflict (id) do update set
  ordinal = excluded.ordinal,
  title_en = excluded.title_en,
  title_it = excluded.title_it,
  grammar_points = excluded.grammar_points;

insert into exercise (id, lesson_id, kind, payload, grammar_point, explanation_en, explanation_it) values
  ('57975a13-e0c2-5eda-9d3f-5bb832248016', 'が-が示す主語', 'assemble', '{"sentence":{"kanji":"妹が毎朝歌います","kana":"いもうとがまいあさうたいます"},"answer":["妹が","毎朝","歌います"]}'::jsonb, '「が」が示す主語', 'が marks the subject: it tells you which element the predicate is about. Here 妹 (younger sister) is the subject and 歌います (sings) is the predicate. 毎朝 (every morning) adds information but is not the subject, so it carries no が. A sentence has exactly one subject marked by が.', 'が marca il soggetto: dice di quale elemento parla il predicato. Qui 妹 (sorella minore) è il soggetto e 歌います (canta) è il predicato. 毎朝 (ogni mattina) aggiunge informazione ma non è il soggetto, quindi non porta が. Una frase ha esattamente un soggetto marcato da が.'),
  ('2e47b85b-29ba-54d7-a09a-2533decd1cb3', 'が-が示す主語', 'select-span', '{"sentence":{"kanji":"妹が学生だ","kana":"いもうとががくせいだ"},"answer":{"start":1,"end":2}}'::jsonb, '述語の三つの形', 'Select the copula. だ states an identity between the subject and what precedes it: 妹 = 学生. The relation holds in one direction only — this sentence says the sister is a student, not that students are the sister. だ is one of the three things a predicate can end with; the other two are a verb and an い-adjective.', 'Seleziona la copula. だ afferma un''identità fra il soggetto e ciò che la precede: 妹 = 学生. La relazione vale in una sola direzione — questa frase dice che la sorella è una studentessa, non che le studentesse siano la sorella. だ è una delle tre cose con cui un predicato può chiudersi; le altre due sono un verbo e un aggettivo in い.'),
  ('8347f682-389b-5c65-81af-6af0f0424823', 'が-が示す主語', 'single-select', '{"sentence":{"kanji":"水が冷たい","kana":"みずがつめたい"},"answer":"冷たい","distractors":["冷たいだ","冷だ","冷たくだ"]}'::jsonb, '述語の三つの形', 'An い-adjective is already a complete predicate: 冷たい does not mean "cold", it means "is cold". The identity function that だ performs is built into the adjective, so だ is never added after an い-adjective. This is why a predicate can end in three ways — a verb, だ, or an い-adjective — and never in two of them at once.', 'Un aggettivo in い è già un predicato completo: 冷たい non significa «freddo», significa «è freddo». La funzione di identità che svolge だ è incorporata nell''aggettivo, quindi だ non si aggiunge mai dopo un aggettivo in い. È la ragione per cui un predicato può chiudersi in tre modi — un verbo, だ, o un aggettivo in い — e mai in due insieme.'),
  ('8fed4be3-4edc-5561-af8c-ca448d7603bc', 'を-で示す目的語', 'single-select', '{"sentence":{"kanji":"今日は日本語を勉強します","kana":"きょうはにほんごをべんきょうします"},"answer":"きょう","distractors":["こんにち","いまび","きょうび"]}'::jsonb, '熟字訓の読み', 'The word 今日 is a jukujikun: the reading きょう is assigned to the whole compound, not to each kanji, so it cannot be spelled out character by character. Here を marks 日本語 as the object being studied.', 'La parola 今日 è un jukujikun: la lettura きょう è assegnata all''intero composto, non ai singoli kanji, quindi non si può ricostruire carattere per carattere. Qui を marca 日本語 come oggetto studiato.'),
  ('56f118fd-9f93-5298-a813-00080f91554c', 'を-で示す目的語', 'assemble', '{"sentence":{"kanji":"私は図書館で新しい本を借りて、毎晩少しずつ読みます","kana":"わたしはとしょかんであたらしいほんをかりて、まいばんすこしずつよみます"},"answer":["私は","図書館で","新しい","本を","借りて、","毎晩","少しずつ","読みます"]}'::jsonb, '「を」で示す目的語', 'を marks 本 (the book) as the object of the verbs 借りる and 読む. Note the okurigana that carry the inflection outside the kanji: 新しい (adjective ending), 借りて (te-form), and 読みます (polite ending).', null),
  ('4339dc49-815a-5f53-bd76-c7464e90c853', 'を-で示す目的語', 'select-span', '{"sentence":{"kanji":"果物をください","kana":"くだものをください"},"answer":{"start":0,"end":1}}'::jsonb, '「を」で示す目的語', 'Select the object marked by を. 果物 (fruit) is a jukujikun read くだもの as a single unit — 果 and 物 are not read separately — so it forms one furigana segment, and here that segment is exactly the object: segment index 0, with をください as the following segment.', 'Seleziona l''oggetto marcato da を. 果物 (frutta) è un jukujikun letto くだもの come unità — 果 e 物 non si leggono separatamente — quindi forma un solo segmento di furigana, e qui quel segmento è esattamente l''oggetto: indice 0, con をください come segmento successivo.')
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  kind = excluded.kind,
  payload = excluded.payload,
  grammar_point = excluded.grammar_point,
  explanation_en = excluded.explanation_en,
  explanation_it = excluded.explanation_it;
