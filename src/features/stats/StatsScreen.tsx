// Livello features/stats (5.1): la PRIMA schermata delle statistiche di Epic 5
// (FR7.1) — le risposte per giorno di calendario. Una schermata-rotta col proprio
// `<main>`, raggiunta dalla dashboard e con un'affordance di ritorno secondaria
// (`onExit`, cablata dal livello app come la sessione). AD-1: importa
// domain/ui/i18n/@tanstack/react-query, MAI data né react-router — le porte arrivano
// da `usePorts()`; l'`userId` è una prop; la navigazione è una callback.
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
// A log vuoto (`answersOverTime` ⇒ `[]`) rende un placeholder testuale neutro e
// minimale (`stats.answersOverTime.empty`), MAI un riquadro di grafico vuoto: la
// ricca dichiarazione «cosa manca e quanto» degli stati a dati insufficienti è la
// storia 5.4. La distribuzione per stadio (5.2) e i tassi d'errore (5.3) sono fuori
// scopo: questa storia conta «quante risposte, e quando», non l'accuratezza.
//
// Nessuna grammatica della celebrazione (nessun verde, nessun `!`, nessuna emoji):
// solo token del sistema di design. L'informazione non è MAI veicolata dal solo
// colore — ogni giorno porta il proprio conteggio come TESTO; la barra è una
// lunghezza inline proporzionale (larghezza = count/max), con token neutri
// (`bg-ink-secondary`/`bg-surface-sunken`, mai verde), coerente con `ProgressMeter`.
import { useQuery } from '@tanstack/react-query';
import { answersOverTime } from '../../domain/answersOverTime';
import { usePorts } from '../ports/PortsContext';
import { useTranslation } from '../../i18n';

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
  const { review, clock } = usePorts();
  const { t } = useTranslation();

  // Il log dei ripassi: la STESSA chiave `['streak', userId]` e la STESSA porta
  // `listReviewLog()` di dashboard e sessione (AD-18 — fonte UNICA e derivata).
  // `enabled: !!userId`: senza id non parte alcuna fetch (scheletro).
  const logQ = useQuery({
    queryKey: ['streak', userId],
    enabled: !!userId,
    queryFn: () => review.listReviewLog(),
  });

  // Scheletro finché l'id non è risolto o il log è ancora pending (cache non
  // seminata). Stessa altezza del contenuto, nessuno spinner, `aria-busy` per l'AT.
  if (!userId || logQ.data === undefined) {
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
