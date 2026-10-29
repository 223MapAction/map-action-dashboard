import React, { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { useSidebarState } from '../../hooks/useSidebarState';
import {
  People,
  Building,
  Tree,
  Heart,
  Calendar,
  Location,
  TickCircle,
  SearchNormal1,
  ArrowRight2,
  Award,
  Chart2,
  Profile2User,
  Clock,
  Briefcase,
  Activity
} from 'iconsax-react';
import { Header, Sidebar } from '../../components/layout';
import { ShimmerThumbnail, ShimmerTitle, ShimmerText } from 'react-shimmer-effects';
import { getGlobalImpactService, getImpactIncidentsService } from './service/impact_service';
import { authService } from '../auth/services/authService';
import Pagination from '../../components/molecules/Pagination';
import './impact.css';
import { useReinitialisationSurChangement } from '../../hooks/useReinitialisationSurChangement';
import { gravite, libelleGravite, couleurTexteGravite } from '../../utils/gravite';
import { logger } from '../../utils/logger';

const EMPTY_ARRAY = [];


const STRUCTURE_LABELS = {
  schools: 'Écoles',
  markets: 'Marchés',
  water_points: 'Sources d\'eau',
  main_roads_bridges: 'Routes / Ponts',
  residential_buildings: 'Bâtiments',
  maternities: 'Maternités',
  health_centers: 'Centres de santé',
  nurseries: 'Crèches'
};

// Les libelles, les seuils et les couleurs viennent maintenant de
// utils/gravite.js. Cette page etait la seule a distinguer quatre paliers, mais
// elle les peignait en rouge / orange / BLEU / VERT — soit, pour les deux
// derniers, les teintes que la carte reserve aux incidents resolus. Un meme
// incident changeait de code couleur d'une page a l'autre.
//
// On lit les variantes -text : le libelle s'affiche en blanc PAR-DESSUS cette
// couleur, et le contraste etant symetrique, elles tiennent dans les deux roles.
const getSeverity = (incident, prediction) => gravite(incident, prediction);

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};



export const Impact = () => {
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  // Filters State
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all'); // all | 30d | 90d | year
  const [statusFilter, setStatusFilter] = useState('both'); // both | resolved | taken_with_action
  const [structureFilter, setStructureFilter] = useState('all'); // all | schools | markets | water_points | etc.
  const [expanded, setExpanded] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Retour a la premiere page des qu'un filtre change.
  useReinitialisationSurChangement([search, periodFilter, statusFilter, structureFilter], () => setCurrentPage(1));

  const statusApiValue = statusFilter === 'both' ? 'all' : (statusFilter === 'taken_with_action' ? 'taken_action' : 'resolved');

  // Appel API pour récupérer les données globales d'impact
  const { data: globalImpactData, error: apiError, isLoading: isLoadingImpact } = useSWR(
    ['/MapApi/impact/', statusApiValue, periodFilter],
    () => getGlobalImpactService(statusApiValue, periodFilter),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true
    }
  );

  // Appel API pour récupérer les incidents d'impact filtrés et paginés
  const { data: impactIncidentsData, error: incidentsError, isLoading: isLoadingIncidents } = useSWR(
    ['/MapApi/impact/incidents/', statusApiValue, periodFilter, search, currentPage],
    () => getImpactIncidentsService(statusApiValue, periodFilter, search, currentPage, 10),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  useEffect(() => {
    if (apiError) logger.error('[Impact] Erreur API impact:', apiError);
    if (incidentsError) logger.error('[Impact] Erreur API incidents:', incidentsError);
  }, [apiError, incidentsError]);

  // Utiliser les vraies données ou fallback sur MOCK
  const loadingIncidents = isLoadingImpact || isLoadingIncidents;
  const loadingDetails = false;
  const error = apiError || incidentsError;

  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = currentUser?.web_role === 'super_admin';

  const isPlatformScope = isSuperAdmin && (
    globalImpactData?.filters?.scope === 'platform' || (
      globalImpactData && (
        !!globalImpactData.resolution ||
        !!globalImpactData.mobilization ||
        !!globalImpactData.mobilisation ||
        !!globalImpactData.citizen_contribution ||
        !!globalImpactData.contribution_citoyenne
      )
    )
  );

  // Normaliser les incidents (gérer pagination API)
  // Memoise : sans cela, chaque rendu produisait un tableau neuf et les useMemo
  // qui en dependent recalculaient tout a chaque fois.
  const incidentsList = useMemo(() => (
    impactIncidentsData
      ? (Array.isArray(impactIncidentsData)
        ? impactIncidentsData
        : (impactIncidentsData.results || []))
      : EMPTY_ARRAY
  ), [impactIncidentsData]);

  const totalIncidentsCount = impactIncidentsData?.count || 0;

  // Structure type filtering logic
  const matchesStructureType = (inc, typeFilter) => {
    if (typeFilter === 'all') return true;
    const pred = inc.prediction;
    if (!pred) return false;

    let count = 0;
    if (typeFilter === 'schools') count = pred.infrastructure?.schools ?? pred.schools ?? pred.social_data?.schools ?? 0;
    else if (typeFilter === 'markets') count = pred.infrastructure?.markets ?? pred.markets ?? pred.social_data?.markets ?? 0;
    else if (typeFilter === 'water_points') count = pred.infrastructure?.water_points ?? pred.water_points ?? pred.social_data?.water_points ?? 0;
    else if (typeFilter === 'main_roads_bridges') count = pred.infrastructure?.main_roads_bridges ?? pred.main_roads_bridges ?? pred.social_data?.main_roads_bridges ?? 0;
    else if (typeFilter === 'residential_buildings') count = pred.infrastructure?.residential_buildings ?? pred.residential_buildings ?? pred.social_data?.residential_buildings ?? 0;
    else if (typeFilter === 'maternities') count = pred.infrastructure?.maternities ?? pred.maternities_count ?? pred.maternities ?? 0;
    else if (typeFilter === 'health_centers') count = pred.infrastructure?.health_centers ?? pred.health_centers ?? 0;
    else if (typeFilter === 'nurseries') count = pred.infrastructure?.nurseries ?? pred.nurseries_count ?? pred.nurseries ?? 0;

    return parseInt(count) > 0;
  };

  // Filtered dataset for statistics & final list display
  const filteredIncidents = useMemo(() => {
    return incidentsList.filter((inc) => matchesStructureType(inc, structureFilter));
  }, [incidentsList, structureFilter]);

  // Compute all global KPIs dynamically - Utilise les données de l'API si disponibles
  const globals = useMemo(() => {
    // Si on a les données de l'API, on les utilise directement
    if (globalImpactData) {
      const directBenefs = globalImpactData.beneficiaries?.direct || globalImpactData.beneficiaires_directs;
      const indirectBenefs = globalImpactData.beneficiaries?.indirect || globalImpactData.beneficiaires_indirects;
      const infraProtected = globalImpactData.infrastructure_protected || {};
      const resolutionStats = globalImpactData.resolution || {};
      const mobilizationStats = globalImpactData.mobilization || globalImpactData.mobilisation || {};
      const citizenStats = globalImpactData.citizen_contribution || globalImpactData.contribution_citoyenne || {};

      return {
        direct: {
          total: directBenefs?.total || 0,
          men: directBenefs?.men ?? directBenefs?.hommes ?? 0,
          women: directBenefs?.women ?? directBenefs?.femmes ?? 0,
          children: directBenefs?.children ?? directBenefs?.enfants ?? 0,
        },
        indirect: {
          total: indirectBenefs?.total || 0,
          men: indirectBenefs?.men ?? indirectBenefs?.hommes ?? Math.round((indirectBenefs?.total || 0) * 0.33),
          women: indirectBenefs?.women ?? indirectBenefs?.femmes ?? Math.round((indirectBenefs?.total || 0) * 0.34),
          children: indirectBenefs?.children ?? indirectBenefs?.enfants ?? Math.round((indirectBenefs?.total || 0) * 0.33),
        },
        structures: infraProtected.by_type || globalImpactData.infrastructures_detail || {
          schools: 0,
          markets: 0,
          water_points: 0,
          main_roads_bridges: 0,
          residential_buildings: 0,
          maternities: 0,
          health_centers: 0,
          nurseries: 0,
        },
        totalStructures: infraProtected.total || globalImpactData.infrastructures_total || 0,
        cumulativeAreaHa: globalImpactData.cumulative_impact_area_ha || globalImpactData.superficie_ha || 0,
        avgResolutionTimeDays: resolutionStats.avg_resolution_days || globalImpactData.temps_moyen_resolution || 0,
        resolutionRate: resolutionStats.resolution_rate?.percentage || globalImpactData.taux_resolution || 0,
        incidentsWithoutAnalysis: (globalImpactData.filters?.incidents_in_scope - globalImpactData.filters?.incidents_with_prediction) || globalImpactData.incidents_sans_analyse || 0,
        mobilization: {
          organisationsCount: mobilizationStats.organisations_involved || mobilizationStats.organisations_distinctes || 0,
          agentsCount: mobilizationStats.field_agents_mobilized || mobilizationStats.agents_terrain || 0,
          collaborationsCount: mobilizationStats.collaborations_created || mobilizationStats.collaborations || 0,
          collaborativeCount: mobilizationStats.incidents_collaborative || 0,
          individualCount: mobilizationStats.incidents_individual || 0,
        },
        citizen: {
          received: citizenStats.reports_received || citizenStats.signalements_recus || 0,
          verified: citizenStats.reports_verified || citizenStats.signalements_verifies || 0,
          withAction: citizenStats.reports_led_to_action || citizenStats.transformes_actions || 0,
          contributorsCount: citizenStats.active_citizen_contributors || 0,
        },
      };
    }

    // Sinon, on renvoie une structure vide par défaut
    return {
      direct: { total: 0, men: 0, women: 0, children: 0 },
      indirect: { total: 0, men: 0, women: 0, children: 0 },
      structures: {
        schools: 0,
        markets: 0,
        water_points: 0,
        main_roads_bridges: 0,
        residential_buildings: 0,
        maternities: 0,
        health_centers: 0,
        nurseries: 0,
      },
      totalStructures: 0,
      cumulativeAreaHa: 0,
      avgResolutionTimeDays: 0,
      resolutionRate: 0,
      incidentsWithoutAnalysis: 0,
      mobilization: {
        organisationsCount: 0,
        agentsCount: 0,
        collaborationsCount: 0,
        collaborativeCount: 0,
        individualCount: 0,
      },
      citizen: {
        received: 0,
        verified: 0,
        withAction: 0,
        contributorsCount: 0,
      },
    };
  }, [globalImpactData]);

  // Main isLoading flag combining SWR loading and details loading
  const isDataLoading = loadingIncidents || (incidentsList.length > 0 && loadingDetails);

  const directTotal = globals.direct?.total || 0;
  const directMenPercent = directTotal > 0 ? Math.round((globals.direct?.men / directTotal) * 100) : 0;
  const directWomenPercent = directTotal > 0 ? Math.round((globals.direct?.women / directTotal) * 100) : 0;
  const directChildrenPercent = directTotal > 0 ? Math.max(0, 100 - directMenPercent - directWomenPercent) : 0;

  const indirectTotal = globals.indirect?.total || 0;
  const indirectMenPercent = indirectTotal > 0 ? Math.round((globals.indirect?.men / indirectTotal) * 100) : 0;
  const indirectWomenPercent = indirectTotal > 0 ? Math.round((globals.indirect?.women / indirectTotal) * 100) : 0;
  const indirectChildrenPercent = indirectTotal > 0 ? Math.max(0, 100 - indirectMenPercent - indirectWomenPercent) : 0;

  return (
    <div className="impact-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`impact-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="impact-content">
          <div className="impact-page">
            {/* Page Header */}
            <div className="impact-page-header">
              <div className="impact-header-left">

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1 className="impact-title">Impact</h1>

                  </div>
                  <p className="impact-subtitle">

                    Mesure et consolidation de l'impact des interventions de Map Action sur le terrain.

                  </p>
                </div>
              </div>
            </div>

            {/* Global Filters bar */}
            <div className="impact-filters-section">
              <div className="impact-filters-group">
                <div className="impact-filter-col">
                  {/* Ce n'est pas un <label> : il ne designe aucun champ, mais
                      un groupe de boutons. Un lecteur d'ecran annoncait une
                      etiquette pour un controle inexistant. En span + groupe
                      nomme, il annonce « Periode, groupe » a l'entree. */}
                  <span className="impact-filter-label" id="impact-filtre-periode">Période</span>
                  <div
                    className="impact-period-filters"
                    role="group"
                    aria-labelledby="impact-filtre-periode"
                  >
                    <button
                      type="button"
                      className={`impact-period-btn ${periodFilter === 'all' ? 'is-active' : ''}`}
                      aria-pressed={periodFilter === 'all'}
                      onClick={() => setPeriodFilter('all')}
                    >
                      Toute la période
                    </button>
                    <button
                      type="button"
                      className={`impact-period-btn ${periodFilter === '30d' ? 'is-active' : ''}`}
                      aria-pressed={periodFilter === '30d'}
                      onClick={() => setPeriodFilter('30d')}
                    >
                      30 derniers jours
                    </button>
                    <button
                      type="button"
                      className={`impact-period-btn ${periodFilter === '90d' ? 'is-active' : ''}`}
                      aria-pressed={periodFilter === '90d'}
                      onClick={() => setPeriodFilter('90d')}
                    >
                      90 derniers jours
                    </button>
                    <button
                      type="button"
                      className={`impact-period-btn ${periodFilter === 'year' ? 'is-active' : ''}`}
                      aria-pressed={periodFilter === 'year'}
                      onClick={() => setPeriodFilter('year')}
                    >
                      Cette année
                    </button>
                  </div>
                </div>

                <div className="impact-filter-col">
                  <span className="impact-filter-label" id="impact-filtre-statut">Statut des Signalements</span>
                  <div
                    className="impact-period-filters"
                    role="group"
                    aria-labelledby="impact-filtre-statut"
                  >
                    <button
                      type="button"
                      className={`impact-period-btn ${statusFilter === 'both' ? 'is-active' : ''}`}
                      aria-pressed={statusFilter === 'both'}
                      onClick={() => setStatusFilter('both')}
                    >
                      Les 2 ensembles
                    </button>
                    <button
                      type="button"
                      className={`impact-period-btn ${statusFilter === 'resolved' ? 'is-active' : ''}`}
                      aria-pressed={statusFilter === 'resolved'}
                      onClick={() => setStatusFilter('resolved')}
                    >
                      Incidents résolus
                    </button>
                    <button
                      type="button"
                      className={`impact-period-btn ${statusFilter === 'taken_with_action' ? 'is-active' : ''}`}
                      aria-pressed={statusFilter === 'taken_with_action'}
                      onClick={() => setStatusFilter('taken_with_action')}
                    >
                      Pris en compte avec action
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {isDataLoading ? (
              // Shimmer Loading Skeleton
              <div className="impact-skeleton-container">
                <div className="impact-skeleton-grid">
                  <ShimmerThumbnail height={160} rounded />
                  <ShimmerThumbnail height={160} rounded />
                  <ShimmerThumbnail height={160} rounded />
                  <ShimmerThumbnail height={160} rounded />
                  <ShimmerThumbnail height={160} rounded />
                </div>
                <div className="impact-skeleton-subgrid">
                  <ShimmerThumbnail height={200} rounded />
                  <ShimmerThumbnail height={200} rounded />
                </div>
                <ShimmerTitle line={1} gap={10} variant="secondary" />
                <ShimmerText line={4} gap={10} />
              </div>
            ) : error ? (
              <div className="impact-empty">
                <Award size={48} variant="Linear" color="var(--color-danger-text)" />
                <p>Une erreur est survenue lors de la récupération des statistiques d'impact.</p>
              </div>
            ) : (
              <>
                {/* Core KPI Cards Grid */}
                <div className="impact-kpis" style={{ marginBottom: '24px' }}>

                  {/* Card 4: Cumulative Area (Primary Glow) */}
                  <div className="impact-kpi impact-kpi-primary-glow">
                    <div className="impact-kpi-top-row">
                      <div className="impact-kpi-icon-glow">
                        <Tree size={24} variant="Bold" color="var(--color-surface)" />
                      </div>
                      <div>
                        <span className="impact-kpi-label">Superficie Protégée</span>
                        <div className="impact-kpi-value">
                          {(globals.cumulativeAreaHa || 0).toFixed(1)} ha
                        </div>
                      </div>
                    </div>
                    <div className="impact-kpi-subtext">
                      Superficie totale des zones d'impact résolues.
                    </div>
                  </div>
                  {/* Card 1: Direct Beneficiaries */}
                  <div className="impact-kpi">
                    <div className="impact-kpi-top-row">
                      <div className="impact-kpi-icon-glow">
                        <People size={24} variant="Bold" color="var(--color-primary-text)" />
                      </div>
                      <div>
                        <span className="impact-kpi-label">Bénéficiaires Directs</span>
                        <div className="impact-kpi-value">
                          {(globals.direct?.total || 0).toLocaleString('fr-FR')}
                        </div>
                      </div>
                    </div>

                    <div className="impact-cohort-breakdown">
                      <div className="cohort-item">
                        <span className="cohort-gender">Hommes</span>
                        <div className="cohort-bar">
                          <div className="cohort-fill men-fill" style={{ width: `${directMenPercent}%` }} />
                        </div>
                        <span className="cohort-val">{(globals.direct?.men || 0).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="cohort-item">
                        <span className="cohort-gender">Femmes</span>
                        <div className="cohort-bar">
                          <div className="cohort-fill women-fill" style={{ width: `${directWomenPercent}%` }} />
                        </div>
                        <span className="cohort-val">{(globals.direct?.women || 0).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="cohort-item">
                        <span className="cohort-gender">Enfants</span>
                        <div className="cohort-bar">
                          <div className="cohort-fill children-fill" style={{ width: `${directChildrenPercent}%` }} />
                        </div>
                        <span className="cohort-val">{(globals.direct?.children || 0).toLocaleString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Indirect Beneficiaries */}
                  <div className="impact-kpi">
                    <div className="impact-kpi-top-row">
                      <div className="impact-kpi-icon-glow">
                        <Profile2User size={24} variant="Bold" color="var(--color-accent-text)" />
                      </div>
                      <div>
                        <span className="impact-kpi-label">Bénéficiaires Indirects</span>
                        <div className="impact-kpi-value">
                          {(globals.indirect?.total || 0).toLocaleString('fr-FR')}
                        </div>
                      </div>
                    </div>

                    <div className="impact-cohort-breakdown">
                      <div className="cohort-item">
                        <span className="cohort-gender">Hommes</span>
                        <div className="cohort-bar">
                          <div className="cohort-fill men-fill" style={{ width: `${indirectMenPercent}%` }} />
                        </div>
                        <span className="cohort-val">{(globals.indirect?.men || 0).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="cohort-item">
                        <span className="cohort-gender">Femmes</span>
                        <div className="cohort-bar">
                          <div className="cohort-fill women-fill" style={{ width: `${indirectWomenPercent}%` }} />
                        </div>
                        <span className="cohort-val">{(globals.indirect?.women || 0).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="cohort-item">
                        <span className="cohort-gender">Enfants</span>
                        <div className="cohort-bar">
                          <div className="cohort-fill children-fill" style={{ width: `${indirectChildrenPercent}%` }} />
                        </div>
                        <span className="cohort-val">{(globals.indirect?.children || 0).toLocaleString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Protected Sensitive Structures */}
                  <div className="impact-kpi">
                    <div className="impact-kpi-top-row">
                      <div className="impact-kpi-icon-glow">
                        <Building size={24} variant="Bold" color="var(--color-warning-text)" />
                      </div>
                      <div>
                        <span className="impact-kpi-label">Structures Sensibles</span>
                        <div className="impact-kpi-value">
                          {globals.totalStructures || 0}
                        </div>
                      </div>
                    </div>

                    <div className="impact-structures-interactive">
                      <span className="structures-filter-title" id="impact-filtre-structure">Filtrer par type :</span>
                      <div
                        className="structures-grid-chips"
                        role="group"
                        aria-labelledby="impact-filtre-structure"
                      >
                        <button
                          type="button"
                          className={`structure-chip ${structureFilter === 'all' ? 'active' : ''}`}
                          aria-pressed={structureFilter === 'all'}
                          onClick={() => setStructureFilter('all')}
                        >
                          Tous ({globals.totalStructures || 0})
                        </button>
                        {Object.entries(STRUCTURE_LABELS).map(([key, label]) => {
                          const count = globals.structures?.[key] || 0;
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`structure-chip ${structureFilter === key ? 'active' : ''}`}
                              aria-pressed={structureFilter === key}
                              disabled={count === 0}
                              onClick={() => setStructureFilter(key)}
                            >
                              {label} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>


                  {isPlatformScope && (
                    <div className="impact-kpi">
                      <div className="impact-kpi-top-row">
                        <div className="impact-kpi-icon-glow">
                          <Activity size={24} variant="Bold" color="var(--color-danger)" />
                        </div>
                        <div>
                          <span className="impact-kpi-label">Signalements sans analyse</span>
                          <div className="impact-kpi-value">
                            {globals.incidentsWithoutAnalysis || 0}
                          </div>
                        </div>
                      </div>
                      <div className="impact-kpi-subtext">
                        Incidents en attente d'estimation d'impact.
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 1: Performance & Mobilization */}
                {isPlatformScope && (
                  <div className="impact-grid-performance">
                    {/* Resolution speed & rate */}
                    <div className="performance-card">
                      <h3 className="section-subtitle-impact">Performance des interventions</h3>
                      <div className="performance-row-inner">
                        <div className="perf-item-value">
                          <div className="perf-circle">
                            <Clock size={28} variant="Bold" color="var(--color-primary-text)" />
                          </div>
                          <div className="perf-stats">
                            <span className="perf-val">
                              {globals.avgResolutionTimeDays > 0
                                ? `${globals.avgResolutionTimeDays} jours`
                                : '—'}
                            </span>
                            <span className="perf-lbl">Temps moyen de résolution</span>
                          </div>
                        </div>

                        <div className="perf-item-value">
                          <div className="perf-circle">
                            <Chart2 size={28} variant="Bold" color="var(--color-success-text)" />
                          </div>
                          <div className="perf-stats">
                            <span className="perf-val">
                              {globals.resolutionRate.toFixed(1)}%
                            </span>
                            <span className="perf-lbl">Taux de résolution</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobilisation Card */}
                    <div className="performance-card">
                      <h3 className="section-subtitle-impact">Mobilisation des acteurs</h3>
                      <div className="actor-stats-grid">
                        <div className="actor-badge">
                          <Briefcase size={20} variant="Bold" color="var(--color-accent-text)" />
                          <span className="actor-num">{globals.mobilization.organisationsCount}</span>
                          <span className="actor-lbl">Organisations impliquées</span>
                        </div>

                        <div className="actor-badge">
                          <Profile2User size={20} variant="Bold" color="var(--color-warning-text)" />
                          <span className="actor-num">{globals.mobilization.agentsCount}</span>
                          <span className="actor-lbl">Agents de terrain</span>
                        </div>

                        <div className="actor-badge">
                          <People size={20} variant="Bold" color="var(--color-primary-text)" />
                          <span className="actor-num">{globals.mobilization.collaborationsCount}</span>
                          <span className="actor-lbl">Collaborations créées</span>
                        </div>
                      </div>

                      <div className="collab-split-bar">
                        <div className="collab-split-item">
                          <span>Traités en collaboration :</span>
                          <strong>{globals.mobilization.collaborativeCount}</strong>
                        </div>
                        <div className="collab-split-item">
                          <span>Traités individuellement :</span>
                          <strong>{globals.mobilization.individualCount}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: Citizen Contribution */}
                {isPlatformScope && (
                  <div className="citizen-contribution-section">
                    <h3 className="section-subtitle-impact">Contribution citoyenne</h3>
                    <div className="citizen-grid">
                      <div className="citizen-card">
                        <Activity size={24} variant="Bold" color="var(--color-primary-text)" />
                        <span className="citizen-number">{globals.citizen.received}</span>
                        <span className="citizen-lbl">Signalements reçus</span>
                      </div>

                      <div className="citizen-card">
                        <TickCircle size={24} variant="Bold" color="var(--color-success-text)" />
                        <span className="citizen-number">{globals.citizen.verified}</span>
                        <span className="citizen-lbl">Signalements vérifiés</span>
                      </div>

                      <div className="citizen-card">
                        <Award size={24} variant="Bold" color="var(--color-warning-text)" />
                        <span className="citizen-number">{globals.citizen.withAction}</span>
                        <span className="citizen-lbl">Ayant conduit à une action</span>
                      </div>

                      <div className="citizen-card">
                        <Profile2User size={24} variant="Bold" color="var(--color-accent-text)" />
                        <span className="citizen-number">{globals.citizen.contributorsCount}</span>
                        <span className="citizen-lbl">Citoyens contributeurs actifs</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 4: Filtered Incidents List */}
                <div className="impact-section">
                  <div className="impact-section-header">
                    <p className="impact-section-title">
                      Incidents filtrés ({filteredIncidents.length})
                    </p>
                  </div>

                  {/* Search incident input */}
                  <div className="impact-toolbar">
                    <div className="impact-search">
                      <SearchNormal1 size={18} variant="Linear" color="var(--color-text-secondary)" />
                      <input
                        type="text"
                        placeholder="Rechercher un signalement par titre, description, zone…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {filteredIncidents.length === 0 ? (
                    <div className="impact-empty">
                      <Award size={48} variant="Linear" color="var(--color-text-muted)" />
                      <p>Aucun signalement ne correspond à vos critères et filtres actuels.</p>
                    </div>
                  ) : (
                    <div className="impact-list">
                      {filteredIncidents.map((inc) => {
                        const pred = inc.prediction;
                        const incTasks = inc.tasks || [];
                        const severity = getSeverity(inc, pred);
                        const isOpen = expanded === inc.id;

                        // Extraire les agents de terrain uniques depuis les tâches de l'incident
                        const uniqueAssignees = new Map();
                        incTasks.forEach(t => {
                          if (t.assigned_to) {
                            const name = typeof t.assigned_to === 'object'
                              ? `${t.assigned_to.first_name || ''} ${t.assigned_to.last_name || ''}`.trim()
                              : String(t.assigned_to);
                            if (name) {
                              uniqueAssignees.set(name, t.assigned_to_role || '');
                            }
                          }
                        });
                        const incAssignments = Array.from(uniqueAssignees.entries()).map(([name, role]) => ({
                          agent_name: name,
                          role
                        }));

                        // Calculate impact area for this card
                        const radius = parseFloat(pred?.impact_radius_meters || 0);
                        const areaHa = (Math.PI * Math.pow(radius, 2)) / 10000;

                        return (
                          <article
                            key={inc.id}
                            className={`impact-incident-card ${isOpen ? 'is-open' : ''}`}
                          >
                            <div
                              className="impact-card-main"
                              onClick={() => setExpanded(isOpen ? null : inc.id)}
                            >
                              <div
                                className="impact-card-thumb"
                                style={
                                  inc.photo || inc.photo_url || inc.image || inc.incident_details?.photo
                                    ? { backgroundImage: `url(${inc.photo || inc.photo_url || inc.image || inc.incident_details?.photo})` }
                                    : undefined
                                }
                              >
                                <span
                                  className="impact-severity-tag"
                                  style={{ backgroundColor: couleurTexteGravite(severity) }}
                                >
                                  {libelleGravite(severity)}
                                </span>
                              </div>

                              <div className="impact-card-info">
                                <div className="impact-card-top">
                                  <span className="impact-card-type">{inc.zone || 'Zone non spécifiée'}</span>
                                  <span className="impact-card-dot">•</span>
                                  <span className="impact-card-region">
                                    <Location size={12} variant="Bold" color="var(--color-text-secondary)" />
                                    {inc.lattitude && inc.longitude
                                      ? `${parseFloat(inc.lattitude).toFixed(4)}°N, ${parseFloat(
                                        inc.longitude
                                      ).toFixed(4)}°E`
                                      : 'Coordonnées non spécifiées'}
                                  </span>
                                </div>

                                <h3 className="impact-card-title">{inc.title || 'Incident sans titre'}</h3>
                                <p className="impact-card-summary">
                                  {inc.description || 'Aucune description disponible pour cet incident.'}
                                </p>

                                {/* Inline metadata badges */}
                                <div className="impact-incident-meta-inline">
                                  {pred && (
                                    <>
                                      <div className="impact-card-metric impact-metric-primary">
                                        <People size={13} variant="Bold" color="var(--color-primary-text)" />
                                        <strong>
                                          {(pred.direct?.total_population_exposed || pred.total_population_exposed || 0).toLocaleString('fr-FR')}
                                        </strong>
                                        <span>directs</span>
                                      </div>

                                      <div className="impact-card-metric impact-metric-purple">
                                        <Profile2User size={13} variant="Bold" color="var(--color-accent-text)" />
                                        <strong>
                                          {(pred.indirect?.total_population_exposed || pred.potential_risk?.stats?.total_pop || 0).toLocaleString('fr-FR')}
                                        </strong>
                                        <span>indirects</span>
                                      </div>

                                      {areaHa > 0 && (
                                        <div className="impact-card-metric impact-metric-success">
                                          <Tree size={13} variant="Bold" color="var(--color-success-text)" />
                                          <strong>{areaHa.toFixed(1)}</strong>
                                          <span>ha impactés</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                <div className="impact-card-meta">
                                  <div className="impact-meta-row">
                                    <Calendar size={13} variant="Bold" color="var(--color-text-secondary)" />
                                    <span>
                                      Créé le {formatDate(inc.created_at)}
                                      {inc.resolution_end_date &&
                                        ` · Résolu le ${formatDate(inc.resolution_end_date)}`}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                className={`impact-toggle ${isOpen ? 'is-open' : ''}`}
                                aria-label={isOpen ? 'Réduire' : 'Voir le détail'}
                              >
                                <ArrowRight2 size={18} variant="Linear" color="var(--color-text-secondary)" />
                              </button>
                            </div>

                            {isOpen && (
                              <div className="impact-card-body">
                                {/* Details Grid */}
                                <div className="impact-detail-grid">
                                  {/* Direct human exposure details */}
                                  <div className="impact-detail-card is-direct">
                                    <div className="impact-detail-header">
                                      <People size={16} variant="Bold" color="currentColor" />
                                      <span>Bénéficiaires Directs</span>
                                    </div>
                                    <ul className="impact-detail-list">
                                      <li>
                                        <span className="impact-detail-key">Total exposés</span>
                                        <span className="impact-detail-val">
                                          {(pred?.direct?.total_population_exposed || pred?.total_population_exposed || 0).toLocaleString('fr-FR')}
                                        </span>
                                      </li>
                                      <li>
                                        <span className="impact-detail-key">Hommes adultes</span>
                                        <span className="impact-detail-val">
                                          {(pred?.direct?.adult_men_exposed || pred?.adult_men_exposed || 0).toLocaleString('fr-FR')}
                                        </span>
                                      </li>
                                      <li>
                                        <span className="impact-detail-key">Femmes adultes</span>
                                        <span className="impact-detail-val">
                                          {(pred?.direct?.adult_women_exposed || pred?.adult_women_exposed || 0).toLocaleString('fr-FR')}
                                        </span>
                                      </li>
                                      <li>
                                        <span className="impact-detail-key">Enfants</span>
                                        <span className="impact-detail-val">
                                          {(pred?.direct?.children_exposed || pred?.children_exposed || 0).toLocaleString('fr-FR')}
                                        </span>
                                      </li>
                                    </ul>
                                  </div>

                                  {/* Indirect human exposure details */}
                                  <div className="impact-detail-card is-indirect">
                                    <div className="impact-detail-header">
                                      <Profile2User size={16} variant="Bold" color="currentColor" />
                                      <span>Bénéficiaires Indirects</span>
                                    </div>
                                    <ul className="impact-detail-list">
                                      <li>
                                        <span className="impact-detail-key">Zone à risque</span>
                                        <span className="impact-detail-val">
                                          {(pred?.indirect?.total_population_exposed || pred?.potential_risk?.stats?.total_pop || 0).toLocaleString('fr-FR')}
                                        </span>
                                      </li>
                                      <li>
                                        <span className="impact-detail-key">Rayon d'impact</span>
                                        <span className="impact-detail-val">
                                          {pred?.impact_radius_meters ? `${pred.impact_radius_meters} m` : 'N/A'}
                                        </span>
                                      </li>
                                      <li>
                                        <span className="impact-detail-key">Vecteur</span>
                                        <span className="impact-detail-val">
                                          {pred?.spread_vectors && Array.isArray(pred.spread_vectors) && pred.spread_vectors.length > 0
                                            ? pred.spread_vectors.join(', ')
                                            : (pred?.potential_risk?.vector || 'N/A')}
                                        </span>
                                      </li>
                                      <li>
                                        <span className="impact-detail-key">Bâtiments à risque</span>
                                        <span className="impact-detail-val">
                                          {pred?.indirect?.residential_buildings || pred?.potential_risk?.stats?.infrastructures || 0} sites
                                        </span>
                                      </li>
                                    </ul>
                                  </div>

                                  {/* Protected sensitive structures */}
                                  <div className="impact-detail-card is-structures">
                                    <div className="impact-detail-header">
                                      <Building size={16} variant="Bold" color="currentColor" />
                                      <span>Structures Sensibles</span>
                                    </div>
                                    <ul className="impact-detail-list scrollable-list">
                                      {Object.entries(STRUCTURE_LABELS).map(([key, label]) => {
                                        let val = 0;
                                        if (pred) {
                                          val = pred.infrastructure?.[key] ?? pred.schools ?? pred.social_data?.[key] ?? 0;
                                          if (key === 'schools') val = pred.infrastructure?.schools ?? pred.schools ?? pred.social_data?.schools ?? 0;
                                          else if (key === 'markets') val = pred.infrastructure?.markets ?? pred.markets ?? pred.social_data?.markets ?? 0;
                                          else if (key === 'water_points') val = pred.infrastructure?.water_points ?? pred.water_points ?? pred.social_data?.water_points ?? 0;
                                          else if (key === 'main_roads_bridges') val = pred.infrastructure?.main_roads_bridges ?? pred.main_roads_bridges ?? pred.social_data?.main_roads_bridges ?? 0;
                                          else if (key === 'residential_buildings') val = pred.infrastructure?.residential_buildings ?? pred.residential_buildings ?? pred.social_data?.residential_buildings ?? 0;
                                          else if (key === 'maternities') val = pred.infrastructure?.maternities ?? pred.maternities_count ?? pred.maternities ?? 0;
                                          else if (key === 'health_centers') val = pred.infrastructure?.health_centers ?? pred.health_centers ?? 0;
                                          else if (key === 'nurseries') val = pred.infrastructure?.nurseries ?? pred.nurseries_count ?? pred.nurseries ?? 0;
                                        }
                                        return (
                                          <li key={key}>
                                            <span className="impact-detail-key">{label}</span>
                                            <span className="impact-detail-val">{val}</span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                </div>

                                {/* Mobilization list */}
                                <div className="impact-orgs">
                                  <h4 className="impact-orgs-label">Mobilisation des Acteurs</h4>
                                  <div className="impact-orgs-details">
                                    <div className="impact-orgs-chips-row">
                                      <span className="details-sublabel">Organisations :</span>
                                      <div className="impact-orgs-list">
                                        {(() => {
                                          const collabOrgs = inc.collaborating_organisations || [];
                                          if (collabOrgs.length === 0) return <span className="text-muted">Aucune organisation spécifiée</span>;
                                          return collabOrgs.map((org, idx) => {
                                            const relationLabel = org.relation === 'leader' ? 'Leader' : (org.relation === 'assigned' ? 'Assignée' : 'Collaborateur');
                                            return (
                                              <span key={idx} className="impact-org-chip">
                                                {org.name} <strong style={{ marginLeft: '4px', fontSize: 'var(--font-size-micro)', opacity: 0.8 }}>({relationLabel})</strong>
                                              </span>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>

                                    {incAssignments.length > 0 && (
                                      <div className="impact-orgs-chips-row">
                                        <span className="details-sublabel">Agents assignés :</span>
                                        <div className="impact-orgs-list">
                                          {incAssignments.map((a, idx) => {
                                            const name = a.agent_name || (a.assigned_to ? `${a.assigned_to.first_name} ${a.assigned_to.last_name}` : `Agent #${a.user_id}`);
                                            return (
                                              <span key={idx} className="impact-org-chip bg-blue">
                                                {name} {a.role ? `(${a.role})` : ''}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Action Tasks List */}
                                <div className="impact-orgs">
                                  <h4 className="impact-orgs-label">Actions & Tâches effectives ({incTasks.length})</h4>
                                  {incTasks.length === 0 ? (
                                    <span className="text-muted">Aucune tâche assignée à cet signalement.</span>
                                  ) : (
                                    <div className="tasks-grid">
                                      {incTasks.map((t) => {
                                        const isDone = t.state === 'done';
                                        return (
                                          <div key={t.id} className={`task-impact-card ${isDone ? 'done' : ''}`}>
                                            <div className="task-impact-header">
                                              <span className="task-title-text">{t.title}</span>
                                              <span className={`task-badge ${t.state}`}>
                                                {t.state === 'done' ? 'Terminée' : t.state === 'failed' ? 'Échouée' : t.state === 'in_progress' ? 'En cours' : 'En attente'}
                                              </span>
                                            </div>
                                            {t.description && <p className="task-desc-text">{t.description}</p>}
                                            {t.end_date && (
                                              <span className="task-date-text">
                                                Échéance : {formatDate(t.end_date)}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}
                      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                        <Pagination
                          page={currentPage}
                          pageSize={10}
                          count={totalIncidentsCount}
                          onChange={setCurrentPage}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Impact;
