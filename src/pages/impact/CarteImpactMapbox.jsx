import 'mapbox-gl/dist/mapbox-gl.css';
import { Map, Marker, Source, Layer, NavigationControl } from 'react-map-gl/mapbox';
import { MAPBOX_TOKEN } from '../../config/mapStyles';
import { COUCHE_REMPLISSAGE, COUCHE_CONTOUR } from './carte';

/**
 * Carte Mapbox des zones d'impact.
 * Séparée de CarteImpactMapLibre.jsx : voir dashboard/components/map/MapViewMapbox.jsx
 * pour la raison (paquets react-map-gl/maplibre et /mapbox non mélangeables).
 */
export const CarteImpactMapbox = ({ carteRef, mapStyle, initialViewState, zones, points, actif, onSelect }) => (
  <Map
    ref={carteRef}
    reuseMaps
    mapboxAccessToken={MAPBOX_TOKEN}
    initialViewState={initialViewState}
    style={{ width: '100%', height: '100%' }}
    mapStyle={mapStyle}
    dragRotate={false}
  >
    <Source id="impact-zones" type="geojson" data={zones}>
      <Layer {...COUCHE_REMPLISSAGE} />
      <Layer {...COUCHE_CONTOUR} />
    </Source>
    {points.map((p) => (
      <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center" onClick={(e) => { e.originalEvent.stopPropagation(); onSelect(p.id); }}>
        <button
          type="button"
          className={`ip-repere ${String(actif) === String(p.id) ? 'is-on' : ''}`}
          aria-label={`Signalement ${p.n} : ${p.titre}`}
          aria-pressed={String(actif) === String(p.id)}
        >
          {p.n}
        </button>
      </Marker>
    ))}
    <NavigationControl position="top-right" showCompass={false} />
  </Map>
);

export default CarteImpactMapbox;
