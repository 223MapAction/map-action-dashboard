import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useSidebarState } from '../../hooks/useSidebarState';
import { Clock, CloseCircle, ArrowLeft2 } from 'iconsax-react';
import { Header, Sidebar } from '../../components/layout';
import MetricsCards from './components/metrics/MetricsCards';
import MapContainer from './components/map/MapContainer';
import StatsWidgets from './components/widgets/StatsWidgets';
import ActivityPanel from './components/activity/ActivityPanel';
import './dashboard.css';
import { getActivityFeedService, getDashboardStatsService } from './service/dashboard_service';
import { API_URL_BASE } from '../../config/api_url_base';
import { authService } from '../auth/services/authService';
import { logger } from '../../utils/logger';
import { libelleGravite } from '../../utils/gravite';
import { getIncidentsService } from '../incident/service/incident_service';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { DashboardMobile } from './mobile/DashboardMobile';

const FiltrePastille = ({ libelle, onRetirer }) => (
  <span className="dashboard-filter-pill">
    {libelle}
    <button type="button" onClick={onRetirer} aria-label={`Retirer le filtre ${libelle}`}>
      <CloseCircle size={14} variant="Bold" color="currentColor" />
    </button>
  </span>
);

export const Dashboard = () => {
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityModalClosing, setActivityModalClosing] = useState(false);

  // Panneau d'activité desktop repliable, pour laisser plus de place à la
  // carte. L'état est mémorisé entre les visites.
  const [activityCollapsed, setActivityCollapsed] = useState(() => {
    try {
      return localStorage.getItem('dashboardActivityCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const [unseenActivities, setUnseenActivities] = useState(0);

  // Sur ordinateur, le panneau d'activité monte jusqu'en haut de l'écran et
  // accueille la cloche et l'avatar de l'en-tête.
  const [zoneActions, setZoneActions] = useState(null);
  const [estOrdinateur, setEstOrdinateur] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const surChangement = (e) => setEstOrdinateur(e.matches);
    mq.addEventListener('change', surChangement);
    return () => mq.removeEventListener('change', surChangement);
  }, []);

  const estMobile = useMediaQuery('(max-width: 640px)');

  // Pilotage de la carte depuis les indicateurs, les widgets et la recherche.
  const [filtreCarte, setFiltreCarte] = useState({ statut: null, gravite: null, zone: null });
  const [cibleCarte, setCibleCarte] = useState(null);
  const majFiltre = (cle, valeur) => setFiltreCarte((f) => ({ ...f, [cle]: valeur }));
  const ouvrirSurCarte = (id) => {
    if (id) setCibleCarte({ id, n: Date.now() });
  };
  const filtreActif = filtreCarte.statut || filtreCarte.gravite || filtreCarte.zone;
  const [contexteCarte, setContexteCarte] = useState(null);

  // Signalements d'une localité : la liste légère de la carte ne porte pas la
  // localité, on la demande donc à l'API complète (recherche par nom).
  const [zoneData, setZoneData] = useState(null);
  useEffect(() => {
    const zone = filtreCarte.zone;
    if (!zone) {
      setZoneData(null);
      return undefined;
    }
    let annule = false;
    getIncidentsService(1, 100, zone)
      .then((data) => {
        if (annule) return;
        const liste = (data?.results || []).filter((i) => i.zone === zone);
        setZoneData({
          ids: new Set(liste.map((i) => String(i.id))),
          points: liste
            .map((i) => ({ lat: parseFloat(i.lattitude ?? i.latitude), lng: parseFloat(i.longitude) }))
            .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
        });
      })
      .catch((err) => logger.error('[Dashboard] Erreur chargement localité:', err));
    return () => {
      annule = true;
    };
  }, [filtreCarte.zone]);

  const filtreExterne = useMemo(
    () => ({
      statut: filtreCarte.statut,
      gravite: filtreCarte.gravite,
      ids: filtreCarte.zone ? zoneData?.ids ?? new Set() : null,
      points: filtreCarte.zone ? zoneData?.points ?? null : null,
    }),
    [filtreCarte.statut, filtreCarte.gravite, filtreCarte.zone, zoneData]
  );

  // La recherche de l'en-tête demande d'ouvrir un signalement sur la carte
  useEffect(() => {
    const surFocus = (e) => {
      if (e.detail?.id) setCibleCarte({ id: e.detail.id, n: Date.now() });
    };
    window.addEventListener('mapaction:focus-incident', surFocus);
    return () => window.removeEventListener('mapaction:focus-incident', surFocus);
  }, []);

  // Les compteurs, widgets et la carte tirent leurs données de leurs propres
  // sources : `dashboard-stats` ici, et l'endpoint paginé `incident-filter`
  // directement dans MapContainer. SWR sert le cache immédiatement puis
  // revalide en arrière-plan.
  const { data: statsData } = useSWR(
    '/MapApi/incidents/dashboard-stats/',
    () => getDashboardStatsService(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const [activitiesList, setActivitiesList] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data: activitiesData, isLoading: isLoadingActivities, mutate: mutateActivities } = useSWR(
    '/MapApi/activity-feed/?page_size=10',
    () => getActivityFeedService({ page_size: 10 }),
    {
      revalidateOnFocus: false
    }
  );

  // Sync initial SWR data to activitiesList state
  useEffect(() => {
    if (activitiesData) {
      const results = activitiesData.results || (Array.isArray(activitiesData) ? activitiesData : []);
      setActivitiesList(prev => {
        const merged = [...prev];
        results.forEach(act => {
          if (!merged.some(m => m.id === act.id)) {
            merged.push(act);
          }
        });
        // Trier par date décroissante pour garder les plus récentes en premier
        return merged.sort((a, b) => new Date(b.created_at || b.timeStamp) - new Date(a.created_at || a.timeStamp));
      });
      setNextUrl(activitiesData.next || null);
    }
  }, [activitiesData]);

  // Écoute temps réel de l'activité via WebSockets
  useEffect(() => {
    const wsBaseUrl = API_URL_BASE.replace(/^http/, 'ws');
    const token = authService.getAccessToken();
    const query = token ? `?token=${token}` : '';

    let socket = null;
    let isCleanedUp = false;
    let delay = 3000;

    const shouldRetry = (code) => ![1000, 4001, 4003, 4004].includes(code);

    const connect = () => {
      if (isCleanedUp) return;
      socket = new WebSocket(`${wsBaseUrl}/ws/activity-feed/${query}`);

      socket.onopen = () => {
        delay = 3000;
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'activity' || data.action) {
            const newAct = {
              id: data.id || `activity-${Date.now()}`,
              action: data.action,
              user_name: data.user_name,
              organisation_name: data.organisation_name,
              organisation_id: data.organisation_id,
              created_at: data.created_at || data.timeStamp || new Date().toISOString(),
              timeStamp: data.timeStamp || data.created_at
            };

            // Ajouter directement à l'état local en tête
            setActivitiesList(prev => {
              if (prev.some(act => act.id === newAct.id)) return prev;
              return [newAct, ...prev];
            });
            setUnseenActivities(n => n + 1);

            // Mettre à jour aussi le cache SWR
            mutateActivities((prev) => {
              const rawList = prev?.results || (Array.isArray(prev) ? prev : []);
              if (rawList.some((act) => act.id === newAct.id)) return prev;
              return Array.isArray(prev) ? [newAct, ...rawList] : { ...prev, results: [newAct, ...rawList] };
            }, { revalidate: false });
          }
        } catch (e) {
          logger.error('[WS-Activity] Erreur parsing message:', e);
          mutateActivities();
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = (e) => {
        if (!isCleanedUp && shouldRetry(e.code)) {
          setTimeout(connect, delay);
          delay = Math.min(delay * 2, 30000);
        }
      };
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (socket) {
        socket.close();
      }
    };
  }, [mutateActivities]);

  const handleLoadMoreActivities = async () => {
    if (!nextUrl || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await getActivityFeedService({ url: nextUrl });
      if (data) {
        const newResults = data.results || (Array.isArray(data) ? data : []);
        setActivitiesList(prev => {
          const merged = [...prev];
          newResults.forEach(act => {
            if (!merged.some(m => m.id === act.id)) {
              merged.push(act);
            }
          });
          return merged;
        });
        setNextUrl(data.next || null);
      }
    } catch (err) {
      logger.error('[Dashboard] Erreur chargement plus d\'activités:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleActivityPanel = (collapsed) => {
    setActivityCollapsed(collapsed);
    try {
      localStorage.setItem('dashboardActivityCollapsed', collapsed ? '1' : '0');
    } catch {
      // Stockage indisponible : l'état reste valable pour la session
    }
  };

  // Les activités reçues panneau ouvert sont vues immédiatement
  useEffect(() => {
    if (!activityCollapsed) setUnseenActivities(0);
  }, [activityCollapsed, unseenActivities]);

  // La carte ne suit que le redimensionnement de la fenêtre : on en simule un
  // à la fin de l'animation du panneau pour qu'elle occupe le nouvel espace.
  useEffect(() => {
    const id = setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
    return () => clearTimeout(id);
  }, [activityCollapsed]);

  // Raccourci clavier « A » pour ouvrir / fermer le panneau
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() !== 'a' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      toggleActivityPanel(!activityCollapsed);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activityCollapsed]);

  const openActivityModal = () => {
    setActivityModalOpen(true);
    setActivityModalClosing(false);
  };

  const closeActivityModal = () => {
    setActivityModalClosing(true);
    setTimeout(() => {
      setActivityModalOpen(false);
      setActivityModalClosing(false);
    }, 250);
  };

  if (estMobile) {
    return (
      <DashboardMobile
        stats={statsData}
        filtreCarte={filtreCarte}
        majFiltre={majFiltre}
        effacerFiltres={() => setFiltreCarte({ statut: null, gravite: null, zone: null })}
        filtreExterne={filtreExterne}
        cible={cibleCarte}
        ouvrirSurCarte={ouvrirSurCarte}
        onFiltresChange={setContexteCarte}
        activites={activitiesList}
        isLoadingActivites={isLoadingActivities}
        nextUrl={nextUrl}
        onLoadMore={handleLoadMoreActivities}
        isLoadingMore={isLoadingMore}
      />
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar gauche */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        hideToggle
      />

      {/* Contenu principal */}
      <div className={`dashboard-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${activityCollapsed ? 'feed-reduit' : 'feed-ouvert'}`}>
        {/* Header */}
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          actionsContainer={estOrdinateur ? zoneActions : null}
          isCollapsed={sidebarCollapsed}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Zone centrale avec scroll */}
        <main className="dashboard-content">
          <div className="dashboard-grid">
            {/* Contexte de la carte : périmètre, puis filtres posés depuis le dashboard */}
            <div className="dashboard-filters" aria-live="polite">
              <span className="dashboard-filters-label">
                {contexteCarte
                  ? `${contexteCarte.pays || 'Tous les pays'} · ${contexteCarte.perimetre} · ${contexteCarte.etat}`
                  : 'Tous les pays · tous les signalements'}
              </span>
              {filtreCarte.statut && (
                <FiltrePastille
                  libelle={filtreCarte.statut === 'resolved' ? 'Résolus' : 'Pris en compte'}
                  onRetirer={() => majFiltre('statut', null)}
                />
              )}
              {filtreCarte.gravite && (
                <FiltrePastille
                  libelle={`Gravité ${libelleGravite(filtreCarte.gravite).toLowerCase()}`}
                  onRetirer={() => majFiltre('gravite', null)}
                />
              )}
              {filtreCarte.zone && (
                <FiltrePastille libelle={filtreCarte.zone} onRetirer={() => majFiltre('zone', null)} />
              )}
              {filtreActif && (
                <button
                  type="button"
                  className="dashboard-filters-reset"
                  onClick={() => setFiltreCarte({ statut: null, gravite: null, zone: null })}
                >
                  Tout effacer
                </button>
              )}
            </div>

            {/* Carte en premier (grande) */}
            <MapContainer filtreExterne={filtreExterne} cible={cibleCarte} onFiltresChange={setContexteCarte} />

            {/* 3 cartes métriques */}
            <MetricsCards
              stats={statsData}
              actif={filtreCarte.statut}
              onSelect={(statut) => majFiltre('statut', statut)}
            />

            {/* 3 widgets statistiques */}
            <StatsWidgets
              stats={statsData}
              zoneActive={filtreCarte.zone}
              graviteActive={filtreCarte.gravite}
              onZone={(zone) => majFiltre('zone', zone)}
              onGravite={(cle) => majFiltre('gravite', cle)}
              onIncident={ouvrirSurCarte}
            />
          </div>
        </main>

        {/* Sidebar droite fixe - Activité en temps réel */}
        <aside className={`dashboard-sidebar-right ${activityCollapsed ? 'collapsed' : ''}`}>
          <div className="feed-actions" ref={setZoneActions} />
          {activityCollapsed ? (
            <button
              type="button"
              className="activity-rail"
              onClick={() => toggleActivityPanel(false)}
              aria-label="Ouvrir le panneau d'activité"
              title="Ouvrir (A)"
            >
              <ArrowLeft2 size={18} color="currentColor" />
              <span className="live-indicator">
                <span className="live-dot"></span>
              </span>
              {unseenActivities > 0 && (
                <span className="activity-rail-badge">
                  {unseenActivities > 9 ? '9+' : unseenActivities}
                </span>
              )}
              <span className="activity-rail-label">Activité en temps réel</span>
            </button>
          ) : (
            <ActivityPanel
              activities={activitiesList}
              isLoading={isLoadingActivities}
              nextUrl={nextUrl}
              onLoadMore={handleLoadMoreActivities}
              isLoadingMore={isLoadingMore}
              onCollapse={() => toggleActivityPanel(true)}
              onSelect={ouvrirSurCarte}
            />
          )}
        </aside>
      </div>

      {/* Bouton flottant mobile - Historique des activités */}
      <button
        className="activity-fab"
        onClick={openActivityModal}
        aria-label="Voir l'historique des activités"
      >
        <Clock size={24} variant="Bold" color="var(--color-surface)" />
       {/*  {activitiesList.length > 0 && (
          <span className="activity-fab-badge">{activitiesList.length}</span>
        )} */}
      </button>

      {/* Modal Activité pour mobile */}
      {activityModalOpen && (
        <div
          className={`activity-modal-overlay ${activityModalClosing ? 'closing' : ''}`}
          onClick={closeActivityModal}
        >
          <div
            className={`activity-modal ${activityModalClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="activity-modal-close"
              onClick={closeActivityModal}
              aria-label="Fermer"
            >
              <CloseCircle size={28} variant="Bold" color="var(--color-text-secondary)" />
            </button>
            <ActivityPanel
              activities={activitiesList}
              isLoading={isLoadingActivities}
              nextUrl={nextUrl}
              onLoadMore={handleLoadMoreActivities}
              isLoadingMore={isLoadingMore}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
