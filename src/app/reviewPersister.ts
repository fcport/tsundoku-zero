// Livello app (4.2): la PERSISTENZA DUREVOLE della coda di mutation su IndexedDB.
// AD-1: `app` è l'unico livello che può dipendere dai pacchetti esterni del persister
// (`@tanstack/query-async-storage-persister`) e dal global `indexedDB` — le `features`
// non li toccano. Qui vive la glue-browser (l'adattatore `AsyncStorage` su IndexedDB)
// PIÙ la fabbrica del persister; la registrazione della `mutationFn` sta invece in
// `features/study/reviewMutation.ts` (dominio + react-query), dall'altra parte del
// confine.
//
// Perché IndexedDB + serialize IDENTITÀ (non `JSON`). Le variabili della mutation
// portano `Date` (`input.dueAt`, `input.reviewedAt`). `JSON.stringify` le
// trasformerebbe in stringhe e alla ripresa `applyReview` chiamerebbe `.toISOString()`
// su una stringa. IndexedDB usa lo STRUCTURED CLONE, che preserva i `Date`: passando
// `serialize`/`deserialize` IDENTITÀ al persister, lo snapshot resta un OGGETTO (mai
// una stringa) e i `Date` sopravvivono al round-trip persist→restore. Il valore
// «stringa» tipizzato dall'`AsyncStorage<string>` del persister è quindi in realtà un
// `PersistedClient` (oggetto): i cast qui sotto sono deliberati e circoscritti a
// questo confine — l'unico punto dove il tipo `string` del persister e l'oggetto
// clonato da IndexedDB si incontrano.
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';
import type {
  AsyncStorage,
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client';

// Le opzioni di persistenza del provider SENZA il persister (né il `queryClient`, che
// il provider aggiunge da sé): la forma testabile in `node` che `main.tsx` combina col
// persister via spread. Estrarre questo tipo dai literali inline evita che una
// regressione (es. `maxAge` che torna al default) resti verde e rompa in silenzio la
// ripresa della coda al riavvio.
type ReviewPersistOptions = Omit<
  PersistQueryClientOptions,
  'persister' | 'queryClient'
>;

// La chiave IndexedDB dello snapshot della coda: un solo record per l'intera coda di
// mutation. Il DB e lo store hanno nomi stabili così una riapertura ritrova il record.
const DB_NAME = 'tsundoku-review-sync';
const STORE_NAME = 'queue';
const CLIENT_KEY = 'client';

// Il tetto di throttle della scrittura su disco (AC5): il persister aggrega le
// scritture ravvicinate in al più una ogni `THROTTLE_MS`. `250 ms` è il tetto fissato
// dalla spec — abbastanza reattivo che una risposta accodata è durevole quasi subito,
// abbastanza rado da non martellare IndexedDB a ogni tick.
const THROTTLE_MS = 250;

/**
 * Apre (o crea) il database IndexedDB della coda e ne garantisce l'object store.
 * Ritorna una `Promise` del `IDBDatabase`: `open` è asincrona e l'upgrade
 * (`onupgradeneeded`) crea lo store alla prima apertura. Glue-browser: gira solo in
 * un ambiente con `indexedDB` (produzione); i test iniettano uno storage in memoria e
 * non passano di qui.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // `onblocked` scatta se un'ALTRA scheda tiene aperta una connessione durante un
    // upgrade di versione: senza gestirlo né `onsuccess` né `onerror` scatterebbero e
    // la `Promise` resterebbe appesa, bloccando restore del persister e render. La
    // rigettiamo con un errore esplicito così il fallimento risale invece di sospendere.
    request.onblocked = () =>
      reject(new Error("IndexedDB bloccato: connessione aperta in un'altra scheda"));
  });
}

/**
 * Esegue `work` dentro una transazione sull'object store e ne risolve/rigetta la
 * `Promise` sul completamento della transazione. Wrapping unico così `getItem`/
 * `setItem`/`removeItem` non ripetono il boilerplate del ciclo di vita transazionale.
 */
function withStore<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result: T | undefined;
    const request = work(store);
    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Adattatore `AsyncStorage` su IndexedDB (glue-browser). Memorizza il
 * `PersistedClient` come OGGETTO (structured clone), non come stringa: è ciò che
 * preserva i `Date` nelle variabili della coda. La firma `AsyncStorage<string>` del
 * persister ci obbliga al tipo `string`, ma con `serialize`/`deserialize` identità il
 * valore che scorre è sempre l'oggetto snapshot — vedi il commento di modulo. Non
 * usata nei test (che iniettano uno storage in memoria).
 */
export function createIndexedDbStorage(): AsyncStorage<string> {
  // `try/finally` attorno alla parte transazionale: `db.close()` DEVE scattare anche
  // sul percorso di errore/abort della transazione — una connessione IDBDatabase lasciata
  // aperta può bloccare futuri upgrade di versione in altre schede. L'errore continua a
  // propagare (la `Promise` rigetta), il `finally` chiude soltanto la connessione.
  return {
    getItem: async (key) => {
      const db = await openDb();
      try {
        const value = await withStore<unknown>(db, 'readonly', (store) =>
          store.get(key),
        );
        return (value ?? null) as string | null;
      } finally {
        db.close();
      }
    },
    setItem: async (key, value) => {
      const db = await openDb();
      try {
        await withStore(db, 'readwrite', (store) => {
          store.put(value, key);
        });
      } finally {
        db.close();
      }
    },
    removeItem: async (key) => {
      const db = await openDb();
      try {
        await withStore(db, 'readwrite', (store) => {
          store.delete(key);
        });
      } finally {
        db.close();
      }
    },
  };
}

/**
 * Crea il persister DUREVOLE della coda (AC5). Configurazione:
 * - `throttleTime` = 250 ms (tetto della spec): scritture aggregate.
 * - `serialize`/`deserialize` IDENTITÀ: lo snapshot resta un oggetto, IndexedDB lo
 *   clona con structured clone e i `Date` sopravvivono al round-trip. I cast a
 *   `string`/`PersistedClient` colmano la firma `AsyncStorage<string>` del persister
 *   (l'unico punto dove tipo-stringa del persister e oggetto-clonato si incontrano).
 * - `key`: la chiave del record IndexedDB dello snapshot.
 *
 * Lo `storage` è INIETTATO così il core è testabile in `node` con uno storage in
 * memoria (nessun IndexedDB reale): la produzione passa `createIndexedDbStorage()`.
 * `maxAge` (Infinity) e `shouldDehydrateQuery` (solo mutation) sono impostati dal
 * `PersistQueryClientProvider` in `main.tsx`, non qui: sono opzioni di persist/hydrate
 * del provider, non del persister.
 */
export function createReviewPersister(
  storage: AsyncStorage<string>,
): Persister {
  return createAsyncStoragePersister({
    storage,
    key: CLIENT_KEY,
    throttleTime: THROTTLE_MS,
    serialize: (client) => client as unknown as string,
    deserialize: (cached) => cached as unknown as PersistedClient,
  });
}

/**
 * Le opzioni di persist/hydrate del `PersistQueryClientProvider` (AC5), estratte dai
 * literali inline di `main.tsx` così sono esercitabili da un test `node`:
 * - `maxAge: Infinity` — una risposta accodata non scade dopo una chiusura prolungata.
 * - `dehydrateOptions.shouldDehydrateQuery: () => false` — si persiste SOLO la coda di
 *   mutation (il default `shouldDehydrateMutation` = `isPaused` tiene solo le pause),
 *   MAI le query. `main.tsx` le combina col persister: `{ persister, ...reviewPersistOptions() }`.
 */
export function reviewPersistOptions(): ReviewPersistOptions {
  return {
    maxAge: Infinity,
    dehydrateOptions: { shouldDehydrateQuery: () => false },
  };
}

/**
 * Fa ripartire il drenaggio della coda dopo un restore riuscito (l'`onSuccess` del
 * provider): riprende le mutation in pausa reidratate. Il `.catch` evita una unhandled
 * rejection se la ripresa fallisce (la correttezza è garantita dalla RPC idempotente e
 * dal refetch fresco della pila; il retry è la storia 4.3).
 */
export function resumeReviewQueue(queryClient: QueryClient): void {
  void queryClient.resumePausedMutations().catch(() => {});
}
