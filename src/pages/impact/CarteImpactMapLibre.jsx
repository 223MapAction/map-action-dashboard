import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect } from 'react';
import { Map, Marker, Source, Layer } from 'react-map-gl/maplibre';
import { COUCHE_REMPLISSAGE, COUCHE_CONTOUR } from './carte';
import { activerGestesCooperatifs } from '../../utils/gestesCarte';

/**
 * Carte MapLibre des zones d'impact.
 * Séparée de CarteImpactMapbox.jsx : voir dashboard/components/map/MapViewMapLibre.jsx
 * pour la raison (paquets react-map-gl/maplibre et /mapbox non mélangeables).
 *
 * Mêmes gestes et mêmes bornes de zoom que la carte du dashboard : la molette
 * seule fait défiler la page, Ctrl + molette zoome la carte.
 */
export const CarteImpactMapLibre = ({ carteRef, mapStyle, initialViewState, zones, points, actif, onSelect }) => {
  // react-map-gl v8 ne transmet pas cooperativeGestures : on l'active après
  // coup, comme sur le dashboard. Voir utils/gestesCarte.
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
    initialViewState={initialViewState}
    style={{ width: '100%', height: '100%' }}
    mapStyle={mapStyle}
    scrollZoom
    dragRotate={false}
    cooperativeGestures
    minZoom={2}
    maxZoom={18}
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
  </Map>
  );
};

export default CarteImpactMapLibre;
