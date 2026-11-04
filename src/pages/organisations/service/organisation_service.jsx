import { authService } from '../../auth/services/authService';
import { API_URL_BASE } from '../../../config/api_url_base';
import { couleurAvatarPour, AVATAR_COULEUR_DEFAUT } from '../../../utils/couleursAvatar';
import { logger } from '../../../utils/logger';

/**
 * Récupère les organisations avec pagination et filtrage
 * @param {number|null} page - Numéro de page
 * @param {number|null} pageSize - Taille de la page
 * @param {boolean} returnFullResponse - Si vrai, retourne l'objet complet {count, next, previous, results}
 * @param {string} search - Terme de recherche
 * @param {string} sector - Secteur d'activité
 * @param {string} status - Statut du partenaire
 * @param {string} orgType - Type d'organisation
 * @returns {Promise<Object|Array>} Liste des organisations ou réponse paginée
 */
export const getOrganisationsService = async (
  page = null,
  pageSize = null,
  returnFullResponse = false,
  search = '',
  sector = '',
  status = '',
  orgType = ''
) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    let url = `${API_URL_BASE}/MapApi/organisations/`;
    
    const params = [];
    if (page !== null && pageSize !== null) {
      params.push(`page=${page}`);
      params.push(`page_size=${pageSize}`);
    } else {
      params.push(`page_size=1000`);
    }
    
    if (search) {
      params.push(`search=${encodeURIComponent(search)}`);
    }
    if (sector) {
      params.push(`activity_sector=${encodeURIComponent(sector)}`);
    }
    if (status) {
      params.push(`partner_status=${encodeURIComponent(status)}`);
    }
    if (orgType) {
      params.push(`organisation_type=${encodeURIComponent(orgType)}`);
    }
    
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    const response = await axios.get(url);
    
    if (returnFullResponse) {
      return response.data;
    }
    
    return response?.data?.results || response?.data || [];
  } catch (error) {
    logger.error('[Organisation] Erreur récupération organisations:', error?.response?.status, error?.response?.data);
    throw error;
  }
};

/**
 * Récupère les statistiques des organisations
 * @returns {Promise<Object>} Statistiques
 */
export const getOrganisationStatsService = async () => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const url = `${API_URL_BASE}/MapApi/organisations/stats/`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    logger.error('[Organisation] Erreur récupération statistiques:', error?.response?.status, error?.response?.data);
    throw error;
  }
};
/**
 * creer une organisation
 * @returns {Promise<Array>} Liste des organisations
 */
export const createOrganisationService = async (data) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const hasFile = data.logo instanceof File || data.logo instanceof Blob;

    let payload;
    let headers = {};

    if (hasFile) {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        if (key === 'logo') {
          formData.append('logo', data.logo);
        } else if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
          formData.append(key, data[key]);
        }
      });
      payload = formData;
      headers['Content-Type'] = 'multipart/form-data';
    } else {
      const cleanData = {};
      Object.keys(data).forEach((key) => {
        if (key === 'logo') {
          if (data.logo === null) {
            cleanData.logo = null;
          }
        } else if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      payload = cleanData;
      headers['Content-Type'] = 'application/json';
    }

    const response = await axios.post(
      `${API_URL_BASE}/MapApi/organisations/`,
      payload,
      { headers }
    );

    return response?.data?.results || response?.data || [];
  } catch (error) {
    logger.error('[Organisation] Erreur creer organisations:', error?.response?.status, error?.response?.data);
    throw error;
  }
};

/**
 * creer une organisation
 * @returns {Promise<Array>} Liste des organisations
 */
export const deleteOrganisationService = async (id) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.delete(`${API_URL_BASE}/MapApi/organisations/${id}/`);

    return response?.data?.results || response?.data || [];
  } catch (error) {
    logger.error('[Organisation] Erreur supprimer organisations:', error?.response?.status, error?.response?.data);
    throw error;
  }
};

/**
 * modifier une organisation
 * @returns {Promise<Array>} Liste des organisations
 */
export const updateOrganisationService = async (id, data) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const hasFile = data.logo instanceof File || data.logo instanceof Blob;

    let payload;
    let headers = {};

    if (hasFile) {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        if (key === 'logo') {
          formData.append('logo', data.logo);
        } else if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
          formData.append(key, data[key]);
        }
      });
      payload = formData;
      headers['Content-Type'] = 'multipart/form-data';
    } else {
      const cleanData = {};
      Object.keys(data).forEach((key) => {
        if (key === 'logo') {
          if (data.logo === null) {
            cleanData.logo = null;
          }
        } else if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      payload = cleanData;
      headers['Content-Type'] = 'application/json';
    }

    const response = await axios.put(
      `${API_URL_BASE}/MapApi/organisations/${id}/`,
      payload,
      { headers }
    );

    return response?.data?.results || response?.data || [];
  } catch (error) {
    logger.error('[Organisation] Erreur modifier organisations:', error?.response?.status, error?.response?.data);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────
// MEMBRES
// ─────────────────────────────────────────────────────────

/**
 * Lister les membres d'une organisation
 * GET /MapApi/organisations/<org_id>/members/
 * @param {number|string} orgId
 * @returns {Promise<Array>}
 */
export const listMembersService = async (orgId) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(`${API_URL_BASE}/MapApi/organisations/${orgId}/members/`);
    return response?.data?.results || response?.data || [];
  } catch (error) {
    logger.error('[Organisation] Erreur liste membres:', error?.response?.status, error?.response?.data);
    throw error;
  }
};

/**
 * Ajouter un membre à une organisation
 * POST /MapApi/organisations/<org_id>/members/add/
 * @param {number|string} orgId
 * @param {{ user_id: number, org_role: string }} data
 * @returns {Promise<Object>}
 */
export const addMemberService = async (orgId, data) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.post(`${API_URL_BASE}/MapApi/organisations/${orgId}/members/add/`, data);
    return response?.data || {};
  } catch (error) {
    logger.error('[Organisation] Erreur ajout membre:', error?.response?.status, error?.response?.data);
    throw error;
  }
};

/**
 * Modifier le rôle d'un membre
 * PUT /MapApi/organisations/<org_id>/members/<user_id>/
 * @param {number|string} orgId
 * @param {number|string} userId
 * @param {{ org_role: string }} data
 * @returns {Promise<Object>}
 */
export const updateMemberService = async (orgId, userId, data) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.put(`${API_URL_BASE}/MapApi/organisations/${orgId}/members/${userId}/`, data);
    return response?.data || {};
  } catch (error) {
    logger.error('[Organisation] Erreur mise à jour membre:', error?.response?.status, error?.response?.data);
    throw error;
  }
};

/**
 * Retirer un membre d'une organisation
 * DELETE /MapApi/organisations/<org_id>/members/<user_id>/
 * @param {number|string} orgId
 * @param {number|string} userId
 * @returns {Promise<Object>}
 */
export const removeMemberService = async (orgId, userId) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.delete(`${API_URL_BASE}/MapApi/organisations/${orgId}/members/${userId}/`);
    return response?.data || {};
  } catch (error) {
    logger.error('[Organisation] Erreur suppression membre:', error?.response?.status, error?.response?.data);
    throw error;
  }
};

/**
 * Récupère une organisation spécifique par son ID
 * @param {number} id - ID de l'organisation
 * @returns {Promise<Object>} Détails de l'organisation
 */
export const getOrganisationService = async (id) => {
  try {
    const axios = authService.createAuthenticatedAxios();
    const response = await axios.get(`${API_URL_BASE}/MapApi/organisations/${id}`);

    return response.data;
  } catch (error) {
    logger.error('[Organisation] Erreur récupération organisation:', error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Filtre les organisations par type d'utilisateur
 * @param {Array} organisations - Liste des organisations
 * @param {string} userType - Type d'utilisateur (ex: 'citizen', 'organization', etc.)
 * @returns {Array} Organisations filtrées
 */
export const filterOrganisationsByType = (organisations, userType) => {
  if (!userType) return organisations;
  return organisations.filter(org => org.user_type === userType);
};

/**
 * Formate les données d'une organisation pour l'affichage
 * @param {Object} organisation - Données brutes de l'organisation
 * @returns {Object} Organisation formatée
 */
export const formatOrganisation = (organisation) => {
  if (!organisation) return null;

  // Créer les initiales à partir du nom de l'organisation
  const nameWords = organisation.name?.split(' ') || [];
  const initials = nameWords.length >= 2
    ? `${nameWords[0].charAt(0)}${nameWords[1].charAt(0)}`.toUpperCase()
    : organisation.name?.substring(0, 2).toUpperCase() || '??';

  return {
    id: organisation.id,
    name: organisation.name,
    initials: initials,
    subdomain: organisation.subdomain,
    logo: organisation.logo_url,
    isPremium: organisation.is_premium,
    membersCount: organisation.members_count,
    primaryColor: organisation.primary_color || AVATAR_COULEUR_DEFAUT,
    secondaryColor: organisation.secondary_color || '#22C55E',
    backgroundColor: organisation.background_color || '#F0F0F0',
    createdAt: organisation.created_at,
    // Couleur pour l'avatar (utilise primary_color si disponible, sinon basée sur l'ID)
    color: organisation.primary_color || getColorFromId(organisation.id)
  };
};

/**
 * Génère une couleur basée sur l'ID
 * @param {number} id - ID de l'organisation
 * @returns {string} Code couleur hexadécimal
 */
// Cette fonction portait sa propre liste de neuf couleurs, presque la meme que
// la palette d'avatars mais pas tout a fait : ordre different et une teinte en
// moins. Deux organisations pouvaient donc recevoir la meme pastille a un
// endroit et deux differentes ailleurs. Une seule liste desormais.
const getColorFromId = (id) => couleurAvatarPour(id);

export default {
  getOrganisationsService,
  createOrganisationService,
  deleteOrganisationService,
  getOrganisationService,
  listMembersService,
  addMemberService,
  updateMemberService,
  removeMemberService,
  filterOrganisationsByType,
  formatOrganisation,
};
