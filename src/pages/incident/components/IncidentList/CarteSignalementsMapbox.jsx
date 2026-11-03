import 'mapbox-gl/dist/mapbox-gl.css';
import { Map, Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import { MAPBOX_TOKEN } from '../../../../config/mapStyles';

/**
 * Carte Mapbox de la liste des signalements.
 * Séparée de CarteSignalementsMapLibre.jsx : voir dashboard/components/map/MapViewMapbox.jsx
 * pour la raison (paquets react-map-gl/maplibre et /mapbox non mélangeables).
 */
export const CarteSignalementsMapbox = ({ carteRef, mapStyle, initialViewState, points, selection, onSelect, fiche }) => (
  <Map
    ref={carteRef}
    reuseMaps
    mapboxAccessToken={MAPBOX_TOKEN}
    initialViewState={initialViewState}
    style={{ width: '100%', height: '100%' }}
    mapStyle={mapStyle}
    dragRotate={false}
  >
    {points.map((p) => (
      <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center" onClick={(e) => { e.originalEvent.stopPropagation(); onSelect(p.id); }}>
        <button
          type="button"
          className={`sg-point sg-g-${p.niveau} ${selection?.id === p.id ? 'is-on' : ''}`}
          aria-label={p.libelle}
          aria-pressed={selection?.id === p.id}
        />
      </Marker>
    ))}
    {selection && (
      <Popup
        longitude={selection.lng}
        latitude={selection.lat}
        anchor="bottom"
        offset={18}
        closeButton={false}
        closeOnClick={false}
        maxWidth="320px"
        className="sg-popup"
      >
        {fiche}
      </Popup>
    )}
    <NavigationControl position="top-right" showCompass={false} />
  </Map>
);

export default CarteSignalementsMapbox;
