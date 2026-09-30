// Livello domain: i verbi dell'allenamento libero. Solo verbi di tutti i giorni,
// quelli che con buona probabilità si useranno davvero, scelti anche per coprire
// ogni terminazione dei godan (う く ぐ す つ ぬ ぶ む る), gli ichidan, する coi suoi
// composti, 来る, e le trappole che il corso nomina: i godan che sembrano ichidan
// (帰る, 入る, 走る, 知る), 行く (いって), ある (ない).
//
// Ogni verbo propone solo le forme che si usano davvero: niente passivo per chi si
// muove o sta (歩かれる, 座られる), niente causativo dove il giapponese usa un altro
// verbo (寝る fa 寝かせる, 起きる fa 起こす), niente «voglio» per 思う.
import { CONJUGATION_FORMS, type ConjugationForm, type Verb } from './conjugation';

/** Tutte le forme tranne quelle indicate. */
function except(...excluded: readonly ConjugationForm[]): readonly ConjugationForm[] {
  return CONJUGATION_FORMS.filter((form) => !excluded.includes(form));
}

/** Le forme di un verbo che esprime uno stato: niente volitivo, passivo, causativo. */
const STATE_FORMS: readonly ConjugationForm[] = [
  'masu',
  'masen',
  'mashita',
  'nai',
  'nakatta',
  'ta',
  'te',
];

/** Chi si muove o fa qualcosa da sé: tutto tranne il passivo. */
const NO_PASSIVE = except('passive');

export const DRILL_VERBS: readonly Verb[] = [
  // godan in う
  { kanji: '買う', kana: 'かう', group: 'godan', meaning: { en: 'to buy', it: 'comprare' }, forms: NO_PASSIVE },
  { kanji: '会う', kana: 'あう', group: 'godan', meaning: { en: 'to meet', it: 'incontrare' }, forms: NO_PASSIVE },
  { kanji: '言う', kana: 'いう', group: 'godan', meaning: { en: 'to say', it: 'dire' } },
  { kanji: '思う', kana: 'おもう', group: 'godan', meaning: { en: 'to think', it: 'pensare, credere' }, forms: except('tai', 'volitional') },
  { kanji: '使う', kana: 'つかう', group: 'godan', meaning: { en: 'to use', it: 'usare' } },
  { kanji: '洗う', kana: 'あらう', group: 'godan', meaning: { en: 'to wash', it: 'lavare' }, forms: NO_PASSIVE },
  { kanji: '歌う', kana: 'うたう', group: 'godan', meaning: { en: 'to sing', it: 'cantare' } },
  { kanji: '習う', kana: 'ならう', group: 'godan', meaning: { en: 'to learn', it: 'imparare' }, forms: NO_PASSIVE },
  // godan in く / ぐ
  { kanji: '書く', kana: 'かく', group: 'godan', meaning: { en: 'to write', it: 'scrivere' } },
  { kanji: '聞く', kana: 'きく', group: 'godan', meaning: { en: 'to listen', it: 'ascoltare' } },
  { kanji: '歩く', kana: 'あるく', group: 'godan', meaning: { en: 'to walk', it: 'camminare' }, forms: NO_PASSIVE },
  { kanji: '働く', kana: 'はたらく', group: 'godan', meaning: { en: 'to work', it: 'lavorare' }, forms: NO_PASSIVE },
  { kanji: '行く', kana: 'いく', group: 'godan', meaning: { en: 'to go', it: 'andare' }, forms: NO_PASSIVE },
  { kanji: '泳ぐ', kana: 'およぐ', group: 'godan', meaning: { en: 'to swim', it: 'nuotare' }, forms: NO_PASSIVE },
  { kanji: '急ぐ', kana: 'いそぐ', group: 'godan', meaning: { en: 'to hurry', it: 'sbrigarsi' }, forms: NO_PASSIVE },
  // godan in す
  { kanji: '話す', kana: 'はなす', group: 'godan', meaning: { en: 'to speak', it: 'parlare' } },
  { kanji: '出す', kana: 'だす', group: 'godan', meaning: { en: 'to take out, to hand in', it: 'tirare fuori, consegnare' } },
  // godan in つ
  { kanji: '待つ', kana: 'まつ', group: 'godan', meaning: { en: 'to wait', it: 'aspettare' } },
  { kanji: '持つ', kana: 'もつ', group: 'godan', meaning: { en: 'to hold, to carry', it: 'tenere, portare' }, forms: NO_PASSIVE },
  // godan in ぬ / ぶ / む
  { kanji: '死ぬ', kana: 'しぬ', group: 'godan', meaning: { en: 'to die', it: 'morire' }, forms: STATE_FORMS },
  { kanji: '遊ぶ', kana: 'あそぶ', group: 'godan', meaning: { en: 'to play, to hang out', it: 'giocare, divertirsi' }, forms: NO_PASSIVE },
  { kanji: '呼ぶ', kana: 'よぶ', group: 'godan', meaning: { en: 'to call', it: 'chiamare' } },
  { kanji: '読む', kana: 'よむ', group: 'godan', meaning: { en: 'to read', it: 'leggere' } },
  { kanji: '飲む', kana: 'のむ', group: 'godan', meaning: { en: 'to drink', it: 'bere' } },
  { kanji: '休む', kana: 'やすむ', group: 'godan', meaning: { en: 'to rest', it: 'riposarsi' }, forms: NO_PASSIVE },
  { kanji: '住む', kana: 'すむ', group: 'godan', meaning: { en: 'to live (somewhere)', it: 'abitare' }, forms: except('passive', 'causative') },
  // godan in る
  { kanji: '作る', kana: 'つくる', group: 'godan', meaning: { en: 'to make', it: 'fare, preparare' } },
  { kanji: '乗る', kana: 'のる', group: 'godan', meaning: { en: 'to ride', it: 'salire (su un mezzo)' }, forms: NO_PASSIVE },
  { kanji: '取る', kana: 'とる', group: 'godan', meaning: { en: 'to take', it: 'prendere' } },
  { kanji: '座る', kana: 'すわる', group: 'godan', meaning: { en: 'to sit', it: 'sedersi' }, forms: NO_PASSIVE },
  { kanji: '送る', kana: 'おくる', group: 'godan', meaning: { en: 'to send', it: 'spedire' } },
  { kanji: '分かる', kana: 'わかる', group: 'godan', meaning: { en: 'to understand', it: 'capire' }, forms: STATE_FORMS },
  { kanji: 'ある', kana: 'ある', group: 'godan', meaning: { en: 'to exist (things)', it: 'esserci (cose)' }, forms: STATE_FORMS },
  // godan che sembrano ichidan
  { kanji: '帰る', kana: 'かえる', group: 'godan', meaning: { en: 'to go home', it: 'tornare a casa' }, forms: NO_PASSIVE },
  { kanji: '入る', kana: 'はいる', group: 'godan', meaning: { en: 'to enter', it: 'entrare' }, forms: NO_PASSIVE },
  { kanji: '走る', kana: 'はしる', group: 'godan', meaning: { en: 'to run', it: 'correre' }, forms: NO_PASSIVE },
  // 知る si usa quasi solo come 知っている (so) e 知らない (non so).
  { kanji: '知る', kana: 'しる', group: 'godan', meaning: { en: 'to get to know', it: 'venire a sapere' }, forms: ['nai', 'masen', 'ta', 'te', 'teiru'] },
  // ichidan
  { kanji: '食べる', kana: 'たべる', group: 'ichidan', meaning: { en: 'to eat', it: 'mangiare' } },
  { kanji: '見る', kana: 'みる', group: 'ichidan', meaning: { en: 'to see', it: 'vedere' } },
  { kanji: '寝る', kana: 'ねる', group: 'ichidan', meaning: { en: 'to sleep', it: 'dormire' }, forms: except('passive', 'causative') },
  { kanji: '起きる', kana: 'おきる', group: 'ichidan', meaning: { en: 'to wake up', it: 'svegliarsi' }, forms: except('passive', 'causative') },
  { kanji: '着る', kana: 'きる', group: 'ichidan', meaning: { en: 'to wear', it: 'indossare' }, forms: except('passive', 'causative') },
  { kanji: '教える', kana: 'おしえる', group: 'ichidan', meaning: { en: 'to teach', it: 'insegnare' } },
  { kanji: '覚える', kana: 'おぼえる', group: 'ichidan', meaning: { en: 'to memorize', it: 'ricordare, memorizzare' }, forms: NO_PASSIVE },
  { kanji: '開ける', kana: 'あける', group: 'ichidan', meaning: { en: 'to open', it: 'aprire' } },
  { kanji: '閉める', kana: 'しめる', group: 'ichidan', meaning: { en: 'to close', it: 'chiudere' }, forms: NO_PASSIVE },
  { kanji: '出る', kana: 'でる', group: 'ichidan', meaning: { en: 'to go out', it: 'uscire' }, forms: NO_PASSIVE },
  { kanji: '降りる', kana: 'おりる', group: 'ichidan', meaning: { en: 'to get off', it: 'scendere' }, forms: except('passive', 'causative') },
  { kanji: '借りる', kana: 'かりる', group: 'ichidan', meaning: { en: 'to borrow', it: 'prendere in prestito' }, forms: NO_PASSIVE },
  { kanji: '忘れる', kana: 'わすれる', group: 'ichidan', meaning: { en: 'to forget', it: 'dimenticare' } },
  { kanji: '始める', kana: 'はじめる', group: 'ichidan', meaning: { en: 'to begin', it: 'cominciare' }, forms: NO_PASSIVE },
  { kanji: '考える', kana: 'かんがえる', group: 'ichidan', meaning: { en: 'to think', it: 'pensare' } },
  { kanji: '見せる', kana: 'みせる', group: 'ichidan', meaning: { en: 'to show', it: 'mostrare' }, forms: except('potential', 'passive', 'causative') },
  { kanji: 'いる', kana: 'いる', group: 'ichidan', meaning: { en: 'to exist (living things)', it: 'esserci (esseri viventi)' }, forms: STATE_FORMS },
  { kanji: 'できる', kana: 'できる', group: 'ichidan', meaning: { en: 'to be able to', it: 'riuscire, sapere fare' }, forms: STATE_FORMS },
  // irregolari
  { kanji: 'する', kana: 'する', group: 'irregular', meaning: { en: 'to do', it: 'fare' } },
  { kanji: '来る', kana: 'くる', group: 'irregular', meaning: { en: 'to come', it: 'venire' }, forms: NO_PASSIVE },
  { kanji: '勉強する', kana: 'べんきょうする', group: 'irregular', meaning: { en: 'to study', it: 'studiare' }, forms: NO_PASSIVE },
  { kanji: '料理する', kana: 'りょうりする', group: 'irregular', meaning: { en: 'to cook', it: 'cucinare' }, forms: NO_PASSIVE },
  { kanji: '電話する', kana: 'でんわする', group: 'irregular', meaning: { en: 'to phone', it: 'telefonare' }, forms: NO_PASSIVE },
  { kanji: '散歩する', kana: 'さんぽする', group: 'irregular', meaning: { en: 'to take a walk', it: 'fare una passeggiata' }, forms: NO_PASSIVE },
];
