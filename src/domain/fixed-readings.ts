// Livello domain: le letture scritte a mano (29-09-2026), per il giapponese che il
// contenuto non accompagna con una lettura. PURO: solo dati e una funzione.
//
// - I PUNTI GRAMMATICALI (`grammarPoints` delle lezioni, mostrati nelle statistiche):
//   sono etichette, non frasi d'esercizio, e il contenuto non ne porta la lettura.
//   `fixed-readings.test.ts` obbliga ogni punto del curriculum ad averne una: una
//   lezione nuova con un punto nuovo rende la CI rossa finché non la si aggiunge qui.
// - Poche PAROLE delle spiegazioni che la frase dell'esercizio non permette di
//   leggere con certezza (kanji attaccati ad altri kanji). Solo parole con UNA
//   lettura possibile: 来 da solo (く/き/こ) non c'è di proposito.
import type { FuriganaSegment } from './furigana';
import type { BilingualText } from './bilingual';
import { readingSegments } from './option-furigana';

// Il valore è la lettura intera, allineata ai kanji da `readingSegments`; oppure i
// segmenti espliciti quando l'allineamento meccanico è ambiguo (不規則動詞の可能形:
// la lettura ha due の, e どうし|の|かのう si potrebbe dividere anche dopo か).
export const GRAMMAR_POINT_READINGS: Readonly<Record<string, string | readonly FuriganaSegment[]>> = {
  '「が」が示す主語': '「が」がしめすしゅご',
  '述語の三つの形': 'じゅつごのみっつのかたち',
  '「を」で示す目的語': '「を」でしめすもくてきご',
  '熟字訓の読み': 'じゅくじくんのよみ',
  'ゼロ代名詞': 'ゼロだいめいし',
  '「は」が示す主題': '「は」がしめすしゅだい',
  '到達点を示す「に」': 'とうたつてんをしめす「に」',
  '非過去形': 'ひかこけい',
  '「ている」の進行': '「ている」のしんこう',
  '過去形の「た」': 'かこけいの「た」',
  '時を示す「に」': 'ときをしめす「に」',
  '動詞の三つのグループ': 'どうしのみっつのグループ',
  'て形・た形の作り方': 'てけい・たけいのつくりかた',
  '名詞を修飾する述語': 'めいしをしゅうしょくするじゅつご',
  '名詞を修飾する「な」': 'めいしをしゅうしょくする「な」',
  '名詞を修飾する「の」': 'めいしをしゅうしょくする「の」',
  '否定の「ない」': 'ひていの「ない」',
  '名詞文の否定「ではない」': 'めいしぶんのひてい「ではない」',
  '形容詞の否定「くない」': 'けいようしのひてい「くない」',
  '丁寧な否定「ません」': 'ていねいなひてい「ません」',
  '動詞の語幹と助動詞': 'どうしのごかんとじょどうし',
  '連用形につく「ます」「たい」': 'れんようけいにつく「ます」「たい」',
  '未然形につく「せる」「れる」': 'みぜんけいにつく「せる」「れる」',
  '意向形': 'いこうけい',
  '目的地を示す「に」': 'もくてきちをしめす「に」',
  '目的を示す「に」': 'もくてきをしめす「に」',
  '存在の場所を示す「に」': 'そんざいのばしょをしめす「に」',
  '変化の結果を示す「に」': 'へんかのけっかをしめす「に」',
  '方向を示す「へ」': 'ほうこうをしめす「へ」',
  '動作の場所を示す「で」': 'どうさのばしょをしめす「で」',
  '手段を示す「で」': 'しゅだんをしめす「で」',
  '名詞をつなぐ「と」': 'めいしをつなぐ「と」',
  '感情・理解の述語と「が」': 'かんじょう・りかいのじゅつごと「が」',
  '欲求の「ほしい」と「たい」': 'よっきゅうの「ほしい」と「たい」',
  '他人の感情を示す「がる」': 'たにんのかんじょうをしめす「がる」',
  '可能形': 'かのうけい',
  '不規則動詞の可能形': [
    { text: '不規則動詞', ruby: 'ふきそくどうし' },
    { text: 'の', ruby: null },
    { text: '可能形', ruby: 'かのうけい' },
  ],
  '可能形と「が」': 'かのうけいと「が」',
  'て形で節をつなぐ': 'てけいでせつをつなぐ',
  '恩恵を受ける「てくれる」': 'おんけいをうける「てくれる」',
  '恩恵を与える「てあげる」': 'おんけいをあたえる「てあげる」',
  '引用の「と」': 'いんようの「と」',
  '連用形でつなぐ複合動詞': 'れんようけいでつなぐふくごうどうし',
  '複合名詞の連濁': 'ふくごうめいしのれんだく',
  '擬音語・擬態語と「と」': 'ぎおんご・ぎたいごと「と」',
  '受身の「れる」「られる」': 'うけみの「れる」「られる」',
  '受身で動作主を示す「に」': 'うけみでどうさぬしをしめす「に」',
  '迷惑の受身': 'めいわくのうけみ',
  '副詞になる「く」': 'ふくしになる「く」',
  '副詞を作る「に」': 'ふくしをつくる「に」',
  '同類を示す「も」': 'どうるいをしめす「も」',
  '経験の「たことがある」': 'けいけんの「たことがある」',
};

/**
 * Il SIGNIFICATO di ogni punto grammaticale (29-09-2026), bilingue, mostrato sotto
 * il giapponese nelle statistiche con «Traduzioni» acceso. Terminologia della
 * linguistica (soggetto, tema, copula, pronome zero), mai le metafore della fonte.
 * `fixed-readings.test.ts` lo obbliga per ogni punto del curriculum, come le letture.
 */
export const GRAMMAR_POINT_MEANINGS: Readonly<Record<string, BilingualText>> = {
  '「が」が示す主語': { en: 'The subject marked by が', it: 'Il soggetto segnato da が' },
  '述語の三つの形': { en: 'The three forms of the predicate', it: 'Le tre forme del predicato' },
  '「を」で示す目的語': { en: 'The object marked by を', it: "L'oggetto segnato da を" },
  '熟字訓の読み': { en: 'Readings of whole-word kanji (jukujikun)', it: 'Letture di parola intera (jukujikun)' },
  'ゼロ代名詞': { en: 'The zero pronoun', it: 'Il pronome zero' },
  '「は」が示す主題': { en: 'The topic marked by は', it: 'Il tema segnato da は' },
  '到達点を示す「に」': { en: 'に for the point reached', it: 'に per il punto di arrivo' },
  '非過去形': { en: 'The non-past form', it: 'La forma non passata' },
  '「ている」の進行': { en: 'ている for an ongoing action', it: "ている per l'azione in corso" },
  '過去形の「た」': { en: 'た, the past form', it: 'た, la forma passata' },
  '時を示す「に」': { en: 'に for time', it: 'に per il tempo' },
  '動詞の三つのグループ': { en: 'The three verb groups', it: 'I tre gruppi verbali' },
  'て形・た形の作り方': { en: 'How to form the te- and ta-forms', it: 'Come si formano le forme in て e in た' },
  '名詞を修飾する述語': { en: 'A predicate describing a noun', it: 'Un predicato che descrive un nome' },
  '名詞を修飾する「な」': { en: 'な describing a noun', it: 'な che descrive un nome' },
  '名詞を修飾する「の」': { en: 'の describing a noun', it: 'の che descrive un nome' },
  '否定の「ない」': { en: 'ない, the negative', it: 'ない, la negazione' },
  '名詞文の否定「ではない」': { en: 'ではない, negating a noun sentence', it: 'ではない, la negazione della frase nominale' },
  '形容詞の否定「くない」': { en: 'くない, negating an adjective', it: "くない, la negazione dell'aggettivo" },
  '丁寧な否定「ません」': { en: 'ません, the polite negative', it: 'ません, la negazione cortese' },
  '動詞の語幹と助動詞': { en: 'Verb stems and auxiliaries', it: 'Radicali del verbo e ausiliari' },
  '連用形につく「ます」「たい」': { en: 'ます and たい on the continuative stem', it: 'ます e たい sul radicale continuativo' },
  '未然形につく「せる」「れる」': { en: 'せる and れる on the irrealis stem', it: 'せる e れる sul radicale irreale' },
  '意向形': { en: 'The volitional form', it: 'La forma volitiva' },
  '目的地を示す「に」': { en: 'に for the destination', it: 'に per la destinazione' },
  '目的を示す「に」': { en: 'に for the purpose', it: 'に per lo scopo' },
  '存在の場所を示す「に」': { en: 'に for where something is', it: 'に per il luogo in cui qualcosa si trova' },
  '変化の結果を示す「に」': { en: 'に for the result of a change', it: 'に per il risultato di un cambiamento' },
  '方向を示す「へ」': { en: 'へ for direction', it: 'へ per la direzione' },
  '動作の場所を示す「で」': { en: 'で for where an action happens', it: "で per il luogo dell'azione" },
  '手段を示す「で」': { en: 'で for the means', it: 'で per il mezzo' },
  '名詞をつなぐ「と」': { en: 'と joining nouns', it: 'と che unisce i nomi' },
  '感情・理解の述語と「が」': { en: 'が with predicates of feeling and understanding', it: 'が con i predicati di sentimento e comprensione' },
  '欲求の「ほしい」と「たい」': { en: 'ほしい and たい for wanting', it: 'ほしい e たい per il desiderio' },
  '他人の感情を示す「がる」': { en: "がる for other people's feelings", it: 'がる per i sentimenti degli altri' },
  '可能形': { en: 'The potential form', it: 'La forma potenziale' },
  '不規則動詞の可能形': { en: 'The potential of irregular verbs', it: 'Il potenziale dei verbi irregolari' },
  '可能形と「が」': { en: 'The potential form and が', it: 'La forma potenziale e が' },
  'て形で節をつなぐ': { en: 'Joining clauses with the te-form', it: 'Unire proposizioni con la forma in て' },
  '恩恵を受ける「てくれる」': { en: 'てくれる, receiving a favour', it: 'てくれる, ricevere un favore' },
  '恩恵を与える「てあげる」': { en: 'てあげる, doing a favour', it: 'てあげる, fare un favore' },
  '引用の「と」': { en: 'と for quoting words and thoughts', it: 'と per citare parole e pensieri' },
  '連用形でつなぐ複合動詞': { en: 'Two verbs joined into one', it: 'Due verbi uniti in uno' },
  '複合名詞の連濁': { en: 'The sound change in compound nouns', it: 'Il cambio di suono nei nomi composti' },
  '擬音語・擬態語と「と」': { en: 'Sound and manner words with と', it: 'Le parole che imitano suoni e modi, con と' },
  '受身の「れる」「られる」': { en: 'The passive with れる and られる', it: 'Il passivo con れる e られる' },
  '受身で動作主を示す「に」': { en: 'に for who does the action in the passive', it: "に per chi fa l'azione nel passivo" },
  '迷惑の受身': { en: 'The passive for something unwelcome', it: 'Il passivo per una cosa sgradita' },
  '副詞になる「く」': { en: 'く: an い-adjective saying how an action is done', it: "く: un aggettivo in い che dice come si fa un'azione" },
  '副詞を作る「に」': { en: 'に: a noun or な-adjective saying how an action is done', it: "に: un nome o un aggettivo in な che dice come si fa un'azione" },
  '同類を示す「も」': { en: 'も: the same goes for this too', it: 'も: vale lo stesso anche per questo' },
  '経験の「たことがある」': { en: 'たことがある: having done something at least once', it: 'たことがある: aver fatto una cosa almeno una volta' },
};

/** Parole con una sola lettura, per le spiegazioni (vedi l'intestazione). */
export const WORD_READINGS: ReadonlyMap<string, string> = new Map([
  ['歌', 'うた'],
  ['毎朝', 'まいあさ'],
  ['学生', 'がくせい'],
  ['先週', 'せんしゅう'],
  ['来年', 'らいねん'],
  ['料理', 'りょうり'],
]);

/**
 * Il punto grammaticale a segmenti con la furigana, oppure `null` se la sua lettura
 * non è in tabella (il chiamante mostra il testo semplice).
 */
export function grammarPointSegments(point: string): readonly FuriganaSegment[] | null {
  const reading = GRAMMAR_POINT_READINGS[point];
  if (reading === undefined) return null;
  return typeof reading === 'string' ? readingSegments(point, reading) : reading;
}
