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
import { PanneauDetail } from './PanneauDetail';
import { MapViewMapbox } from './MapViewMapbox';
import { ApercuMobile } from '../../mobile/ApercuMobile';
import { HabillageCarteMobile } from '../../mobile/HabillageCarteMobile';

import { getIncidentService } from '../../../incident/service/incident_service';

import {
  getOrgInternalIncidentsService,
} from '../../../mes-interventions/service/mes_interventions_service';

import {
  getIncidentsFilteredService,
} from '../../service/dashboard_service';

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

// Taille de page côté front uniquement (l'API garde son propre défaut/plafond).
// Le front boucle sur `next` jusqu'à épuisement, donc cette valeur ne fait
// qu'ajuster le nombre d'aller-retours, pas ce qui finit par s'afficher.
const MAP_PAGE_SIZE = 30;

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

/**
 * `filtreExterne` et `cible` sont optionnels : sans eux, la carte se comporte
 * exactement comme avant. Le dashboard s'en sert pour piloter la carte depuis
 * ses indicateurs et ses widgets (statut, gravité, localité, signalement à
 * ouvrir). `mobile` remplace les contrôles posés sur la carte par ceux de la
 * maquette mobile, et la bulle par une feuille basse.
 */
export const MapContainer = ({ filtreExterne = null, cible = null, onFiltresChange, mobile = null } = {}) => {
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
      ? `/org-incidents-page-${currentPage}`
      : `/map-incidents-${scope}-${
          countryFilter || 'all'
        }-page-${currentPage}`,

    async () => {
      /**
       * Cas "Mes signalements".
       *
       * Ce service retourne déjà les incidents
       * de l'organisation/utilisateur, mais doit
       * être paginé comme les autres scopes pour
       * que toutes les pages finissent par être
       * récupérées (voir boucle d'auto-chargement
       * plus bas).
       */
      if (
        ownershipFilter === 'mine'
      ) {
        return getOrgInternalIncidentsService({
          page: currentPage,
          page_size: MAP_PAGE_SIZE,
        });
      }

      const params = {
        scope,
        page: currentPage,
        page_size: MAP_PAGE_SIZE,
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

        // `next` reflète fidèlement l'état réel de la pagination API,
        // quel que soit le scope (y compris "mine").
        const nextPageAvailable =
          Boolean(data?.next);

        setHasMorePages(
          nextPageAvailable
        );

        setIsLoadingMore(false);

        /**
         * Auto-chargement de toutes les pages.
         *
         * On ne touche à rien côté API : elle garde sa pagination
         * telle quelle. Mais côté front, dès qu'une page arrive et
         * qu'il en reste, on enchaîne tout de suite sur la suivante,
         * pour que tous les incidents finissent par apparaître sur
         * la carte sans action de l'utilisateur (pas besoin de
         * déplacer la carte ni de cliquer sur "Charger plus").
         *
         * On avance uniquement après un SUCCÈS : si une page échoue
         * (onError ci-dessous), on n'avance pas dessus tout seul —
         * l'utilisateur peut relancer via le bouton "Charger plus".
         */
        if (nextPageAvailable) {
          setCurrentPage(
            (previous) => previous + 1
          );
        }
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

  const idsZoneCharges = useMemo(
    () =>
      Boolean(filtreExterne?.ids?.size) &&
      allIncidents.some((i) => filtreExterne.ids.has(String(i.id))),
    [filtreExterne, allIncidents]
  );

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
           * Filtres venus du dashboard.
           */
          if (
            filtreExterne?.statut === 'taken' &&
            !['taken_into_account', 'in_progress'].includes(incident?.etat)
          ) {
            return false;
          }

          if (
            filtreExterne?.gravite &&
            gravite(incident) !== filtreExterne.gravite
          ) {
            return false;
          }

          // Une localité filtre seulement si ses signalements sont déjà
          // chargés sur la carte ; sinon on se contente de recadrer.
          if (
            filtreExterne?.ids?.size &&
            idsZoneCharges &&
            !filtreExterne.ids.has(String(incident?.id))
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
      filtreExterne,
      idsZoneCharges,
    ]);


  /* --------------------------------------------------------------------------
   * Pilotage par le dashboard
   * ------------------------------------------------------------------------ */

  // « Résolus » bascule la carte sur les résolus ; « Pris en compte » et la
  // remise à zéro la ramènent sur les actifs. On ne touche à rien tant que le
  // dashboard n'a rien demandé.
  const statutExterne = filtreExterne?.statut ?? null;
  const statutExternePrecedent = useRef(statutExterne);

  useEffect(() => {
    if (statutExternePrecedent.current === statutExterne) return;
    statutExternePrecedent.current = statutExterne;
    setStatusFilter(statutExterne === 'resolved' ? 'resolved' : 'active');
  }, [statutExterne]);


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
   * Filtres de la carte remontés au dashboard (ligne de contexte)
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    onFiltresChange?.({
      pays: COUNTRIES.find((c) => c.en === countryFilter)?.fr || null,
      perimetre: ownershipFilter === 'mine' ? 'mes signalements' : 'tous les signalements',
      etat: statusFilter === 'resolved' ? 'résolus' : 'actifs',
    });
  }, [countryFilter, ownershipFilter, statusFilter, onFiltresChange]);


  /* --------------------------------------------------------------------------
   * Bulle au clic sur un point
   * ------------------------------------------------------------------------ */

  const [bulle, setBulle] = useState(null);

  // Bureau : la bulle est au-dessus du point. Mobile : la feuille est en bas,
  // le point remonte donc au-dessus d'elle.
  const estMobile = Boolean(mobile);
  const decalageBulle = estMobile ? -120 : 120;

  const ouvrirBulle = useCallback((incident) => {
    if (!incident?.id) return;
    setGroupeOuvert(null);
    setBulle(incident);
    // Décale la carte pour que la bulle (au-dessus du point) reste visible.
    const carte = carteRef.current?.getMap?.();
    if (carte && Number.isFinite(incident._lng) && Number.isFinite(incident._lat)) {
      carte.easeTo({ center: [incident._lng, incident._lat], offset: [0, decalageBulle], duration: 500 });
    }
  }, [decalageBulle]);

  const fermerBulle = useCallback(() => setBulle(null), []);

  // Échap ferme la bulle
  useEffect(() => {
    if (!bulle) return undefined;
    const surTouche = (e) => {
      if (e.key === 'Escape') setBulle(null);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [bulle]);

  const ouvrirApercu = useCallback((incident) => {
    // Sur mobile, fermer le détail rapide ramène à l'aperçu.
    if (!estMobile) setBulle(null);
    openModal(incident);
  }, [openModal, estMobile]);


  /* --------------------------------------------------------------------------
   * Signalement ciblé par le dashboard (recherche, widget, fil d'activité)
   * ------------------------------------------------------------------------ */

  const cibleId = cible?.id ?? null;
  const cibleJeton = cible?.n ?? null;

  useEffect(() => {
    if (!cibleId) return;
    const incident = validIncidents.find((i) => String(i.id) === String(cibleId));
    const carte = carteRef.current?.getMap?.();
    if (incident && carte) {
      carte.flyTo({
        center: [incident._lng, incident._lat],
        zoom: Math.max(carte.getZoom(), 10),
        offset: [0, decalageBulle],
        speed: 1.4,
      });
      setGroupeOuvert(null);
      setBulle(incident);
    } else {
      // Pas encore chargé sur la carte : on ouvre directement l'aperçu.
      if (estMobile) setBulle({ id: cibleId });
      else openModal({ id: cibleId });
    }
    // Le jeton relance la même cible ; validIncidents est lu au moment du clic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cibleId, cibleJeton, openModal, ouvrirBulle]);

  // Une localité choisie dans le dashboard recadre la carte sur ses signalements.
  // Les points viennent du dashboard : la liste légère de la carte ne porte pas
  // la localité, et tous les signalements ne sont pas forcément chargés.
  const pointsExternes = filtreExterne?.points ?? null;

  useEffect(() => {
    if (!pointsExternes?.length) return;
    const carte = carteRef.current?.getMap?.();
    if (!carte) return;
    const lngs = pointsExternes.map((p) => p.lng);
    const lats = pointsExternes.map((p) => p.lat);
    const ouest = Math.min(...lngs), est = Math.max(...lngs);
    const sud = Math.min(...lats), nord = Math.max(...lats);
    // Points quasi confondus : un fitBounds zoomerait à l'infini.
    if (est - ouest < 0.05 && nord - sud < 0.05) {
      carte.flyTo({ center: [(ouest + est) / 2, (sud + nord) / 2], zoom: 10, duration: 900 });
    } else {
      carte.fitBounds([[ouest, sud], [est, nord]], { padding: 80, maxZoom: 10, duration: 900 });
    }
  }, [pointsExternes]);


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
              openModal={ouvrirBulle}
              bulle={estMobile ? null : bulle}
              fermerBulle={fermerBulle}
              onCarteClic={estMobile ? fermerBulle : undefined}
              ouvrirApercu={ouvrirApercu}
              focusIso={COUNTRIES.find((country) => country.en === countryFilter)?.iso}
            />
          );
        })()}


        {!estMobile && (
        <>
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
        </>
        )}

      </div>

      {estMobile && (bulle ? (
        <ApercuMobile incident={bulle} onDetail={ouvrirApercu} onFermer={fermerBulle} />
      ) : (
        <HabillageCarteMobile
          nonLues={mobile.nonLues}
          onStatistiques={mobile.onStatistiques}
          onActivite={mobile.onActivite}
          onNotifications={mobile.onNotifications}
          etat={statusFilter}
          onEtat={(valeur) => {
            setStatusFilter(valeur);
            // Un statut posé depuis les statistiques céderait sinon le pas au
            // choix fait ici à son prochain changement.
            if (statutExterne) mobile.onStatut(valeur === 'resolved' ? 'resolved' : null);
          }}
          proprietaire={ownershipFilter}
          onProprietaire={setOwnershipFilter}
          pays={countryFilter}
          onPays={setCountryFilter}
          paysUtilisateur={userOrgCountry}
          nomPays={COUNTRIES.find((c) => c.en === countryFilter)?.fr || null}
          styles={Object.values(MAP_STYLES)}
          styleActif={activeStyle}
          onStyle={handleStyleChange}
          graviteActive={mobile.graviteActive}
          onGravite={mobile.onGravite}
          zoneActive={mobile.zoneActive}
          onToutEffacer={() => {
            setOwnershipFilter('all');
            setStatusFilter('active');
            setCountryFilter('');
            setActiveStyle('humanitarian');
            mobile.onEffacer();
          }}
          nombre={validIncidents.length}
          aPlus={hasMorePages}
          chargementPlus={isLoadingMore || isLoadingPage}
          onChargerPlus={loadMoreIncidents}
          masquerNombre={isMapLoading}
        />
      ))}


      {/* ======================================================================
       * MODAL INCIDENT
       * ==================================================================== */}

      {selectedIncidentId && (
        <PanneauDetail
          incident={selectedIncident}
          isLoading={isLoadingIncident}
          ouvert={modalShowing && !modalClosing}
          mobile={estMobile}
          etapes={INCIDENT_STATUS_STEPS}
          coordonnees={(() => {
            if (!selectedIncident) return '';
            const { latitude, longitude, valid } = getIncidentCoordinates(selectedIncident);
            if (!valid) return 'Non spécifiées';
            if (!estMobile) return `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`;
            const f = (n) => Math.abs(n).toFixed(4).replace('.', ',');
            return `${f(latitude)}° ${latitude < 0 ? 'S' : 'N'}, ${f(longitude)}° ${longitude < 0 ? 'O' : 'E'}`;
          })()}
          onFermer={closeModal}
          onOuvrirFiche={() =>
            navigate(`/signalements/${selectedIncident.id}`, { state: { from: '/dashboard' } })
          }
        />
      )}
    </div>
  );
};


export default MapContainer;