import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { FiltersBar } from '../../components/molecules/FiltersBar';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { useSidebarState } from '../../hooks/useSidebarState';
import Pagination from '../../components/molecules/Pagination';
import { getIncidentsService } from '../incident/service/incident_service';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale/fr';
import 'react-datepicker/dist/react-datepicker.css';
import {
  ArrowDown2,
  Filter,
  Calendar,
  CalendarRemove,
  Location,
  People,
  Crown1,
  Danger,
  Gallery,
  Element3,
  RowVertical,
} from 'iconsax-react';
import { Header, Sidebar } from '../../components/layout';
import { CollaborationRequests } from '../collaboration-requests';
import { SuggestRequests } from '../suggest-request/SuggestRequests';
import { getCollaborationsService } from './service/collaboration_service';
import { ShimmerThumbnail, ShimmerTitle, ShimmerText } from 'react-shimmer-effects';
import '../incident/components/IncidentDetail/vue-detail.css';
import './collaboration.css';
import './collaboration-liste.css';
import { useReinitialisationSurChangement } from '../../hooks/useReinitialisationSurChangement';
import { useEnVue } from '../../hooks/useEnVue';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
import { useSocketCollaborations } from '../../hooks/useSocketCollaborations';


registerLocale('fr', fr);

const CLE_VUE = 'collaborations.vue';

// Statut affiché sur une collaboration, une fois l'avancement pris en compte.
const STATUTS = {
  'in-progress': { libelle: 'En cours', classe: 'vl-s-cours' },
  completed: { libelle: 'Terminée', classe: 'vl-s-fini' },
  pending: { libelle: 'Invitation en attente', classe: 'vl-s-attente' },
  declined: { libelle: 'Refusée', classe: 'vl-s-refus' },
  rejected: { libelle: 'Refusée', classe: 'vl-s-refus' },
};

const ROLES = {
  leader: 'Leader',
  contributor: 'Contributeur',
  contributeur: 'Contributeur',
  observer: 'Observateur',
  observateur: 'Observateur',
};

const libelleRole = (role) => ROLES[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Membre');

// La vignette de chaque carte est en background-image : `loading="lazy"` ne
// s'applique qu'a <img>/<iframe>, pas a une div. Sans ce composant, les 20
// cartes d'une page chargeaient leurs 20 images en meme temps a l'ouverture.
// Un hook ne peut pas s'appeler dans la boucle .map() de la liste : chaque
// carte doit donc etre son propre composant pour avoir sa propre instance de
// useEnVue.
const CollabCardCover = ({ className, image, children }) => {
  const [ref, enVue] = useEnVue();
  return (
    <div
      ref={ref}
      className={className}
      style={enVue && image ? { backgroundImage: `url(${image})` } : undefined}
    >
      {children}
    </div>
  );
};

export const Collaboration = () => {
  const navigate = useNavigate();
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'requests' ? 'requests' : tabParam === 'suggestions' ? 'suggestions' : 'collaborations';
  const setActiveTab = (tab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const {
    saisie: searchInput,
    setSaisie: setSearchInput,
    recherche: search,
  } = useRechercheDebouncee();
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('accepted');
  const [localStatusFilter, setLocalStatusFilter] = useState('all');
  const [incidentFilter, setIncidentFilter] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [dateFrom, dateTo] = dateRange;

  // Le role a sa propre liste, toujours visible (c'est le filtre qu'on change
  // le plus apres le statut). Signalement, acceptation et periode sont repliés derriere « Plus de
  // filtres » : cette page etait la seule de l'app a afficher 3 menus
  // deroulants + un selecteur de dates + 3 pastilles en permanence, contre 1 a
  // 2 filtres ailleurs. On garde la recherche et les pastilles (les plus
  // utilisees) toujours visibles, et on replie le reste.
  //
  // Le panneau s'ouvre tout seul si un filtre replie est deja actif (ex. lien
  // partage avec ?incident=...) : sinon l'utilisateur verrait une liste
  // filtree sans savoir pourquoi, ni comment revenir en arriere.
  const filtresAvancesActifs =
    statusFilter !== 'all' || Boolean(incidentFilter) ||
    Boolean(dateFrom) || Boolean(dateTo);
  const [filtresAvancesOuverts, setFiltresAvancesOuverts] = useState(filtresAvancesActifs);
  // On n'ouvre le panneau QUE lorsque filtresAvancesActifs passe de faux a
  // vrai : si l'utilisateur l'a replie a la main, on ne le rouvre pas tout
  // seul a chaque changement d'un filtre deja actif.
  useReinitialisationSurChangement([filtresAvancesActifs], () => {
    if (filtresAvancesActifs) setFiltresAvancesOuverts(true);
  });
  const nbFiltresAvancesActifs = [
    statusFilter !== 'all', Boolean(incidentFilter), Boolean(dateFrom) || Boolean(dateTo),
  ].filter(Boolean).length;


  // Retour a la premiere page des qu'un filtre change.
  useReinitialisationSurChangement(
    [search, roleFilter, statusFilter, incidentFilter, dateFrom, dateTo, localStatusFilter],
    () => setPage(1),
  );

  // Les cent signalements qui remplissent la liste déroulante du filtre.
  //
  // Mesuré à 4,3 s (111 Ko, 35 signalements complets) : c'est cher pour un menu
  // qui n'affiche qu'un titre par entrée. Cet appel partait jusqu'ici dès que
  // le navigateur devenait inoccupé, donc à chaque visite, y compris pour les
  // gens qui n'ouvrent jamais « Plus de filtres » — soit la majorité.
  //
  // On attend donc que ce menu-là soit ouvert. Se brancher sur le panneau
  // « Plus de filtres » ne servirait à rien : statusFilter vaut « accepted »
  // par défaut, donc le panneau s'ouvre de lui-même au premier rendu, pour
  // tout le monde. Le menu des signalements, lui, reste fermé tant qu'on ne
  // clique pas dessus.
  //
  // Une fois chargée, la liste reste en cache cinq minutes : refermer puis
  // rouvrir ne relance rien. Le coût est un court délai à la première
  // ouverture du menu, contre 4 s de trafic épargnées à tous ceux qui ne
  // filtrent pas par signalement.
  //
  // Charger plutôt que réduire : couper à vingt entrées rendrait le filtre
  // menteur, puisqu'il ne proposerait plus tous les signalements existants.
  const [listeSignalementsDemandee, setListeSignalementsDemandee] = useState(false);

  const { data: rawIncidents, isLoading: chargementListeSignalements } = useSWR(
    listeSignalementsDemandee ? 'incidents_dropdown_list' : null,
    () => getIncidentsService(1, 100),
    { dedupingInterval: 300000, revalidateIfStale: false, revalidateOnFocus: false }
  );
  const incidentsList = useMemo(() => {
    return rawIncidents?.results || (Array.isArray(rawIncidents) ? rawIncidents : []);
  }, [rawIncidents]);

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = (e) => setIsMobile(e.matches);
    update(mq);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Construit les paramètres d'appel pour une page donnée.
  const buildParams = useMemo(
    () => (pageArg) => {
      const params = { page: pageArg, page_size: pageSize };
      if (search.trim()) {
        params.search = search.trim();
      }
      if (roleFilter) {
        params.role = roleFilter;
      }
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      // Filtre d'avancement (Terminées / En cours)
      if (localStatusFilter === 'completed') {
        params.status = 'completed';
      } else if (localStatusFilter === 'in-progress') {
        params.status = 'in-progress';
      }
      if (incidentFilter) {
        params.incident_id = incidentFilter;
      }
      if (dateFrom) {
        params.date_from = dateFrom.toISOString().slice(0, 10);
      }
      if (dateTo) {
        params.date_to = dateTo.toISOString().slice(0, 10);
      }
      return params;
    },
    [search, roleFilter, statusFilter, incidentFilter, dateFrom, dateTo, localStatusFilter]
  );

  // Utiliser useSWR pour charger les collaborations
  const { data: swrData, error: swrError, isLoading, mutate } = useSWR(
    ['collaborations', page, search, roleFilter, statusFilter, incidentFilter, dateFrom, dateTo, localStatusFilter],
    () => getCollaborationsService(buildParams(page)),
    // Cette route met 8 a 10 secondes. Les revalidations automatiques de SWR —
    // au focus de la fenetre, a la reconnexion, ou parce que la donnee est
    // jugee perimee — relancent donc un appel de 10 secondes sans que
    // l'utilisateur ait rien demande. Mesure : un second appel identique
    // partait exactement a la fin du premier. Le rafraichissement reste
    // possible, mais seulement quand on revient sur l'onglet.
    { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false }
  );

  // Le prechargement de la page suivante est suspendu. Il avait du sens sur une
  // route rapide ; mesuree entre 7 et 12 secondes, elle fait payer a chacun un
  // appel lent pour un clic sur « suivant » qui n'arrivera peut-etre jamais.
  // A remettre quand /MapApi/collaborations/dashboard/ aura ete profile.

  // Revalider en fond au RETOUR sur l'onglet. La version precedente testait la
  // valeur de l'onglet et non son changement : elle se declenchait donc aussi
  // au premier montage, redemandant ce que SWR venait tout juste de demander.
  // Sur une route a 7-12 secondes, cela doublait le chargement de la page.
  const ongletPrecedent = useRef(activeTab);
  useEffect(() => {
    const revient = ongletPrecedent.current !== 'collaborations' && activeTab === 'collaborations';
    ongletPrecedent.current = activeTab;
    if (revient) mutate();
  }, [activeTab, mutate]);

  // Statuts recus en direct par WebSocket, appliques par-dessus la reponse de
  // l'API. La route `/MapApi/collaborations/dashboard/` met 8 a 12 secondes :
  // attendre sa revalidation pour afficher une acceptation laisserait la carte
  // en « en attente » pendant une dizaine de secondes apres le clic d'en face.
  const [statutsTempsReel, setStatutsTempsReel] = useState({});

  const surMessageCollaboration = useCallback((donnees) => {
    const id = donnees.id;
    const statut = donnees.status;
    if (id && statut) {
      setStatutsTempsReel((prec) => ({ ...prec, [id]: statut }));
    }
    // Revalidation en fond : le message ne porte pas toute la collaboration
    // (titre du signalement, vignette, taches). L'affichage est deja correct
    // grace a l'override ci-dessus, l'appel lent se contente de completer.
    //
    // L'override est retire des que l'API renvoie le meme statut : le laisser
    // en place figerait la carte et masquerait un changement ulterieur venu
    // d'ailleurs (autre onglet, autre appareil).
    mutate().then((frais) => {
      if (!id || !frais) return;
      const liste = frais.results || (Array.isArray(frais) ? frais : []);
      const ligne = liste.find((c) => String(c.id) === String(id));
      if (!ligne || ligne.status !== statut) return;
      setStatutsTempsReel((prec) => {
        if (!(id in prec)) return prec;
        const { [id]: _retire, ...restants } = prec;
        return restants;
      });
    }).catch(() => {
      // Une revalidation en echec laisse l'override en place : mieux vaut
      // afficher le statut recu en direct que revenir a l'ancien.
    });
  }, [mutate]);

  // L'onglet « Demandes » ouvre deja sa propre connexion sur le meme canal :
  // on ne branche celle-ci que sur l'onglet des collaborations.
  useSocketCollaborations(surMessageCollaboration, activeTab === 'collaborations');

  // Mapper les données API vers le format attendu par le composant
  const collaborations = useMemo(() => {
    if (!swrData) return [];
    const rawList = swrData.results || (Array.isArray(swrData) ? swrData : []);

    return rawList.map(collab => {
      const createdDate = new Date(collab.created_at);
      const startDate = collab.start_date ? new Date(collab.start_date) : null;
      const endDate = collab.end_date ? new Date(collab.end_date) : null;
      const incidentTitle = collab.incident_details?.title || collab.incident_title || `Incident`;
      // Vignette d'abord : posee en fond de carte sur quelques centaines de
      // pixels, alors que incident_photo est l'original — mesure : ~973 Ko en
      // moyenne contre ~14 Ko pour incident_thumbnail, facteur ~70. L'API
      // fournit les deux sur chaque ligne ; seul l'ordre de preference change.
      const incidentImage = collab.incident_thumbnail || collab.thumbnail || collab.incident_photo || collab.photo || collab.incident_details?.image || collab.incident_details?.photo || '';
      const orgName = collab.organisation_name || collab.user_full_name || ``;
      const incidentLocation = collab.incident_details?.zone || collab.incident_zone || 'À définir';
      const incidentDescription = collab.incident_description || collab.incident_details?.description || collab.motivation || 'Aucune description';
      const incidentProgress = Math.max(0, Math.min(100, parseInt(collab.incident_progress, 10) || 0));
      const tasks = collab.tasks || [];
      // Leader : seulement si la ligne porte les organisations du signalement.
      const leader = (collab.incident_details?.acting_organisations || []).find((o) => o.relation === 'leader')?.name || '';
      const participantsCount = collab.participants_count || collab.incident_details?.participants_count || 0;
      const statutBrut = statutsTempsReel[collab.id] || collab.status;

      return {
        id: collab.id,
        userRole: collab.role,
        title: incidentTitle,
        incidentId: collab.incident,
        userId: collab.user,
        status: incidentProgress === 100 ? 'completed' : (statutBrut === 'accepted' ? 'in-progress' : statutBrut),
        createdAt: collab.created_at,
        motivation: collab.motivation,
        otherOption: collab.other_option,
        image: incidentImage,
        organisation: orgName,
        role: collab.role,
        joinedAt: createdDate.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        startDate: startDate ? startDate.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }) : 'Non défini',
        endDate: endDate ? endDate.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }) : 'Non défini',
        startAt: collab.created_at,
        endAt: collab.end_date,
        location: incidentLocation,
        description: incidentDescription,
        progress: incidentProgress,
        tasks,
        tasksDone: tasks.filter((t) => t.completed).length,
        tasksFailed: tasks.filter((t) => t.failed).length,
        leader,
        participantsCount
      };
    });
  }, [swrData, statutsTempsReel]);

  // Filtres locaux pour recherche et dates (le filtre de statut est maintenant géré par l'API)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return collaborations.filter((c) => {
      // Filtre période (optionnel, peut être géré par l'API aussi)
      if (dateFrom || dateTo) {
        const cStart = c.startAt ? new Date(c.startAt) : null;
        const cEnd = c.endAt ? new Date(c.endAt) : null;
        if (dateFrom && cEnd && cEnd < dateFrom) return false;
        if (dateTo && cStart && cStart > dateTo) return false;
      }

      // Filtre recherche
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.organisation.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
      );
    });
  }, [collaborations, search, dateFrom, dateTo]);

  const resetDateRange = () => setDateRange([null, null]);

  const openCollabDetail = (collab) => {
    navigate(`/collaboration-detail/${collab.id}`);
  };

  const counts = useMemo(
    () => ({
      all: collaborations.length,
      'in-progress': collaborations.filter((c) => c.status === 'in-progress').length,
      completed: collaborations.filter((c) => c.status === 'completed').length,
    }),
    [collaborations]
  );

  // Cartes ou liste compacte : préférence de l'utilisateur, gardée d'une visite à l'autre.
  const [vue, setVue] = useState(() => {
    try {
      return localStorage.getItem(CLE_VUE) === 'liste' ? 'liste' : 'cartes';
    } catch {
      return 'cartes';
    }
  });
  const changerVue = (v) => {
    setVue(v);
    try {
      localStorage.setItem(CLE_VUE, v);
    } catch {
      // Stockage indisponible (navigation privée) : la préférence vaut pour la session.
    }
  };

  const clavierOuvrir = (e, c) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCollabDetail(c);
    }
  };

  const nbTotal = swrData?.count ?? collaborations.length;

  return (
    <div className="collaboration-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`collaboration-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="collaboration-content">
          <div className="collab-page vl">
            <BandeauErreur
              erreur={swrError}
              onReessayer={mutate}
              message="Impossible de charger vos collaborations. La liste affichée peut ne plus être à jour."
            />

            <header className="vl-head">
              <h1>Collaborations</h1>
              <p>Les signalements sur lesquels votre organisation agit avec d'autres.</p>
            </header>

            <nav className="vd-tabs vl-tabs" role="tablist" aria-label="Sections">
              {[
                ['collaborations', 'Mes collaborations', activeTab === 'collaborations' && !isLoading ? nbTotal : null],
                ['requests', 'Demandes'],
                ['suggestions', 'Suggestions'],
              ].map(([cle, libelle, n]) => (
                <button
                  key={cle}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === cle}
                  className={activeTab === cle ? 'is-on' : ''}
                  onClick={() => setActiveTab(cle)}
                >
                  {libelle}
                  {n ? <span className="vd-n">{n}</span> : null}
                </button>
              ))}
            </nav>

            {activeTab === 'collaborations' ? (
              <>
                {/* Pas de bouton « Effacer » : chaque filtre a deja sa propre
                    sortie (une pastille qu'on reclique, un menu qu'on remet a
                    « Tous », une croix sur la periode) ; un bouton qui les
                    remet TOUS a zero d'un coup ne fait que reinitialiser par
                    erreur ce qu'on venait de choisir expres. */}
                <div className="collab-filtres-fixes">
                  <FiltersBar
                    recherche={searchInput}
                    onRecherche={setSearchInput}
                    placeholder="Titre, organisation, lieu…"
                    actifSupplementaire={localStatusFilter !== 'all' || Boolean(roleFilter) || filtresAvancesActifs}
                  >
                    {[
                      ['all', 'Toutes'],
                      ['in-progress', 'En cours'],
                      ['completed', 'Terminées'],
                    ].map(([cle, libelle]) => (
                      <button
                        key={cle}
                        type="button"
                        className={`collab-filter-pill ${localStatusFilter === cle ? 'is-active' : ''}`}
                        onClick={() => setLocalStatusFilter(cle)}
                        aria-pressed={localStatusFilter === cle}
                      >
                        {libelle}
                        <span className="collab-filter-count">{counts[cle]}</span>
                      </button>
                    ))}

                    <div className={`am-filtres-select ${roleFilter ? 'is-active' : ''}`}>
                      <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filtrer par rôle">
                        <option value="">Mon rôle : tous</option>
                        <option value="leader">Leader</option>
                        <option value="contributor">Contributeur</option>
                        <option value="observer">Observateur</option>
                      </select>
                      <ArrowDown2 size={14} variant="Linear" color="currentColor" aria-hidden="true" />
                    </div>

                    <button
                      type="button"
                      className={`collab-filtres-avances-toggle ${filtresAvancesOuverts ? 'is-active' : ''}`}
                      onClick={() => setFiltresAvancesOuverts((v) => !v)}
                      aria-expanded={filtresAvancesOuverts}
                    >
                      <Filter size={16} variant="Linear" color="currentColor" />
                      Plus de filtres
                      {nbFiltresAvancesActifs > 0 && (
                        <span className="collab-filtres-avances-badge">{nbFiltresAvancesActifs}</span>
                      )}
                      <ArrowDown2
                        size={14}
                        variant="Linear"
                        color="currentColor"
                        style={{ transform: filtresAvancesOuverts ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                      />
                    </button>

                    <div className="vl-vue" role="group" aria-label="Affichage">
                      <button type="button" aria-pressed={vue === 'cartes'} className={vue === 'cartes' ? 'is-on' : ''} onClick={() => changerVue('cartes')}>
                        <Element3 size={15} color="currentColor" />Cartes
                      </button>
                      <button type="button" aria-pressed={vue === 'liste'} className={vue === 'liste' ? 'is-on' : ''} onClick={() => changerVue('liste')}>
                        <RowVertical size={15} color="currentColor" />Liste
                      </button>
                    </div>

                    {filtresAvancesOuverts && (
                      <div className="collab-filtres-avances-panneau">
                        <div className="am-filtres-select">
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            aria-label="Filtrer par statut"
                          >
                            <option value="all">Tous les statuts</option>
                            <option value="accepted">Acceptée</option>
                            <option value="pending">En attente</option>
                            <option value="declined">Refusée</option>
                          </select>
                          <ArrowDown2 size={14} variant="Linear" color="currentColor" aria-hidden="true" />
                        </div>

                        <div className="am-filtres-select">
                          <select
                            value={incidentFilter}
                            onChange={(e) => setIncidentFilter(e.target.value)}
                            // La liste des signalements coûte 4 s à l'API : on
                            // ne la demande qu'ici, quand ce menu s'ouvre pour
                            // de bon. `mousedown` précède l'ouverture, `focus`
                            // couvre le clavier.
                            onMouseDown={() => setListeSignalementsDemandee(true)}
                            onFocus={() => setListeSignalementsDemandee(true)}
                            aria-label="Filtrer par signalement"
                            aria-busy={chargementListeSignalements}
                          >
                            <option value="">Tous les signalements</option>
                            {chargementListeSignalements && (
                              <option value="" disabled>Chargement des signalements...</option>
                            )}
                            {incidentsList.map((inc) => (
                              <option key={inc.id} value={inc.id}>{inc.title}</option>
                            ))}
                          </select>
                          <ArrowDown2 size={14} variant="Linear" color="currentColor" aria-hidden="true" />
                        </div>

                        <div className="collab-date-range">
                          <Calendar size={16} variant="Bold" color="var(--color-primary-text)" />
                          <span className="collab-date-label">Période :</span>
                          <DatePicker
                            selectsRange
                            startDate={dateFrom}
                            endDate={dateTo}
                            onChange={(update) => setDateRange(update)}
                            locale="fr"
                            dateFormat="dd MMM yyyy"
                            placeholderText={isMobile ? 'Période…' : 'Sélectionner une période…'}
                            isClearable={false}
                            monthsShown={isMobile ? 1 : 2}
                            withPortal={isMobile}
                            shouldCloseOnSelect={!isMobile}
                            className="collab-date-input"
                            calendarClassName="collab-datepicker"
                            popperClassName="collab-datepicker-popper"
                            portalId="collab-datepicker-portal"
                          />
                          {(dateFrom || dateTo) && (
                            <button
                              type="button"
                              className="collab-date-clear"
                              onClick={resetDateRange}
                              aria-label="Réinitialiser la période"
                              title="Réinitialiser"
                            >
                              <CalendarRemove size={16} variant="Bold" color="var(--color-danger-text)" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </FiltersBar>
                </div>

                {isLoading ? (
                  <div className={vue === 'cartes' ? 'vl-grid' : 'vl-rows'} aria-busy="true">
                    {[...Array(vue === 'cartes' ? 6 : 5)].map((_, i) => (
                      vue === 'cartes' ? (
                        <div key={i} className="vd-card vl-card">
                          <ShimmerThumbnail height={136} className="m-0" />
                          <div className="vl-card-body"><ShimmerText line={1} gap={0} /><ShimmerTitle line={2} gap={8} /><ShimmerThumbnail height={6} rounded className="m-0" /></div>
                        </div>
                      ) : (
                        <div key={i} className="vd-card vl-row"><ShimmerThumbnail height={44} width={56} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerTitle line={1} gap={6} /></div></div>
                      )
                    ))}
                  </div>
                ) : swrError && collaborations.length === 0 ? (
                  <div className="vd-card vd-empty vl-empty">
                    <span className="vd-empty-ic vl-empty-ko"><Danger size={24} variant="Bold" color="currentColor" /></span>
                    <b>Les collaborations n'ont pas pu être chargées</b>
                    <p>Vérifiez votre connexion, puis réessayez.</p>
                    <button type="button" className="vd-btn vd-btn-p vd-btn-s vd-mt8" onClick={() => mutate()}>Réessayer</button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="vd-card vd-empty vl-empty">
                    <span className="vd-empty-ic vl-empty-ic"><People size={24} variant="Bold" color="currentColor" /></span>
                    <b>Aucune collaboration ne correspond</b>
                    <p>
                      {search || localStatusFilter !== 'all' || roleFilter || filtresAvancesActifs
                        ? 'Modifiez la recherche ou les filtres pour élargir les résultats.'
                        : "Vous ne participez encore à aucune collaboration. Depuis un signalement, choisissez « Lancer une collaboration » ou acceptez une invitation dans l'onglet Demandes."}
                    </p>
                  </div>
                ) : (
                  <>
                    {vue === 'cartes' ? (
                      <div className="vl-grid">
                        {filtered.map((c) => {
                          const s = STATUTS[c.status] || STATUTS['in-progress'];
                          return (
                            <article
                              key={c.id}
                              className="vd-card vl-card"
                              onClick={() => openCollabDetail(c)}
                              onKeyDown={(e) => clavierOuvrir(e, c)}
                              role="link"
                              tabIndex={0}
                              aria-label={`Ouvrir la collaboration : ${c.title}`}
                            >
                              <CollabCardCover className="vl-cover" image={c.image}>
                                {!c.image && <Gallery size={26} color="currentColor" aria-hidden="true" />}
                                <span className={`vd-chip vl-chip ${s.classe}`}><i style={{ backgroundColor: 'currentColor' }} />{s.libelle}</span>
                                {c.userRole && <span className="vd-chip vl-role">{c.userRole === 'leader' && <Crown1 size={12} variant="Bold" color="currentColor" />}{libelleRole(c.userRole)}</span>}
                              </CollabCardCover>
                              <div className="vl-card-body">
                                <span className="vl-lieu"><Location size={13} color="currentColor" />{c.location}</span>
                                <h3 className="vl-title">{c.title}</h3>
                                <span className="vl-orgs">
                                  {c.leader && <>Leader : <b>{c.leader}</b> · </>}
                                  {c.participantsCount} {c.participantsCount > 1 ? 'participants' : 'participant'}
                                </span>
                                <div className="vl-prog">
                                  <div className="vl-prog-l">
                                    <span>{c.tasks.length ? `${c.tasksDone} / ${c.tasks.length} tâches` : 'Aucune tâche'}</span>
                                    <b>{c.progress} %</b>
                                  </div>
                                  <div className="vl-bar"><i className={s.classe} style={{ width: `${c.progress}%` }} /></div>
                                </div>
                              </div>
                              <footer className="vl-card-foot">
                                <span><Calendar size={13} color="currentColor" />Depuis le {c.startDate}</span>
                                {c.tasksFailed > 0 && <span className="vl-alerte">{c.tasksFailed} tâche{c.tasksFailed > 1 ? 's' : ''} échouée{c.tasksFailed > 1 ? 's' : ''}</span>}
                              </footer>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="vl-rows">
                        {filtered.map((c) => {
                          const s = STATUTS[c.status] || STATUTS['in-progress'];
                          return (
                            <article
                              key={c.id}
                              className="vd-card vl-row"
                              onClick={() => openCollabDetail(c)}
                              onKeyDown={(e) => clavierOuvrir(e, c)}
                              role="link"
                              tabIndex={0}
                              aria-label={`Ouvrir la collaboration : ${c.title}`}
                            >
                              <CollabCardCover className="vl-thumb" image={c.image}>
                                {!c.image && <Gallery size={18} color="currentColor" aria-hidden="true" />}
                              </CollabCardCover>
                              <div className="vl-row-t">
                                <b>{c.title}</b>
                                <span>{c.location}{c.leader ? ` · Leader : ${c.leader}` : ''}</span>
                              </div>
                              <span className={`vd-chip ${s.classe}`}>{s.libelle}</span>
                              <span className="vd-chip vd-chip-neutre vl-row-role">{libelleRole(c.userRole)}</span>
                              <div className="vl-row-prog">
                                <div className="vl-bar"><i className={s.classe} style={{ width: `${c.progress}%` }} /></div>
                                <b>{c.progress} %</b>
                              </div>
                              {c.tasksFailed > 0 ? <span className="vl-alerte vl-row-al">{c.tasksFailed} échouée{c.tasksFailed > 1 ? 's' : ''}</span> : <span className="vl-row-al" />}
                            </article>
                          );
                        })}
                      </div>
                    )}

                    <Pagination
                      page={page}
                      pageSize={pageSize}
                      count={swrData?.count || filtered.length}
                      onChange={setPage}
                    />
                  </>
                )}
              </>
            ) : activeTab === 'requests' ? (
              <CollaborationRequests embedded={true} />
            ) : activeTab === 'suggestions' ? (
              <SuggestRequests embedded={true} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Collaboration;
