import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import debounce from 'lodash.debounce';
import { useSidebarState } from '../../hooks/useSidebarState';
import { Header, Sidebar } from '../../components/layout';
import IncidentList from './components/IncidentList/IncidentList';
import { getIncidentsService } from './service/incident_service';
import IncidentModalContext from './modale/IncidentModalContext';
import IncidentDeleteModal from './modale/IncidentDeleteModal';
import IncidentAssignModal from './modale/IncidentAssignModal';
import './incident.css';
import { useReinitialisationSurChangement } from '../../hooks/useReinitialisationSurChangement';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
import { logger } from '../../utils/logger';
import { useEstTelephone } from './mobile/useEstTelephone';


// Fonction pour adapter les données de l'API au format attendu
const adaptIncidentData = (incident, currentUserId = null) => {
  if (!incident) return null;

  const isOwner = currentUserId && incident.taken_by ? parseInt(incident.taken_by) === parseInt(currentUserId) : false;

  // Mapper l'état de l'incident vers un badge en prenant en compte le propriétaire
  const getBadgeFromEtat = (etat) => {
    if (etat === 'taken_into_account') {
      return {
        label: isOwner ? 'PRIS EN COMPTE (PAR MOI)' : incident.taken_by ? 'PRIS EN COMPTE (PAR AUTRE)' : 'PRIS EN COMPTE',
        variant: isOwner ? 'taken-me' : incident.taken_by ? 'taken-other' : 'taken'
      };
    }
    if (etat === 'resolved') {
      return {
        label: isOwner ? 'RÉSOLU (PAR MOI)' : incident.taken_by ? 'RÉSOLU (PAR AUTRE)' : 'RÉSOLU',
        variant: isOwner ? 'resolved-me' : incident.taken_by ? 'resolved-other' : 'resolved'
      };
    }
    if (etat === 'declared') {
      return { label: 'DÉCLARÉ', variant: 'declared' };
    }
    return { label: 'EN COURS', variant: 'in-progress' };
  };

  return {
    ...incident,
    // Adapter les champs pour la carte et le détail
    location: incident.zone || incident.location || 'Localisation non spécifiée',
    type: incident.zone || incident.type || 'Non spécifié',
    image: incident.photo || incident.image,
    photo: incident.photo || incident.image, // Pour IncidentCard
    organisation_name: incident.organisation_name || incident.user_id?.organisation_name || 'Non spécifié',
    user_full_name: incident.user_full_name || (incident.user_id ? `${incident.user_id.first_name} ${incident.user_id.last_name}` : 'Non spécifié'),
    badges: [getBadgeFromEtat(incident.etat)],
    description: incident.description || 'Aucune description disponible',
    // Ajouter les coordonnées formatées
    coordinates: (() => {
      const lat = parseFloat(incident.lattitude);
      const lng = parseFloat(incident.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng };
      }
      return null;
    })(),
    // Dates formatées
    startDate: incident.created_at ? new Date(incident.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date(incident.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') : 'Non spécifié',
    endDate: incident.resolution_end_date ? new Date(incident.resolution_end_date).toLocaleDateString('fr-FR') : 'En cours',
    // Informations supplémentaires
    objectives: incident.objectives || [],
    participants: incident.participants || [],
    // taken_by est l'ID de la personne qui a pris en charge, pas le nombre
    participantsCount: incident.participants?.length || 0,
    extraParticipants: 0,
    // taken_by contient l'ID de l'utilisateur qui a pris en charge l'incident
    takenBy: incident.taken_by,
    // Déterminer si l'utilisateur connecté est propriétaire de l'incident
    isOwner: currentUserId ? incident.taken_by === parseInt(currentUserId) : false
  };
};

export const Incident = () => {
  const navigate = useNavigate();
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const workspaceClass = [
    'incident-workspace',
  ].join(' ');

  // Récupérer l'ID de l'utilisateur connecté
  const currentUserId = sessionStorage.getItem('user_id');

  // États pour la pagination et recherche
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Tableau ou carte : préférence gardée d'une visite à l'autre.
  const [vue, setVueEtat] = useState(() => {
    try { return localStorage.getItem('signalements.vue') === 'carte' ? 'carte' : 'tableau'; } catch { return 'tableau'; }
  });
  const setVue = (v) => {
    setVueEtat(v);
    try { localStorage.setItem('signalements.vue', v); } catch { /* navigation privée : préférence de session */ }
  };

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767.98px)');
    const maj = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  // Sur téléphone, la liste s'allonge (« Afficher 20 de plus ») au lieu de
  // paginer. Chaque lot est une page de 20 demandée À LA SUITE des précédentes :
  // /MapApi/incident/ coûte ~140 ms par ligne, redemander 40 puis 60 lignes à
  // chaque clic ferait payer à nouveau tout ce qui est déjà affiché.
  // Pas de bascule Liste/Carte sur téléphone : la carte vit sur le dashboard.
  const estTelephone = useEstTelephone();
  const vueEffective = estTelephone ? 'tableau' : vue;
  const listeContinue = isMobile && vueEffective === 'tableau';
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Plage de dates (YYYY-MM-DD). Vide par défaut : tous les signalements.
  const [periode, setPeriode] = useState({ debut: '', fin: '' });
  const periodeActive = periode.debut && periode.fin && periode.debut <= periode.fin ? periode : null;
  const clePeriode = periodeActive ? `${periodeActive.debut}_${periodeActive.fin}` : '';

  // La recherche part 400 ms après la dernière frappe : chaque requête coûte
  // ~3 s côté serveur, et à 200 ms un mot tapé en déclenchait plusieurs.
  const debouncedSetSearch = React.useMemo(
    () => debounce((val) => setSearch(val.trim().length === 1 ? '' : val), 400),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [debouncedSetSearch]);

  // Retour a la premiere page des qu'un filtre change.
  useReinitialisationSurChangement([search, statusFilter, clePeriode], () => setPage(1));

  // Charger la liste des incidents avec useSWR
  const {
    data: rawIncidents,
    error: erreurIncidents,
    isLoading: isLoadingIncidents,
    mutate: mutateIncidents
  } = useSWR(
    // statusFilter fait partie de la cle : sans lui, changer de statut ne
    // redemandait rien au serveur et le filtre ne s'appliquait qu'aux lignes
    // deja recues — soit la page courante, pendant que la pagination
    // continuait d'annoncer le total complet.
    listeContinue ? null : ['/incidents/all', page, search, statusFilter, clePeriode],
    () => getIncidentsService(page, pageSize, search, statusFilter, periodeActive),
    {
      // Changer de page laisse la page précédente affichée le temps de la réponse.
      keepPreviousData: true,
      // Cette route met ~3 s pour 20 lignes : revenir sur l'onglet ne la relance
      // pas plus d'une fois par minute.
      focusThrottleInterval: 60000,
      revalidateOnReconnect: true,
      onError: (error) => {
        logger.error('[INCIDENT] Erreur chargement incidents:', error);
      }
    }
  );

  // Adapter les données des incidents avec l'ID de l'utilisateur
  const {
    data: lotsMobile,
    error: erreurMobile,
    isLoading: chargementMobile,
    size: nbLots,
    setSize: setNbLots,
    mutate: mutateMobile,
  } = useSWRInfinite(
    (index, precedent) => {
      if (!listeContinue) return null;
      if (precedent && !precedent.next) return null;
      return ['/incidents/mobile', index + 1, search, statusFilter, clePeriode];
    },
    ([, p, s, e]) => getIncidentsService(p, pageSize, s, e, periodeActive),
    { revalidateFirstPage: false, focusThrottleInterval: 60000 },
  );

  // Un lot de plus est demandé mais pas encore arrivé.
  const chargementPlus = Boolean(listeContinue && lotsMobile && nbLots > lotsMobile.length);
  const chargerPlus = React.useCallback(() => setNbLots((n) => n + 1), [setNbLots]);

  const reponse = listeContinue
    ? (lotsMobile?.length ? { count: lotsMobile[0]?.count ?? 0, results: lotsMobile.flatMap((l) => l?.results || []) } : undefined)
    : rawIncidents;

  const rawList = reponse
    ? Array.isArray(reponse)
      ? reponse
      : Array.isArray(reponse.results)
        ? reponse.results
        : []
    : [];

  const incidents = rawList.map((inc) => adaptIncidentData(inc, currentUserId));

  // ── États locaux pour la gestion des modales d'incidents ─────────────────────
  const [deleteModal, setDeleteModal] = useState({ open: false, incident: null });
  const [assignModal, setAssignModal] = useState({ open: false, incident: null });
  const [deleteAlert, setDeleteAlert] = useState({ type: null, message: null });
  const [assignAlert, setAssignAlert] = useState({ type: null, message: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [deleteClosing, setDeleteClosing] = useState(false);
  const [assignClosing, setAssignClosing] = useState(false);

  const openDeleteModal = (incident) => {
    setDeleteModal({ open: true, incident });
    setDeleteAlert({ type: null, message: null });
    setDeleteClosing(false);
  };

  const closeDeleteModal = () => {
    setDeleteClosing(true);
    setTimeout(() => {
      setDeleteModal({ open: false, incident: null });
      setDeleteAlert({ type: null, message: null });
      setDeleteClosing(false);
    }, 280);
  };

  const openAssignModal = (incident) => {
    setAssignModal({ open: true, incident });
    setAssignAlert({ type: null, message: null });
    setAssignClosing(false);
  };

  const closeAssignModal = () => {
    setAssignClosing(true);
    setTimeout(() => {
      setAssignModal({ open: false, incident: null });
      setAssignAlert({ type: null, message: null });
      setAssignClosing(false);
    }, 280);
  };

  const contextValue = {
    deleteModal,
    setDeleteModal,
    assignModal,
    setAssignModal,
    deleteAlert,
    setDeleteAlert,
    assignAlert,
    setAssignAlert,
    isDeleting,
    setIsDeleting,
    isAssigning,
    setIsAssigning,
    deleteClosing,
    setDeleteClosing,
    assignClosing,
    setAssignClosing,
    mutateIncidents: listeContinue ? mutateMobile : mutateIncidents,
    openDeleteModal,
    closeDeleteModal,
    openAssignModal,
    closeAssignModal
  };

  return (
    <IncidentModalContext.Provider value={contextValue}>
      <div className="incident-page">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <div className={`incident-page-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {!estTelephone && (
            <Header
              onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
              sidebarCollapsed={sidebarCollapsed}
            />
          )}

          <div className={workspaceClass}>
            {/* Sur téléphone, l'erreur descend du haut de l'écran en alerte
                flottante, au-dessus de la liste, au lieu de la pousser. */}
            {(() => {
              const erreur = listeContinue ? erreurMobile : erreurIncidents;
              const bandeau = (
                <BandeauErreur
                  erreur={erreur}
                  onReessayer={listeContinue ? mutateMobile : mutateIncidents}
                  message="Impossible de charger les signalements. La liste affichée peut ne plus être à jour."
                />
              );
              return estTelephone ? (erreur && <div className="sgm-erreur">{bandeau}</div>) : bandeau;
            })()}
            {/* Liste des incidents (Pleine largeur) */}
            <IncidentList
              incidents={incidents}
              isLoading={listeContinue ? chargementMobile : isLoadingIncidents}
              onSelectIncident={(incident) => navigate(`/signalements/${incident.id}`, { state: { incident } })}
              search={searchInput}
              setSearch={(val) => {
                setSearchInput(val);
                debouncedSetSearch(val);
              }}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              periode={periode}
              setPeriode={setPeriode}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              count={reponse?.count || 0}
              vue={vueEffective}
              setVue={setVue}
              isMobile={isMobile}
              estTelephone={estTelephone}
              onPlus={chargerPlus}
              chargementPlus={chargementPlus}
            />
          </div>
        </div>

        {/* Modales d'actions d'incidents */}
        <IncidentAssignModal />
        <IncidentDeleteModal />
      </div>
    </IncidentModalContext.Provider>
  );
};

export default Incident;
