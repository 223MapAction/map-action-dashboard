import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';

import {
  NIVEAUX_GRAVITE,
  gravite,
  couleurGravite,
} from '../../../../utils/gravite';

import { MapViewMapLibre } from './MapViewMapLibre';
import { MapViewMapbox } from './MapViewMapbox';

import {
  ShimmerThumbnail,
  ShimmerTitle,
  ShimmerText,
} from 'react-shimmer-effects';

import { getIncidentService } from '../../../incident/service/incident_service';

import {
  getOrgInternalIncidentsService,
} from '../../../mes-interventions/service/mes_interventions_service';

import {
  getIncidentsFilteredService,
} from '../../service/dashboard_service';

import { BlurryImage } from '../../../../components/atoms/BlurryImage';

import {
  COUNTRIES,
} from '../../../organisations/data/organisations';

import {
  OSM_STYLE,
  MAPBOX_SATELLITE_STYLE,
  HAS_MAPBOX_TOKEN,
} from '../../../../config/mapStyles';

import {
  IS_MAPBOX,
} from '../../../../config/mapEngine';

import './map.css';

import {
  useReinitialisationSurChangement,
} from '../../../../hooks/useReinitialisationSurChangement';

import { logger } from '../../../../utils/logger';


/* ============================================================================
 * CONSTANTES
 * ========================================================================== */

const DEFAULT_MALI_LAT = 12.65;
const DEFAULT_MALI_LNG = -8.0;

const INCIDENT_STATUS_STEPS = [
  {
    id: 'declared',
    label: 'Déclaré',
  },
  {
    id: 'taken_into_account',
    label: 'Pris en compte',
  },
  {
    id: 'resolved',
    label: 'Résolu',
  },
];


/* ============================================================================
 * STYLES DE CARTE
 * ========================================================================== */

const MAP_STYLES = {
  humanitarian: {
    id: 'humanitarian',
    label: 'Carte',
    style: OSM_STYLE,
  },

  ...(IS_MAPBOX && HAS_MAPBOX_TOKEN
    ? {
        satellite: {
          id: 'satellite',
          label: 'Satellite',
          style: MAPBOX_SATELLITE_STYLE,
        },
      }
    : {}),
};


/* ============================================================================
 * HELPERS
 * ========================================================================== */

/**
 * Retourne la classe CSS du marker selon :
 * - le statut de l'incident ;
 * - la personne ayant pris en charge l'incident.
 */
const getMarkerColorClass = (
  incident,
  currentUserId
) => {
  const isResolved =
    incident?.etat === 'resolved';

  if (isResolved) {
    let takenById = null;

    if (
      incident?.taken_by &&
      typeof incident.taken_by === 'object'
    ) {
      takenById =
        incident.taken_by.id;
    } else {
      takenById =
        incident?.taken_by ??
        incident?.takenBy;
    }

    const takenBy = String(
      takenById ?? ''
    );

    const me = String(
      currentUserId ?? ''
    );

    if (
      takenBy &&
      me &&
      takenBy === me
    ) {
      return 'resolved-mine';
    }

    return 'resolved-others';
  }

  return `active-${gravite(incident)}`;
};


/**
 * Traduit l'état d'un incident.
 */
const translateEtat = (etat) => {
  switch (etat) {
    case 'resolved':
      return 'Résolu';

    case 'taken_into_account':
      return 'Pris en compte';

    case 'pending':
      return 'En attente';

    case 'declared':
      return 'Déclaré';

    default:
      return etat || '';
  }
};


/**
 * Récupère les coordonnées d'un incident.
 *
 * Le backend semble parfois utiliser "lattitude"
 * et parfois "latitude", donc on accepte les deux.
 */
const getIncidentCoordinates = (
  incident
) => {
  const latitude = Number(
    incident?.latitude ??
    incident?.lattitude
  );

  const longitude = Number(
    incident?.longitude
  );

  const valid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude !== 0 &&
    longitude !== 0;

  return {
    latitude,
    longitude,
    valid,
  };
};


/**
 * Génère des coordonnées de secours stables
 * lorsque l'incident ne possède pas de coordonnées.
 *
 * Cela évite de mettre plusieurs incidents
 * directement au centre du Mali.
 */
const getFallbackCoordinates = (
  incident
) => {
  const id = String(
    incident?.id ?? ''
  );

  let hash = 0;

  for (let i = 0; i < id.length; i++) {
    hash =
      (hash << 5) -
      hash +
      id.charCodeAt(i);

    hash |= 0;
  }

  return {
    lat:
      DEFAULT_MALI_LAT +
      Math.sin(hash) * 0.005,

    lng:
      DEFAULT_MALI_LNG +
      Math.cos(hash) * 0.005,
  };
};


/* ============================================================================
 * COMPOSANT
 * ========================================================================== */

export const MapContainer = () => {
  const navigate = useNavigate();

  /* --------------------------------------------------------------------------
   * Modal
   * ------------------------------------------------------------------------ */

  const [
    selectedIncidentId,
    setSelectedIncidentId,
  ] = useState(null);

  const [
    modalClosing,
    setModalClosing,
  ] = useState(false);

  const [
    modalShowing,
    setModalShowing,
  ] = useState(false);

  const modalTimerRef =
    useRef(null);


  /* --------------------------------------------------------------------------
   * Carte
   * ------------------------------------------------------------------------ */

  const carteRef =
    useRef(null);

  const [
    activeStyle,
    setActiveStyle,
  ] = useState('humanitarian');

  /**
   * Important :
   *
   * initialViewState ne doit pas dépendre de "center".
   *
   * center change quand les incidents arrivent.
   * initialViewState, lui, ne doit servir qu'à
   * l'initialisation de la carte.
   */
  const initialViewState = useMemo(
    () => ({
      longitude: DEFAULT_MALI_LNG,
      latitude: DEFAULT_MALI_LAT,
      zoom: 6,
    }),
    []
  );


  /* --------------------------------------------------------------------------
   * Filtres
   * ------------------------------------------------------------------------ */

  const currentUserId =
    sessionStorage.getItem('user_id');

  const userOrgCountry =
    sessionStorage.getItem(
      'organisation_country'
    ) || '';

  const [
    ownershipFilter,
    setOwnershipFilter,
  ] = useState('all');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('active');

  const [
    countryFilter,
    setCountryFilter,
  ] = useState('');


  /* --------------------------------------------------------------------------
   * Groupe de markers
   * ------------------------------------------------------------------------ */

  const [
    groupeOuvert,
    setGroupeOuvert,
  ] = useState(null);


  /* --------------------------------------------------------------------------
   * Pagination
   * ------------------------------------------------------------------------ */

  const [
    allIncidents,
    setAllIncidents,
  ] = useState([]);

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    hasMorePages,
    setHasMorePages,
  ] = useState(true);

  const [
    isLoadingMore,
    setIsLoadingMore,
  ] = useState(false);

  const loadedPagesRef =
    useRef(new Set());

  const hasMorePagesRef =
    useRef(true);

  const isLoadingMoreRef =
    useRef(false);

  const isLoadingPageRef =
    useRef(false);

  const validIncidentsLengthRef =
    useRef(0);


  /* --------------------------------------------------------------------------
   * Scope API
   * ------------------------------------------------------------------------ */

  const scope = useMemo(() => {
    if (ownershipFilter === 'mine') {
      return 'mine';
    }

    if (statusFilter === 'resolved') {
      return 'resolved';
    }

    if (statusFilter === 'active') {
      return 'unresolved';
    }

    return 'all';
  }, [
    ownershipFilter,
    statusFilter,
  ]);


  /* --------------------------------------------------------------------------
   * Réinitialisation lors des changements de filtres
   * ------------------------------------------------------------------------ */

  useReinitialisationSurChangement(
    [
      ownershipFilter,
      statusFilter,
      countryFilter,
    ],
    () => {
      setAllIncidents([]);
      setCurrentPage(1);
      setHasMorePages(true);
      setIsLoadingMore(false);

      loadedPagesRef.current =
        new Set();
    }
  );


  /* --------------------------------------------------------------------------
   * Incident sélectionné
   * ------------------------------------------------------------------------ */

  const {
    data: selectedIncident,
    isLoading: isLoadingIncident,
  } = useSWR(
    selectedIncidentId
      ? `/incident/${selectedIncidentId}`
      : null,

    () =>
      getIncidentService(
        selectedIncidentId
      ),

    {
      revalidateOnFocus: false,

      onError: (error) => {
        logger.error(
          '[MAP] Erreur chargement incident:',
          error
        );
      },
    }
  );


  /* --------------------------------------------------------------------------
   * Chargement des incidents
   * ------------------------------------------------------------------------ */

  const {
    isLoading: isLoadingPage,
  } = useSWR(
    ownershipFilter === 'mine'
      ? currentPage === 1
        ? '/org-incidents'
        : null
      : `/map-incidents-${scope}-${
          countryFilter || 'all'
        }-page-${currentPage}`,

    async () => {
      /**
       * Cas "Mes signalements".
       *
       * Ce service retourne déjà les incidents
       * de l'organisation/utilisateur.
       */
      if (
        ownershipFilter === 'mine'
      ) {
        return getOrgInternalIncidentsService();
      }

      const params = {
        scope,
        page: currentPage,
        page_size: 30,
      };

      if (countryFilter) {
        params.country =
          countryFilter;
      }

      return getIncidentsFilteredService(
        params
      );
    },

    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,

      // Fusion de la page recue dans allIncidents. Fait ici plutot que dans
      // un effet qui observe pageData : useSWR est le systeme externe, ce
      // callback EST la synchronisation, pas un rendu qui en declenche une
      // autre.
      onSuccess: (data) => {
        const pageKey =
          `${scope}-${
            countryFilter || 'all'
          }-${currentPage}`;

        if (
          loadedPagesRef.current.has(
            pageKey
          )
        ) {
          return;
        }

        loadedPagesRef.current.add(
          pageKey
        );

        const results =
          data?.results ||
          (Array.isArray(data)
            ? data
            : []);

        setAllIncidents((previous) => {
          const existingIds =
            new Set(
              previous.map(
                (incident) =>
                  incident.id
              )
            );

          const newIncidents =
            results.filter(
              (incident) =>
                !existingIds.has(
                  incident.id
                )
            );

          return [
            ...previous,
            ...newIncidents,
          ];
        });

        setHasMorePages(
          ownershipFilter === 'mine'
            ? false
            : Boolean(data?.next)
        );

        setIsLoadingMore(false);
      },

      onError: (error) => {
        logger.error(
          '[MAP] Erreur chargement incidents:',
          error
        );

        setIsLoadingMore(false);
      },
    }
  );


  /* --------------------------------------------------------------------------
   * Refs pagination
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    hasMorePagesRef.current =
      hasMorePages;

    isLoadingMoreRef.current =
      isLoadingMore;

    isLoadingPageRef.current =
      isLoadingPage;
  }, [
    hasMorePages,
    isLoadingMore,
    isLoadingPage,
  ]);


  /* --------------------------------------------------------------------------
   * Chargement page suivante
   * ------------------------------------------------------------------------ */

  const loadMoreIncidents =
    useCallback(() => {
      if (
        !hasMorePagesRef.current ||
        isLoadingMoreRef.current ||
        isLoadingPageRef.current
      ) {
        return;
      }

      setIsLoadingMore(true);

      setCurrentPage(
        (previous) =>
          previous + 1
      );
    }, []);


  /* --------------------------------------------------------------------------
   * MoveEnd stable
   * ------------------------------------------------------------------------ */

  const onMapMoveEnd =
    useCallback(() => {
      if (
        hasMorePagesRef.current &&
        !isLoadingMoreRef.current &&
        !isLoadingPageRef.current &&
        validIncidentsLengthRef.current >
          0
      ) {
        loadMoreIncidents();
      }
    }, [
      loadMoreIncidents,
    ]);


  /* --------------------------------------------------------------------------
   * Validation des incidents
   * ------------------------------------------------------------------------ */

  const validIncidents =
    useMemo(() => {
      return allIncidents
        .map((incident) => {
          const {
            latitude,
            longitude,
            valid,
          } =
            getIncidentCoordinates(
              incident
            );

          let finalLat =
            latitude;

          let finalLng =
            longitude;

          let hasFallbackCoords =
            false;

          if (!valid) {
            const fallback =
              getFallbackCoordinates(
                incident
              );

            finalLat =
              fallback.lat;

            finalLng =
              fallback.lng;

            hasFallbackCoords =
              true;
          }

          if (
            !Number.isFinite(
              finalLat
            ) ||
            !Number.isFinite(
              finalLng
            )
          ) {
            finalLat =
              DEFAULT_MALI_LAT;

            finalLng =
              DEFAULT_MALI_LNG;
          }

          return {
            ...incident,

            _lat: finalLat,
            _lng: finalLng,

            _hasFallbackCoords:
              hasFallbackCoords,
          };
        })

        .filter((incident) => {
          /**
           * Mes signalements.
           */
          if (
            ownershipFilter === 'mine'
          ) {
            let takenBy =
              incident?.taken_by;

            if (
              takenBy &&
              typeof takenBy ===
                'object'
            ) {
              takenBy =
                takenBy.id;
            }

            if (
              !takenBy ||
              !currentUserId ||
              String(takenBy) !==
                String(currentUserId)
            ) {
              return false;
            }
          }

          /**
           * Filtre résolu.
           */
          const isResolved =
            incident?.etat ===
            'resolved';

          if (
            statusFilter ===
              'resolved' &&
            !isResolved
          ) {
            return false;
          }

          /**
           * Les incidents supprimés
           * ne doivent jamais apparaître.
           */
          if (
            incident?.is_deleted ||
            incident?.isDeleted
          ) {
            return false;
          }

          return true;
        });
    }, [
      allIncidents,
      ownershipFilter,
      statusFilter,
      currentUserId,
    ]);


  /* --------------------------------------------------------------------------
   * Mise à jour de la ref du nombre d'incidents
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    validIncidentsLengthRef.current =
      validIncidents.length;
  }, [
    validIncidents.length,
  ]);


  /* --------------------------------------------------------------------------
   * Groupement des incidents
   * ------------------------------------------------------------------------ */

  const incidentGroups =
    useMemo(() => {
      const grouped =
        Object.create(null);

      const order = [];

      for (
        const incident of validIncidents
      ) {
        const key =
          `${incident._lat}|${incident._lng}`;

        if (grouped[key]) {
          grouped[
            key
          ].incidents.push(
            incident
          );
        } else {
          grouped[key] = {
            cle: key,
            lat: incident._lat,
            lng: incident._lng,
            incidents: [
              incident,
            ],
          };

          order.push(key);
        }
      }

      return order.map(
        (key) =>
          grouped[key]
      );
    }, [
      validIncidents,
    ]);


  /* --------------------------------------------------------------------------
   * Changement de style
   * ------------------------------------------------------------------------ */

  const handleStyleChange =
    useCallback((styleId) => {
      if (
        !MAP_STYLES[styleId]
      ) {
        logger.warn(
          `[MAP] Style inconnu: ${styleId}`
        );

        return;
      }

      setActiveStyle(
        styleId
      );
    }, []);


  /* --------------------------------------------------------------------------
   * Modal
   * ------------------------------------------------------------------------ */

  const openModal =
    useCallback((incident) => {
      if (!incident?.id) {
        return;
      }

      if (
        modalTimerRef.current
      ) {
        clearTimeout(
          modalTimerRef.current
        );
      }

      setModalClosing(false);

      setSelectedIncidentId(
        incident.id
      );

      modalTimerRef.current =
        setTimeout(() => {
          setModalShowing(true);
        }, 10);
    }, []);


  const closeModal =
    useCallback(() => {
      if (
        modalTimerRef.current
      ) {
        clearTimeout(
          modalTimerRef.current
        );
      }

      setModalShowing(false);
      setModalClosing(true);

      modalTimerRef.current =
        setTimeout(() => {
          setSelectedIncidentId(
            null
          );

          setModalClosing(false);
        }, 300);
    }, []);


  /* --------------------------------------------------------------------------
   * Nettoyage modal
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    return () => {
      if (
        modalTimerRef.current
      ) {
        clearTimeout(
          modalTimerRef.current
        );
      }
    };
  }, []);


  /* --------------------------------------------------------------------------
   * Blocage du scroll body
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    if (selectedIncidentId) {
      document.body.style.overflow =
        'hidden';
    } else {
      document.body.style.overflow =
        '';
    }

    return () => {
      document.body.style.overflow =
        '';
    };
  }, [
    selectedIncidentId,
  ]);


  /* --------------------------------------------------------------------------
   * Status de l'incident sélectionné
   * ------------------------------------------------------------------------ */

  const statusIndex =
    selectedIncident
      ? Math.max(
          0,
          INCIDENT_STATUS_STEPS.findIndex(
            (step) =>
              step.id ===
              (
                selectedIncident.etat ||
                'declared'
              )
          )
        )
      : 0;


  /* --------------------------------------------------------------------------
   * Chargement carte
   * ------------------------------------------------------------------------ */

  const isMapLoading =
    isLoadingPage &&
    allIncidents.length === 0;


  /* ==========================================================================
   * RENDER
   * ======================================================================== */

  return (
    <div className="card">
      <div className="map-container">

        {/* ------------------------------------------------------------------
         * Loading
         * ---------------------------------------------------------------- */}

        {isMapLoading && (
          <div className="map-loading-overlay">
            <div className="map-loading-spinner">
              <div className="spinner" />

              <p>
                Chargement des
                signalements...
              </p>
            </div>
          </div>
        )}


        {/* ------------------------------------------------------------------
         * MAP
         * ---------------------------------------------------------------- */}

        {(() => {
          const MapView = IS_MAPBOX ? MapViewMapbox : MapViewMapLibre;
          return (
            <MapView
              carteRef={carteRef}
              initialViewState={initialViewState}
              mapStyle={MAP_STYLES[activeStyle]?.style || OSM_STYLE}
              onMoveEnd={onMapMoveEnd}
              isMapLoading={isMapLoading}
              incidentGroups={incidentGroups}
              groupeOuvert={groupeOuvert}
              setGroupeOuvert={setGroupeOuvert}
              currentUserId={currentUserId}
              getMarkerColorClass={getMarkerColorClass}
              translateEtat={translateEtat}
              openModal={openModal}
              focusIso={COUNTRIES.find((country) => country.en === countryFilter)?.iso}
            />
          );
        })()}


        {/* ------------------------------------------------------------------
         * SWITCHER STYLE
         * ---------------------------------------------------------------- */}

        <div className="map-style-switcher">
          {Object.values(
            MAP_STYLES
          ).map((style) => (
            <button
              key={style.id}
              type="button"
              className={`map-style-btn ${
                activeStyle ===
                style.id
                  ? 'is-active'
                  : ''
              }`}
              onClick={() =>
                handleStyleChange(
                  style.id
                )
              }
            >
              {style.label}
            </button>
          ))}
        </div>


        {/* ------------------------------------------------------------------
         * FILTRES
         * ---------------------------------------------------------------- */}

        <div className="map-filters-overlay">

          {/* Attribution */}
          <div className="map-filter-group">
            <select
              className="map-filter-select"
              value={
                ownershipFilter
              }
              onChange={(event) =>
                setOwnershipFilter(
                  event.target.value
                )
              }
              aria-label="Filtre d'attribution"
            >
              <option value="all">
                Tous les signalements
              </option>

              <option value="mine">
                Mes signalements
              </option>
            </select>
          </div>


          {/* Pays */}
          <div className="map-filter-group">
            <select
              className="map-filter-select"
              value={
                countryFilter
              }
              onChange={(event) =>
                setCountryFilter(
                  event.target.value
                )
              }
              aria-label="Filtre par pays"
            >
              <option value="">
                Tous les pays
              </option>

              {userOrgCountry && (
                <option
                  value={
                    userOrgCountry
                  }
                >
                  Mon pays (
                  {
                    COUNTRIES.find(
                      (country) =>
                        country.en ===
                        userOrgCountry
                    )?.fr ||
                    userOrgCountry
                  }
                  )
                </option>
              )}

              {COUNTRIES.map(
                (country) => (
                  <option
                    key={
                      country.en
                    }
                    value={
                      country.en
                    }
                  >
                    {country.fr}
                  </option>
                )
              )}
            </select>
          </div>


          {/* Statut */}
          <div className="map-filter-buttons">

            <button
              type="button"
              className={`map-filter-btn ${
                statusFilter ===
                'active'
                  ? 'is-active'
                  : ''
              }`}
              onClick={() =>
                setStatusFilter(
                  'active'
                )
              }
            >
              Actifs
            </button>

            <button
              type="button"
              className={`map-filter-btn ${
                statusFilter ===
                'resolved'
                  ? 'is-active'
                  : ''
              }`}
              onClick={() =>
                setStatusFilter(
                  'resolved'
                )
              }
            >
              Résolus
            </button>

          </div>
        </div>


        {/* ------------------------------------------------------------------
         * LÉGENDE
         * ---------------------------------------------------------------- */}

        <div className="map-legend-modern">

          {statusFilter ===
          'active' ? (
            <>
              <p className="map-legend-title">
                Gravité
              </p>

              <div className="map-legend-list">
                {NIVEAUX_GRAVITE.map(
                  ({
                    cle,
                    libelle,
                  }) => (
                    <div
                      className="map-legend-item"
                      key={cle}
                    >
                      <span
                        className="map-legend-dot"
                        style={{
                          backgroundColor:
                            couleurGravite(
                              cle
                            ),
                        }}
                      />

                      {libelle}
                    </div>
                  )
                )}
              </div>
            </>
          ) : (
            <>
              <p className="map-legend-title">
                INCIDENTS RÉSOLUS
              </p>

              <div className="map-legend-list">

                <div className="map-legend-item">
                  <span
                    className="map-legend-dot"
                    style={{
                      backgroundColor:
                        'var(--color-primary)',
                    }}
                  />

                  Par d'autres
                </div>

                <div className="map-legend-item">
                  <span
                    className="map-legend-dot"
                    style={{
                      backgroundColor:
                        'var(--color-success)',
                    }}
                  />

                  Par moi
                </div>

              </div>
            </>
          )}

        </div>


        {/* ------------------------------------------------------------------
         * STATUS PAGINATION
         * ---------------------------------------------------------------- */}

        {!isMapLoading && (
          <div className="map-status-stack">

            <div className="map-incidents-count">
              {
                validIncidents.length
              }{' '}
              incident
              {validIncidents.length >
              1
                ? 's'
                : ''}{' '}
              affiché
              {validIncidents.length >
              1
                ? 's'
                : ''}
            </div>


            {hasMorePages && (
              <button
                type="button"
                onClick={
                  loadMoreIncidents
                }
                disabled={
                  isLoadingMore ||
                  isLoadingPage
                }
                className="btn btn-primary btn-sm"
                style={{
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: '8px',
                  padding:
                    '8px 16px',
                  fontSize:
                    'var(--font-size-body-small)',
                  fontWeight: '600',
                  borderRadius:
                    '20px',
                  boxShadow:
                    '0 2px 8px rgba(var(--rgb-ombre), 0.15)',
                  cursor:
                    isLoadingMore ||
                    isLoadingPage
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    isLoadingMore ||
                    isLoadingPage
                      ? 0.7
                      : 1,
                }}
              >
                {isLoadingMore ||
                isLoadingPage ? (
                  <>
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">
                        Chargement...
                      </span>
                    </div>

                    Chargement...
                  </>
                ) : (
                  'Charger plus d’incidents'
                )}
              </button>
            )}

          </div>
        )}

      </div>


      {/* ======================================================================
       * MODAL INCIDENT
       * ==================================================================== */}

      {selectedIncidentId && (
        <>
          <div
            className={`modal fade ${
              modalShowing &&
              !modalClosing
                ? 'show'
                : ''
            }`}
            style={{
              display: 'block',
            }}
            tabIndex="-1"
            role="dialog"
            onClick={
              closeModal
            }
          >
            <div
              className="modal-dialog modal-dialog-scrollable"
              role="document"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-content">

                {/* ----------------------------------------------------------
                 * HEADER
                 * -------------------------------------------------------- */}

                <div className="modal-header">

                  <div
                    className="d-flex flex-column"
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <h5 className="modal-title fw-bold">

                      {isLoadingIncident ? (
                        <ShimmerTitle
                          line={1}
                          gap={10}
                          variant="primary"
                        />
                      ) : (
                        selectedIncident?.title ||
                        'Chargement...'
                      )}

                    </h5>

                    <small className="text-muted mt-1">

                      {isLoadingIncident ? (
                        <ShimmerText
                          line={1}
                          gap={10}
                        />
                      ) : (
                        <>
                          {
                            selectedIncident?.zone
                          }

                          {' • '}

                          {translateEtat(
                            selectedIncident?.etat
                          )}
                        </>
                      )}

                    </small>
                  </div>


                  <button
                    type="button"
                    className="btn-close"
                    onClick={
                      closeModal
                    }
                    aria-label="Fermer"
                  />

                </div>


                {/* ----------------------------------------------------------
                 * BODY
                 * -------------------------------------------------------- */}

                <div className="modal-body">

                  {isLoadingIncident ||
                  !selectedIncident ? (
                    <div>

                      <ShimmerThumbnail
                        height={240}
                        rounded
                      />

                      <div
                        style={{
                          marginTop:
                            '1rem',
                          marginBottom:
                            '1.5rem',
                        }}
                      >
                        <ShimmerTitle
                          line={1}
                          gap={10}
                          variant="secondary"
                        />
                      </div>

                      <div
                        style={{
                          marginBottom:
                            '1.5rem',
                        }}
                      >
                        <ShimmerText
                          line={3}
                          gap={10}
                        />
                      </div>

                      <div
                        style={{
                          marginBottom:
                            '1rem',
                        }}
                      >
                        <ShimmerThumbnail
                          height={120}
                          rounded
                        />
                      </div>

                      <ShimmerText
                        line={5}
                        gap={10}
                      />

                    </div>
                  ) : (
                    <>

                      {/* ----------------------------------------------------
                       * PHOTO
                       * -------------------------------------------------- */}

                      {selectedIncident.photo && (
                        <BlurryImage
                          src={
                            selectedIncident.photo
                          }
                          alt={
                            selectedIncident.title
                          }
                          className="img-fluid rounded mb-3 w-100"
                          style={{
                            maxHeight:
                              '300px',
                            objectFit:
                              'cover',
                          }}
                        />
                      )}


                      {/* ----------------------------------------------------
                       * BADGES
                       * -------------------------------------------------- */}

                      <div className="d-flex flex-wrap gap-2 mb-3">

                        <span
                          className={`badge ${
                            selectedIncident.etat ===
                            'resolved'
                              ? 'badge-status-resolved'
                              : selectedIncident.etat ===
                                'taken_into_account'
                              ? 'badge-status-taken_into_account'
                              : selectedIncident.etat ===
                                'pending'
                              ? 'badge-status-pending'
                              : 'badge-status-declared'
                          }`}
                        >
                          STATUT :{' '}

                          {selectedIncident.etat ===
                          'resolved'
                            ? 'RÉSOLU'
                            : selectedIncident.etat ===
                              'taken_into_account'
                            ? 'PRIS EN COMPTE'
                            : selectedIncident.etat ===
                              'pending'
                            ? 'EN ATTENTE'
                            : 'DÉCLARÉ'}
                        </span>


                        {selectedIncident.zone && (
                          <span className="badge bg-info text-dark">
                            {
                              selectedIncident.zone
                            }
                          </span>
                        )}

                      </div>


                      {/* ----------------------------------------------------
                       * DESCRIPTION
                       * -------------------------------------------------- */}

                      {selectedIncident.description && (
                        <p className="text-secondary mb-3">
                          {
                            selectedIncident.description
                          }
                        </p>
                      )}


                      {/* ----------------------------------------------------
                       * INFORMATIONS
                       * -------------------------------------------------- */}

                      <ul className="list-group list-group-flush mb-3">

                        <li className="list-group-item px-0">
                          <strong>
                            Créé le :
                          </strong>{' '}

                          {selectedIncident.created_at
                            ? new Date(
                                selectedIncident.created_at
                              ).toLocaleDateString(
                                'fr-FR',
                                {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )
                            : 'Non spécifié'}
                        </li>


                        <li className="list-group-item px-0">

                          <strong>
                            Coordonnées :
                          </strong>{' '}

                          {(() => {
                            const {
                              latitude,
                              longitude,
                              valid,
                            } =
                              getIncidentCoordinates(
                                selectedIncident
                              );

                            if (!valid) {
                              return 'Non spécifiées (Mali par défaut)';
                            }

                            return `${latitude.toFixed(
                              4
                            )}°N, ${longitude.toFixed(
                              4
                            )}°E`;
                          })()}

                        </li>

                      </ul>


                      {/* ----------------------------------------------------
                       * STATUS STEPPER
                       * -------------------------------------------------- */}

                      <div
                        className={`mb-4 status-stepper-${
                          selectedIncident?.etat ||
                          'declared'
                        }`}
                      >

                        <h6 className="section-title mb-3">
                          STATUT DE L'INCIDENT
                        </h6>

                        <div className="incident-modal-status-bar">

                          {INCIDENT_STATUS_STEPS.map(
                            (
                              step,
                              index
                            ) => (
                              <div
                                key={
                                  step.id
                                }
                                className={`incident-modal-status-segment ${
                                  index <
                                  statusIndex
                                    ? 'is-done'
                                    : ''
                                } ${
                                  index ===
                                  statusIndex
                                    ? 'is-current'
                                    : ''
                                }`}
                              />
                            )
                          )}

                        </div>


                        <div className="incident-modal-status-steps">

                          {INCIDENT_STATUS_STEPS.map(
                            (
                              step,
                              index
                            ) => (
                              <div
                                key={
                                  step.id
                                }
                                className={`incident-modal-status-step ${
                                  index <
                                  statusIndex
                                    ? 'is-done'
                                    : ''
                                } ${
                                  index ===
                                  statusIndex
                                    ? 'is-current'
                                    : ''
                                }`}
                              >
                                <span className="incident-modal-status-dot" />

                                <span>
                                  {
                                    step.label.toUpperCase()
                                  }
                                </span>
                              </div>
                            )
                          )}

                        </div>

                      </div>


                      {/* ----------------------------------------------------
                       * AUDIO
                       * -------------------------------------------------- */}

                      {selectedIncident.audio && (
                        <div className="mb-4">

                          <h6 className="section-title mb-2">
                            AUDIO
                          </h6>

                          <audio
                            controls
                            className="w-100"
                          >
                            <source
                              src={
                                selectedIncident.audio
                              }
                              type="audio/mpeg"
                            />

                            Votre navigateur ne supporte pas l'élément audio.
                          </audio>

                        </div>
                      )}


                      {/* ----------------------------------------------------
                       * VIDEO
                       * -------------------------------------------------- */}

                      {selectedIncident.video && (
                        <div className="mb-4">

                          <h6 className="section-title mb-2">
                            VIDÉO DE PRÉSENTATION
                          </h6>

                          <video
                            controls
                            className="w-100 rounded"
                            style={{
                              maxHeight:
                                '400px',
                            }}
                          >
                            <source
                              src={
                                selectedIncident.video
                              }
                              type="video/mp4"
                            />

                            Votre navigateur ne supporte pas la lecture de vidéos.
                          </video>

                        </div>
                      )}


                      {/* ----------------------------------------------------
                       * ORGANISATIONS
                       * -------------------------------------------------- */}

                      {selectedIncident.participants?.length >
                        0 && (
                        <div className="mb-3">

                          <h6 className="section-title mb-3">
                            ORGANISATIONS MOBILISÉES
                          </h6>

                          <div className="d-flex flex-wrap gap-3 mb-3">

                            {selectedIncident.participants.map(
                              (
                                participant,
                                index
                              ) => (
                                <div
                                  key={
                                    index
                                  }
                                  className="d-flex align-items-center gap-2"
                                >

                                  <div
                                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                    style={{
                                      backgroundColor:
                                        participant.color,

                                      width:
                                        '40px',

                                      height:
                                        '40px',

                                      fontSize:
                                        'var(--font-size-body-small)',
                                    }}
                                  >
                                    {
                                      participant.initials
                                    }
                                  </div>

                                  <span>
                                    {
                                      participant.name
                                    }
                                  </span>

                                </div>
                              )
                            )}


                            {selectedIncident.extraParticipants >
                              0 && (
                              <div className="d-flex align-items-center gap-2">

                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                  style={{
                                    backgroundColor:
                                      'var(--color-text-muted)',

                                    width:
                                      '40px',

                                    height:
                                      '40px',

                                    fontSize:
                                      'var(--font-size-body-small)',
                                  }}
                                >
                                  +
                                  {
                                    selectedIncident.extraParticipants
                                  }
                                </div>

                                <span>
                                  Autres organisations
                                </span>

                              </div>
                            )}

                          </div>
                        </div>
                      )}

                    </>
                  )}

                </div>


                {/* ----------------------------------------------------------
                 * FOOTER
                 * -------------------------------------------------------- */}

                {!isLoadingIncident &&
                  selectedIncident && (
                    <div className="modal-footer">

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={
                          closeModal
                        }
                      >
                        Fermer
                      </button>


                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          navigate(
                            `/signalements/${selectedIncident.id}`,
                            {
                              state: {
                                from:
                                  '/dashboard',
                              },
                            }
                          );
                        }}
                      >
                        Savoir plus
                      </button>

                    </div>
                  )}

              </div>
            </div>
          </div>


          {/* ----------------------------------------------------------------
           * BACKDROP
           * -------------------------------------------------------------- */}

          <div
            className={`modal-backdrop fade ${
              modalShowing &&
              !modalClosing
                ? 'show'
                : ''
            }`}
          />
        </>
      )}
    </div>
  );
};


export default MapContainer;