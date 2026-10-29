/**
 * Où se trouve un signalement, en une ligne lisible.
 *
 * `zone` (le quartier, la commune) est souvent vide dans les signalements
 * envoyés depuis l'application : seules les coordonnées GPS sont remplies.
 * Afficher uniquement `zone` laissait alors la case vide, comme si le
 * signalement n'avait pas de lieu. On retombe sur `location`, puis sur les
 * coordonnées.
 *
 * Les libellés de repli posés par les adaptateurs (« Localisation non
 * spécifiée ») ne comptent pas comme un lieu.
 */
const VIDES = new Set(['', 'localisation non spécifiée', 'non spécifié', 'à définir', 'inconnue']);

const texte = (v) => (typeof v === 'string' && !VIDES.has(v.trim().toLowerCase()) ? v.trim() : '');

const coordonnees = (incident) => {
  const c = incident?.coordinates;
  const lat = Number(c?.lat ?? incident?.lattitude ?? incident?.latitude);
  const lng = Number(c?.lng ?? incident?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return '';
  return `${lat.toFixed(4).replace('.', ',')}° · ${lng.toFixed(4).replace('.', ',')}°`;
};

export const lieuIncident = (incident, repli = 'Lieu non précisé') =>
  texte(incident?.zone) || texte(incident?.location) || coordonnees(incident) || repli;

export default lieuIncident;
