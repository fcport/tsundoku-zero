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
| `/riconoscimenti` in inglese | browser sul deploy | attribuzione presente, esercizi dichiarati originali, affiliazione negata esplicitamente, fondamento accademico citato (Kuno 1973) |
| `/riconoscimenti` in italiano | browser sul deploy, dopo cambio lingua | stesso contenuto, tradotto |
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

## In attesa

| Storia | Cosa serve | Di chi |
|---|---|---|
| 6.3 | il transcript privato della lezione campione in `.authoring/` (mai versionato, storia 6.1), poi `npm run check-contamination` | owner |
| 6.4 | cronometrare un flusso di autorazione reale (M5) e autorare almeno quattro lezioni in più con rilettura umana (FR11.2) | owner |
| 7.4 | una pull request che faccia girare «E2E (percorso principale)» sul Supabase reale | questa PR |
| 7.6 | uno screen reader vero con voce TTS giapponese (NVDA/VoiceOver) | owner |
