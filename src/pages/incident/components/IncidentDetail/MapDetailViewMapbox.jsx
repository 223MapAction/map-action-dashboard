import 'mapbox-gl/dist/mapbox-gl.css';
import { Map, Marker, NavigationControl, FullscreenControl, Source, Layer } from 'react-map-gl/mapbox';
import { cercleGeoJSON } from './cercleZone';
import { MAPBOX_TOKEN } from '../../../../config/mapStyles';

/**
 * Mini-carte Mapbox de la fiche incident.
 * Separee de MapDetailViewMapLibre.jsx : voir MapContainer/MapViewMapbox.jsx
 * pour la raison (paquets react-map-gl/maplibre et /mapbox non-melangeables).
 */
export const MapDetailViewMapbox = ({ carteRef, longitude, latitude, mapStyle, rayon, couleur = '#F97316' }) => (
  <Map
    ref={carteRef}
    reuseMaps
    mapboxAccessToken={MAPBOX_TOKEN}
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

export default MapDetailViewMapbox;
