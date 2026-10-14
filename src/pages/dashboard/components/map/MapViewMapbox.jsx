import { useEffect } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Map, Marker, Popup, Source, Layer } from 'react-map-gl/mapbox';
import { MAPBOX_TOKEN } from '../../../../config/mapStyles';
import { CountryFocusLayer } from './CountryFocusLayer';
import { activerGestesCooperatifs } from '../../../../utils/gestesCarte';

/**
 * Carte Mapbox du dashboard.
 *
 * Separee de MapViewMapLibre.jsx a dessein : react-map-gl/maplibre et
 * react-map-gl/mapbox sont deux paquets distincts, chacun avec ses propres
 * Map/Marker/Popup, incompatibles entre eux dans un meme composant.
 * MapContainer choisit laquelle des deux rendre via IS_MAPBOX et lui passe
 * les memes props/donnees.
 */
export const MapViewMapbox = ({
  carteRef,
  initialViewState,
  mapStyle,
  onMoveEnd,
  isMapLoading,
  incidentGroups,
  groupeOuvert,
  setGroupeOuvert,
  currentUserId,
  getMarkerColorClass,
  translateEtat,
  openModal,
  focusIso,
}) => {
  // react-map-gl v8 ne transmet pas cooperativeGestures a mapbox-gl :
  // on l'active nous-memes apres coup. Voir utils/gestesCarte.
  useEffect(() => {
    let annule = false;
    const essayer = () => {
      if (annule) return;
      const carte = carteRef.current?.getMap?.();
      if (carte) { activerGestesCooperatifs(carte, { touchOnly: false }); return; }
      setTimeout(essayer, 300);
    };
    essayer();
    return () => { annule = true; };
  }, [carteRef]);

  return (
    <Map
      ref={carteRef}
      reuseMaps
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={initialViewState}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      scrollZoom={true}
      dragPan={true}
      dragRotate={false}
      doubleClickZoom={true}
      touchZoomRotate={true}
      touchPitch={true}
      keyboard={true}
      cooperativeGestures={true}
      minZoom={2}
      maxZoom={18}
      onMoveEnd={onMoveEnd}
    >
      <CountryFocusLayer
        Source={Source}
        Layer={Layer}
        carteRef={carteRef}
        iso={focusIso}
        vueParDefaut={initialViewState}
      />

      {!isMapLoading &&
        incidentGroups.map((group) => {
          const principal = group.incidents[0];
          const nombre = group.incidents.length;
          const colorClass = getMarkerColorClass(principal, currentUserId);
          const label =
            nombre > 1
              ? `${nombre} incidents à cet emplacement`
              : `Voir l'incident ${principal?.title || ''}`;

          return (
            <Marker key={group.cle} longitude={group.lng} latitude={group.lat} anchor="center">
              <button
                type="button"
                className={`incident-marker severity-${colorClass}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (nombre > 1) {
                    setGroupeOuvert(group);
                  } else {
                    openModal(principal);
                  }
                }}
                aria-label={label}
                title={label}
              >
                <span className="incident-marker-pulse" />
                <span className="incident-marker-dot" />
                {nombre > 1 && <span className="incident-marker-count">{nombre}</span>}
              </button>
            </Marker>
          );
        })}

      {groupeOuvert && (
        <Popup
          longitude={groupeOuvert.lng}
          latitude={groupeOuvert.lat}
          anchor="bottom"
          offset={18}
          closeOnClick={false}
          onClose={() => setGroupeOuvert(null)}
          className="incident-group-popup"
        >
          <p className="incident-group-title">
            {groupeOuvert.incidents.length} incidents à cet emplacement
          </p>
          <ul className="incident-group-list">
            {groupeOuvert.incidents.map((incident) => (
              <li key={incident.id}>
                <button
                  type="button"
                  className={`incident-group-item severity-${getMarkerColorClass(incident, currentUserId)}`}
                  onClick={() => {
                    setGroupeOuvert(null);
                    openModal(incident);
                  }}
                >
                  <span className="incident-group-dot" />
                  <span className="incident-group-label">
                    {incident.title || 'Incident sans titre'}
                  </span>
                  <span className="incident-group-etat">{translateEtat(incident.etat)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popup>
      )}
    </Map>
  );
};

export default MapViewMapbox;
