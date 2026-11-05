// Une prise en charge « en mode collaboratif » reste un événement de
// signalement : seules les demandes, invitations et adhésions relèvent des
// collaborations.
export const categorie = (action = '') => {
  const act = action.toLowerCase();
  if (/demande de collaboration|invit|a rejoint|quitté la collaboration|nouvelle collaboration/.test(act)) {
    return 'collaboration';
  }
  return 'signalement';
};

export const initiales = (nom = '') => {
  const mots = nom.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  return (mots[0][0] + (mots[1]?.[0] ?? '')).toUpperCase();
};

// Avatars d'organisation : une teinte stable par nom, tirée d'une gamme
// sobre (bleus, ardoises, sarcelles). Le rouge, l'orange et le jaune restent
// réservés à la gravité, le vert au « résolu ».
const COULEURS_ORG = ['#1E78AC', '#0E7490', '#475569', '#0F766E', '#334155', '#2B8BC4'];

export const couleurPour = (id, nom = '') => {
  const cle = String(id ?? '') + nom;
  let h = 0;
  for (const c of cle) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COULEURS_ORG[Math.abs(h) % COULEURS_ORG.length];
};

export const tempsRelatif = (date) => {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `Il y a ${heures} h`;
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export const libelleJour = (date) => {
  const debut = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ecart = Math.round((debut(new Date()) - debut(date)) / 86400000);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};
