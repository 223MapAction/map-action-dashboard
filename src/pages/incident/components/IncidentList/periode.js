/*
 * Dates du filtre par période. Les valeurs échangées avec l'API sont en
 * YYYY-MM-DD, en heure locale (pas toISOString, qui décale d'un jour en
 * fuseau positif).
 */

export const versIso = (d) => (d
  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  : '');

export const depuisIso = (s) => {
  if (!s) return null;
  const [a, m, j] = s.split('-').map(Number);
  return new Date(a, m - 1, j);
};

export const ajouterJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const memeJour = (a, b) => Boolean(a && b && versIso(a) === versIso(b));
export const court = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const complet = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const debutMois = (d, decalage = 0) => new Date(d.getFullYear(), d.getMonth() + decalage, 1);
export const aujourdhui = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

export const raccourcis = (auj) => [
  { id: 'auj', nom: 'Aujourd’hui', plage: [auj, auj] },
  { id: 'hier', nom: 'Hier', plage: [ajouterJours(auj, -1), ajouterJours(auj, -1)] },
  { id: '7j', nom: '7 derniers jours', plage: [ajouterJours(auj, -6), auj] },
  { id: '30j', nom: '30 derniers jours', plage: [ajouterJours(auj, -29), auj] },
  { id: 'mois', nom: 'Ce mois-ci', plage: [debutMois(auj), auj] },
  { id: 'mois-1', nom: 'Mois dernier', plage: [debutMois(auj, -1), new Date(auj.getFullYear(), auj.getMonth(), 0)] },
];

/** Texte d'une période appliquée : nom du raccourci, jour seul ou plage. */
export const libellePeriode = (valeur) => {
  const a = depuisIso(valeur?.debut);
  const b = depuisIso(valeur?.fin);
  if (!a || !b) return 'Toutes les dates';
  const r = raccourcis(aujourdhui()).find(({ plage: [x, y] }) => memeJour(x, a) && memeJour(y, b));
  if (r) return r.nom;
  return memeJour(a, b) ? complet(a) : `${court(a)} → ${complet(b)}`;
};
