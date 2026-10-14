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

/** La reazione quando al posto del passivo si usa il verbo normale: に cambia senso. */
const activeInsteadOfPassive = (it: string, en: string) => [
  tanuki(
    `Non hai messo il passivo. Con un verbo normale, に vuol dire «a»: ${it} Con il passivo, に diventa «da»: è il tanuki che lo fa a te.`,
    `You didn't use the passive. With a plain verb, に means "to": ${en} With the passive, に becomes "by": the tanuki does it to you.`,
  ),
];

/** Il seguito di una frase finita al passivo: la frase si riscrive, il tanuki capisce. */
const passiveWritten = (it: string, en: string) => [
  narration(
    "Sotto la zampa del tanuki il diario sussulta. L'inchiostro della pagina si scioglie, e la frase si riscrive da sola con la tua.",
    "Under the tanuki's paw the diary twitches. The ink on the page melts, and the sentence rewrites itself with yours.",
  ),
  narration(
    "Il tanuki abbassa lo sguardo sul diario, poi lo alza su di te. Le orecchie gli si sono appiattite all'indietro.",
    "The tanuki looks down at the diary, then up at you. Its ears have gone flat against its head.",
  ),
  tanuki(it, en),
];

/** 第二夜: il diario scritto con la tua calligrafia. */
const SECOND_NIGHT: Night = {
  id: 'the-diary',
  kanjiTitle: '第二夜',
  title: { it: 'Il diario', en: 'The diary' },
  stamp: [{ text: '二', ruby: 'に' }],
  stampMeaning: { it: 'Seconda notte', en: 'Second night' },
  steps: [
    narration(
      'Ventisette libri. Accendi la seconda candela. Il tanuki dorme acciambellato sulla pila. Ha la pancia più tonda di ieri.',
      'Twenty-seven books. You light the second candle. The tanuki is asleep, curled up on the pile. Its belly is rounder than yesterday.',
    ),
    narration(
      "In cima c'è un quaderno che non ricordi di aver comprato. Sulla copertina, con la tua calligrafia, c'è scritto 日記: diario.",
      "On top there's a notebook you don't remember buying. On the cover, in your handwriting, it says 日記: diary.",
    ),
    narration(
      "Lo apri. Ogni pagina porta una data, e sono le date di domani, di dopodomani, della settimana prossima. È la tua calligrafia, ma tu queste pagine non le hai mai scritte. L'ultima pagina scritta dice soltanto:",
      "You open it. Every page has a date, and the dates are tomorrow, the day after, next week. It's your handwriting, but you never wrote these pages. The last written page says only:",
    ),
    {
      kind: 'line',
      speaker: 'diary',
      ja: { kanji: 'あの夜、たぬきに食べられた。', kana: 'あのよる、たぬきにたべられた。' },
      translation: { it: 'Quella notte il tanuki mi ha mangiato.', en: 'That night the tanuki ate me.' },
    },
    tanuki('Quello non è un libro da leggere. Chiudilo.', "That's not a book for reading. Close it."),
    narration(
      "La candela non trema. È ferma, troppo ferma, come se stesse trattenendo il respiro. Sotto l'ultima riga l'inchiostro si muove e scrive una domanda nuova, lettera per lettera.",
      "The candle doesn't flicker. It's still, too still, as if holding its breath. Below the last line the ink moves and writes a new question, letter by letter.",
    ),
    {
      kind: 'line',
      speaker: 'diary',
      ja: { kanji: '…読みたい？', kana: '…よみたい？' },
      translation: { it: '…Vuoi leggermi?', en: '…Do you want to read me?' },
    },
    tanuki(
      'Se proprio vuoi leggerlo, diglielo con un verbo intero. E sii educato: quello lì ti conosce meglio di quanto conosci te stesso.',
      'If you really want to read it, tell it with a whole verb. And be polite: that thing knows you better than you know yourself.',
    ),
    {
      kind: 'ask',
      prompt: { it: 'Cosa rispondi al diario?', en: 'What do you say to the diary?' },
      options: [
        {
          id: 'diary-yes',
          label: { it: 'Sì, voglio leggerti.', en: 'Yes, I want to read you.' },
          frame: { kanji: 'はい、＿。', kana: 'はい、＿。' },
          target: { verb: '読む', pieces: ['tai'] },
          alsoAccepted: [
            {
              // Il soggetto detto apertamente: giusto, e il diario lo prende come la forma semplice.
              answers: ['わたしはよみたい', 'わたしは読みたい', '私はよみたい', '私は読みたい'],
              then: [],
            },
            {
              answers: ['よみたいです', '読みたいです'],
              then: [
                narration(
                  'Il diario esita, come chi si sente dare del lei da un parente. Poi si apre lo stesso, più lentamente.',
                  'The diary hesitates, like someone addressed formally by a relative. Then it opens anyway, more slowly.',
                ),
              ],
            },
          ],
          mistakes: [
            {
              answers: ['はい', 'うん', 'ええ'],
              then: [
                tanuki(
                  'Un sì non basta. Un sì è una porta lasciata socchiusa: può voler dire qualsiasi cosa. Le parole che contano hanno un verbo dentro.',
                  'A yes is not enough. A yes is a door left ajar: it can mean anything. Words that count have a verb in them.',
                ),
              ],
            },
            {
              answers: ['よむたい', '読むたい'],
              then: [
                tanuki(
                  'たい non va dopo la forma del dizionario: si attacca al radicale in i, quello di 読みます.',
                  'たい does not go after the dictionary form: it attaches to the i-stem, the one in 読みます.',
                ),
              ],
            },
            {
              answers: ['よみたかった', '読みたかった', 'よみたかったです', '読みたかったです'],
              then: [
                tanuki('Al passato? Il diario ti chiede adesso, non ieri.', "In the past? The diary is asking now, not yesterday."),
              ],
            },
          ],
          then: [
            narration(
              'Il diario si spalanca di colpo e le pagine corrono da sole. Ha capito chi gli stava parlando: con se stessi non si usa il cortese, e quel diario sei tu.',
              'The diary flies open and the pages race by on their own. It understood who was speaking: you are not polite with yourself, and that diary is you.',
            ),
            tanuki("…Te l'avevo detto di essere educato.", '…I told you to be polite.'),
          ],
        },
        {
          id: 'diary-no',
          label: { it: 'No, non voglio leggerti. (Il consiglio del tanuki.)', en: "No, I don't want to read you. (The tanuki's advice.)" },
          frame: { kanji: 'いいえ、＿。', kana: 'いいえ、＿。' },
          target: { verb: '読む', pieces: ['tai', 'negative'] },
          alsoAccepted: [{ answers: ['よみたくないです', '読みたくないです'], then: [] }],
          mistakes: [
            {
              answers: ['よみたいない', '読みたいない', 'よみたいじゃない', '読みたいじゃない'],
              then: [
                tanuki(
                  'たい finisce in い, come un aggettivo: la い diventa くない. じゃない è per i nomi.',
                  'たい ends in い, like an adjective: the い becomes くない. じゃない is for nouns.',
                ),
              ],
            },
            {
              answers: ['よまない', '読まない', 'よみません', '読みません'],
              then: [
                tanuki(
                  'Hai detto che non lo leggi. Lui ti ha chiesto se lo vuoi.',
                  "You said you don't read it. It asked whether you want to.",
                ),
              ],
            },
          ],
          then: [
            narration(
              'Il diario si chiude con un colpo secco. Il tanuki sorride, sollevato. Poi, piano, il diario si riapre da solo: non era una vera domanda.',
              'The diary snaps shut. The tanuki smiles, relieved. Then, slowly, the diary opens again by itself: it was never really a question.',
            ),
          ],
        },
      ],
    },
    narration('Le pagine si fermano su domani sera.', 'The pages stop at tomorrow night.'),
    {
      kind: 'line',
      speaker: 'diary',
      ja: {
        kanji: '明日の夜、三本目のろうそくをつけた。たぬきは笑っていた。',
        kana: 'あしたのよる、さんぼんめのろうそくをつけた。たぬきはわらっていた。',
      },
      translation: {
        it: 'Domani sera ho acceso la terza candela. Il tanuki stava ridendo.',
        en: 'Tomorrow night I lit the third candle. The tanuki was laughing.',
      },
    },
    narration(
      "Giri la pagina. Stanotte. La riga è scritta solo a metà, con la tua calligrafia, e si interrompe. La penna è appoggiata sul diario, l'inchiostro ancora fresco. Dietro di te il tanuki si è avvicinato: non l'hai sentito muoversi.",
      "You turn the page. Tonight. The line is only half written, in your handwriting, and it breaks off. The pen lies on the diary, the ink still wet. Behind you the tanuki has come closer: you didn't hear it move.",
    ),
    {
      kind: 'ask',
      prompt: {
        it: 'Finisci la frase: qualcosa che stanotte il tanuki ti ha fatto. Dopo たぬきに il verbo va al passivo.',
        en: 'Finish the sentence: something the tanuki did to you tonight. After たぬきに the verb goes in the passive.',
      },
      options: [
        {
          id: 'spoke',
          label: { it: 'Il tanuki mi ha parlato.', en: 'The tanuki spoke to me.' },
          frame: { kanji: '今夜、わたしはたぬきに＿。', kana: 'こんや、わたしはたぬきに＿。' },
          target: { verb: '話す', pieces: ['passive', 'past'] },
          alsoAccepted: [{ answers: ['はなされました', '話されました'], then: [] }],
          mistakes: [
            {
              answers: ['はなした', '話した', 'はなしました', '話しました'],
              then: activeInsteadOfPassive('hai parlato al tanuki.', 'you spoke to the tanuki.'),
            },
          ],
          then: passiveWritten(
            'Ah. Adesso sono io quello che parla. E tu quello che ascolta.',
            "Ah. Now I'm the one who speaks. And you're the one who listens.",
          ),
        },
        {
          id: 'watched',
          label: { it: 'Il tanuki mi ha guardato.', en: 'The tanuki watched me.' },
          frame: { kanji: '今夜、わたしはたぬきに＿。', kana: 'こんや、わたしはたぬきに＿。' },
          target: { verb: '見る', pieces: ['passive', 'past'] },
          alsoAccepted: [{ answers: ['みられました', '見られました'], then: [] }],
          mistakes: [
            {
              answers: ['みた', '見た', 'みました', '見ました'],
              then: activeInsteadOfPassive('hai guardato il tanuki.', 'you watched the tanuki.'),
            },
          ],
          then: passiveWritten(
            'Ah. Adesso sono io quello che guarda. E tu quello che viene guardato.',
            "Ah. Now I'm the one who watches. And you're the one being watched.",
          ),
        },
        {
          id: 'called',
          label: { it: 'Il tanuki mi ha chiamato.', en: 'The tanuki called me.' },
          frame: { kanji: '今夜、わたしはたぬきに＿。', kana: 'こんや、わたしはたぬきに＿。' },
          target: { verb: '呼ぶ', pieces: ['passive', 'past'] },
          alsoAccepted: [{ answers: ['よばれました', '呼ばれました'], then: [] }],
          mistakes: [
            {
              answers: ['よんだ', '呼んだ', 'よびました', '呼びました'],
              then: activeInsteadOfPassive('hai chiamato il tanuki.', 'you called the tanuki.'),
            },
          ],
          then: passiveWritten(
            'Ah. Adesso sono io quello che chiama. E tu quello che risponde.',
            "Ah. Now I'm the one who calls. And you're the one who answers.",
          ),
        },
      ],
    },
    { kind: 'candleOut' },
    narration(
      "La seconda candela si spegne. Al buio conti i libri: ventisei. Quando gli occhi si abituano, il diario non è più sulla pila. Ce l'ha il tanuki, stretto sotto la zampa macchiata d'inchiostro.",
      "The second candle goes out. In the dark you count the books: twenty-six. When your eyes adjust, the diary is no longer on the pile. The tanuki has it, clutched under its ink-stained paw.",
    ),
    tanuki(
      'Questo lo tengo io. Così domani sera sappiamo già cosa succede.',
      "I'll keep this one. That way tomorrow night we already know what happens.",
    ),
    narration(
      "Lontano, in fondo alla stanza, dove non ricordavi ci fosse una porta, si accende da sola una candela che non hai acceso tu.",
      "Far away, at the back of the room, where you don't remember there being a door, a candle you didn't light lights itself.",
    ),
  ],
  foreign: [
    narration(
      "Le parole ti escono nella tua lingua. Il diario le lascia scivolare via dalla pagina, come acqua sulla cera.",
      'The words come out in your own language. The diary lets them slide off the page, like water off wax.',
    ),
    tanuki('Quello scrive solo in giapponese. Anche se ha la tua calligrafia.', 'It only writes in Japanese. Even if it has your handwriting.'),
  ],
  wrong: [
    narration(
      "La penna non si muove. La candela si accorcia, anche se la fiamma è ferma.",
      "The pen doesn't move. The candle burns down, even though the flame is still.",
    ),
  ],
};

export const NIGHTS: readonly Night[] = [FIRST_NIGHT, SECOND_NIGHT];
