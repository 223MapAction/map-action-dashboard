/**
 * Outils du "focus pays" de la carte du dashboard : a partir de la frontiere
 * d'un pays (Feature GeoJSON Polygon/MultiPolygon), construit le masque qui
 * assombrit le reste du monde et la bbox sur laquelle cadrer la camera.
 */

// Rectangle couvrant le monde (limites Web Mercator en latitude).
const MONDE = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];

const polygonesDe = (geometry) =>
  geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

/** Polygone "monde moins le pays" : le pays devient un trou dans le rectangle monde. */
export const masqueInverse = (feature) => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [MONDE, ...polygonesDe(feature.geometry).map((polygone) => polygone[0])],
  },
});

/** Bbox [[ouest, sud], [est, nord]] au format attendu par fitBounds. */
export const bboxPays = (feature) => {
  let [ouest, sud, est, nord] = [Infinity, Infinity, -Infinity, -Infinity];
  polygonesDe(feature.geometry).forEach((polygone) =>
    polygone[0].forEach(([lng, lat]) => {
      ouest = Math.min(ouest, lng);
      sud = Math.min(sud, lat);
      est = Math.max(est, lng);
      nord = Math.max(nord, lat);
    })
  );
  return [[ouest, sud], [est, nord]];
};

/** Retrouve la frontiere d'un pays par son code ISO alpha-3. */
export const frontiereDe = (collection, iso) =>
  collection?.features?.find((feature) => feature.properties?.iso === iso) || null;
