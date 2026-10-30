/**
 * Géométrie de la carte des zones d'impact, commune aux deux moteurs.
 */

const RAYON_TERRE = 6371008.8;

/** Cercle géographique de `rayon` mètres autour d'un point, en polygone. */
const cercle = (lng, lat, rayon, pas = 64) => {
  const latR = (lat * Math.PI) / 180;
  const d = rayon / RAYON_TERRE;
  const anneau = [];
  for (let i = 0; i <= pas; i++) {
    const angle = (i / pas) * 2 * Math.PI;
    const dLat = d * Math.cos(angle);
    const dLng = (d * Math.sin(angle)) / Math.cos(latR);
    anneau.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return anneau;
};

/** Zones d'impact des signalements localisés qui ont un rayon. */
export const zonesGeoJSON = (points, actif) => ({
  type: 'FeatureCollection',
  features: points
    .filter((p) => p.rayon > 0)
    .map((p) => ({
      type: 'Feature',
      properties: { id: String(p.id), actif: String(p.id) === String(actif) },
      geometry: { type: 'Polygon', coordinates: [cercle(p.lng, p.lat, p.rayon)] },
    })),
});

/** Emprise [[ouest, sud], [est, nord]] de points, rayons compris. */
export const emprise = (points) => {
  if (!points.length) return null;
  let o = Infinity; let s = Infinity; let e = -Infinity; let n = -Infinity;
  points.forEach((p) => {
    const marge = (p.rayon || 0) / 111320;
    o = Math.min(o, p.lng - marge); e = Math.max(e, p.lng + marge);
    s = Math.min(s, p.lat - marge); n = Math.max(n, p.lat + marge);
  });
  return [[o, s], [e, n]];
};

export const COUCHE_REMPLISSAGE = {
  id: 'impact-zones-fond',
  type: 'fill',
  paint: {
    'fill-color': ['case', ['get', 'actif'], '#1E78AC', '#64748B'],
    'fill-opacity': ['case', ['get', 'actif'], 0.2, 0.12],
  },
};

export const COUCHE_CONTOUR = {
  id: 'impact-zones-contour',
  type: 'line',
  paint: {
    'line-color': ['case', ['get', 'actif'], '#1E78AC', '#64748B'],
    'line-width': ['case', ['get', 'actif'], 2, 1.5],
  },
};
