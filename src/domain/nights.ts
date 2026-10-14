// Livello domain: le notti, in ordine. Usano solo la grammatica che le lezioni
// hanno già spiegato (fino alla 19: たい, il potenziale, il passato, です e ます).
import type { Night } from './night';

const tanuki = (it: string, en: string) => ({ kind: 'speech', speaker: 'tanuki', text: { it, en } }) as const;
const narration = (it: string, en: string) => ({ kind: 'narration', text: { it, en } }) as const;

/** 第一夜: il primo libro risvegliato. */
const FIRST_NIGHT: Night = {
  id: 'first-candle',
  kanjiTitle: '第一夜',
  title: { it: 'La prima candela', en: 'The first candle' },
  stamp: [{ text: '一', ruby: 'いち' }],
  stampMeaning: { it: 'Prima notte', en: 'First night' },
  steps: [
    narration(
      "È notte. Davanti a te c'è la pila: i libri comprati e mai aperti. Ne conti ventotto. Su quello in cima è seduto un tanuki, e non ricordi di averlo fatto entrare.",
      "It is night. In front of you is the pile: the books you bought and never opened. You count twenty-eight. A tanuki is sitting on the top one, and you don't remember letting it in.",
    ),
    narration(
      "Accanto alla pila c'è una candela accesa. Il tanuki si lecca una zampa e indica il libro sotto di lui.",
      'Next to the pile a candle is burning. The tanuki licks a paw and points at the book beneath it.',
    ),
    {
      kind: 'line',
      speaker: 'tanuki',
      ja: { kanji: 'この本は、ずっと読まれたかったんですよ。', kana: 'このほんは、ずっとよまれたかったんですよ。' },
      translation: { it: 'Questo libro voleva tanto essere letto, sai.', en: 'This book has wanted to be read for so long, you know.' },
    },
    narration(
      "Il libro si apre da solo. Le pagine sono bianche, poi l'inchiostro sale dalla carta come una macchia d'acqua e forma una frase.",
      'The book opens by itself. The pages are blank, then ink rises through the paper like a water stain and forms a sentence.',
    ),
    {
      kind: 'line',
      speaker: 'book',
      ja: { kanji: 'なぜ…読まなかった？', kana: 'なぜ…よまなかった？' },
      translation: { it: 'Perché… non mi hai letto?', en: "Why… didn't you read me?" },
    },
    narration('La fiamma si piega verso di te.', 'The flame bends towards you.'),
    tanuki(
      'Digli che non volevi leggerlo. È la verità, no? Con la verità non si arrabbiano mai.',
      "Tell it you didn't want to read it. That's the truth, isn't it? They never get angry at the truth.",
    ),
    {
      kind: 'ask',
      prompt: { it: 'Cosa rispondi al libro?', en: 'What do you say to the book?' },
      options: [
        {
          id: 'couldnt',
          label: { it: 'Volevo leggerti, ma non ho potuto.', en: "I wanted to read you, but I couldn't." },
          frame: { kanji: '＿。でも、読めませんでした。', kana: '＿。でも、よめませんでした。' },
          target: { verb: '読む', pieces: ['tai', 'past', 'polite'] },
          alsoAccepted: [
            {
              answers: ['よみたかった', '読みたかった'],
              then: [
                tanuki(
                  "Mezza frase semplice e mezza cortese. Il libro se n'è accorto, ma ha capito.",
                  'Half the sentence plain and half polite. The book noticed, but it understood.',
                ),
              ],
            },
          ],
          mistakes: [
            {
              answers: ['よみたいでした', '読みたいでした', 'よみたいだった', '読みたいだった'],
              then: [
                narration("L'inchiostro si sbava e gocciola. Le parole sono uscite storte.", 'The ink smears and drips. The words came out crooked.'),
                tanuki(
                  'でした si attacca ai nomi, non alle parole in い. Le parole in い il passato se lo fanno da sole: la い finale diventa かった.',
                  'でした attaches to nouns, not to words in い. Words in い make their own past: the final い becomes かった.',
                ),
              ],
            },
            {
              answers: ['よみたかったでした', '読みたかったでした'],
              then: [
                tanuki(
                  "Due passati uno sopra l'altro. かった è già passato: dopo basta です.",
                  'Two pasts stacked on each other. かった is already past: after it, です is enough.',
                ),
              ],
            },
            {
              answers: ['よんだかった', '読んだかった', 'よんだい', '読んだい', 'よむたかった', '読むたかった'],
              then: [
                tanuki(
                  'たい non si attacca alla forma del dizionario né al passato: si attacca al radicale in i, quello di 読みます. Prima voglio, poi il passato.',
                  "たい doesn't attach to the dictionary form or to the past: it attaches to the i-stem, the one in 読みます. First want, then past.",
                ),
              ],
            },
          ],
          then: [
            narration(
              "L'inchiostro esita. Poi scende, piano, e torna dentro la carta. Le pagine si richiudono da sole, con delicatezza, come chi si gira dall'altra parte per dormire.",
              'The ink hesitates. Then it sinks, slowly, back into the paper. The pages close on their own, gently, like someone turning over to sleep.',
            ),
            tanuki('Peccato. Non avrebbe aspettato ancora a lungo.', "Pity. It wouldn't have waited much longer."),
            narration(
              'Il tanuki appoggia una zampa sulla copertina e la tiene lì.',
              'The tanuki rests a paw on the cover and keeps it there.',
            ),
          ],
        },
        {
          id: 'didnt',
          label: { it: 'Non volevo leggerti. (Il consiglio del tanuki.)', en: "I didn't want to read you. (The tanuki's advice.)" },
          frame: { kanji: '＿。', kana: '＿。' },
          target: { verb: '読む', pieces: ['tai', 'negative', 'past', 'polite'] },
          alsoAccepted: [
            {
              answers: ['よみたくなかった', '読みたくなかった'],
              then: [tanuki('Senza nemmeno です. Brutale.', 'Not even a です. Brutal.')],
            },
          ],
          mistakes: [
            {
              answers: ['よみたくないでした', '読みたくないでした'],
              then: [
                tanuki(
                  'ない finisce in い: si comporta come un aggettivo. Il passato è なかった, non ないでした.',
                  'ない ends in い: it behaves like an adjective. The past is なかった, not ないでした.',
                ),
              ],
            },
            {
              answers: ['よみたいじゃなかった', '読みたいじゃなかった', 'よみたいではなかった', '読みたいではなかった', 'よみたいじゃなかったです', '読みたいじゃなかったです'],
              then: [
                tanuki(
                  'じゃない nega i nomi. たい finisce in い: la い diventa くない, e al passato くなかった.',
                  'じゃない negates nouns. たい ends in い: the い becomes くない, and in the past くなかった.',
                ),
              ],
            },
            {
              answers: ['よまなかった', '読まなかった', 'よまなかったです', '読まなかったです', 'よみませんでした', '読みませんでした'],
              then: [
                tanuki(
                  "Che non l'hai letto lo sa già: è proprio quello che ti ha chiesto. Vuole sapere se lo volevi.",
                  "It already knows you didn't read it: that's exactly what it asked. It wants to know whether you wanted to.",
                ),
              ],
            },
          ],
          then: [
            narration(
              "Il libro sussulta. L'inchiostro smette di salire e si secca sulla pagina, in crepe sottili come fango d'estate.",
              'The book flinches. The ink stops rising and dries on the page, in thin cracks like mud in summer.',
            ),
            tanuki('Visto? Con la verità non si arrabbiano mai.', 'See? They never get angry at the truth.'),
            narration(
              'Il tanuki si china sul libro. Senti un rumore che non sai riconoscere, morbido, come carta bagnata.',
              "The tanuki bends over the book. You hear a sound you can't place, soft, like wet paper.",
            ),
          ],
        },
        {
          id: 'boring',
          label: { it: 'Eri noioso.', en: 'You were boring.' },
          hint: { it: 'noioso: つまらない', en: 'boring: つまらない' },
          frame: { kanji: '＿。', kana: '＿。' },
          target: { answers: [{ kanji: 'つまらなかったです', kana: 'つまらなかったです' }] },
          alsoAccepted: [
            {
              answers: ['つまらなかった'],
              then: [tanuki('Senza です. Neanche la cortesia di mentire. Mi piaci.', 'No です. Not even the courtesy of lying. I like you.')],
            },
          ],
          mistakes: [
            {
              answers: ['つまらないでした', 'つまらないだった'],
              then: [
                tanuki(
                  'でした si attacca ai nomi. つまらない finisce in い: il passato è つまらなかった, e se vuoi essere educato ci aggiungi です.',
                  'でした attaches to nouns. つまらない ends in い: the past is つまらなかった, and to be polite you add です.',
                ),
              ],
            },
            {
              answers: ['つめたい', 'つめたかった', 'つめたかったです', 'つめたいでした', '冷たい', '冷たかった', '冷たかったです', '冷たいでした'],
              then: [
                narration(
                  'Le pagine si coprono di brina. Hai detto つめたい, «freddo», e il libro ti ha preso alla lettera: tra le dita senti il freddo che sale dalla carta.',
                  'Frost spreads over the pages. You said つめたい, “cold”, and the book took you at your word: you feel the cold rising from the paper into your fingers.',
                ),
                tanuki("Noioso è つまらない. Freddo è un'altra storia.", 'Boring is つまらない. Cold is another story.'),
              ],
            },
            {
              answers: ['つまらない', 'つまらないです'],
              then: [
                tanuki(
                  'Al presente? Allora è noioso ancora adesso, mentre lo guardi. Lui voleva sapere di prima.',
                  "In the present? Then it's boring right now, while you look at it. It wanted to know about before.",
                ),
              ],
            },
          ],
          then: [
            narration(
              'Le pagine si svuotano una per una, finché il libro è di nuovo bianco, poi grigio, poi solo carta vecchia. Si chiude da solo con un rumore secco.',
              'The pages empty one by one, until the book is white again, then grey, then just old paper. It shuts by itself with a dry snap.',
            ),
            tanuki('Sei crudele. Mi piaci.', "You're cruel. I like you."),
          ],
        },
      ],
    },
    { kind: 'candleOut' },
    narration('La candela si spegne.', 'The candle goes out.'),
    narration(
      "Al buio conti i libri sulla pila: ventisette. Quando gli occhi si abituano, vedi il tanuki seduto dove prima c'era il libro. Si sta leccando la zampa, e la zampa è nera di inchiostro.",
      'In the dark you count the books on the pile: twenty-seven. When your eyes adjust, you see the tanuki sitting where the book used to be. It is licking its paw, and the paw is black with ink.',
    ),
    tanuki(
      'Uno in meno. Ne restano ventisette. Domani notte accendiamo la seconda candela.',
      'One fewer. Twenty-seven to go. Tomorrow night we light the second candle.',
    ),
    tanuki(
      "Non volevi chiederti dove sia finito quello che c'era scritto dentro, vero?",
      "You weren't going to ask where the writing inside went, were you?",
    ),
  ],
  foreign: [
    narration(
      "Le parole ti escono nella tua lingua. Il libro non reagisce: l'inchiostro resta fermo, come se non avesse sentito niente.",
      "The words come out in your own language. The book doesn't react: the ink stays still, as if it heard nothing.",
    ),
    tanuki('Non capisce la tua lingua. Diglielo in giapponese, se hai il coraggio.', "It doesn't understand your language. Tell it in Japanese, if you dare."),
  ],
  wrong: [
    narration(
      'La fiamma trema e si abbassa. Il libro aspetta parole che abbiano una forma.',
      'The flame trembles and shrinks. The book is waiting for words with a proper shape.',
    ),
  ],
};

export const NIGHTS: readonly Night[] = [FIRST_NIGHT];
