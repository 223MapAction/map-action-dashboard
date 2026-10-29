// Dates des formulaires de tâches et de résolution.
//
// Les champs <input type="date"> parlent en « AAAA-MM-JJ » local. Passer par
// toISOString() décalerait d'un jour à l'ouest de Greenwich : on construit donc
// la chaîne à la main, depuis l'heure locale.

const versChaine = (d) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
};

const depuisChaine = (s) => {
  const [a, m, j] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, j);
};

export const aujourdhui = () => versChaine(new Date());

export const ajouterJours = (s, n) => {
  const d = depuisChaine(s);
  d.setDate(d.getDate() + n);
  return versChaine(d);
};

export const lendemain = (s) => ajouterJours(s, 1);

/** Nombre de jours entre deux dates, ou null si l'une manque. */
export const ecartJours = (debut, fin) => {
  if (!debut || !fin) return null;
  return Math.round((depuisChaine(fin) - depuisChaine(debut)) / 86400000);
};

export const dateCourte = (s) =>
  s ? depuisChaine(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';

export const libelleDuree = (n) => {
  if (n === 7) return '1 semaine';
  if (n === 14) return '2 semaines';
  return `${n} jour${n > 1 ? 's' : ''}`;
};

/** Première et dernière date d'une liste de tâches, au format des champs date. */
export const bornesTaches = (taches) => {
  const debuts = taches.map((t) => t.start_date || t.created_at).filter(Boolean).map((s) => String(s).slice(0, 10));
  const fins = taches.map((t) => t.updated_at || t.end_date || t.completedAt).filter(Boolean).map((s) => String(s).slice(0, 10));
  const tri = (l) => [...l].sort();
  return {
    debut: debuts.length ? tri(debuts)[0] : '',
    fin: fins.length ? tri(fins)[fins.length - 1] : '',
  };
};

/** « Jeu. 30 oct. », ou « Jeu. 2 oct. 2026 » avec l'année. */
export const dateLongue = (s, avecAnnee = false) => {
  if (!s) return '';
  const texte = depuisChaine(s).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', ...(avecAnnee ? { year: 'numeric' } : {}),
  });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};
