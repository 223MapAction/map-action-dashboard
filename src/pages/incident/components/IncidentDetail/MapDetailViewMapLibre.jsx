import 'maplibre-gl/dist/maplibre-gl.css';
import { Map, Marker, NavigationControl, FullscreenControl, Source, Layer } from 'react-map-gl/maplibre';
import { cercleGeoJSON } from './cercleZone';

/**
 * Mini-carte MapLibre de la fiche incident.
 * Separee de MapDetailViewMapbox.jsx : voir MapContainer/MapViewMapLibre.jsx
 * pour la raison (paquets react-map-gl/maplibre et /mapbox non-melangeables).
 */
export const MapDetailViewMapLibre = ({ carteRef, longitude, latitude, mapStyle, rayon, couleur = '#F97316' }) => (
  <Map
    ref={carteRef}
    reuseMaps
    initialViewState={{ longitude, latitude, zoom: rayon ? 16 : 14 }}
    style={{ width: '100%', height: '100%' }}
    mapStyle={mapStyle}
  >
    {rayon > 0 && (
      <Source id="zone-intervention" type="geojson" data={cercleGeoJSON(longitude, latitude, rayon)}>
        <Layer id="zone-intervention-fond" type="fill" paint={{ 'fill-color': couleur, 'fill-opacity': 0.15 }} />
        <Layer id="zone-intervention-trait" type="line" paint={{ 'line-color': couleur, 'line-width': 2, 'line-dasharray': [2, 1.5] }} />
      </Source>
    )}
    <Marker longitude={longitude} latitude={latitude} anchor="center">
      <span className="vd-map-point" style={{ backgroundColor: couleur }} aria-label="Position du signalement" />
    </Marker>
    <NavigationControl position="top-right" />
    <FullscreenControl position="bottom-right" />
  </Map>
);

export default MapDetailViewMapLibre;
