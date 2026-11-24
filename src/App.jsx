import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { Login, ForgotPassword, ResetPassword } from './pages/auth';
import { ProtectedRoute } from './components/auth';
import { FrontiereChargementPage } from './components/atoms/FrontiereChargementPage';
import { ChargementPage } from './components/atoms/ChargementPage';
import { MentionCopyright } from './components/layout/MentionCopyright';

// Les pages protégées sont chargées à la demande : sans ça, maplibre-gl et
// recharts partent dans le bundle initial et se téléchargent dès le login.
// Les pages exportent des named exports, d'où le remap vers `default`.
const Dashboard = lazy(() => import('./pages/dashboard').then((m) => ({ default: m.Dashboard })));
const Collaboration = lazy(() => import('./pages/collaboration').then((m) => ({ default: m.Collaboration })));
const CollaborationDetail = lazy(() => import('./pages/collaboration-detail').then((m) => ({ default: m.CollaborationDetail })));
const Incident = lazy(() => import('./pages/incident').then((m) => ({ default: m.Incident })));
const IncidentDetailPage = lazy(() => import('./pages/incident').then((m) => ({ default: m.IncidentDetailPage })));
const Impact = lazy(() => import('./pages/impact').then((m) => ({ default: m.Impact })));
const Profile = lazy(() => import('./pages/profile').then((m) => ({ default: m.Profile })));
const TrashPage = lazy(() => import('./pages/trash').then((m) => ({ default: m.TrashPage })));
const Organisations = lazy(() => import('./pages/organisations').then((m) => ({ default: m.Organisations })));
const Agents = lazy(() => import('./pages/agents').then((m) => ({ default: m.Agents })));
const MesInterventions = lazy(() => import('./pages/mes-interventions').then((m) => ({ default: m.MesInterventions })));
const NotFound = lazy(() => import('./pages/not-found').then((m) => ({ default: m.NotFound })));


/** Reporte l'identifiant de l'ancienne adresse /incidents/:id vers la nouvelle. */
const RedirectionSignalement = () => {
  const { id } = useParams();
  return <Navigate to={`/signalements/${id}`} replace />;
};

function App() {
  // Il y avait ici un effet qui appelait authService.isAuthenticated(), jetait
  // le resultat, puis basculait un drapeau — l'application rendait donc `null`
  // au premier passage, avant de se rendre une seconde fois. Un ecran blanc a
  // chaque ouverture, pour rien : isAuthenticated() lit sessionStorage, c'est
  // synchrone, et personne n'utilisait sa reponse. C'est ProtectedRoute qui
  // decide reellement de l'acces a chaque route.
  return (
    <SWRConfig
      value={{
        // Une même clé demandée plusieurs fois en moins de 5 s ne déclenche
        // qu'une seule requête réseau.
        dedupingInterval: 5000,
        // Au retour sur une page, on réaffiche les données en cache pendant
        // que la revalidation se fait en fond, au lieu d'un écran de loader.
        keepPreviousData: true,
        revalidateOnFocus: false,
        errorRetryCount: 2,
      }}
    >
    <BrowserRouter>
      {/* Les pages arrivent a la demande. La frontiere rattrape l'echec de
          cette recuperation — deploiement en cours, connexion coupee — qui
          laissait jusqu'ici un ecran blanc et une erreur non rattrapee. */}
      <FrontiereChargementPage>
      <Suspense fallback={<ChargementPage />}>
      <Routes>
        {/* Route publique - Login */}
        <Route path="/login" element={<Login onLogin={() => {}} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Routes protégées */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/collaboration"
          element={
            <ProtectedRoute>
              <Collaboration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/collaboration/:id"
          element={
            <ProtectedRoute>
              <CollaborationDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/collaboration-detail/:id"
          element={
            <ProtectedRoute>
              <CollaborationDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/signalements"
          element={
            <ProtectedRoute>
              <Incident />
            </ProtectedRoute>
          }
        />
        <Route
          path="/signalements/:id"
          element={
            <ProtectedRoute>
              <IncidentDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mes-interventions"
          element={
            <ProtectedRoute>
              <MesInterventions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/impact"
          element={
            <ProtectedRoute>
              <Impact />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trash"
          element={
            <ProtectedRoute>
              <TrashPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organisations"
          element={
            <ProtectedRoute>
              <Organisations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/agents"
          element={
            <ProtectedRoute>
              <Agents />
            </ProtectedRoute>
          }
        />

        {/* Anciennes adresses : les signets et liens partagés vers /incidents
            doivent continuer de fonctionner. `replace` évite de polluer
            l'historique, et `:id` est reporté sur la nouvelle adresse. */}
        <Route path="/incidents" element={<Navigate to="/signalements" replace />} />
        <Route path="/incidents/:id" element={<RedirectionSignalement />} />

        {/* Redirections & 404 */}
        <Route path="/404" element={<NotFound />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </FrontiereChargementPage>
      <MentionCopyright />
    </BrowserRouter>
    </SWRConfig>
  );
}

export default App;
