import { authService } from '../auth/services/authService';
import { API_URL_BASE } from '../../config/api_url_base';
import { lieuIncident } from '../../utils/lieuIncident';

const ETATS = {
  declared: { libelle: 'Déclaré', classe: 'is-declare' },
  taken_into_account: { libelle: 'Pris en compte', classe: 'is-pris' },
  in_progress: { libelle: 'En cours', classe: 'is-cours' },
  resolved: { libelle: 'Résolu', classe: 'is-resolu' },
};

/**
 * Toute la corbeille. Si l'API pagine sa réponse (`next`), on suit les pages :
 * la sélection « Tout » doit porter sur tous les signalements, pas sur les
 * premiers seulement.
 */
export const getToutLaCorbeille = async () => {
  const axios = authService.createAuthenticatedAxios();
  const { data } = await axios.get(`${API_URL_BASE}/MapApi/incidents/trash/`);
  if (Array.isArray(data)) return data;
  const liste = [...(data?.results || [])];
  let suivante = data?.next;
  while (suivante) {
    const { data: page } = await axios.get(suivante);
    liste.push(...(page?.results || []));
    suivante = page?.next;
  }
  return liste;
};

const dateFr = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Un signalement de la corbeille, prêt à afficher : rien d'autre que l'API. */
export const lireSignalementSupprime = (inc) => ({
  id: inc.id,
  titre: inc.title || 'Sans titre',
  description: inc.description || '',
  photo: inc.photo || '',
  zone: inc.zone || '',
  lieu: lieuIncident(inc),
  etat: ETATS[inc.etat] || null,
  signaleLe: dateFr(inc.created_at),
});
