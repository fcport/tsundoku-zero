// Livello app (AD-1): la tabella delle rotte dichiarative. Sostituisce la
// commutazione booleana di 1.7 (AuthGate) con il routing per URL, applicando
// l'UNICO guard (routeGuards.tsx) a due archi simmetrici:
//
//   /login (pubblica) sotto RedirectIfAuthenticated → AuthScreen
//   path="*" (tutto il resto) sotto RequireAuth      → AuthenticatedShell
//
// Il catch-all dietro il guard protegge OGNI path non-/login (dashboard,
// statistiche, impostazioni: non esistono ancora come rotte, arrivano in Epic
// 3/5). La sessione (3.18) è la PRIMA rotta VERA (`/study`) che affianca il
// catch-all: dichiarata PRIMA di `path="*"` così ha precedenza, il resto ricade
// sulla shell. Coerente con «nessuna rotta prima della storia che la usa».
//
// react-router è importato SOLO nel livello app. Le schermate (features) non
// contengono controlli di auth (AC2) né stringhe di path: l'autorizzazione e il
// routing sono tutti qui.
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { AuthScreen } from '../features/auth/AuthScreen';
import { SessionScreen } from '../features/study/SessionScreen';
import { StatsScreen } from '../features/stats/StatsScreen';
import { DrillScreen } from '../features/drill/DrillScreen';
import { LessonsScreen } from '../features/lessons/LessonsScreen';
import { LessonPracticeScreen } from '../features/lessons/LessonPracticeScreen';
import { PrivacyScreen } from '../features/legal/PrivacyScreen';
import { AcknowledgementsScreen } from '../features/legal/AcknowledgementsScreen';
import { AboutScreen } from '../features/about/AboutScreen';
import { AuthenticatedShell } from './AuthenticatedShell';
import { SettingsPage } from './SettingsPage';
import { RedirectIfAuthenticated, RequireAuth } from './routeGuards';
import {
  ABOUT_PATH,
  ACKNOWLEDGEMENTS_PATH,
  DRILL_PATH,
  LEGACY_PATH_REDIRECTS,
  LESSON_PRACTICE_PATH,
  LESSONS_PATH,
  LOGIN_PATH,
  PRIVACY_PATH,
  ROOT_PATH,
  STATS_PATH,
  SETTINGS_PATH,
  STUDY_PATH,
  lessonPracticePath,
} from './routes';
import type { AuthGateway } from '../domain/ports/authGateway';
import type { SettingsRepository } from '../domain/ports/settingsRepository';
import type { AccountGateway } from '../domain/ports/accountGateway';

export interface AppRoutesProps {
  readonly authenticated: boolean;
  readonly gateway: AuthGateway;
  readonly settings: SettingsRepository;
  readonly account: AccountGateway;
  /**
   * L'id dell'utente corrente (o `null` finché non risolto), inoltrato alla shell
   * protetta e da lì alla dashboard (chiave per-utente della pila, 3.12).
   */
  readonly userId: string | null;
  readonly onAuthenticated: () => void;
  readonly onSignOut: () => void;
  readonly signOutPending: boolean;
  readonly onAccountDeleted: () => void;
}

export function AppRoutes({
  authenticated,
  gateway,
  settings,
  account,
  userId,
  onAuthenticated,
  onSignOut,
  signOutPending,
  onAccountDeleted,
}: AppRoutesProps) {
  // Navigazione confinata al livello app (AD-1): `useNavigate` è già usato dalla
  // shell. `onExit` della sessione (3.20) è cablato qui → ROOT_PATH (il catch-all
  // rende la dashboard), speculare a `onStartSession` della dashboard.
  const navigate = useNavigate();
  return (
    <Routes>
      {/* I vecchi percorsi in italiano: solo reindirizzamenti verso i nuovi, fuori
          dalle guardie (la destinazione applica la sua). */}
      {LEGACY_PATH_REDIRECTS.map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      <Route path="/lezioni/:lessonId" element={<LegacyLessonRedirect />} />
      {/* La privacy policy (7.1): l'UNICA rotta pubblica in ENTRAMBI gli stati —
          raggiungibile da anonimo (prima della registrazione) e da autenticato.
          Dichiarata come figlio DIRETTO di <Routes>, FUORI da entrambe le guardie,
          cosi il match statico `/privacy` batte il catch-all `*`. `onExit` e
          DETERMINISTICO dal livello app (niente navigate(-1), che su deep-link
          diretto sarebbe un vicolo cieco): autenticato -> ROOT_PATH, anonimo ->
          LOGIN_PATH. */}
      <Route
        path={PRIVACY_PATH}
        element={
          <PrivacyScreen
            onExit={() => navigate(authenticated ? ROOT_PATH : LOGIN_PATH)}
          />
        }
      />
      {/* I riconoscimenti (7.2): la SECONDA rotta pubblica in ENTRAMBI gli stati,
          gemella di `/privacy`. Figlio DIRETTO di <Routes>, FUORI da entrambe le
          guardie, cosi il match statico `/acknowledgements` batte il catch-all `*`.
          `onExit` DETERMINISTICO dal livello app (niente navigate(-1), vicolo cieco
          su deep-link diretto): autenticato -> ROOT_PATH, anonimo -> LOGIN_PATH. */}
      <Route
        path={ACKNOWLEDGEMENTS_PATH}
        element={
          <AcknowledgementsScreen
            onExit={() => navigate(authenticated ? ROOT_PATH : LOGIN_PATH)}
          />
        }
      />
      {/* «Come funziona?»: pubblica in entrambi gli stati, gemella di `/privacy`. */}
      <Route
        path={ABOUT_PATH}
        element={
          <AboutScreen
            onExit={() => navigate(authenticated ? ROOT_PATH : LOGIN_PATH)}
          />
        }
      />
      <Route element={<RedirectIfAuthenticated authenticated={authenticated} />}>
        <Route
          path={LOGIN_PATH}
          element={
            <AuthScreen
              gateway={gateway}
              onAuthenticated={onAuthenticated}
              onViewPrivacy={() => navigate(PRIVACY_PATH)}
              onViewAcknowledgements={() => navigate(ACKNOWLEDGEMENTS_PATH)}
              onViewAbout={() => navigate(ABOUT_PATH)}
            />
          }
        />
      </Route>
      <Route element={<RequireAuth authenticated={authenticated} />}>
        {/* La sessione di esercizi (3.18): rotta VERA sotto il guard, PRIMA del
            catch-all così `/study` ha precedenza. `userId` è già una prop di
            AppRoutes (chiave per-utente della pila, AD-5). */}
        <Route
          path={STUDY_PATH}
          element={
            <SessionScreen
              userId={userId}
              onExit={() => navigate(ROOT_PATH)}
            />
          }
        />
        {/* Le statistiche (5.1): rotta VERA sotto il guard, PRIMA del catch-all così
            `/stats` ha precedenza. `onExit`→ROOT_PATH, speculare alla sessione. */}
        <Route
          path={STATS_PATH}
          element={
            <StatsScreen
              userId={userId}
              onExit={() => navigate(ROOT_PATH)}
            />
          }
        />
        {/* L'allenamento libero: fuori dalla pila, `onExit`→ROOT_PATH come le altre. */}
        <Route
          path={DRILL_PATH}
          element={<DrillScreen onExit={() => navigate(ROOT_PATH)} />}
        />
        {/* Le lezioni e il ripasso libero di una lezione: fuori dalla pila. */}
        <Route
          path={LESSONS_PATH}
          element={
            <LessonsScreen
              userId={userId}
              onExit={() => navigate(ROOT_PATH)}
              onPractice={(lessonId) => navigate(lessonPracticePath(lessonId))}
            />
          }
        />
        <Route
          path={LESSON_PRACTICE_PATH}
          element={
            <LessonPracticeRoute
              userId={userId}
              onExit={() => navigate(LESSONS_PATH)}
            />
          }
        />
        <Route
          path={SETTINGS_PATH}
          element={
            <SettingsPage
              settings={settings}
              account={account}
              userId={userId}
              onAccountDeleted={onAccountDeleted}
            />
          }
        />
        <Route
          path="*"
          element={
            <AuthenticatedShell
              settings={settings}
              userId={userId}
              onSignOut={onSignOut}
              signOutPending={signOutPending}
            />
          }
        />
      </Route>
    </Routes>
  );
}

// Il ripasso di una lezione legge l'id dal path (react-router resta nel livello app)
// e lo passa alla feature. `key` rimonta la schermata cambiando lezione, così il
// giro e il punteggio ripartono da zero.
function LessonPracticeRoute({
  userId,
  onExit,
}: {
  readonly userId: string | null;
  readonly onExit: () => void;
}) {
  const { lessonId = '' } = useParams();
  return (
    <LessonPracticeScreen key={lessonId} userId={userId} lessonId={lessonId} onExit={onExit} />
  );
}

// Il vecchio `/lezioni/:lessonId` porta al ripasso della stessa lezione sul percorso nuovo.
function LegacyLessonRedirect() {
  const { lessonId = '' } = useParams();
  return <Navigate to={lessonPracticePath(lessonId)} replace />;
}
