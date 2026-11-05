/**
 * Polygone circulaire (GeoJSON) de `rayon` mètres autour d'un point, pour
 * dessiner la zone d'intervention sur la mini-carte.
 */
export const cercleGeoJSON = (lng, lat, rayon, pas = 64) => {
  const dLng = rayon / (111320 * Math.cos((lat * Math.PI) / 180));
  const dLat = rayon / 110540;
  const points = Array.from({ length: pas + 1 }, (_, i) => {
    const a = (i / pas) * 2 * Math.PI;
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [points] } };
};

export default cercleGeoJSON;
