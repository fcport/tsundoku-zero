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
// A log vuoto rende placeholder testuali neutri e minimali
// (`stats.answersOverTime.empty`/`stats.stageDistribution.empty`/
// `stats.grammarPointErrorRates.empty`), MAI un riquadro di grafico vuoto: la ricca
// dichiarazione «cosa manca e quanto» degli stati a dati insufficienti è la storia
// 5.4.
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
import { answersOverTime } from '../../domain/answersOverTime';
import { stageDistribution } from '../../domain/stageDistribution';
import { grammarPointErrorRates } from '../../domain/grammarPointErrorRates';
import { lessonsByGrammarPoint } from '../../domain/curriculum';
import { resolveBilingual } from '../../domain/bilingual';
import { usePorts } from '../ports/PortsContext';
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
// l'anello solo per navigazione da tastiera. Token `focus-ring` (in scuro
// `accent-dark`): nessun colore letterale (UX-DR1).
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring dark:focus-visible:outline-accent-dark';

// Classe CONDIVISA del <main> fra scheletro e contenuto: la STESSA stringa nei due
// rami evita salti di layout (stesso pattern della dashboard e della sessione).
// `items-stretch` perché le barre per-giorno e i blocchi scheletro occupano l'intera
// larghezza; l'altezza minima è condivisa.
const CONTAINER = 'min-h-[24rem] flex flex-col items-stretch gap-6 p-6';

export function StatsScreen({ userId, onExit }: StatsScreenProps) {
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

  // Scheletro finché l'id non è risolto o una delle due query è ancora pending
  // (cache non seminata). Stessa altezza del contenuto, nessuno spinner, `aria-busy`
  // per l'AT.
  if (!userId || logQ.data === undefined || lessonsQ.data === undefined) {
    return (
      <main aria-busy="true" className={CONTAINER}>
        <div className="h-[20px] w-40 rounded-md bg-surface-sunken" />
        <div className="h-[16px] w-full rounded-md bg-surface-sunken" />
        <div className="h-[16px] w-full rounded-md bg-surface-sunken" />
        <div className="h-[16px] w-full rounded-md bg-surface-sunken" />
      </main>
    );
  }

  // La serie DERIVATA dal solo log (AD-18): pura, orologio e fuso dal Clock.
  const series = answersOverTime(logQ.data, clock.now(), clock.timeZone());
  // Il massimo giornaliero per la larghezza proporzionale della barra. `series` non
  // è vuota nel ramo sotto (il vuoto è gestito prima); `Math.max(1, ...)` evita la
  // divisione per zero quando ogni giorno ha `count` 0 (code a 0 da ritmo interrotto).
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

  return (
    <main className={CONTAINER}>
      {/* Il titolo di livello schermata (`<h2>`, come ogni altra schermata): reso
          SOPRA lo split empty/dati così compare in ENTRAMBI gli stati. La sezione
          delle risposte nel tempo ha una propria intestazione subordinata (`<h3>`). */}
      <h2 className="text-display text-ink-primary">{t('stats.title')}</h2>
      {series.length === 0 ? (
        // Log vuoto: placeholder testuale neutro, MAI un grafico vuoto (5.1). La
        // ricca dichiarazione «cosa manca» è la storia 5.4.
        <p className="text-body text-ink-primary">
          {t('stats.answersOverTime.empty')}
        </p>
      ) : (
        <>
          {/* L'intestazione della serie delle risposte nel tempo (subordinata al
              titolo di schermata: `<h3>`). */}
          <h3 className="text-display text-ink-primary">
            {t('stats.answersOverTime.heading')}
          </h3>
          {/* La lista ordinata di barre per-giorno: ogni giorno porta il proprio
              conteggio come TESTO (mai dal solo colore) più una barra proporzionale
              (larghezza = count/max, token neutri, nessun verde). */}
          <ol className="flex flex-col gap-3">
            {series.map((day) => (
              <li key={day.date} className="flex flex-col gap-1">
                <span className="text-label text-ink-secondary">
                  {t('stats.answersOverTime.dayLabel', {
                    date: day.date,
                    answers: day.count,
                  })}
                </span>
                <div className="h-[4px] w-full overflow-hidden rounded-md bg-surface-sunken">
                  <div
                    className="h-full rounded-md bg-ink-secondary"
                    style={{ width: `${(day.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
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
          <h3 className="text-display text-ink-primary">
            {t('stats.stageDistribution.heading')}
          </h3>
          {/* La lista ordinata di barre per-stadio: ogni stadio (0-5, contiguo,
              zeri inclusi — l'asse deriva da `LEITNER_INTERVALS_DAYS`) porta il
              proprio conteggio come TESTO (mai dal solo colore) più una barra
              proporzionale (larghezza = count/max, token neutri, nessun verde). */}
          <ol className="flex flex-col gap-3">
            {distribution.map((bucket) => (
              <li key={bucket.stage} className="flex flex-col gap-1">
                <span className="text-label text-ink-secondary">
                  {t('stats.stageDistribution.stageLabel', {
                    stage: bucket.stage,
                    exercises: bucket.count,
                  })}
                </span>
                <div className="h-[4px] w-full overflow-hidden rounded-md bg-surface-sunken">
                  <div
                    className="h-full rounded-md bg-ink-secondary"
                    style={{ width: `${(bucket.count / stageMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
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
          <h3 className="text-display text-ink-primary">
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
                <li key={entry.grammarPoint} className="flex flex-col gap-1">
                  {/* Il punto grammaticale: CONTENUTO giapponese, reso in lang="ja"
                      (WCAG 3.1.2), mai da t(). */}
                  <span className="text-label text-ink-primary" lang="ja">
                    {entry.grammarPoint}
                  </span>
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
                  <div className="h-[4px] w-full overflow-hidden rounded-md bg-surface-sunken">
                    <div
                      className="h-full rounded-md bg-ink-secondary"
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
        className={`self-center rounded-md border border-border-strong bg-surface-base text-ink-primary px-6 py-3 text-body ${FOCUS_RING}`}
      >
        {t('stats.back')}
      </button>
    </main>
  );
}
