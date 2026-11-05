// Mise en forme des signalements de la liste.
//
// Uniquement à partir des champs que /MapApi/incident/ renvoie dans la liste :
// etat, severity, zone, created_at, resolution_end_date, taken_by,
// taken_by_organisation, taken_by_name, take_in_charge_mode, user_full_name,
// user_id, reported_by_agent, lattitude / longitude, thumbnail / photo.

/** Les états que l'API sait filtrer (paramètre `etat`), dans l'ordre des onglets. */
export const ETATS = [
  { valeur: '', libelle: 'Tous' },
  { valeur: 'declared', libelle: 'Déclarés' },
  { valeur: 'taken_into_account', libelle: 'Pris en compte' },
  { valeur: 'resolved', libelle: 'Résolus' },
];

const ETAT = {
  declared: { libelle: 'Déclaré', classe: 'sg-e-declare' },
  taken_into_account: { libelle: 'Pris en compte', classe: 'sg-e-pris' },
  in_progress: { libelle: 'En cours', classe: 'sg-e-cours' },
  resolved: { libelle: 'Résolu', classe: 'sg-e-resolu' },
};

export const etatDe = (etat) => ETAT[etat] || { libelle: 'Déclaré', classe: 'sg-e-declare' };

/** Le nom de l'état pour annoncer un total (« 128 signalements déclarés »). */
export const nomEtatPluriel = (etat) => ({
  declared: 'déclarés',
  taken_into_account: 'pris en compte',
  resolved: 'résolus',
}[etat] || '');

/** « Il y a 25 min », « Il y a 2 h », « Hier », « Il y a 4 j », puis la date. */
export const quandRelatif = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `Il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return 'Hier';
  if (jours < 30) return `Il y a ${jours} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Qui l'a signalé : le nom, précédé de « Agent · » quand c'est un agent de terrain. */
export const auteurDe = (incident) => {
  const u = incident.user_id;
  const nom = (incident.user_full_name && incident.user_full_name !== 'Non spécifié')
    ? incident.user_full_name
    : (u && typeof u === 'object' ? [u.first_name, u.last_name].filter(Boolean).join(' ') : '');
  if (!nom) return '';
  return incident.reported_by_agent ? `Agent · ${nom}` : nom;
};

/**
 * Qui s'en occupe. `null` quand personne ne l'a pris en charge.
 * @returns {{ nom: string, estMoi: boolean, mode: string } | null}
 */
export const priseEnChargeDe = (incident, monOrgId) => {
  const org = incident.taken_by_organisation;
  if (!org && !incident.taken_by && !incident.taken_by_name) return null;
  const estMoi = Boolean(monOrgId && org?.id && String(org.id) === String(monOrgId));
  const nom = estMoi ? 'Votre organisation' : (org?.name || incident.taken_by_name || 'Une organisation');
  const m = incident.take_in_charge_mode;
  let mode = '';
  if (incident.etat === 'resolved' && incident.resolution_end_date) {
    mode = `Résolu le ${new Date(incident.resolution_end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  } else if (m === 'collaborative' || m === 'collaboratif') {
    mode = 'En collaboration';
  } else if (m === 'internal' || m === 'interne') {
    mode = 'En interne';
  }
  return { nom, estMoi, mode };
};
