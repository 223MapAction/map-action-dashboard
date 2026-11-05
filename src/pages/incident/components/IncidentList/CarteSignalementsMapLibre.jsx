import 'maplibre-gl/dist/maplibre-gl.css';
import { Map, Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';

/**
 * Carte MapLibre de la liste des signalements.
 * Séparée de CarteSignalementsMapbox.jsx : voir dashboard/components/map/MapViewMapLibre.jsx
 * pour la raison (paquets react-map-gl/maplibre et /mapbox non mélangeables).
 */
export const CarteSignalementsMapLibre = ({ carteRef, mapStyle, initialViewState, points, selection, onSelect, fiche }) => (
  <Map
    ref={carteRef}
    reuseMaps
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

export default CarteSignalementsMapLibre;
