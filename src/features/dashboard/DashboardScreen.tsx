// Livello features/dashboard: la PRIMA schermata del ciclo di ripasso e il PRIMO
// consumatore del read-model (AD-5). Accende TanStack Query sulla pila dei
// dovuti, lo streak, lo sblocco e il curriculum, tutto via porte INIETTATE da
// `usePorts()` (features NON importa data, AD-1). L'`userId` arriva come prop
// (l'app lo risolve da `AuthGateway.currentUserId`): il dominio non vede la
// `Session`, e la pila usa la chiave di dominio `dueQueryKey(userId)` VERBATIM
// (nessuna schermata ricalcola la pila).
//
// Questa storia (3.13) aggiunge il CANCELLO delle quest sequenziali: pila NON
// vuota ⇒ SOLO l'azione svuota-pila (inerte, come in 3.12); pila vuota con una
// lezione successiva ⇒ SOLO l'azione di SBLOCCO, cablata a un `useMutation` che
// chiama `progress.unlockLesson` e invalida pila+sblocco in `onSuccess`; pila
// vuota a curriculum esaurito ⇒ NESSUNA azione (la schermata senza-azione è 3.16).
// Le due quest non compaiono MAI insieme. L'`onClick` di avvio sessione resta 3.18
// (l'azione svuota-pila è ancora sola-copy).
//
// Nessuna grammatica della celebrazione (nessun verde, nessun `!`, nessuna
// emoji): solo token del sistema di design (la regola colore vale anche qui). I
// primitivi ui (pile-counter, streak-badge, curriculum-progress, button-primary)
// sono composti INLINE: l'estrazione nasce col secondo consumatore.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nextLessonToUnlock } from '../../domain/curriculum';
import { dueQueryKey } from '../../domain/due';
import { streak } from '../../domain/streak';
import { usePorts } from '../ports/PortsContext';
import { useTranslation } from '../../i18n';

export interface DashboardScreenProps {
  /**
   * L'id dell'utente corrente, risolto dall'app (`AuthGateway.currentUserId`).
   * `null` finché non è risolto: la dashboard mostra lo scheletro, senza ramo
   * speciale.
   */
  readonly userId: string | null;
}

// Altezza CONDIVISA fra scheletro e contenuto finale: la stessa classe sul
// contenitore <main> nei due rami garantisce nessun salto di layout (AC3). Vive
// qui una sola volta, così i due rami non possono divergere.
const CONTAINER_HEIGHT = 'min-h-[24rem]';

export function DashboardScreen({ userId }: DashboardScreenProps) {
  const { clock, review, progress, content } = usePorts();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Le quattro letture del read-model. La pila usa la chiave di DOMINIO verbatim
  // (AD-5); le altre chiavi sono per-utente (`['streak'|'unlocked', userId]`) o
  // globali (`['lessons']`, il contenuto è uguale per tutti). Tutte le per-utente
  // sono `enabled: !!userId`: senza id non parte alcuna fetch (scheletro).
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
    queryFn: () => progress.listUnlockedLessonIds(),
  });
  const lessonsQ = useQuery({
    queryKey: ['lessons'],
    queryFn: () => content.listLessons(),
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
  // spinner, `aria-busy` per l'AT (AC3).
  if (
    !userId ||
    dueQ.data === undefined ||
    logQ.data === undefined ||
    unlockedQ.data === undefined ||
    lessonsQ.data === undefined
  ) {
    return (
      <main
        aria-busy="true"
        className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`}
      >
        {/* Blocchi neutri alla stessa altezza dei corrispondenti finali:
            conteggio + etichetta, streak, progresso, azione. Nessuno spinner. */}
        <div className="h-[72px] w-32 rounded-md bg-surface-sunken" />
        <div className="h-[20px] w-40 rounded-md bg-surface-sunken" />
        <div className="h-[16px] w-36 rounded-md bg-surface-sunken" />
        <div className="h-[16px] w-44 rounded-md bg-surface-sunken" />
        <div className="h-12 w-48 rounded-md bg-surface-sunken" />
      </main>
    );
  }

  // Read-model PURO: pila, streak e la SUCCESSIVA lezione DERIVATI a ogni lettura,
  // mai memorizzati (AD-5/AD-18). `isDue`/`streak`/`nextLessonToUnlock` restano
  // l'autorità di dominio; orologio e fuso ENTRANO dal Clock (mai letti qui).
  const count = dueQ.data.length;
  const days = streak(logQ.data, clock.now(), clock.timeZone());
  const unlocked = unlockedQ.data.length;
  const total = lessonsQ.data.length;
  // La SUCCESSIVA lezione da sbloccare (autorità sequenziale, puro): `null` a
  // curriculum esaurito. La UI passa alla RPC solo il suo `id`.
  const next = nextLessonToUnlock(lessonsQ.data, unlockedQ.data);

  return (
    <main className={`${CONTAINER_HEIGHT} flex flex-col items-center gap-6 p-6`}>
      {/* pile-counter: il conteggio nel ruolo tipografico più grande, l'etichetta
          SOTTO il numero (AC1). Il conteggio PRECEDE il verbo (AC4). */}
      <p className="text-count-hero text-ink-primary">{count}</p>
      <p className="text-label text-ink-secondary">{t('dashboard.dueLabel')}</p>

      {/* streak-badge: giorni consecutivi da `streak()` su review_log. */}
      <p className="text-label text-ink-secondary">
        {t('dashboard.streakLabel', { days })}
      </p>

      {/* curriculum-progress: sbloccate su totale ("u di t lezioni"). */}
      <p className="text-label text-ink-secondary">
        {t('dashboard.curriculumLabel', { unlocked, total })}
      </p>

      {/* Il CANCELLO delle quest sequenziali (AC4): al più UNA sola azione, mai
          entrambe insieme.
          - Pila NON vuota (count > 0) ⇒ SOLO svuota-pila (sola-copy, inerte come
            in 3.12; l'azione di sblocco NON è presente, nemmeno disabilitata).
          - Pila vuota (count === 0) con una lezione successiva ⇒ SOLO sblocco,
            cablato a `unlockMutation.mutate(next.id)`.
          - Pila vuota a curriculum esaurito (next === null) ⇒ NESSUNA azione (la
            schermata senza-azione è 3.16): non si rende alcun pulsante. */}
      {count > 0 ? (
        // button-primary svuota-pila: verbale e concreto. onClick/rotta (avvio
        // sessione) resta 3.18: qui è solo la copy.
        <button
          type="button"
          className="rounded-md border border-border-strong bg-accent text-surface-raised p-3 text-label"
        >
          {t('dashboard.primaryAction')}
        </button>
      ) : next !== null ? (
        // button-primary sblocco: materializza la lezione successiva via porta.
        <button
          type="button"
          onClick={() => unlockMutation.mutate(next.id)}
          disabled={unlockMutation.isPending}
          className="rounded-md border border-border-strong bg-accent text-surface-raised p-3 text-label"
        >
          {t('dashboard.unlockAction')}
        </button>
      ) : null}
    </main>
  );
}
