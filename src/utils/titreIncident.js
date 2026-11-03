/**
 * Titre lisible d'un signalement.
 *
 * Le serveur fabrique le titre en coupant le début de la description et en
 * ajoutant « ... » (« Dechet... », « Eaux usée ... »). Quand c'est le cas, la
 * description contient le texte entier : on l'affiche à la place, ramené à sa
 * première ligne.
 */
export const titreIncident = (incident, longueurMax = 140) => {
  const titre = (incident?.title || '').trim();
  const description = (incident?.description || '').trim();
  if (!titre) return description.split('\n')[0].slice(0, longueurMax) || 'Signalement sans titre';

  const racine = titre.replace(/\s*(\.\.\.|…)$/, '').trim();
  const estTronque = racine !== titre;
  if (estTronque && description && description.replace(/\s+/g, ' ').startsWith(racine.replace(/\s+/g, ' '))) {
    const premiereLigne = description.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
    return premiereLigne.length > longueurMax ? `${premiereLigne.slice(0, longueurMax - 1)}…` : premiereLigne;
  }
  return titre;
};

/** Vrai si la description n'apporte rien de plus que le titre affiché. */
export const descriptionRedondante = (incident) => {
  const description = (incident?.description || '').replace(/\s+/g, ' ').trim();
  return !description || description === titreIncident(incident, 10000).replace(/\s+/g, ' ');
};

export default titreIncident;
