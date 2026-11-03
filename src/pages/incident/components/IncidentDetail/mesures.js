// Mise en forme des valeurs chiffrées des fiches signalement et collaboration.

export const nombre = (v, decimales = 0) => {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || Number.isNaN(n)) return null;
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
};

export const niveauScore = (score) => {
  const s = Number(score);
  if (Number.isNaN(s)) return { libelle: 'non évalué', couleur: 'var(--color-border)' };
  if (s >= 7) return { libelle: 'élevé', couleur: 'var(--color-severity-high)' };
  if (s >= 4) return { libelle: 'modéré', couleur: 'var(--color-severity-medium)' };
  return { libelle: 'faible', couleur: 'var(--color-severity-low)' };
};
