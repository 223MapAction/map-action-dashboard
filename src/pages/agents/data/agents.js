// La palette d'avatars est partagee avec les pages signalements et
// interventions : elle vit desormais dans src/utils.
export { AVATAR_COLORS } from '../../../utils/couleursAvatar';

/**
 * Les trois rôles d'un membre d'organisation, dans l'ordre opérationnel :
 * un coordinateur cherche d'abord qui est sur le terrain.
 *
 * `api` est la valeur `org_role` du serveur ; `onglet` le libellé court des
 * onglets et des cartes du formulaire.
 */
export const ROLES = [
  {
    id: 'terrain',
    api: 'field_agent',
    label: 'Agent de terrain',
    onglet: 'Terrain',
    description: 'Application mobile seulement. Se connecte avec son code.',
  },
  {
    id: 'bureau',
    api: 'bureau_agent',
    label: 'Agent de bureau',
    onglet: 'Bureau',
    description: 'Tableau de bord. Suit les signalements et les collaborations.',
  },
  {
    id: 'admin',
    api: 'org_admin',
    label: 'Administrateur',
    onglet: 'Administration',
    description: 'Accès complet, gère l’équipe de l’organisation.',
  },
];
