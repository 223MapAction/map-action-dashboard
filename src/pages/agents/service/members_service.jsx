import { authService } from '../../auth/services/authService';
import { API_URL_BASE } from '../../../config/api_url_base';
import { logger } from '../../../utils/logger';

/**
 * Récupère tous les membres d'une organisation avec filtrage
 * @param {number|string} organisationId - ID de l'organisation
 * @param {string} search - Recherche textuelle
 * @param {string} role - Rôle filtré (admin|bureau|terrain)
 * @param {string} status - Statut filtré (active|inactive)
 * @returns {Promise<Object|Array>} Réponse paginée ou liste des membres
 */
export const getOrganisationMembersService = async (organisationId, search = '', role = '', status = '') => {
    try {
        const axios = authService.createAuthenticatedAxios();

        const params = {};
        if (search) params.search = search;
        if (role) {
            let backendRole = role;
            if (role === 'admin') backendRole = 'org_admin';
            if (role === 'bureau') backendRole = 'bureau_agent';
            if (role === 'terrain') backendRole = 'field_agent';
            params.role = backendRole;
        }
        if (status) {
            params.status = status;
        }

        const url = organisationId
            ? `${API_URL_BASE}/MapApi/organisations/${organisationId}/members/`
            : `${API_URL_BASE}/MapApi/agents/`;

        const response = await axios.get(
            url,
            { params }
        );
        return response.data;
    } catch (error) {
        logger.error('[Members] Erreur récupération membres:', error?.response?.status, error?.response?.data);
        throw error;
    }
};

/**
 * Récupère TOUS les agents correspondant aux filtres.
 *
 * La page découpe elle-même la liste en pages : si l'API pagine sa réponse
 * (`next`), on suit les pages jusqu'au bout, sinon seuls les premiers agents
 * s'afficheraient sans qu'aucun message ne le signale.
 */
export const getTousLesAgentsService = async (search = '', role = '', status = '', organisationId = null) => {
    const premiere = await getOrganisationMembersService(organisationId, search, role, status);
    if (Array.isArray(premiere)) return premiere;

    const membres = [...(premiere?.results || [])];
    let suivante = premiere?.next;
    const axios = authService.createAuthenticatedAxios();
    while (suivante) {
        const { data } = await axios.get(suivante);
        membres.push(...(data?.results || []));
        suivante = data?.next;
    }
    return membres;
};

/**
 * Récupère les statistiques des agents de la plateforme
 * @returns {Promise<Object>} Statistiques {total, active, admins, bureau_agents, field_agents}
 */
export const getAgentsStatsService = async () => {
    try {
        const axios = authService.createAuthenticatedAxios();
        const response = await axios.get(`${API_URL_BASE}/MapApi/agents/stats/`);
        return response.data;
    } catch (error) {
        logger.error('[Members] Erreur récupération stats agents:', error?.response?.status, error?.response?.data);
        throw error;
    }
};

/**
 * Crée un nouvel agent de terrain dans une organisation
 * @param {number|string} organisationId - ID de l'organisation
 * @param {Object} agentData - Données de l'agent à créer
 * @returns {Promise<Object>} Agent créé
 */
export const createOrganisationAgentService = async (organisationId, agentData) => {
    try {
        const axios = authService.createAuthenticatedAxios();
        const response = await axios.post(
            `${API_URL_BASE}/MapApi/organisations/${organisationId}/agents/create/`,
            agentData,
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error) {
        logger.error('[Members] Erreur création agent:', error?.response?.status, error?.response?.data);
        throw error;
    }
};

/**
 * Ajoute un membre existant à une organisation
 * @param {number|string} organisationId - ID de l'organisation
 * @param {Object} data - Données { user_id, org_role }
 * @returns {Promise<Object>}
 */
export const addOrganisationStaffMemberService = async (organisationId, data) => {
    try {
        const axios = authService.createAuthenticatedAxios();
        const response = await axios.post(
            `${API_URL_BASE}/MapApi/organisations/${organisationId}/staff/create/`,
            data,
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error) {
        logger.error('[Members] Erreur ajout staff:', error?.response?.status, error?.response?.data);
        throw error;
    }
};

/**
 * Modifie le rôle d'un membre
 * @param {number|string} organisationId - ID de l'organisation
 * @param {number|string} userId - ID de l'utilisateur
 * @param {Object} data - Données { org_role }
 * @returns {Promise<Object>}
 */
export const updateOrganisationMemberService = async (organisationId, userId, data) => {
    try {
        const axios = authService.createAuthenticatedAxios();
        const response = await axios.patch(
            `${API_URL_BASE}/MapApi/organisations/${organisationId}/members/${userId}/`,
            data,
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error) {
        logger.error('[Members] Erreur mise à jour membre:', error?.response?.status, error?.response?.data);
        throw error;
    }
};

/**
 * Retire un membre d'une organisation
 * @param {number|string} organisationId - ID de l'organisation
 * @param {number|string} userId - ID de l'utilisateur
 * @returns {Promise<Object>}
 */
export const removeOrganisationMemberService = async (organisationId, userId) => {
    try {
        const axios = authService.createAuthenticatedAxios();
        const response = await axios.delete(
            `${API_URL_BASE}/MapApi/organisations/${organisationId}/members/${userId}/`
        );
      
        return response.data;
    } catch (error) {
        logger.error('[Members] Erreur retrait membre:', error?.response?.status, error?.response?.data);
        throw error;
    }
};
