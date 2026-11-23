
import { authService } from '../../auth/services/authService';
import { API_URL_BASE } from '../../../config/api_url_base';
import { logger } from '../../../utils/logger';



const INCIDENT_URL = 'incident';
const INCIDENTS_URL = 'incidents';

/**
 * Récupère tous les incidents avec pagination
 * @param {number} page - Numéro de page (default: 1)
 * @param {number} pageSize - Taille de la page (default: 10)
 * @returns {Promise<Object>} - { count, next, previous, results }
 */
export const getIncidentsService = async (page = null, pageSize = null, search = '', etat = '', periode = null) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    
    const params = [];
    if (page !== null && pageSize !== null) {
      params.push(`page=${page}`);
      params.push(`page_size=${pageSize}`);
    } else {
      params.push(`page_size=100`);
    }
    
    if (search) {
      params.push(`search=${encodeURIComponent(search)}`);
    }

    if (etat) {
      params.push(`etat=${encodeURIComponent(etat)}`);
    }

    // Plage de dates sur created_at, envoyée seulement quand les deux bornes
    // sont choisies. Sans elle, l'API renvoie tous les signalements.
    if (periode?.debut && periode?.fin) {
      params.push('filter_type=custom_range');
      params.push(`custom_start=${encodeURIComponent(periode.debut)}`);
      params.push(`custom_end=${encodeURIComponent(periode.fin)}`);
    }

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    const response = await axios.get(
      `${API_URL_BASE}/MapApi/incident/${queryString}`
    );

    logger.warn('[Incident]url Incidents récupérés:', `${API_URL_BASE}/MapApi/incident/${queryString}`);
    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur récupération incidents:', error.response?.status, error.response?.data);
    throw error;
  }
};


/**
 * Récupère les incidents résolus
 * @returns {Promise<Object>} - { count, next, previous, results }
 */
export const getResolvedIncidentsService = async () => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(
      `${API_URL_BASE}/MapApi/incidentResolved/`
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur récupération incidents résolus:', error.response?.status, error.response?.data);
    throw error;
  }
};


/**
 * Récupère les détails d'un incident spécifique
 * @param {number} id - ID de l'incident
 * @returns {Promise<Object>} Détails de l'incident
 */
export const getIncidentService = async (id) => {
  try {
    const axios = authService.createAuthenticatedAxios();


    const response = await axios.get(
      `${API_URL_BASE}/MapApi/${INCIDENT_URL}/${id}`
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur récupération incident:', error.response?.status, error.response?.data);
    throw error;
  }
};


/**
 * Crée un nouvel incident
 * @param {Object} incidentData - Données de l'incident
 * @param {string} incidentData.title - Titre
 * @param {string} incidentData.zone - Zone (requis)
 * @param {string} incidentData.description - Description
 * @param {string} incidentData.lattitude - Latitude
 * @param {string} incidentData.longitude - Longitude
 * @param {number} incidentData.category_id - ID de la catégorie
 * @param {number} incidentData.indicateur_id - ID de l'indicateur
 * @param {File} incidentData.photo - Fichier photo
 * @param {File} incidentData.video - Fichier vidéo
 * @param {File} incidentData.audio - Fichier audio
 * @returns {Promise<Object>} Incident créé
 */
export const createIncidentService = async (incidentData) => {
  try {
    const axios = authService.createAuthenticatedAxios();

    // Créer un FormData pour envoyer les fichiers
    const formData = new FormData();
    Object.keys(incidentData).forEach(key => {
      if (incidentData[key] !== null && incidentData[key] !== undefined) {
        formData.append(key, incidentData[key]);
      }
    });

    const response = await axios.post(
      `${API_URL_BASE}/MapApi/${INCIDENT_URL}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur création incident:', error.response?.status, error.response?.data);
    throw error?.response?.data || error;
  }
};

/**
 * Met à jour un incident
 * @param {number} id - ID de l'incident
 * @param {Object} updates - Données à mettre à jour
 * @returns {Promise<Object>} Incident mis à jour
 */
export const updateIncidentService = async (id, updates) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.put(
      `${API_URL_BASE}/MapApi/${INCIDENT_URL}s/${id}/`,
      updates
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur mise à jour incident:', error.response?.status, error.response?.data);
    throw error?.response?.data || error;
  }
};

/**
 * Supprime un incident (soft delete)
 * @param {number} id - ID de l'incident
 * @returns {Promise<void>}
 */
export const deleteIncidentService = async (id) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    await axios.delete(`${API_URL_BASE}/MapApi/${INCIDENT_URL}/${id}`);

  } catch (error) {
    logger.error('[Incident] Erreur suppression incident:', error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Prendre en charge un incident (devenir leader)
 * @param {number} incidentId 
 * @returns 
 */
export const takeInChargeIncidentService = async (incidentId, data = null) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.post(
      `${API_URL_BASE}/MapApi/${INCIDENT_URL}s/${incidentId}/take_in_charge/`,
      data
    );

    return response.data;
  } catch (error) {
    logger.error('[Prise en charge Incident] Erreur:', error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Récupère les incidents par zone
 * @param {string} zone - Nom de la zone
 * @returns {Promise<Array>} Liste des incidents
 */
export const getIncidentsByZoneService = async (zone) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(
      `${API_URL_BASE}/MapApi/${INCIDENT_URL}/zone/${zone}/`
    );

    return response.data?.results || response.data || [];
  } catch (error) {
    logger.error('[Incident] Erreur récupération incidents par zone:', error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Récupère les incidents par catégorie
 * @param {number} categoryId - ID de la catégorie
 * @returns {Promise<Array>} Liste des incidents
 */
export const getIncidentsByCategoryService = async (categoryId) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(
      `${API_URL_BASE}/MapApi/${INCIDENT_URL}/category/${categoryId}/`
    );

    return response.data?.results || response.data || [];
  } catch (error) {
    logger.error('[Incident] Erreur récupération incidents par catégorie:', error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Récupère les incidents de l'organisation
 * @param {string} source - Source des incidents (agents|citizens|all, default: all)
 * @returns {Promise<Array>} Liste des incidents
 */
export const getOrgIncidentsService = async (source = 'agents') => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(
      `${API_URL_BASE}/MapApi/org-${INCIDENTS_URL}/`,
      {
        params: { source }
      }
    );

    return response.data?.results || response.data || [];
  } catch (error) {
    logger.error('[Incident] Erreur récupération incidents organisation:', error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Bascule la visibilité publique d'un incident
 * @param {number} incidentId - ID de l'incident
 * @returns {Promise<Object>} - { status, message, data: { is_public } }
 */
export const togglePublicIncidentService = async (incidentId) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.post(
      `${API_URL_BASE}/MapApi/${INCIDENTS_URL}/${incidentId}/toggle-public/`
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur basculement visibilité:', error.response?.status, error.response?.data);
    throw error?.response?.data || error;
  }
};

/**
 * Relance l'analyse IA (prédiction) d'un incident.
 *
 * Réservé aux super admins côté backend (IsSuperAdmin) — l'incident doit
 * avoir une photo, sinon l'API renvoie 400.
 * @param {string} incidentId - UUID de l'incident
 * @returns {Promise<Object>} - Prediction (statut repassé à "pending")
 */
export const retryIncidentPredictionService = async (incidentId) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.post(
      `${API_URL_BASE}/MapApi/${INCIDENTS_URL}/${incidentId}/prediction/retry/`
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur relance prédiction:', error.response?.status, error.response?.data);
    throw error?.response?.data || error;
  }
};

/**
 * Récupère les assignations d'incident a un agents
 * @returns {Promise<Array>}
 */
export const getAssignIncidentToAgentService = async (incidentId = null, data = null) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    if (incidentId) {
      const payload = {
        incident: incidentId,
        user_id: data?.taken_by,
        deadline: data?.deadline,
        ...data
      };
      const response = await axios.post(
        `${API_URL_BASE}/MapApi/agent/assigned-incidents/`,
        payload
      );
      return response.data;
    }

    const response = await axios.get(
      `${API_URL_BASE}/MapApi/agent/assigned-incidents/`
    );

    return response.data?.results || response.data || [];
  } catch (error) {
    logger.error(
      `[Incident] Erreur ${incidentId ? 'assignation' : 'récupération'} incidents assignés:`,
      error.response?.status,
      error.response?.data
    );
    throw error;
  }
};
/**
 * Assigne un incident à un ou plusieurs agents.
 *
 * `incidentId` est obligatoire. La version précédente l'acceptait à null et
 * retombait sur une ligne référençant `response`, variable déclarée dans le
 * bloc `if` : tout appel sans identifiant levait un ReferenceError au lieu
 * d'une erreur exploitable. Reste d'un copier-coller depuis
 * getAssignIncidentToAgentService, dont la branche GET avait été retirée
 * sans son `return`.
 *
 * @param {number|string} incidentId - ID de l'incident (requis)
 * @param {Object} data - Données d'assignation
 * @returns {Promise<Object>} Assignation créée
 */
export const assignIncidentToAgentService = async (incidentId, data = null) => {
  if (!incidentId) {
    throw new Error('[Incident] assignIncidentToAgentService : incidentId est requis');
  }

  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.post(
      `${API_URL_BASE}/MapApi/incidents/${incidentId}/assignments/`,
      data
    );
    return response.data;
  } catch (error) {
    logger.error(
      '[Incident] Erreur assignation incident:',
      error.response?.status,
      error.response?.data
    );
    throw error;
  }
};

/**
 * Récupère les assignations (agents assignés) d'un incident spécifique
 * @param {number} incidentId - ID de l'incident
 * @returns {Promise<Array>} Liste des assignations
 */
export const getIncidentAssignmentsService = async (incidentId) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(
      `${API_URL_BASE}/MapApi/incidents/${incidentId}/assignments/`
    );
    return response.data?.results || response.data || [];
  } catch (error) {
    logger.error(
      `[Incident] Erreur récupération assignations pour l'incident ${incidentId}:`,
      error.response?.status,
      error.response?.data
    );
    throw error;
  }
};

/**
 * Clôture un incident (leader uniquement)
 * @param {number} incidentId - ID de l'incident
 * @param {Object} data - { resolution_start_date, resolution_end_date }
 * @returns {Promise<Object>} Incident clôturé
 */
export const closeIncidentService = async (incidentId, data) => {
  try {
    const axios = authService.createAuthenticatedAxios();

    let payload = data;
    let headers = {};

    if (data && data.resolution_file) {
      const formData = new FormData();
      formData.append('resolution_start_date', data.resolution_start_date);
      formData.append('resolution_end_date', data.resolution_end_date);
      formData.append('resolution_file', data.resolution_file);
      payload = formData;
      headers['Content-Type'] = 'multipart/form-data';
    }

    const response = await axios.post(
      `${API_URL_BASE}/MapApi/${INCIDENT_URL}s/${incidentId}/close/`,
      payload,
      { headers }
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur clôture incident:', error.response?.status, error.response?.data);
    throw error?.response?.data || error;
  }
};

/**
 * Récupère les incidents supprimés (corbeille)
 * @returns {Promise<Array>} Liste des incidents supprimés
 */
export const getTrashIncidentsService = async () => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(
      `${API_URL_BASE}/MapApi/${INCIDENTS_URL}/trash/`
    );

    return response.data?.results || response.data || [];
  } catch (error) {
    logger.error('[Incident] Erreur récupération corbeille:', error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Restaure un incident supprimé
 * @param {number} incidentId - ID de l'incident
 * @returns {Promise<Object>} Incident restauré
 */
export const restoreIncidentService = async (incidentId) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.post(
      `${API_URL_BASE}/MapApi/${INCIDENT_URL}/${incidentId}/restore/`
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur restauration incident:', error.response?.status, error.response?.data);
    throw error?.response?.data || error;
  }
};

/**
 * Récupère les prédictions d'un incident spécifique
 * @param {number|string} id - ID de l'incident
 * @returns {Promise<Object>} Prédictions de l'incident
 */
export const getIncidentPredictionService = async (id) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(
      `${API_URL_BASE}/MapApi/Incidentprediction/${id}/`
    );

    return response.data;
  } catch (error) {
    logger.error('[Incident] Erreur récupération prédiction:', error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Formate un incident pour l'affichage
 * @param {Object} incident - Données brutes de l'incident
 * @returns {Object} Incident formaté
 */
export const formatIncident = (incident) => {
  if (!incident) return null;

  return {
    id: incident.id,
    title: incident.title,
    zone: incident.zone,
    description: incident.description,
    etat: incident.etat,
    etatLabel: getEtatLabel(incident.etat),
    progress: incident.progress || 0,
    isPublic: incident.is_public,
    isDeleted: incident.is_deleted,
    createdAt: incident.created_at,
    photo: incident.photo,
    video: incident.video,
    audio: incident.audio,
    category: incident.category,
    takenBy: incident.taken_by,
    userId: incident.user_id,
    resolutionStartDate: incident.resolution_start_date,
    resolutionEndDate: incident.resolution_end_date,
    reportedByAgent: incident.reported_by_agent
  };
};

/**
 * Obtient le libellé d'un état
 * @param {string} etat - État de l'incident
 * @returns {string} Libellé traduit
 */
const getEtatLabel = (etat) => {
  const labels = {
    declared: 'Déclaré',
    taken_into_account: 'Pris en compte',
    in_progress: 'En cours',
    resolved: 'Résolu'
  };
  return labels[etat] || etat;
};

export default {
  getIncidentsService,
  getResolvedIncidentsService,
  getIncidentService,
  getIncidentPredictionService,
  createIncidentService,
  updateIncidentService,
  deleteIncidentService,
  getIncidentsByZoneService,
  getIncidentsByCategoryService,
  getOrgIncidentsService,
  togglePublicIncidentService,
  retryIncidentPredictionService,
  assignIncidentToAgentService,
  getIncidentAssignmentsService,
  takeInChargeIncidentService,
  closeIncidentService,
  getTrashIncidentsService,
  restoreIncidentService,
  formatIncident
};