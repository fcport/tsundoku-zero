// Livello features/dashboard: la PRIMA schermata del ciclo di ripasso e il PRIMO
// consumatore del read-model (AD-5). Accende TanStack Query sulla pila dei
// dovuti, lo streak, lo sblocco e il curriculum, tutto via porte INIETTATE da
// `usePorts()` (features NON importa data, AD-1). L'`userId` arriva come prop
// (l'app lo risolve da `AuthGateway.currentUserId`): il dominio non vede la
// `Session`, e la pila usa la chiave di dominio `dueQueryKey(userId)` VERBATIM
// (nessuna schermata ricalcola la pila).
//
// Il CANCELLO delle quest sequenziali (3.13): pila NON vuota ⇒ SOLO l'azione
// svuota-pila, ora CABLATA all'avvio sessione (3.18) via la prop `onStartSession`
// (una callback: la dashboard non conosce react-router né stringhe di path, AD-1 —
// la shell la cabla con `useNavigate`); pila vuota con una lezione successiva ⇒ SOLO
// l'azione di SBLOCCO, cablata a un `useMutation` che chiama `progress.unlockLesson`
// e invalida pila+sblocco in `onSuccess`; pila vuota a curriculum esaurito ⇒
// NESSUNA azione. Le due quest non compaiono MAI insieme.
//
// Questa storia (3.16) fa CAMBIARE STATO al pile-counter a zero (nel ramo
// `unlocked > 0`): a `count === 0` non rende «0» né `dueLabel`, ma DICHIARA il
// PERCHÉ la pila è vuota — derivato dallo stato già presente (AD-5), mai
// memorizzato, quindi sopravvive al refresh. Priorità: `next === null` ⇒
// `curriculumCompleteBody` (curriculum esaurito, l'UNICA schermata senza azione);
// l'ultima sbloccata concettuale (3.14, `exerciseCount === 0`) ⇒ `noExercisesNotice`;
// altrimenti ⇒ `clearedBody` («hai svuotato la pila»). «Esaurito» e «concettuale»
// sono ortogonali: nel raro caso convivono ENTRAMBE le dichiarazioni (nessuna
// mente), sempre senza pulsante. Streak e curriculum restano visibili: a
// `unlocked > 0` portano informazione reale, cambia SOLO il contatore, non l'intera
// schermata (il primo-avvio a schermo pulito resta 3.15, `unlocked === 0`). A
// `count > 0` il numero resta invariato (3.12).
//
// Il TETTO giornaliero di sblocco (3.17, FR6.5/FR6.6): a `count === 0 && next !==
// null`, se gli sblocchi di oggi hanno raggiunto il tetto, il cancello sostituisce
// l'azione di sblocco con una DICHIARAZIONE del limite (NESSUN pulsante), che
// riapre a mezzanotte. Il tetto (`user_settings.lessons_per_day`, predefinito 1)
// arriva dalla porta `settings` (NUOVA prop, non promossa a `Ports`); `capReached`
// è DERIVATO puro (`dailyUnlockLimitReached`) dagli istanti di sblocco del
// read-model unico, mai memorizzato. Il tetto NON tocca il ramo `count > 0`
// (svuota-pila), il primo avvio (3.15) né le dichiarazioni 3.16 a pila vuota: agisce
// SOLO nel blocco azione.
//
// Nessuna grammatica della celebrazione (nessun verde, nessun `!`, nessuna
// emoji): solo token del sistema di design (la regola colore vale anche qui). I
// primitivi ui (pile-counter, streak-badge, curriculum-progress, button-primary)
// sono composti INLINE: l'estrazione nasce col secondo consumatore.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lastUnlockedLesson, nextLessonToUnlock } from '../../domain/curriculum';
import { dueQueryKey } from '../../domain/due';
import { streak } from '../../domain/streak';
import {
  DEFAULT_LESSONS_PER_DAY,
  dailyUnlockLimitReached,
} from '../../domain/unlockPace';
import type { SettingsRepository } from '../../domain/ports/settingsRepository';
import { usePorts } from '../ports/PortsContext';
import { resolveLocale, useTranslation } from '../../i18n';
import { RESERVED_ORDER_START } from '../../domain/lesson';
import { ACTION_BAR, KICKER, SERVICE_LINK } from '../../ui/magazine';
import { kanjiDate } from '../../ui/kanjiDate';
import { Furigana } from '../../ui/Furigana';
import { Translation } from '../../ui/Translation';
import { ArrowIcon, ExternalIcon } from '../../ui/icons';

export interface DashboardScreenProps {
  /**
   * L'id dell'utente corrente, risolto dall'app (`AuthGateway.currentUserId`).
   * `null` finché non è risolto: la dashboard mostra lo scheletro, senza ramo
   * speciale.
   */
  readonly userId: string | null;
  /**
   * La porta delle impostazioni, iniettata come PROP (non promossa a `Ports`, che
   * è per il ciclo profondo dashboard→sessione→card). Fornisce il tetto giornaliero
   * di sblocco (`loadLessonsPerDay`), condiviso con Impostazioni via la stessa
   * chiave `['lessonsPerDay', userId]`.
   */
  readonly settings: SettingsRepository;
  /**
   * Avvia la sessione di esercizi (3.18): cablata SOLO sul pulsante svuota-pila
   * (ramo `count > 0`). Una callback, non una stringa di path: la dashboard non
   * conosce react-router (AD-1); la shell la fornisce via `useNavigate`.
   */
  readonly onStartSession: () => void;
  /**
   * Naviga alle statistiche (5.1): l'affordance «vedi statistiche» del ramo
   * contenuto. Una callback, non una stringa di path (AD-1): la shell la cabla con
   * `useNavigate` verso `STATS_PATH`.
   */
  readonly onViewStats: () => void;
}

// Altezza CONDIVISA fra scheletro e contenuto finale: la stessa classe sul
// contenitore <main> nei due rami garantisce nessun salto di layout (AC3). Vive
// qui una sola volta, così i due rami non possono divergere.
const CONTAINER_HEIGHT = 'min-h-[24rem]';

// La classe CONDIVISA del <main> della dashboard. Direzione «rivista» (29-09-2026):
// non più la colonna stretta di 3.23 ma la pagina INTERA a destra del dorso, una
// griglia a filetti che riempie l'altezza (`flex-1`) con la barra d'azione in fondo.
// Una sola definizione, composta in TUTTI i rami <main> così non divergono.
const MAIN_CLASS = `${CONTAINER_HEIGHT} flex flex-1 flex-col`;

// La GRIGLIA della pagina: sotto 1024px il numero e la colonna della data, con i
// dati a tutta larghezza sotto; da 1024px tre colonne affiancate (numero, data in
// verticale, dati). I filetti sono i bordi delle celle.
const GRID_CLASS =
  'grid flex-1 grid-cols-[minmax(0,1fr)_64px] border-b-[1.5px] border-border-strong lg:grid-cols-[minmax(0,1fr)_150px_300px]';

// Il riquadro del numero: alto abbastanza da far uscire il numero dal fondo.
const HERO_CLASS = 'relative min-h-[300px] overflow-hidden sm:min-h-[400px]';

// La dichiarazione che PRENDE IL POSTO del numero quando non c'è niente da contare
// (primo avvio, pila svuotata, curriculum esaurito): corpo grande da editoriale.
const DECLARATION_CLASS =
  'p-5 text-[22px] font-medium leading-snug text-ink-primary sm:p-8 sm:text-[28px]';

// Una fila di segmenti: `filled` pieni d'inchiostro su `count`. Decorativa: il dato
// lo porta il testo accanto (numero visibile + frase per l'AT), mai il solo disegno.
function Segments({ count, filled }: { readonly count: number; readonly filled: number }) {
  return (
    <span aria-hidden="true" className="mt-3 flex gap-[2px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-[6px] flex-1 ${i < filled ? 'bg-ink-primary' : 'bg-surface-sunken'}`}
        />
      ))}
    </span>
  );
}

export function DashboardScreen({
  userId,
  settings,
  onStartSession,
  onViewStats,
}: DashboardScreenProps) {
  const { clock, review, progress, content } = usePorts();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  // Le cinque letture del read-model. La pila usa la chiave di DOMINIO verbatim
  // (AD-5); le altre chiavi sono per-utente (`['streak'|'unlocked'|'lessonsPerDay',
  // userId]`) o globali (`['lessons']`, il contenuto è uguale per tutti). Tutte le
  // per-utente sono `enabled: !!userId`: senza id non parte alcuna fetch (scheletro).
  const dueQ = useQuery({
    queryKey: dueQueryKey(userId ?? ''),
    enabled: !!userId,
    queryFn: () => review.listDue(clock.now()),
  });
  const logQ = useQuery({
    queryKey: ['streak', userId],
    enabled: !!userId,
    queryFn: () => review.listReviewLog(),
  });
  const unlockedQ = useQuery({
    queryKey: ['unlocked', userId],
    enabled: !!userId,
    queryFn: () => progress.listUnlockedLessons(),
  });
  const lessonsQ = useQuery({
    queryKey: ['lessons'],
    queryFn: () => content.listLessons(),
  });
  // Il tetto giornaliero di sblocco (3.17): la STESSA chiave di Impostazioni, così
  // un cambio là si riflette qui subito (setQueryData ottimistico). `null`/assente
  // degrada al DEFAULT del dominio.
  const lessonsPerDayQ = useQuery({
    queryKey: ['lessonsPerDay', userId],
    enabled: !!userId,
    queryFn: () => settings.loadLessonsPerDay(),
  });

  // L'azione di SBLOCCO (3.13): materializza la lezione via porta
  // (`progress.unlockLesson`, scrittura atomica/idempotente), MAI da `data`
  // diretto (AD-1: features→domain/ports, non data). L'istante entra dal Clock. In
  // `onSuccess` invalida la pila (`dueQueryKey`) e lo sblocco (`['unlocked']`), così
  // il read-model è RI-DERIVATO, mai memorizzato (AC7/AD-5). Definito PRIMA del
  // ramo scheletro (i hook non sono condizionali); l'`id` da sbloccare è passato a
  // `mutate` dal cancello, il dominio ha già scelto la successiva.
  const unlockMutation = useMutation({
    mutationFn: (lessonId: string) =>
      progress.unlockLesson(lessonId, clock.now()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dueQueryKey(userId ?? '') });
      void queryClient.invalidateQueries({ queryKey: ['unlocked', userId] });
    },
  });

  // Scheletro finché l'id non è risolto o una qualunque query è `pending`
  // (cache non ancora seminata). Stessa altezza del contenuto finale, nessuno
  // spinner, `aria-busy` per l'AT (AC3). Il tetto (`lessonsPerDayQ`) è nel cancello
  // scheletro: la dashboard attende ANCHE il suo valore prima di decidere il blocco
  // azione (evita di renderizzare `unlockAction` con un tetto ancora ignoto).
  if (
    !userId ||
    dueQ.data === undefined ||
    logQ.data === undefined ||
    unlockedQ.data === undefined ||
    lessonsQ.data === undefined ||
    lessonsPerDayQ.data === undefined
  ) {
    return (
      <main aria-busy="true" className={MAIN_CLASS}>
        {/* La stessa griglia del caricato, con le celle vuote: il numero, la
            colonna della data e i due dati. Nessuno spinner, nessun salto di
            layout quando i dati arrivano (la barra d'azione è un blocco neutro alla
            stessa altezza). */}
        <div className={GRID_CLASS}>
          <div className={HERO_CLASS}>
            <div className="absolute bottom-6 left-5 h-[200px] w-[140px] bg-surface-sunken sm:h-[300px] sm:w-[200px]" />
          </div>
          <div className="border-l-[1.5px] border-border-strong" />
          <div className="col-span-2 h-[132px] border-t-[1.5px] border-border-strong lg:col-span-1 lg:h-auto lg:border-l-[1.5px] lg:border-t-0" />
        </div>
        <div className="min-h-[72px] bg-surface-sunken sm:min-h-[88px]" />
      </main>
    );
  }

  // Read-model PURO: pila, streak e la SUCCESSIVA lezione DERIVATI a ogni lettura,
  // mai memorizzati (AD-5/AD-18). `isDue`/`streak`/`nextLessonToUnlock` restano
  // l'autorità di dominio; orologio e fuso ENTRANO dal Clock (mai letti qui).
  const count = dueQ.data.length;
  const days = streak(logQ.data, clock.now(), clock.timeZone());
  // Il read-model UNICO del progresso (3.17): da `unlockedQ.data` (UnlockedLesson[])
  // derivano SIA gli id (sequenza del curriculum) SIA gli istanti (tetto), senza
  // doppia lettura di `lesson_progress`.
  const unlockedIds = unlockedQ.data.map((u) => u.lessonId);
  const unlockedAt = unlockedQ.data.map((u) => u.unlockedAt);
  const unlocked = unlockedIds.length;
  // Solo il curriculum: la fascia riservata (order ≥ 900, fixture dei test) non si
  // conta e non si sblocca, anche se un seed vecchio l'avesse portata nel database.
  const curriculum = lessonsQ.data.filter((lesson) => lesson.ordinal < RESERVED_ORDER_START);
  const total = curriculum.length;
  // La SUCCESSIVA lezione da sbloccare (autorità sequenziale, puro): `null` a
  // curriculum esaurito. La UI passa alla RPC solo il suo `id`.
  const next = nextLessonToUnlock(curriculum, unlockedIds);
  // L'ULTIMA lezione sbloccata (autorità sequenziale, puro): `null` se nulla è
  // sbloccato. Serve alla dichiarazione «senza esercizi» (3.14), DERIVATA dallo
  // stato persistito (`['lessons']` + `['unlocked']` + pila), mai memorizzata
  // (AD-5): sopravvive al refresh.
  const lastUnlocked = lastUnlockedLesson(curriculum, unlockedIds);
  // Il tetto giornaliero: `null`/assente degrada al DEFAULT del dominio. `capReached`
  // è DERIVATO puro dagli istanti di sblocco (mai memorizzato); orologio e fuso
  // ENTRANO dal Clock. Il confine di giornata è mezzanotte nel fuso (coerente con
  // «riapre a mezzanotte» della copy).
  const cap = lessonsPerDayQ.data ?? DEFAULT_LESSONS_PER_DAY;
  const capReached = dailyUnlockLimitReached(
    unlockedAt,
    cap,
    clock.now(),
    clock.timeZone(),
  );

  // Il ramo di PRIMO AVVIO (3.15): DERIVATO, mai memorizzato (AD-5). Segnale
  // canonico `unlocked === 0` (= zero righe lesson_progress = «mai sbloccato
  // niente»): distinto da `count === 0` (pila svuotata di 3.14) e da `next === null`
  // (curriculum esaurito di 3.16). Sopravvive al refresh finché nulla è sbloccato.
  // Uno stato DISTINTO: una descrizione di cosa fa l'app (firstRunBody) più UNA sola
  // azione la cui copy significa *comincia* (startAction), riusando `unlockMutation`
  // (materializza la prima lezione, `ordinal` minimo). NIENTE conteggi a zero (AC3):
  // nessun pile-counter (né `text-count-hero` né `dueLabel`), nessuno streak-badge,
  // nessun curriculum-progress («0 di N» sarebbe un altro zero) — non c'è ancora
  // niente da contare. Copy neutra, solo token del sistema di design. `CONTAINER_HEIGHT`
  // sul <main> (nessun salto di layout col resto). A curriculum vuoto (`next === null`,
  // mai in produzione) resta solo la descrizione, NESSUN pulsante (AC4).
  if (unlocked === 0) {
    return (
      <main className={MAIN_CLASS}>
        {/* La descrizione al posto del numero, poi la sola barra «comincia». */}
        <div className="flex-1 border-b-[1.5px] border-border-strong">
          <p className={`${DECLARATION_CLASS} max-w-[34rem]`}>
            {t('dashboard.firstRunBody')}
          </p>
        </div>
        {next !== null ? (
          <button
            type="button"
            onClick={() => unlockMutation.mutate(next.id)}
            disabled={unlockMutation.isPending}
            className={ACTION_BAR}
          >
            <span>{t('dashboard.startAction')}</span>
            <ArrowIcon className="text-accent-on-ink" />
          </button>
        ) : null}
      </main>
    );
  }

  // La data di oggi in kanji per la colonna verticale (in chiaro è già nella
  // testata della shell: qui è la sua controparte da impaginato, `aria-hidden`).
  const jpToday = kanjiDate(clock.now(), clock.timeZone());
  const locale = resolveLocale(i18n.language);
  const localToday = new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: clock.timeZone(),
  }).format(clock.now());

  return (
    <main className={MAIN_CLASS}>
      <div className={GRID_CLASS}>
        {/* pile-counter che CAMBIA STATO a zero (3.16, AC1). A `count > 0` il
            numero è l'evento della pagina: Archivo nerissimo condensato, così grande
            da uscire dal fondo del riquadro, con l'etichetta DOPO nel DOM (3.12: il
            numero PRECEDE il verbo) e in alto a destra sulla pagina. A `count === 0`
            NON si rende «0» né `dueLabel`, ma la DICHIARAZIONE del perché la pila è
            vuota, DERIVATA dallo stato persistito (AD-5), mai memorizzata:
            - `curriculumCompleteBody` SSE `next === null` (curriculum esaurito, AC2).
            - `noExercisesNotice` (3.14) SSE l'ULTIMA sbloccata è concettuale
              (`exerciseCount === 0`): mai `clearedBody`, la pila non si è mai riempita.
            - `clearedBody` («hai svuotato la pila») SSE l'ultima AVEVA esercizi.
            «Esaurito» e «concettuale» convivono nel raro caso, sempre senza pulsante. */}
        <div className={HERO_CLASS}>
          {count > 0 ? (
            <>
              <p className="absolute bottom-0 left-3 translate-y-[14%] text-count-hero-mobile font-stretch-extra-condensed text-ink-primary sm:left-5 sm:text-count-hero">
                {count}
              </p>
              <p className="absolute right-4 top-4 max-w-[9ch] text-right text-[17px] font-extrabold leading-tight text-accent sm:right-6 sm:top-6 sm:text-[22px]">
                {t('dashboard.dueLabel')}
              </p>
            </>
          ) : (
            <div className="flex flex-col">
              {next === null ? (
                <p className={DECLARATION_CLASS}>{t('dashboard.curriculumCompleteBody')}</p>
              ) : null}
              {lastUnlocked?.exerciseCount === 0 ? (
                <p className={DECLARATION_CLASS}>{t('dashboard.noExercisesNotice')}</p>
              ) : next !== null ? (
                <p className={DECLARATION_CLASS}>{t('dashboard.clearedBody')}</p>
              ) : null}
            </div>
          )}
        </div>

        {/* La colonna centrale: la data di oggi scritta in verticale (縦書き), col
            giorno della settimana in rosso in testa. Impaginato, non informazione
            nuova: la data in chiaro è nella testata, quindi qui `aria-hidden`. */}
        <div className="flex justify-center border-l-[1.5px] border-border-strong py-5 sm:py-8">
          <p
            lang="ja"
            aria-hidden="true"
            className="font-jp text-[22px] font-bold tracking-[0.14em] text-ink-primary [writing-mode:vertical-rl] sm:text-[32px]"
          >
            {/* Giorno e data con la furigana della casella sul dorso (in verticale
                la lettura corre a destra dei kanji, come nei libri). */}
            <span className="mb-4 text-[14px] font-bold tracking-normal text-accent sm:text-[16px]">
              <Furigana segments={jpToday.weekdaySegments} />
            </span>
            <Furigana segments={jpToday.dateSegments} />
            {/* La traduzione della data, con «Traduzioni» acceso. */}
            <Translation
              text={localToday}
              lang={locale}
              className="mt-3 block font-mono text-[12px] font-medium normal-case tracking-normal text-ink-secondary"
            />
          </p>
        </div>

        {/* La colonna dei DATI: sotto 1024px a tutta larghezza sotto il numero, da
            1024px terza colonna. Ogni dato ha l'occhiello, il numero grande e una fila
            di segmenti; la frase completa resta per l'AT (`sr-only`), perché il
            numero da solo non dice di cosa è il numero. */}
        <div className="col-span-2 flex flex-col border-t-[1.5px] border-border-strong lg:col-span-1 lg:border-l-[1.5px] lg:border-t-0">
          <div className="grid grid-cols-2 lg:grid-cols-1">
            {/* streak-badge: giorni consecutivi da `streak()` su review_log. */}
            <div className="border-r-[1.5px] border-border-strong p-4 sm:p-6 lg:border-b-[1.5px] lg:border-r-0">
              <p className={KICKER}>{t('dashboard.streakKicker')}</p>
              <p aria-hidden="true" className="mt-2 text-[44px] font-extrabold leading-none font-stretch-condensed text-ink-primary">
                {days}
              </p>
              <Segments count={7} filled={Math.min(days, 7)} />
              <p className="sr-only">{t('dashboard.streakLabel', { days })}</p>
            </div>
            {/* curriculum-progress: sbloccate su totale ("u di t lezioni"). */}
            <div className="p-4 sm:p-6 lg:border-b-[1.5px] lg:border-border-strong">
              <p className={KICKER}>{t('dashboard.curriculumKicker')}</p>
              <p aria-hidden="true" className="mt-2 text-[44px] font-extrabold leading-none font-stretch-condensed text-ink-primary">
                {unlocked}
                <span className="ml-1 text-[16px] font-medium font-stretch-normal text-ink-secondary">
                  / {total}
                </span>
              </p>
              <Segments count={total} filled={unlocked} />
              <p className="sr-only">{t('dashboard.curriculumLabel', { unlocked, total })}</p>
            </div>
          </div>

          {/* I collegamenti di servizio: le statistiche (5.1, callback cablata dal
              livello app, AD-1) e il video di riferimento della lezione in corso, un
              vero <a> perché punta FUORI dall'app (apre YouTube, niente embed). */}
          <div className="flex flex-wrap gap-x-5 gap-y-3 p-4 sm:p-6">
            <button type="button" onClick={onViewStats} className={SERVICE_LINK}>
              {t('dashboard.viewStats')}
            </button>
            {lastUnlocked?.video ? (
              <a
                href={`https://www.youtube.com/watch?v=${lastUnlocked.video}`}
                target="_blank"
                rel="noreferrer"
                className={SERVICE_LINK}
              >
                {t('dashboard.referenceVideo')} <ExternalIcon />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Il CANCELLO delle quest sequenziali (AC4/3.13) + il tetto giornaliero
          (3.17): al più UNA sola azione, mai entrambe insieme, sempre la barra
          d'inchiostro in fondo alla pagina.
          - Pila NON vuota (count > 0) ⇒ SOLO svuota-pila, cablata all'avvio sessione
            (3.18) via `onStartSession` (la shell naviga a /studia). Il tetto NON è
            consultato qui.
          - Pila vuota (count === 0) con una lezione successiva e tetto NON
            raggiunto ⇒ SOLO sblocco, cablato a `unlockMutation.mutate(next.id)`.
          - Pila vuota, lezione successiva, ma tetto RAGGIUNTO ⇒ NESSUN pulsante,
            ma la DICHIARAZIONE del limite (`dailyLimitReachedBody`, con
            `{{limit}}`=cap): il tetto riapre a mezzanotte, si cambia da Impostazioni.
          - Pila vuota a curriculum esaurito (next === null) ⇒ NESSUNA azione (la
            schermata senza-azione è 3.16): non si rende alcun pulsante. */}
      {count > 0 ? (
        <button type="button" onClick={onStartSession} className={ACTION_BAR}>
          <span>{t('dashboard.primaryAction')}</span>
          <ArrowIcon className="text-accent-on-ink" />
        </button>
      ) : next !== null ? (
        capReached ? (
          // Tetto raggiunto: nessun pulsante, la dichiarazione del limite.
          <p className="p-4 text-body text-ink-primary sm:px-8 sm:py-6">
            {t('dashboard.dailyLimitReachedBody', { limit: cap })}
          </p>
        ) : (
          // Sblocco: materializza la lezione successiva via porta.
          <button
            type="button"
            onClick={() => unlockMutation.mutate(next.id)}
            disabled={unlockMutation.isPending}
            className={ACTION_BAR}
          >
            <span>{t('dashboard.unlockAction')}</span>
            <ArrowIcon className="text-accent-on-ink" />
          </button>
        )
      ) : null}
    </main>
  );
}
