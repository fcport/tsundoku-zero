# Addendum — Tsundoku Zero

Materiale tecnico e di profondità estratto dal product brief, tenuto fuori dal PRD perché riguarda il *come*, non il *cosa*.

**Destinatario primario:** `bmad-architecture`. Le proposte qui sotto sono **proposte**, non decisioni ratificate: l'Architect deve confermarle o sfidarle. Il PRD non le presuppone.

---

## 1. Direzione tecnica proposta

| Concern | Scelta proposta | Motivazione dell'owner |
|---|---|---|
| Framework | React 19 + TypeScript (strict) | È la competenza da dimostrare |
| Build | Vite | Veloce, configurazione minima |
| Routing | React Router | Tre rotte, niente di esotico |
| Stato UI | Zustand | Superficie piccola, nessun boilerplate; stato server tenuto separato da stato UI |
| Dati server | TanStack Query | Cache, aggiornamenti ottimistici, refetch in background |
| Backend | Supabase (Postgres, Auth, RLS) | Auth e dati per-utente senza scrivere un server |
| Stile | Tailwind | Iterazione rapida, nessun dibattito di architettura CSS |
| Test unitari | Vitest + Testing Library | |
| End-to-end | Playwright | Continuità con il lavoro professionale esistente |
| CI | GitHub Actions | Lint, typecheck, test a ogni PR |
| Hosting | Vercel o Netlify | Frontend statico; i dati stanno su Supabase |

### Punti che l'Architect deve valutare esplicitamente

- **La resilienza di rete (F9) non era prevista quando questa tabella è stata scritta.** FR9.2 e FR9.5 richiedono una coda **durevole**, che sopravvive alla chiusura dell'applicazione. TanStack Query da solo non la fornisce: la sua persistenza è cache di query, non coda di mutazioni garantita. Serve una decisione esplicita sul meccanismo di persistenza della coda e sull'idempotenza richiesta da FR9.6.
- **Piano gratuito Supabase.** I progetti inattivi vengono sospesi. Per un deploy pubblico dimostrativo che può restare inutilizzato per settimane, il primo accesso dopo la sospensione è degradato. Impatta M4 (registrarsi e studiare in meno di 60 secondi).
- **Zustand più TanStack Query** su un'applicazione a tre rotte: verificare che due librerie di stato siano giustificate e non sovradimensionate.

---

## 2. Confine architetturale

Il vincolo che l'owner considera più importante di tutti gli altri:

> `src/domain/` contiene il motore di scheduling e non sa nulla di React, Supabase o rete. Tutto il resto dipende da lui; lui non dipende da nulla.
>
> Se questo confine regge, la codebase si legge come progettata invece che assemblata.

Conseguenza operativa: è un **invariante da far rispettare meccanicamente** (regola di lint sui confini di import, o equivalente), non una convenzione affidata alla disciplina. Su un progetto guidato da sessioni automatiche, una convenzione non applicata meccanicamente decade in poche storie.

---

## 3. Modello dati — schizzo iniziale

```
vocabulary            -- dataset distribuito, sola lettura per gli utenti
  id                  uuid pk
  kanji               text null
  kana                text not null
  romaji              text not null
  meaning_en          text not null
  meaning_it          text not null
  jlpt_level          text not null
  part_of_speech      text not null

review_state          -- per utente, per item
  user_id             uuid fk -> auth.users, on delete cascade
  vocabulary_id       uuid fk -> vocabulary
  stage               int not null      -- stadio di scheduling
  due_at              timestamptz not null
  review_count        int not null
  lapse_count         int not null
  last_reviewed_at    timestamptz null
  primary key (user_id, vocabulary_id)

review_log            -- append-only, alimenta le statistiche
  id                  uuid pk
  user_id             uuid fk -> auth.users, on delete cascade
  vocabulary_id       uuid fk -> vocabulary
  outcome             text not null     -- again | hard | good | easy
  reviewed_at         timestamptz not null

user_settings
  user_id             uuid pk fk -> auth.users, on delete cascade
  locale              text not null default 'en'
  new_items_per_day   int not null default 10
```

La separazione fra dizionario immutabile e progresso mutabile per-utente è deliberata: il dataset può essere aggiornato o ricaricato senza toccare la cronologia di apprendimento di nessuno (FR2.3).

### Lacune note rispetto al PRD

- **FR9.6 (idempotenza della sincronizzazione).** `review_log` non ha una chiave che permetta di riconoscere una valutazione già applicata. Riapplicare una coda recuperata da FR9.5 produrrebbe righe duplicate, falsando le statistiche di F7 e la contro-metrica CM2. Serve un identificatore generato dal client, o un vincolo equivalente.
- **OQ-5 (stabilità degli id nel riseed).** `vocabulary.id` è uuid. Se un riseed rigenera gli uuid, ogni `review_state` resta orfano e la promessa di FR2.3 salta. Serve una chiave naturale stabile derivata dal contenuto.
- **FR8.3** persiste la lingua per utente: coerente con `user_settings.locale`. Nessuna lacuna.

---

## 4. Algoritmo di scheduling

Sistema di Leitner modificato — più semplice di SM-2, più facile da difendere, adeguato per qualche centinaio di item.

- Stadi da 0 a 5, con intervalli di circa 0, 1, 3, 7, 16 e 35 giorni.
- `again` riporta l'item allo stadio 0 e incrementa il contatore di ricadute.
- `good` avanza di uno stadio.
- `easy` avanza di due stadi.
- `hard` mantiene lo stadio e riprogramma a circa il 60% dell'intervallo corrente.
- Una piccola dispersione deterministica distribuisce le scadenze, così che la pila non arrivi a grappoli.

Firma da rispettare:

```ts
function schedule(
  state: ReviewState,
  outcome: ReviewOutcome,
  now: Date
): ReviewState
```

Pura, deterministica, interamente testata. Se in futuro l'algoritmo venisse sostituito con SM-2 o FSRS, cambierebbe solo questo modulo — è il senso del confine.

**Modifica richiesta dal PRD:** FR7.4 fissa la giornata dello streak alla mezzanotte locale. Il calcolo dello streak ha quindi bisogno anche del **fuso orario**, non del solo istante. Per preservare NFR2 va iniettato come parametro allo stesso modo di `now`, non letto dall'ambiente. La firma sopra copre `schedule()`; la funzione di streak richiede una firma propria che includa il fuso.

**Casi limite, risolti nel PRD.** Due regole, nessun caso speciale:

- **Gli stadi saturano** ai due estremi: mai sotto 0, mai sopra 5. `easy` allo stadio 4 porta a 5, non a 6. (FR5.3)
- **Intervallo 0 significa "di nuovo in questa sessione"**: l'item torna in fondo alla coda corrente. Questo copre sia `hard` allo stadio 0 (dove il 60% di zero è zero) sia `again` su un item già allo stadio 0 — con la stessa regola, senza ramificazioni. La sessione termina comunque, perché per uscire dalla coda un item deve ricevere almeno un `good`. (FR5.4)

### Alternative scartate

| Alternativa | Perché scartata |
|---|---|
| SM-2 | Più complesso da spiegare e giustificare; sovradimensionato per qualche centinaio di item |
| FSRS | Richiede dati di calibrazione che un utente singolo al giorno zero non ha |

Entrambe restano raggiungibili proprio grazie al confine di §2: sostituirle tocca un solo modulo.

---

## 5. Epiche proposte dall'owner

Input per `bmad-create-epics-and-stories`, che le raffinerà in storie implementabili. Riportate come scritte nel brief.

1. **Fondazione.** Repository, Vite + React + TS strict, Tailwind, ESLint e Prettier, Vitest, GitHub Actions con lint/typecheck/test, licenza MIT, pipeline di deploy che produce un URL pubblico. Fatta quando un'app vuota è pubblicamente raggiungibile e la CI è verde.
2. **Motore di dominio.** `src/domain/`: tipi, `schedule()`, selezione degli item dovuti, calcolo dello streak. Nessuna UI. Fatta quando i test coprono intervalli, ricadute, condizioni limite e comportamento con orologio iniettato.
3. **Livello dati.** Progetto Supabase, migrazioni dello schema, policy di isolamento su ogni tabella per-utente, dataset N5 caricato, client tipizzato, un test che dimostra che un utente non può leggere le righe di un altro.
4. **Autenticazione.** Registrazione, accesso, disconnessione, cancellazione account, rotte protette, persistenza di sessione, stati di errore per i fallimenti prevedibili.
5. **Flusso di studio.** Dashboard con conteggio della pila e azione primaria; schermata di studio con rivelazione e valutazione; stato di completamento; aggiornamenti ottimistici; operatività completa da tastiera e ARIA.
6. **Nuovi item.** Introduzione di vocabolario mai visto quando la pila è vuota, nel rispetto del tetto giornaliero; impostazione per modificare il tetto.
7. **Statistiche e streak.** Revisioni nel tempo, distribuzione per stadio, item con più ricadute, visualizzazione e calcolo dello streak.
8. **Internazionalizzazione.** Inglese e italiano, commutazione a runtime, persistenza per utente, nessuna stringa cablata residua.
9. **Lancio.** Pagina di privacy policy, cancellazione account verificata end-to-end, README, screenshot, stati vuoti e di errore, un test Playwright che copre il percorso completo.

### Effetto delle decisioni prese in questo PRD

- **La resilienza di rete (F9) non ha un'epica.** Attraversa Epic 5 (la sessione precarica e accoda) ed Epic 3 (idempotenza lato dati). Da collocare esplicitamente in `bmad-create-epics-and-stories`, altrimenti sparisce.
- **La provenienza e l'attribuzione del dataset (§9 del PRD, FR10.2)** ricadono su Epic 3 per la verifica della licenza e su Epic 9 per l'attribuzione visibile.
- **Epic 2 deve includere la firma della funzione di streak con fuso orario iniettato**, non solo `schedule()`.

---

## 6. Traccia del README

Il README non è un elenco di funzionalità. Deve rispondere a:

- Cos'è questo, in due frasi
- Perché Leitner e non SM-2 o FSRS
- Perché il livello di dominio non ha dipendenze dal framework
- Perché Supabase, e cosa cambierebbe su scala maggiore
- Perché la licenza del codice e quella dei dati sono separate
- Cosa è stato deliberatamente lasciato fuori, e perché
- Come è stato usato il flusso di lavoro assistito da AI: cosa è stato delegato, cosa rifiutato, dove è costato più tempo di quanto ne abbia risparmiato

L'ultimo punto merita di essere scritto onestamente. È un documento più interessante del codice.
