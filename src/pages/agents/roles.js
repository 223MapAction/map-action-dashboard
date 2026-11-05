import { ROLES } from './data/agents';

export { ROLES };

export const getRoleConfig = (roleId) =>
  ROLES.find((r) => r.id === roleId) || { id: roleId, label: roleId, onglet: roleId };

/** Rôle de la page (`terrain`…) à partir de l'`org_role` du serveur. */
export const roleDepuisApi = (orgRole) => ROLES.find((r) => r.api === orgRole)?.id || 'bureau';

/** `org_role` du serveur à partir du rôle de la page. */
export const roleVersApi = (role) => ROLES.find((r) => r.id === role)?.api || 'bureau_agent';
