---
title: 'Riconoscere la fonte del metodo'
type: 'feature'
created: '2026-09-26'
baseline_revision: 'b7c5c2b71034b03f0d367e40d474364bbc10d41c'
status: 'awaiting-operator'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
operator_actions:
  - "Quando configuri il dominio pubblico del deploy (console Vercel), verifica che il dominio scelto NON contenga il nome della fonte ('Cure Dolly' o 'Dolly'): l'AC 'il nome della fonte non compare nel dominio' e verificabile solo sul dominio reale, che vive fuori dal repository (deploy-config.test.ts fissa solo vercel.json, non il dominio)."
  - "Sul deploy pubblico reale apri /riconoscimenti sia in inglese sia in italiano e verifica che il collegamento al canale apra, in una nuova scheda, il canale YouTube corretto della fonte (Organic Japanese with Cure Dolly, https://www.youtube.com/channel/UCkdmU8hGK4Fg3LghTVtKltQ): la correttezza e la raggiungibilita dell'URL esterno non sono verificabili da un test unitario."
---

<intent-contract>

## Intent

**Problem:** Chi si chiede da dove venga questo modo strutturale di spiegare la grammatica giapponese non trova, da nessuna parte nell'app, l'origine dell'approccio: manca una pagina di riconoscimenti che attribuisca la fonte del metodo (Cure Dolly) e, al tempo stesso, delimiti con precisione cosa il progetto NON eredita da essa.

**Approach:** Introdurre una schermata-rotta pubblica `/riconoscimenti` (stessa feature `features/legal` di 7.1, stesso stampo di `PrivacyScreen`) che, da i18n con parita en/it: attribuisce a Cure Dolly la divulgazione del modello strutturale con un collegamento reale al canale; dichiara che il contenuto degli esercizi e originale del progetto e non riproduce materiale della fonte; nega affiliazione/approvazione/continuita; e attesta che la sostanza grammaticale e linguistica consolidata citando una fonte accademica indipendente e verificabile. Raggiungibile da un collegamento sulla schermata di Accesso e da uno nelle Impostazioni, cablati come callback dal livello app (nessun react-router nelle features).

## Boundaries & Constraints

**Always:**
- La rotta `/riconoscimenti` e **ungated**: raggiungibile da anonimo e da autenticato. Vive fuori da entrambe le guardie in `AppRoutes`, dichiarata come figlio DIRETTO di `<Routes>`; il segmento statico ha precedenza sul catch-all `*` (stesso trattamento di `/privacy`).
- Il **nome della fonte** ("Cure Dolly"/"Dolly") compare SOLO nel contenuto di questa pagina: MAI nel nome del prodotto, nel percorso/URL (la rotta e `/riconoscimenti`, non `/cure-dolly`), ne nella copy di branding (namespace i18n `app`). L'identita visiva resta priva del nome della fonte.
- Il collegamento al canale e un vero `<a href>` all'URL stabile in forma channel-id `https://www.youtube.com/channel/UCkdmU8hGK4Fg3LghTVtKltQ` (gli id-canale non cambiano, gli handle si), con `target="_blank"` e `rel="noreferrer"`, testo del link da `t()`.
- La citazione accademica e **verificabile e specifica** (autore, titolo, editore, anno), indipendente dalla fonte del metodo: `Susumu Kuno, The Structure of the Japanese Language (MIT Press, 1973)`.
- Tutta la copy visibile passa da `t()` (AD-14/AD-1): nessuna stringa cablata, chiavi aggiunte a ENTRAMBI i cataloghi `en`/`it` sotto `legal.acknowledgements.*` (parita ricorsiva verificata dal test i18n), nessun carattere CJK nei cataloghi.
- Le features (`legal`, `auth`, `settings`) NON importano `react-router` ne conoscono stringhe di path (AD-1): la navigazione e una **callback** iniettata dal livello app, come `onExit`/`onViewPrivacy` esistenti.
- Tono del sistema (UX): ASCII nell'interfaccia, nessun `!`, nessuna emoji, nessun avverbio di lode; nessuna formulazione che suggerisca affiliazione/approvazione/continuita col canale; solo classi token del design system (nessun colore letterale); anello di focus visibile sugli interattivi.
- Invariante single-`<main>`: `AcknowledgementsScreen` e una schermata-rotta col PROPRIO `<main>` (come `PrivacyScreen`/`StatsScreen`); i collegamenti aggiunti in `AuthScreen`/`SettingsScreen` non introducono nuovi landmark (Impostazioni resta a due `role="group"`).

**Block If:**
- Emergesse che il progetto riproduce/adatta materiale della fonte (rendendo falsa la dichiarazione di originalita), o che il nome della fonte e gia usato in nome prodotto/dominio/identita: la pagina diventerebbe falsa. HALT con `blocked` e la discrepanza.

**Never:**
- NON introdurre licenze o README (storia 7.3, fuori ambito); NON toccare la privacy policy 7.1 se non per aggiungere il collegamento di navigazione.
- NON usare il nome della fonte come marchio, in loghi, titoli di pagina di branding, nel nome del prodotto o nel percorso di rotta.
- NON affermare o insinuare partnership, sponsorizzazione, approvazione ufficiale o continuita col canale.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Anonimo apre `/riconoscimenti` | `authenticated=false` | `AcknowledgementsScreen` resa (attribuzione + link canale + ritorno); un solo `<main>` | Nessun errore |
| Autenticato apre `/riconoscimenti` | `authenticated=true` | `AcknowledgementsScreen` resa; un solo `<main>` | Nessun errore |
| Collegamento su Accesso | `/login` anonimo | markup contiene `legal.acknowledgements.linkLabel`; `/riconoscimenti` raggiungibile con `authenticated=false` | Nessun errore |
| Collegamento in Impostazioni | `SettingsScreen` resa | markup contiene `legal.acknowledgements.linkLabel`; restano ESATTAMENTE 2 `role="group"` | Nessun errore |
| Ritorno dalla pagina | `onExit`, autenticato / anonimo | naviga a `ROOT_PATH` / `LOGIN_PATH` rispettivamente | Nessun errore |

</intent-contract>

## Code Map

- `src/features/legal/PrivacyScreen.tsx` -- MODELLO di riferimento (schermata-rotta presentazionale, `<main>` unico, `onExit`, token `FOCUS_RING`, copy da `t('legal.privacy.*')`); non modificare.
- `src/features/legal/AcknowledgementsScreen.tsx` -- NUOVO: gemello di `PrivacyScreen`. Aggiunge un `<a href>` esterno al canale (costante di modulo `CURE_DOLLY_CHANNEL_URL`) col token `FOCUS_RING`.
- `src/features/legal/AcknowledgementsScreen.test.tsx` -- NUOVO: ancora gli AC di contenuto alla superficie letta (attribuzione+struttura, link canale con href, originalita, no-affiliazione, citazione accademica), single `<main>`, ASCII/no-celebrazione, switch en->it.
- `src/i18n/en.ts` / `src/i18n/it.ts` -- cataloghi tipizzati; aggiungere il ramo `legal.acknowledgements.*` a ENTRAMBI (parita). `legal.privacy.*` resta invariato (linea 256-268 in en, 238-251 in it).
- `src/app/routes.ts` -- aggiungere ed esportare `ACKNOWLEDGEMENTS_PATH = '/riconoscimenti'` accanto a `PRIVACY_PATH` (con commento; il path NON contiene il nome della fonte).
- `src/app/AppRoutes.tsx` -- aggiungere `<Route path={ACKNOWLEDGEMENTS_PATH}>` come figlio DIRETTO di `<Routes>` (fuori dalle guardie, accanto a `/privacy`), `onExit={() => navigate(authenticated ? ROOT_PATH : LOGIN_PATH)}`; passare `onViewAcknowledgements={() => navigate(ACKNOWLEDGEMENTS_PATH)}` ad `AuthScreen`.
- `src/app/AppRoutes.test.tsx` -- harness `renderAt(path, authenticated)` gia esistente; aggiungere le righe della Matrix (`/riconoscimenti` anonimo+autenticato; link su `/login`).
- `src/features/auth/AuthScreen.tsx` -- aggiungere prop `onViewAcknowledgements: () => void` e un collegamento (button-affordance, `legal.acknowledgements.linkLabel`) dentro il `<main>`, accanto a quello della privacy.
- `src/features/settings/SettingsScreen.tsx` -- aggiungere prop `onViewAcknowledgements: () => void` e il collegamento (fuori dai due `role="group"`, accanto a quello della privacy, conteggio gruppi invariato = 2).
- `src/features/settings/SettingsScreen.test.tsx` -- harness `render()` passa gia `onViewPrivacy`; aggiungere `onViewAcknowledgements` (NOOP), asserire il link, verificare che i `role="group"` restino 2.
- `src/app/AuthenticatedShell.tsx` -- passare `onViewAcknowledgements={() => navigate(ACKNOWLEDGEMENTS_PATH)}` a `SettingsScreen` (usa gia `useNavigate` e importa `PRIVACY_PATH`).

## Tasks & Acceptance

**Execution:**
- `src/i18n/en.ts` -- aggiungere ramo `legal.acknowledgements: { title, linkLabel, method, channelLabel, originalContent, noAffiliation, scholarship, back }`. Valori: vedi Design Notes. -- fonte delle chiavi tipizzate, dichiarazioni fattuali.
- `src/i18n/it.ts` -- aggiungere lo STESSO ramo con la traduzione italiana (stessi valori proper-noun per `channelLabel` e la citazione). -- parita ricorsiva en/it.
- `src/app/routes.ts` -- esportare `ACKNOWLEDGEMENTS_PATH = '/riconoscimenti'` con commento. -- nessuna stringa di path nelle features; il path non porta il nome della fonte.
- `src/features/legal/AcknowledgementsScreen.tsx` -- NUOVA schermata presentazionale: `<main>` unico, copy da `t('legal.acknowledgements.*')`, `<a href={CURE_DOLLY_CHANNEL_URL} target="_blank" rel="noreferrer">` col testo `channelLabel`, prop `onExit` per il ritorno (affordance secondaria con `FOCUS_RING`); nessuna porta, nessuno stato. -- realizza la pagina di riconoscimenti.
- `src/features/legal/AcknowledgementsScreen.test.tsx` -- NUOVO test (`renderToStaticMarkup`, node): il markup contiene i cinque testi (`method`,`originalContent`,`noAffiliation`,`scholarship`,`channelLabel`); un solo `<main>`; l'href del canale e presente; `method` nomina "Cure Dolly" e "structural"/"strutturale"; `originalContent` nomina "original"/"originali" e "reproduce"/"riproduc"; `noAffiliation` nomina non-affiliazione/non-approvazione/non-continuazione; `scholarship` nomina "Kuno", "MIT Press", "1973"; nessun `!` e nessun code point >= U+2000 (resa en); dopo `changeLanguage('it')` rende i valori it. -- ancora gli AC di contenuto alla superficie letta.
- `src/features/auth/AuthScreen.tsx` -- prop `onViewAcknowledgements`, collegamento con `legal.acknowledgements.linkLabel` dentro il `<main>`, accanto a quello privacy. -- collegamento sulla schermata di Accesso.
- `src/features/settings/SettingsScreen.tsx` -- prop `onViewAcknowledgements`, collegamento con `legal.acknowledgements.linkLabel` fuori dai due `role="group"`. -- collegamento in Impostazioni.
- `src/features/settings/SettingsScreen.test.tsx` -- aggiornare `render()` per passare `onViewAcknowledgements` (NOOP); asserire il link; verificare che i `role="group"` restino 2. -- protegge l'invariante dei gruppi.
- `src/app/AuthenticatedShell.tsx` -- passare `onViewAcknowledgements={() => navigate(ACKNOWLEDGEMENTS_PATH)}` a `SettingsScreen`. -- cablaggio navigazione al livello app.
- `src/app/AppRoutes.tsx` -- rotta ungated `/riconoscimenti` + wiring `onViewAcknowledgements` per `AuthScreen` + `onExit` deterministico della pagina. -- rende `/riconoscimenti` raggiungibile in entrambi gli stati.
- `src/app/AppRoutes.test.tsx` -- aggiungere: `/riconoscimenti` con `authenticated=false` e con `true` rende `AcknowledgementsScreen` (single `<main>`, NON la dashboard); `/login` anonimo contiene `en.legal.acknowledgements.linkLabel`. -- verifica route-matching e raggiungibilita.
- `src/i18n/i18n.test.tsx` (o test esistente di identita del prodotto, se presente) -- aggiungere/estendere un'asserzione: il namespace `app` di `en` e `it` e `ACKNOWLEDGEMENTS_PATH` NON contengono la sottostringa `dolly` (case-insensitive), mentre `en.legal.acknowledgements.method` la contiene. -- ancora l'AC "il nome della fonte non compare nell'identita".

**Acceptance Criteria:**
- Given la pagina `/riconoscimenti` resa, when letta, then attribuisce a Cure Dolly la divulgazione del modello strutturale, and contiene un collegamento (`<a href>`) al canale YouTube reale della fonte.
- Given la stessa pagina, when letta, then dichiara che il contenuto degli esercizi e originale del progetto e non riproduce materiale della fonte, and non usa formulazioni che suggeriscano affiliazione, approvazione o continuita col canale.
- Given la stessa pagina, when letta, then dichiara che la sostanza grammaticale insegnata e linguistica consolidata citando almeno una fonte accademica indipendente, and il riferimento e verificabile e specifico (autore, titolo, editore, anno), non generico.
- Given il nome del prodotto, il percorso della rotta e la copy di branding (namespace `app`), when ispezionati, then non contengono il nome della fonte ("Cure Dolly"/"Dolly").
- Given la schermata di Accesso con `authenticated=false` e la schermata Impostazioni, when rese, then ciascuna contiene un collegamento alla pagina di riconoscimenti, and Impostazioni continua a esporre esattamente due `role="group"`.
- Given i cataloghi `en`/`it`, when confrontati, then hanno lo stesso insieme di chiavi (parita ricorsiva) and nessun valore contiene caratteri CJK.

## Design Notes

Gemello di `PrivacyScreen` (7.1): stessa struttura, stesso token `FOCUS_RING`, stesso `onExit` deterministico dal livello app (`authenticated ? ROOT_PATH : LOGIN_PATH`) per non lasciare un vicolo cieco su deep-link diretto. La rotta `/riconoscimenti` e figlio diretto di `<Routes>` (fuori dalle guardie) cosi il match statico batte il catch-all. L'unica novita rispetto a 7.1 e un vero collegamento esterno: un `<a href>` (non un `<button>`-callback) perche punta fuori dall'app; URL in forma channel-id per stabilita.

Il nome della fonte e confinato al contenuto della pagina: la rotta si chiama `/riconoscimenti` (non `/cure-dolly`) e nessuna copy di branding lo nomina -- e cosi che l'AC "il nome della fonte non compare nel dominio/identita" diventa osservabile in repo. Il dominio pubblico effettivo e scelto dall'operatore fuori dal repo; il vincolo qui e che nulla nel codice introduce quel nome nell'identita.

Reachability e simmetria con 7.1: pagina PUBBLICA (l'epica la elenca fra le sole pagine senza autenticazione, con login e privacy), quindi raggiungibile PRIMA dell'autenticazione dal login e, per autenticati, dalle Impostazioni -- gli stessi due punti d'aggancio della privacy, accanto ad essa.

Valori i18n (la copy PORTA gli AC, quindi e fissata qui):

```
en.legal.acknowledgements = {
  title: 'Acknowledgements',
  linkLabel: 'Read the acknowledgements',
  method: 'The structural way of explaining Japanese grammar used here was made widely known by Cure Dolly, whose lessons brought this model to a broad audience. The source is the channel:',
  channelLabel: 'Organic Japanese with Cure Dolly',
  originalContent: 'The exercises and their explanations are original to this project. They do not reproduce, copy, or adapt any material from that channel.',
  noAffiliation: 'This project is independent. It is not affiliated with, endorsed by, or a continuation of that channel.',
  scholarship: 'The grammar taught here is established linguistics, not a private theory. This structural description of Japanese is documented in the academic literature, for example in Susumu Kuno, The Structure of the Japanese Language (MIT Press, 1973).',
  back: 'Back',
}
it.legal.acknowledgements = {
  title: 'Riconoscimenti',
  linkLabel: 'Leggi i riconoscimenti',
  method: 'Il modo strutturale di spiegare la grammatica giapponese usato qui e stato reso ampiamente noto da Cure Dolly, le cui lezioni hanno divulgato questo modello a un vasto pubblico. La fonte e il canale:',
  channelLabel: 'Organic Japanese with Cure Dolly',
  originalContent: 'Gli esercizi e le loro spiegazioni sono originali di questo progetto. Non riproducono, copiano o adattano alcun materiale di quel canale.',
  noAffiliation: 'Questo progetto e indipendente. Non e affiliato, approvato, ne una continuazione di quel canale.',
  scholarship: 'La grammatica insegnata qui e linguistica consolidata, non una teoria privata. Questa descrizione strutturale del giapponese e documentata nella letteratura accademica, per esempio in Susumu Kuno, The Structure of the Japanese Language (MIT Press, 1973).',
  back: 'Indietro',
}
```

Nota ortografica: nei valori `it` va ripristinato l'accento corretto (`e`->`è`, `ne`->`né`) come nel resto di `it.ts`; nessun em-dash e nessuna virgoletta tipografica (code point >= U+2000) in ENTRAMBI i cataloghi.

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errori (confini: `legal`->`i18n` ok; nessun `react-router` in features; nessun colore letterale).
- `npm run typecheck` -- expected: 0 errori (chiavi `legal.acknowledgements.*` tipizzate; nuove prop richieste onorate da tutti i call-site e dai test).
- `npm test` -- expected: verde, inclusi parita i18n, `AcknowledgementsScreen.test.tsx`, `AppRoutes.test.tsx` e `SettingsScreen.test.tsx` aggiornati.

## Review Triage Log

### 2026-09-26 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[low]` `[patch]` L'invariante ASCII/no-`!` (nessun code point >= U+2000) era asserita solo sulla resa `en`, mentre la spec la richiede in ENTRAMBI i cataloghi. Aggiunto in `AcknowledgementsScreen.test.tsx` un test che rende la copy `it` e verifica l'assenza di `!` e di code point >= U+2000 (gli accenti `è`/`né` restano < U+2000).

I 13 finding rigettati (tutti low, nessuna conseguenza per il lettore della pagina): `rel="noreferrer"` implica gia `noopener` sui browser moderni e cambiarlo romperebbe l'asserzione senza guadagno reale; l'URL del canale e stato verificato out-of-band in fase di planning (id-canale reale della fonte); l'asimmetria fra i due test di rotta e coperta dagli AC di contenuto in `AcknowledgementsScreen.test.tsx`; la navigazione `onExit` e glue non eseguita da `renderToStaticMarkup` (convenzione «verifica live differita» del repo, gemella di 7.1); i due collegamenti su `AuthScreen` hanno etichette distinte (nomi accessibili distinti); l'indicatore «apre in nuova scheda» e WCAG AAA, non richiesto dal pavimento AA; `warnings: ['oversized']` e `status` in transito sono bookkeeping sanzionato del workflow; la nota ortografica nelle Design Notes e intenzionale (it.ts e canonico); il guard `app`+route-path copre le superfici d'identita che questa storia puo cambiare (il nome prodotto «Tsundoku Zero» e fisso e non toccato); la precedenza della rotta sul catch-all e gia ancorata da `not.toContain(dashboard.primaryAction)`.

I due finding fuori-repo (correttezza/raggiungibilita dell'URL esterno; clausola dominio dell'AC4) non sono difetti di codice: sono verifiche eseguibili solo da un umano sul deploy reale e sono state trasferite in `operator_actions` (vedi frontmatter).

## Auto Run Result

Status: awaiting-operator

### Sintesi della modifica implementata

Aggiunta la pagina pubblica di riconoscimenti `/riconoscimenti` (feature `features/legal`, gemella di `PrivacyScreen` di 7.1) che, da i18n con parita en/it: attribuisce a **Cure Dolly** la divulgazione del modello **strutturale** della grammatica giapponese con un **collegamento reale** al canale (`<a href>` esterno all'URL stabile in forma channel-id, `target="_blank"` + `rel="noreferrer"`); dichiara che il contenuto degli esercizi e **originale** del progetto e non riproduce materiale della fonte; **nega** affiliazione/approvazione/continuita col canale; e attesta che la sostanza grammaticale e **linguistica consolidata** citando una fonte accademica indipendente, verificabile e specifica (Susumu Kuno, *The Structure of the Japanese Language*, MIT Press, 1973). Il nome della fonte e confinato al **contenuto** della pagina: mai nel percorso di rotta (`/riconoscimenti`, non `/cure-dolly`) ne nel namespace `app` di branding, con un test i18n che ancora questo confine. La pagina e raggiungibile da un collegamento sulla schermata di Accesso (prima della registrazione) e da uno nelle Impostazioni; la rotta e ungated e la navigazione e cablata come callback dal livello app (nessun `react-router` nelle features, AD-1).

### File modificati/creati

- `src/features/legal/AcknowledgementsScreen.tsx` (nuovo) -- schermata-rotta presentazionale col proprio `<main>`, copy da `t('legal.acknowledgements.*')`, `<a href>` esterno al canale (costante `CURE_DOLLY_CHANNEL_URL`), `onExit` per il ritorno.
- `src/features/legal/AcknowledgementsScreen.test.tsx` (nuovo) -- AC di contenuto (attribuzione+strutturale, link canale con href/target/rel, originalita, non-affiliazione, citazione accademica), single `<main>`, ASCII/no-celebrazione su en E it, switch en->it.
- `src/i18n/en.ts` / `src/i18n/it.ts` -- ramo `legal.acknowledgements.{title,linkLabel,method,channelLabel,originalContent,noAffiliation,scholarship,back}` in entrambi (parita); italiano con ortografia corretta, nessun code point >= U+2000.
- `src/app/routes.ts` -- costante `ACKNOWLEDGEMENTS_PATH = '/riconoscimenti'`.
- `src/app/AppRoutes.tsx` -- rotta ungated `/riconoscimenti` (figlio diretto di `<Routes>`) + `onExit` deterministico + `onViewAcknowledgements` per `AuthScreen`.
- `src/app/AuthenticatedShell.tsx` -- cabla `onViewAcknowledgements={() => navigate(ACKNOWLEDGEMENTS_PATH)}` a `SettingsScreen`.
- `src/features/auth/AuthScreen.tsx` -- prop `onViewAcknowledgements` + collegamento dentro il `<main>`.
- `src/features/settings/SettingsScreen.tsx` -- prop `onViewAcknowledgements` + collegamento fuori dai due `role="group"`.
- `src/app/AppRoutes.test.tsx` / `src/features/settings/SettingsScreen.test.tsx` / `src/i18n/i18n.test.tsx` -- rotte `/riconoscimenti` (anonimo/autenticato), link su login e in Impostazioni (2 `role="group"` invariati), e guard «il nome della fonte non compare nell'identita».

### Esito della review

- Patch applicate: 1 (low) -- guardia ASCII/no-`!` sulla resa `it`.
- Deferiti: 0.
- Rigettati: 13 (tutti low) -- vedi Review Triage Log.

### Raccomandazione di review di follow-up

`false`. Nessuna patch `high`; punteggio `3×medium(0) + 1×low(1) = 1` (< 5). Patch per severita: high 0, medium 0, low 1.

### Verifica eseguita

- `npm run typecheck` -- 0 errori (prima e dopo il patch).
- `npm run lint` -- 0 errori (confini AD-1: `legal`->`i18n`, nessun `react-router` nelle features, nessun colore letterale).
- `npm test` -- 98 file, 1194 test verdi prima del patch; dopo il patch, i 4 file toccati (`AcknowledgementsScreen`, `i18n`, `AppRoutes`, `SettingsScreen`) verdi (63 test, con `AcknowledgementsScreen` a 12).
- Matrix Test Audit: righe 1-4 coperte da test eseguiti e verdi; riga 5 (`onExit`->ROOT/LOGIN) e glue differita alla verifica live (convenzione del repo, affordance testata presente).

### Perche awaiting-operator e non done

L'AC4 osserva tre superfici — nome prodotto, **dominio**, identita visiva — che non devono contenere il nome della fonte. Nome prodotto e identita sono verificati in-repo (guard su `app` e sul percorso di rotta). Il **dominio** pubblico, invece, non vive nel repository: `deploy-config.test.ts` dichiara che l'URL reale e un'azione operatore su Vercel. La clausola dominio dell'AC4 e quindi verificabile solo sul deploy reale, fuori dal repo. Tutto cio che un agente puo fare e completo e verificato; cio che resta e affidato all'operatore (vedi `operator_actions`), senza usare `blocked` (che fermerebbe l'intera run) e senza toccare `sprint-status.yaml`.

### Rischi residui

- La correttezza dell'attribuzione dipende dall'URL esterno (`UCkdmU8hGK4Fg3LghTVtKltQ`): verificato in fase di planning come canale reale della fonte, ma la sua raggiungibilita nel tempo e confermabile solo dal vivo (operator action #2).
- Le affermazioni di navigazione (link->`/riconoscimenti`, `onExit`->ROOT/LOGIN) sono glue non eseguita in ambiente node: coperte reali arriveranno dall'e2e del percorso (Epic 7 storia 7.4).
