# Verifiche dell'operatore

Alcuni criteri di accettazione non sono verificabili da un test: vivono fuori dal
repository (un dominio pubblico, un URL esterno, il progetto Supabase reale) o
richiedono un essere umano con occhi e orecchie. Le storie che li portano finiscono in
`awaiting-operator` e si chiudono con `bmad-loop confirm`.

Questo file è la loro **prova**. Senza, l'esito di quelle verifiche resterebbe solo
nella memoria di chi le ha fatte, e la Definition of Done del PRD §11 non sarebbe
ispezionabile da nessun altro.

Una riga per verifica: cosa è stato controllato, come, e cosa si è visto. Chi aggiunge
una riga scrive l'esito **misurato**, non quello atteso.

## 7.2 — Riconoscere la fonte del metodo

Verificata il 28-09-2026 sul deploy pubblico `tsundoku-zero.vercel.app`.

| Criterio | Come | Esito |
|---|---|---|
| Il nome della fonte non compare nel dominio | ispezione del dominio reale | `tsundoku-zero.vercel.app` — nessuna occorrenza di «Cure»/«Dolly» |
| `/acknowledgements` in inglese | browser sul deploy | attribuzione presente, esercizi dichiarati originali, affiliazione negata esplicitamente, fondamento accademico citato (Kuno 1973) |
| `/acknowledgements` in italiano | browser sul deploy, dopo cambio lingua | stesso contenuto, tradotto |
| Il collegamento apre il canale corretto in una nuova scheda | attributi del DOM + richiesta all'URL | `href` = `https://www.youtube.com/channel/UCkdmU8hGK4Fg3LghTVtKltQ`, `target="_blank"`, `rel="noreferrer"`; l'URL risponde HTTP 200 con titolo «Organic Japanese with Cure Dolly» |

## 7.5 — La cancellazione verificata tabella per tabella

Verificata il 28-09-2026 sul progetto Supabase reale, contando le righe **prima e dopo**
su ogni tabella — non dedotta dalle chiavi esterne. Account di prova registrato dal
deploy pubblico, prima lezione sbloccata, una risposta registrata via `apply_review`
per popolare anche `review_log`. Cancellazione invocata sulla **stessa** Edge Function
che usa l'app (`delete-account`), col JWT dell'utente.

| Tabella | Prima | Dopo |
|---|---:|---:|
| `auth.users` | 1 | 0 |
| `user_settings` | 1 | 0 |
| `lesson_progress` | 1 | 0 |
| `review_state` | 3 | 0 |
| `review_log` | 1 | 0 |
| `lesson` (contenuto, non per-utente) | 1 | **1** |
| `exercise` (contenuto, non per-utente) | 3 | **3** |

Controllo aggiuntivo non richiesto dall'AC ma dovuto ad `AD-11`: la stessa funzione
chiamata **senza** `Authorization` risponde **401**, quindi non cancella su richiesta
anonima.

## 7.4 — Il percorso completo verificato da una macchina

Verificata il 28-09-2026 con la pull request #1.

| Criterio | Come | Esito |
|---|---|---|
| «Confirm email» disattivato sulla console Supabase | Management API (`mailer_autoconfirm`) | già `true`: `signUp` restituisce subito una sessione |
| Secret `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` su GitHub Actions | impostati il 28-09-2026 leggendoli da `.env` | presenti; nessuna `service_role` fra i secret |
| «E2E (percorso principale)» verde su pull request, contro il Supabase reale | PR #1 | **2 test passati** in 17,4s (percorso principale + cancellazione) |
| Dopo il merge, «Migrate & deploy functions» applica le migrazioni e POI esegue il collaudo | run su `main` dopo il merge | ordine rispettato: `db push` → `functions deploy` → `E2E di collaudo`, tutti verdi |
| Teardown verificato (`AD-13`) | conteggio righe sul progetto reale dopo ogni run | 0 utenti residui; contenuto intatto (1 lezione, 3 esercizi) |

Osservazione collaterale, non richiesta da questa storia: la PR ha prodotto
un'**anteprima dedicata** (`…-git-verifica-e2e-…vercel.app`, distinta dalla produzione,
HTTP 200), che è l'AC2 della storia 1.2 — fino a oggi dato per funzionante e mai
provato. L'anteprima è però protetta dall'autenticazione Vercel: raggiungibile solo da
chi ha accesso al progetto. Se le anteprime devono essere pubbliche, è
un'impostazione da cambiare in Vercel (Deployment Protection), non un difetto del
repository.

## In attesa

| Storia | Cosa serve | Di chi |
|---|---|---|
| 6.3 | il transcript privato della lezione campione in `.authoring/` (mai versionato, storia 6.1), poi `npm run check-contamination` | owner |
| 6.4 | cronometrare un flusso di autorazione reale (M5) e autorare almeno quattro lezioni in più con rilettura umana (FR11.2) | owner |
| 7.6 | uno screen reader vero con voce TTS giapponese (NVDA/VoiceOver) | owner |
