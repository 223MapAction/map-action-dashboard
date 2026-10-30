import { lieuIncident } from '../../utils/lieuIncident';

/** État d'un signalement : libellé et classe de pastille. */
export const ETATS = {
  declared: { libelle: 'Déclaré', classe: 'is-declare' },
  taken_into_account: { libelle: 'Pris en compte', classe: 'is-pris' },
  in_progress: { libelle: 'En cours', classe: 'is-cours' },
  resolved: { libelle: 'Résolu', classe: 'is-resolu' },
};

/** État d'une assignation d'agent. */
export const ETATS_ASSIGNATION = {
  pending: { libelle: 'En cours', classe: 'is-cours' },
  reported: { libelle: 'Reporté', classe: 'is-retard' },
  resolved: { libelle: 'Terminé', classe: 'is-resolu' },
};

const estInterne = (mode) => mode === 'internal' || mode === 'interne';

/** Mode de prise en charge, ou null quand l'API ne le précise pas. */
export const modeIntervention = (mode) => {
  if (!mode) return null;
  return estInterne(mode)
    ? { libelle: 'Interne', classe: 'is-interne' }
    : { libelle: 'Collaboration', classe: 'is-collab' };
};

export const dateFr = (iso, avecHeure = false) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return avecHeure
    ? `${jour} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : jour;
};

/** Ce que la liste affiche d'un signalement pris en charge. */
export const versIntervention = (incident) => {
  const avancement = Math.min(100, Math.max(0, Math.round(Number(incident.progress) || 0)));
  return {
    ...incident,
    lieu: lieuIncident(incident),
    photo: incident.photo || incident.image || '',
    declareLe: dateFr(incident.created_at),
    resoluLe: dateFr(incident.resolution_end_date),
    avancement,
    etat: ETATS[incident.etat] || ETATS.in_progress,
    mode: modeIntervention(incident.take_in_charge_mode),
    nbRapports: Number(incident.reports_count) || 0,
  };
};
