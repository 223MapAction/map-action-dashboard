import { useEffect, useMemo, useState } from 'react';
import { bboxPays, frontiereDe, masqueInverse } from '../../../../utils/focusPays';

const URL_FRONTIERES = '/frontieres-pays.geojson';

// Charge une seule fois pour toute la session, au premier pays selectionne.
let chargement = null;
const chargerFrontieres = () => {
  if (!chargement) {
    chargement = fetch(URL_FRONTIERES)
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .catch(() => null);
  }
  return chargement;
};

/**
 * Focus sur un pays : assombrit le reste du monde, surligne la frontiere et
 * cadre la camera dessus. Sans iso, rien n'est affiche et la camera revient
 * a la vue par defaut.
 *
 * Source et Layer sont passes par la carte appelante : react-map-gl/maplibre
 * et react-map-gl/mapbox ont chacun les leurs (voir MapViewMapLibre.jsx).
 */
export const CountryFocusLayer = ({ Source, Layer, carteRef, iso, vueParDefaut }) => {
  const [frontieres, setFrontieres] = useState(null);

  useEffect(() => {
    if (!iso || frontieres) return;
    let annule = false;
    chargerFrontieres().then((donnees) => { if (!annule) setFrontieres(donnees); });
    return () => { annule = true; };
  }, [iso, frontieres]);

  const pays = useMemo(() => (iso ? frontiereDe(frontieres, iso) : null), [frontieres, iso]);
  const masque = useMemo(() => (pays ? masqueInverse(pays) : null), [pays]);

  useEffect(() => {
    const carte = carteRef.current;
    if (!carte) return;
    if (pays) {
      carte.fitBounds(bboxPays(pays), { padding: 40, duration: 1200 });
    } else if (!iso && vueParDefaut) {
      carte.flyTo({
        center: [vueParDefaut.longitude, vueParDefaut.latitude],
        zoom: vueParDefaut.zoom,
        duration: 1200,
      });
    }
  }, [carteRef, pays, iso, vueParDefaut]);

  if (!pays) return null;

  return (
    <>
      <Source id="focus-pays-masque" type="geojson" data={masque}>
        <Layer id="focus-pays-masque" type="fill" paint={{ 'fill-color': '#0f172a', 'fill-opacity': 0.6 }} />
      </Source>
      <Source id="focus-pays-frontiere" type="geojson" data={pays}>
        <Layer
          id="focus-pays-frontiere"
          type="line"
          paint={{ 'line-color': '#38bdf8', 'line-width': 2.5 }}
        />
      </Source>
    </>
  );
};

export default CountryFocusLayer;
