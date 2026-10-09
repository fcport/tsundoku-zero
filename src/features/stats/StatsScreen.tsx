// Livello features/stats (5.1/5.2/5.3): la schermata delle statistiche di Epic 5. Tre
// sezioni: le risposte per giorno di calendario (5.1, FR7.1), la distribuzione degli
// esercizi per stadio di ripasso (5.2, FR7.2) e i tassi d'errore per punto
// grammaticale (5.3, FR7.3). Una schermata-rotta col proprio `<main>`, raggiunta
// dalla dashboard e con un'affordance di ritorno secondaria (`onExit`, cablata dal
// livello app come la sessione). AD-1: importa domain/ui/i18n/@tanstack/react-query,
// MAI data né react-router — le porte arrivano da `usePorts()`; l'`userId` è una
// prop; la navigazione è una callback.
//
// FONTE UNICA e derivata (AD-18): la serie giornaliera si calcola dal SOLO
// `review_log`, letto via `review.listReviewLog()` sulla STESSA identità di query
// `['streak', userId]` già usata da dashboard e sessione — un consumatore in più
// condivide la cache calda e beneficia dell'invalidazione post-risposta della
// sessione (`onSettled`), senza una seconda chiave per lo stesso dato. NIENTE
// `review_count`/`review_state`/`listDue`: quelli produrrebbero un secondo numero
// difendibile e divergente. L'aggregazione vive nel dominio (`answersOverTime`,
// pura e totale); orologio e fuso ENTRANO dal Clock iniettato.
//
// A dati insufficienti ogni vista rende una DICHIARAZIONE testuale «cosa manca e
// quanto» (5.4, FR7.5), MAI un riquadro di grafico vuoto né una schermata muta. Le
// tre viste decidono la sufficienza INDIPENDENTEMENTE (UX-DR18). Il grafico temporale
// ha un asse TEMPORALE: è meaningful SSE `daysWithAnswers(series) >= MIN_ANSWER_DAYS`
// (soglia UNICA dal dominio, motivata dai documenti UX «almeno 3 giorni»); sotto
// soglia rende SOLO la dichiarazione quantificata (soglia + giorni finora), mai un
// grafico sparso a 1-2 giorni. Distribuzione e tassi hanno assi CATEGORIALI: sono
// meaningful con QUALUNQUE dato, quindi la loro insufficienza è «nessun dato» (log
// vuoto) e la dichiarazione nomina il minimo onesto («almeno uno»), senza soglie
// numeriche fabbricate.
//
// FONTE UNICA e derivata anche per i tassi d'errore per punto (AD-18, 5.3): il tasso
// NON si legge da `review_state`/`lapse_count` — si DERIVA dal SOLO log via
// `grammarPointErrorRates` (dominio, pura e SENZA orologio), aggregando per
// `grammarPoint` DEL LOG (denormalizzato), MAI per `exerciseId`: cosi la storia
// sopravvive alla riautorazione di un esercizio. Ogni voce NOMINA la lezione che
// insegna quel punto — un ARRICCHIMENTO che dipende dal catalogo (`content.
// listLessons()`, STESSA chiave `['lessons']` della dashboard), risolto via l'helper
// puro `lessonsByGrammarPoint` + `resolveBilingual` per la lingua corrente. Il punto
// e CONTENUTO giapponese: reso in `<span lang="ja">`, mai da t(); un punto orfano
// (assente da ogni lezione) rende un fallback neutro (`unknownLesson`), mai un crash.
//
// FONTE UNICA e derivata anche per la distribuzione (AD-18): lo stadio corrente di
// un esercizio NON si legge da `review_state` — si RICOSTRUISCE rigiocando i suoi
// esiti dal SOLO log via `stageDistribution` (dominio, pura e SENZA orologio: lo
// stadio non dipende dal tempo). L'asse dei sei stadi deriva dalla costante unica
// della scala Leitner (`LEITNER_INTERVALS_DAYS`), non da un elenco parallelo nella
// vista.
//
// Nessuna grammatica della celebrazione (nessun verde, nessun `!`, nessuna emoji):
// solo token del sistema di design. L'informazione non è MAI veicolata dal solo
// colore — ogni giorno porta il proprio conteggio come TESTO; la barra è una
// lunghezza inline proporzionale (larghezza = count/max), con token neutri
// (`bg-ink-secondary`/`bg-surface-sunken`, mai verde), coerente con `ProgressMeter`.
import { useQuery } from '@tanstack/react-query';
import {
  answersOverTime,
  calendarWeeks,
  daysWithAnswers,
  MIN_ANSWER_DAYS,
} from '../../domain/answersOverTime';
import { milestones } from '../../domain/milestones';
import { freeDaysInHistory, streakHistory, streakStatus } from '../../domain/streak';
import { stageDistribution } from '../../domain/stageDistribution';
import { grammarPointErrorRates } from '../../domain/grammarPointErrorRates';
import { lessonsByGrammarPoint } from '../../domain/curriculum';
import { resolveBilingual } from '../../domain/bilingual';
import { RESPONSIVE_CONTAINER } from '../../ui/layout';
import { MagazineFrame } from '../../ui/MagazineFrame';
import { Furigana } from '../../ui/Furigana';
import { GRAMMAR_POINT_MEANINGS, grammarPointSegments } from '../../domain/fixed-readings';
import { Translation } from '../../ui/Translation';
import { KICKER, SCREEN_TITLE } from '../../ui/magazine';
import { usePorts } from '../ports/PortsContext';
import { useExerciseLessons } from '../lessons/useExerciseLessons';
import { CalendarHeatmap } from './CalendarHeatmap';
import { Milestones } from './Milestones';
import { resolveLocale, useTranslation } from '../../i18n';

export interface StatsScreenProps {
  /**
   * L'id dell'utente corrente, risolto dall'app. `null` finché non è risolto: la
   * schermata mostra lo scheletro, senza ramo speciale (stesso pattern della
   * dashboard e della sessione).
   */
  readonly userId: string | null;
  /**
   * Il ritorno alla dashboard: navigazione come CALLBACK dal livello app (AD-1: le
   * features non importano react-router). Il cablaggio vive in `AppRoutes`
   * (`() => navigate(ROOT_PATH)`), speculare a `onExit` della sessione. Obbligatoria.
   */
  readonly onExit: () => void;
}

// ANELLO DI FOCUS visibile: lo STESSO token condiviso dagli interattivi della
// SESSIONE (`SessionScreen`, `ExerciseCard`), la schermata-rotta su cui questa è
// modellata (`onExit` speculare a quello della sessione). `focus-visible:` mostra
// l'anello solo per navigazione da tastiera. Token `focus-ring`: nessun colore
// letterale (UX-DR1).
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

// Classe CONDIVISA del <main> fra scheletro e contenuto: la STESSA stringa nei due
// rami evita salti di layout (stesso pattern della dashboard e della sessione).
// `items-stretch` perché le barre per-giorno e i blocchi scheletro occupano l'intera
// larghezza; l'altezza minima è condivisa. Compone il contenitore responsive di
// `src/ui/layout.ts` (3.23): colonna singola centrata, `measure`, gutter 20/32px, mai
// allargata a ≥1024px; il gutter orizzontale è del contenitore, qui resta `py-6`.
const CONTAINER = `min-h-[24rem] ${RESPONSIVE_CONTAINER} flex flex-col items-stretch gap-6 py-8 sm:gap-8 sm:py-12`;

// Direzione «rivista» (29-09-2026): il dorso col marchio attorno a ogni stato della
// vista; dentro, la colonna di lettura con il titolo a testata e le sezioni divise
// da filetti. Gli stadi sono un istogramma a colonne, i tassi d'errore righe con la
// percentuale grande e una barra rossa.
export function StatsScreen(props: StatsScreenProps) {
  return (
    <MagazineFrame furiganaToggle>
      <StatsContent {...props} />
    </MagazineFrame>
  );
}

// Il titolo di sezione (<h3>): maiuscolo condensato sotto un filetto.
const SECTION_HEADING =
  'border-t-[1.5px] border-border-strong pt-3 text-[22px] font-extrabold uppercase leading-tight font-stretch-condensed text-ink-primary';

// Il calendario: quante settimane, e quanti degli ultimi giorni elencare coi numeri.
const CALENDAR_WEEKS = 26;
const RECENT_DAYS = 14;

function StatsContent({ userId, onExit }: StatsScreenProps) {
  const { review, content, clock } = usePorts();
  const { t, i18n } = useTranslation();
  // La lingua CORRENTE per risolvere il titolo bilingue della lezione (FR8.5):
  // `i18n.language` (grezzo) validato via l'unica fonte dei locali (AD-14).
  const locale = resolveLocale(i18n.language);

  // Il log dei ripassi: la STESSA chiave `['streak', userId]` e la STESSA porta
  // `listReviewLog()` di dashboard e sessione (AD-18 — fonte UNICA e derivata).
  // `enabled: !!userId`: senza id non parte alcuna fetch (scheletro).
  const logQ = useQuery({
    queryKey: ['streak', userId],
    enabled: !!userId,
    queryFn: () => review.listReviewLog(),
  });

  // Il catalogo delle lezioni: la STESSA chiave `['lessons']` e la STESSA porta
  // `listLessons()` della dashboard (cache condivisa; il contenuto e uguale per
  // tutti, nessun `enabled` per-utente). Serve SOLO a NOMINARE la lezione accanto a
  // ciascun punto grammaticale (5.3): il tasso deriva dal SOLO log, questo e
  // arricchimento.
  const lessonsQ = useQuery({
    queryKey: ['lessons'],
    queryFn: () => content.listLessons(),
  });
  // La lezione di ogni esercizio, per i traguardi delle lezioni lette (07-10-2026).
  // Fuori dallo scheletro: finché manca, la sezione dei traguardi non c'è.
  const exerciseLessonsQ = useExerciseLessons();

  // Scheletro finché l'id non è risolto o una delle due query è ancora pending
  // (cache non seminata). Stessa altezza del contenuto, nessuno spinner, `aria-busy`
  // per l'AT.
  if (!userId || logQ.data === undefined || lessonsQ.data === undefined) {
    return (
      <main aria-busy="true" className={CONTAINER}>
        <div className="h-[56px] w-64 bg-surface-sunken" />
        <div className="h-[180px] w-full bg-surface-sunken" />
        <div className="h-[16px] w-full bg-surface-sunken" />
        <div className="h-[16px] w-full bg-surface-sunken" />
      </main>
    );
  }

  // La serie DERIVATA dal solo log (AD-18): pura, orologio e fuso dal Clock.
  const series = answersOverTime(logQ.data, clock.now(), clock.timeZone());
  // I giorni DISTINTI con risposte «finora» (5.4): l'helper puro del dominio conta i
  // soli giorni con `count > 0` (esclude zeri interni/coda). Sotto `MIN_ANSWER_DAYS`
  // il grafico temporale è insufficiente e rende SOLO la dichiarazione quantificata.
  const answerDays = daysWithAnswers(series);
  // Il massimo giornaliero per la larghezza proporzionale della barra. Nel ramo
  // meaningful `series` non è vuota; `Math.max(1, ...)` evita la divisione per zero
  // quando ogni giorno ha `count` 0 (code a 0 da ritmo interrotto).
  const max = Math.max(1, ...series.map((day) => day.count));

  // La distribuzione per stadio DERIVATA dal SOLO log (AD-18): pura e SENZA
  // orologio (lo stadio non dipende dal tempo). `[]` a log vuoto ⇒ placeholder. Il
  // massimo per la larghezza proporzionale della barra; `Math.max(1, ...)` evita la
  // divisione per zero quando qualche stadio è a 0.
  const distribution = stageDistribution(logQ.data);
  const stageMax = Math.max(1, ...distribution.map((s) => s.count));

  // I tassi d'errore per punto grammaticale DERIVATI dal SOLO log (AD-18): puri e
  // SENZA orologio (il tasso non dipende dal tempo). `[]` a log vuoto ⇒ placeholder.
  // `errorRate` e gia in `[0,1]`: la barra e larghezza inline = errorRate, nessuna
  // normalizzazione al massimo (a tasso 0 la barra e vuota). Il join punto -> lezione
  // e un helper puro sul catalogo (arricchimento, non fonte del tasso).
  const errorRates = grammarPointErrorRates(logQ.data);
  const lessonByPoint = lessonsByGrammarPoint(lessonsQ.data);

  // La serie, il calendario e i traguardi (07-10-2026), tutti dal solo log. Le date
  // dei giorni liberi sono giorni nominali (`YYYY-MM-DD`), quindi lette in UTC.
  const hasLog = logQ.data.length > 0;
  const dateLocale = locale === 'it' ? 'it-IT' : 'en-GB';
  const dayName = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const nominal = (iso: string) => dayName.format(new Date(`${iso}T12:00:00Z`));
  // La forma corta per l'elenco degli ultimi giorni («sab 26 set»): sta in una riga
  // anche su un telefono stretto.
  const dayShort = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const shortDay = (iso: string) => dayShort.format(new Date(`${iso}T12:00:00Z`));
  const streakNow = streakStatus(logQ.data, clock.now(), clock.timeZone());
  const bestStreak = Math.max(0, ...streakHistory(logQ.data, clock.timeZone()).map((p) => p.days));
  const weeks = calendarWeeks(logQ.data, clock.now(), clock.timeZone(), CALENDAR_WEEKS);
  const freeDays = freeDaysInHistory(logQ.data, clock.now(), clock.timeZone());
  const tracks =
    exerciseLessonsQ.data === undefined
      ? null
      : milestones(logQ.data, lessonsQ.data, exerciseLessonsQ.data, clock.timeZone());

  return (
    <main className={CONTAINER}>
      {/* Il titolo di livello schermata (`<h2>`, come ogni altra schermata): reso
          SOPRA lo split empty/dati così compare in ENTRAMBI gli stati. La sezione
          delle risposte nel tempo ha una propria intestazione subordinata (`<h3>`). */}
      <h2 className={`${SCREEN_TITLE} text-ink-primary`}>
        {t('stats.title')}
      </h2>
      {/* La SERIE (07-10-2026): i giorni di fila, il record e il giorno libero, con
          la regola detta per intero. Solo dopo la prima risposta. */}
      {hasLog ? (
        <section className="flex flex-col gap-3">
          <h3 className={SECTION_HEADING}>{t('stats.streak.heading')}</h3>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <p className="flex items-baseline gap-3">
              <span aria-hidden="true" className="text-[56px] font-extrabold leading-none font-stretch-condensed text-ink-primary">
                {streakNow.days}
              </span>
              <span aria-hidden="true" className={KICKER}>
                {t('dashboard.streakKicker')}
              </span>
              <span className="sr-only">{t('dashboard.streakLabel', { days: streakNow.days })}</span>
            </p>
            <p className="text-label text-ink-secondary">
              {t('stats.streak.best', { days: bestStreak })}
            </p>
          </div>
          <p className="text-body text-ink-primary">{t('stats.streak.rule')}</p>
          {streakNow.days > 0 ? (
            <p className="text-body font-semibold text-ink-primary">
              {streakNow.lastFreeDay === null || streakNow.freeDayBackOn === null
                ? t('stats.streak.freeDayReady')
                : t('stats.streak.freeDayUsed', {
                    date: nominal(streakNow.lastFreeDay),
                    back: nominal(streakNow.freeDayBackOn),
                  })}
            </p>
          ) : null}
        </section>
      ) : null}
      {answerDays < MIN_ANSWER_DAYS ? (
        // Sotto soglia (5.4): un trend con meno di `MIN_ANSWER_DAYS` giorni distinti
        // non è un trend. Rende SOLO la dichiarazione quantificata (soglia + giorni
        // finora, entrambi dal dominio, mai un `3` letterale), nessuna intestazione né
        // barra: MAI un grafico sparso a 1-2 giorni.
        <p className="text-body text-ink-primary">
          {t('stats.answersOverTime.insufficient', {
            needed: MIN_ANSWER_DAYS,
            soFar: answerDays,
          })}
        </p>
      ) : (
        <>
          {/* L'intestazione della serie delle risposte nel tempo (subordinata al
              titolo di schermata: `<h3>`). */}
          <h3 className={SECTION_HEADING}>
            {t('stats.answersOverTime.heading')}
          </h3>
          {/* Il CALENDARIO delle ultime settimane (07-10-2026), poi i numeri esatti
              degli ultimi giorni. */}
          <CalendarHeatmap weeks={weeks} freeDays={freeDays} dateLocale={dateLocale} />
          <h4 className="text-[18px] font-bold text-ink-primary">
            {t('stats.calendar.recentHeading', { days: RECENT_DAYS })}
          </h4>
          {/* La lista ordinata di barre per-giorno, una riga per giorno: la data
              corta, la barra proporzionale (larghezza = count/max, token neutri,
              nessun verde) e il conteggio come TESTO (mai dal solo colore). Per l'AT
              la riga intera in una frase, con la data per esteso. */}
          <ol className="flex flex-col gap-2">
            {series.slice(-RECENT_DAYS).map((day) => (
              <li
                key={day.date}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-3"
              >
                <span className="sr-only">
                  {t('stats.answersOverTime.dayLabel', {
                    date: nominal(day.date),
                    answers: day.count,
                  })}
                </span>
                <span aria-hidden="true" className="whitespace-nowrap text-label text-ink-secondary">
                  {shortDay(day.date)}
                </span>
                <div aria-hidden="true" className="h-[8px] w-full overflow-hidden bg-surface-sunken">
                  <div
                    className="h-full bg-ink-primary"
                    style={{ width: `${(day.count / max) * 100}%` }}
                  />
                </div>
                <span aria-hidden="true" className="text-right text-label font-bold tabular-nums text-ink-primary">
                  {day.count}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {/* I TRAGUARDI (07-10-2026): dopo la prima risposta, quando c'è la lezione di
          ogni esercizio. */}
      {hasLog && tracks !== null ? (
        <Milestones
          tracks={tracks}
          now={clock.now()}
          timeZone={clock.timeZone()}
          headingClassName={SECTION_HEADING}
        />
      ) : null}
      {/* La SECONDA sezione (5.2): la distribuzione per stadio, derivata dal SOLO
          log (nessun clock). A distribuzione vuota (log vuoto) un placeholder
          testuale neutro, MAI un riquadro di grafico vuoto. */}
      {distribution.length === 0 ? (
        <p className="text-body text-ink-primary">
          {t('stats.stageDistribution.empty')}
        </p>
      ) : (
        <>
          {/* L'intestazione della distribuzione (subordinata al titolo: `<h3>`). */}
          <h3 className={SECTION_HEADING}>
            {t('stats.stageDistribution.heading')}
          </h3>
          {/* Cosa sono i livelli: senza, «livello 1» non dice niente a chi studia. */}
          <p className="-mt-4 text-body text-ink-secondary">{t('stats.stageDistribution.hint')}</p>
          {/* La lista ordinata di barre per-stadio: ogni stadio (0-5, contiguo,
              zeri inclusi — l'asse deriva da `LEITNER_INTERVALS_DAYS`) porta il
              proprio conteggio come TESTO (mai dal solo colore) più una barra
              proporzionale (larghezza = count/max, token neutri, nessun verde). */}
          <ol className="grid h-[200px] grid-cols-6 items-stretch gap-2 border-b-[1.5px] border-border-strong">
            {distribution.map((bucket) => (
              <li key={bucket.stage} className="flex flex-col items-center gap-1">
                <span className="sr-only">
                  {t('stats.stageDistribution.stageLabel', {
                    stage: bucket.stage,
                    exercises: bucket.count,
                  })}
                </span>
                <span aria-hidden="true" className="text-[22px] font-extrabold leading-none font-stretch-condensed text-ink-primary">
                  {bucket.count}
                </span>
                <div aria-hidden="true" className="flex w-full flex-1 items-end">
                  <div
                    className="w-full bg-ink-primary"
                    style={{ height: `${(bucket.count / stageMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          {/* L'asse: il numero di ciascuno stadio sotto la sua colonna. */}
          <div aria-hidden="true" className="-mt-6 grid grid-cols-6 gap-2 text-center font-mono text-label-caps text-ink-secondary">
            {distribution.map((bucket) => (
              <span key={bucket.stage}>{bucket.stage}</span>
            ))}
          </div>
        </>
      )}
      {/* La TERZA sezione (5.3): i tassi d'errore per punto grammaticale, derivati
          dal SOLO log (nessun clock), aggregati per `grammarPoint` DEL LOG (mai per
          esercizio). A elenco vuoto (log vuoto) un placeholder testuale neutro, MAI
          un riquadro di grafico vuoto. */}
      {errorRates.length === 0 ? (
        <p className="text-body text-ink-primary">
          {t('stats.grammarPointErrorRates.empty')}
        </p>
      ) : (
        <>
          {/* L'intestazione dei tassi d'errore (subordinata al titolo: `<h3>`). */}
          <h3 className={SECTION_HEADING}>
            {t('stats.grammarPointErrorRates.heading')}
          </h3>
          {/* La lista ordinata di voci per-punto (tasso desc): ogni voce porta il
              punto grammaticale in `<span lang="ja">` (e giapponese, mai da t()), il
              tasso come TESTO (mai dal solo colore), il nome della lezione che lo
              insegna o un fallback neutro (`unknownLesson`) per un punto orfano, e una
              barra proporzionale (larghezza = errorRate, gia in [0,1], token neutri,
              nessun verde). */}
          <ol className="flex flex-col gap-3">
            {errorRates.map((entry) => {
              const lesson = lessonByPoint.get(entry.grammarPoint);
              const resolved = lesson
                ? resolveBilingual(lesson.title, locale)
                : null;
              return (
                <li key={entry.grammarPoint} className="flex flex-col gap-1 border-b-[1.5px] border-border-hairline pb-3">
                  {/* Il punto grammaticale: CONTENUTO giapponese, reso in lang="ja"
                      (WCAG 3.1.2), mai da t(). Con la furigana della casella sul dorso,
                      dalla tabella delle letture (testo semplice se manca). */}
                  <span className="text-[20px] font-bold text-ink-primary" lang="ja">
                    <Furigana
                      segments={
                        grammarPointSegments(entry.grammarPoint) ?? [
                          { text: entry.grammarPoint, ruby: null },
                        ]
                      }
                    />
                  </span>
                  {/* Il significato del punto, con «Traduzioni» acceso. */}
                  {GRAMMAR_POINT_MEANINGS[entry.grammarPoint] && (
                    <Translation
                      text={resolveBilingual(GRAMMAR_POINT_MEANINGS[entry.grammarPoint]!, locale).text}
                      lang={resolveBilingual(GRAMMAR_POINT_MEANINGS[entry.grammarPoint]!, locale).language}
                      className="block text-body italic text-ink-secondary"
                    />
                  )}
                  {/* Il tasso come TESTO (etichetta-valore, nessuna concordanza di
                      numero): errori su totale. */}
                  <span className="text-label text-ink-secondary">
                    {t('stats.grammarPointErrorRates.entryLabel', {
                      errors: entry.errors,
                      total: entry.total,
                    })}
                  </span>
                  {/* La lezione azionabile che insegna il punto: l'etichetta STATICA
                      (interfaccia, da t()) seguita dal titolo bilingue risolto per la
                      lingua CORRENTE (`resolveBilingual` + locale, FR8.5). Il titolo e
                      CONTENUTO reso in un nodo con `lang` sulla lingua EFFETTIVAMENTE
                      resa (WCAG 3.1.2: se e ripiego, il titolo e in inglese ⇒
                      lang="en", mai annunciato con pronuncia italiana). Un punto orfano
                      (drift contenuti) rende invece un fallback neutro
                      (`unknownLesson`), mai un crash. */}
                  {resolved ? (
                    <span className="text-label text-ink-secondary">
                      {t('stats.grammarPointErrorRates.lessonLabel')}{' '}
                      <span lang={resolved.language}>{resolved.text}</span>
                    </span>
                  ) : (
                    <span className="text-label text-ink-secondary">
                      {t('stats.grammarPointErrorRates.unknownLesson')}
                    </span>
                  )}
                  <div className="h-[8px] w-full overflow-hidden bg-surface-sunken">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${entry.errorRate * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {/* L'affordance di ritorno alla dashboard (5.1): SECONDARIA — chiaramente non
          il button-primary (nessun fill, ink muto, nessun verde). → `onExit`. */}
      <button
        type="button"
        onClick={onExit}
        className={`min-h-[56px] self-start border-[1.5px] border-border-strong bg-surface-raised px-6 text-label font-bold uppercase tracking-[0.04em] text-ink-primary hover:bg-surface-sunken ${FOCUS_RING}`}
      >
        {t('stats.back')}
      </button>
    </main>
  );
}
