import { useState } from 'react';
import { getRoleConfig } from '../roles';

const initiales = (nom = '') =>
  nom.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || '').join('') || '?';

/**
 * Une URL d'avatar n'est exploitable que si elle pointe vers un fichier.
 * L'API renvoie parfois l'URL de l'endpoint lui-même
 * (« …/MapApi/agents/ »), qui ne charge évidemment aucune image : on écarte
 * ces valeurs avant même de tenter le rendu, plutôt que d'afficher une icône
 * cassée le temps que l'erreur remonte.
 */
const avatarExploitable = (url) => {
  if (!url || typeof url !== 'string') return false;
  if (url.endsWith('/')) return false;
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url) || url.startsWith('data:image/');
};

/** Photo de l'agent, sinon ses initiales sur sa couleur. */
export const AvatarAgent = ({ agent, taille = 38 }) => {
  const [echecImage, setEchecImage] = useState(false);
  const afficherImage = avatarExploitable(agent.avatar) && !echecImage;

  return (
    <span
      className="ag-avatar"
      style={{
        width: taille,
        height: taille,
        fontSize: Math.round(taille * 0.34),
        backgroundColor: afficherImage ? 'transparent' : agent.avatarColor,
      }}
    >
      {afficherImage
        ? <img src={agent.avatar} alt="" onError={() => setEchecImage(true)} />
        : <span aria-hidden="true">{initiales(agent.fullName)}</span>}
    </span>
  );
};

export const RoleAgent = ({ role }) => (
  <span className={`ag-role is-${role}`}>{getRoleConfig(role).label}</span>
);

export default AvatarAgent;
