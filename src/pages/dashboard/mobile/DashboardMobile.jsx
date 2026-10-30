import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '../../../components/layout';
import { useNotifications } from '../../../components/layout/useNotifications';
import MapContainer from '../components/map/MapContainer';
import { ActiviteMobile } from './ActiviteMobile';
import { NotificationsMobile } from './NotificationsMobile';
import { StatistiquesMobile } from './StatistiquesMobile';
import './dashboard-mobile.css';

/**
 * Dashboard sous 640 px : la carte en plein écran, les autres écrans par-dessus.
 * L'écran ouvert est dans l'adresse pour que le retour du téléphone le referme ;
 * la carte reste montée dessous et garde sa position et ses filtres.
 */
export const DashboardMobile = ({
  stats,
  filtreCarte,
  majFiltre,
  effacerFiltres,
  filtreExterne,
  cible,
  ouvrirSurCarte,
  onFiltresChange,
  activites,
  isLoadingActivites,
  nextUrl,
  onLoadMore,
  isLoadingMore,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const vue = params.get('vue');
  const notifications = useNotifications();

  const ouvrirVue = (nom) => setParams({ vue: nom });
  const fermerVue = () => {
    if (location.key === 'default') setParams({}, { replace: true });
    else navigate(-1);
  };
  const piloterCarte = (action) => (valeur) => {
    action(valeur);
    fermerVue();
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onClose={() => {}} />

      <main className="dm-plein">
        <MapContainer
          filtreExterne={filtreExterne}
          cible={cible}
          onFiltresChange={onFiltresChange}
          mobile={{
            nonLues: notifications.unreadCount,
            onStatistiques: () => ouvrirVue('statistiques'),
            onActivite: () => ouvrirVue('activite'),
            onNotifications: () => ouvrirVue('notifications'),
            graviteActive: filtreCarte.gravite,
            zoneActive: filtreCarte.zone,
            onGravite: (cle) => majFiltre('gravite', cle),
            onStatut: (statut) => majFiltre('statut', statut),
            onEffacer: effacerFiltres,
          }}
        />
      </main>

      {vue === 'statistiques' && (
        <StatistiquesMobile
          stats={stats}
          statut={filtreCarte.statut}
          zoneActive={filtreCarte.zone}
          graviteActive={filtreCarte.gravite}
          onStatut={piloterCarte((v) => majFiltre('statut', v))}
          onZone={piloterCarte((v) => majFiltre('zone', v))}
          onGravite={piloterCarte((v) => majFiltre('gravite', v))}
          onIncident={piloterCarte(ouvrirSurCarte)}
          onFermer={fermerVue}
        />
      )}
      {vue === 'activite' && (
        <ActiviteMobile
          activites={activites}
          isLoading={isLoadingActivites}
          nextUrl={nextUrl}
          onLoadMore={onLoadMore}
          isLoadingMore={isLoadingMore}
          onRetour={fermerVue}
        />
      )}
      {vue === 'notifications' && <NotificationsMobile donnees={notifications} onRetour={fermerVue} />}
    </div>
  );
};

export default DashboardMobile;
