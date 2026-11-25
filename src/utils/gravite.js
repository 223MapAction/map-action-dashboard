/**
 * Échelle de gravité — source unique côté frontend.
 *
 * ── SOURCE PRINCIPALE : global_impact_score ──────────────────────────────────
 * Le champ `global_impact_score` (0–10), présent au niveau des détails d'un
 * incident (ou de sa prédiction IA), est la métrique de référence pour
 * déterminer le niveau de gravité :
 *
 *   De 0 à 3   → Faible  ('low')
 *   De 4 à 6   → Moyenne ('medium') (ex. 5.36)
 *   De 7 à 10  → Élevée  ('high')
 *
 * Ordre de priorité des sources :
 *   1. `global_impact_score` (de la prédiction ou des détails de l'incident) ;
 *   2. `base_severity` (repli numérique 0–10 si le score global n'est pas fourni) ;
 *   3. `severity` texte du serveur ('high' | 'medium' | 'low') ;
 *   4. `badges` (dernier recours pour les anciennes charges utiles).
 */

/**
 * Du plus grave au moins grave. L'ORDRE FAIT PARTIE DU CONTRAT : les légendes
 * et les listes bouclent dessus, et c'est lui qui garantit qu'aucune vue ne
 * peut présenter les niveaux dans un ordre différent d'une autre.
 */
export const NIVEAUX_GRAVITE = [
  { cle: 'high', libelle: 'Élevée', min: 7 },
  { cle: 'medium', libelle: 'Moyenne', min: 4 },
  { cle: 'low', libelle: 'Faible', min: 0 }
];

export const CLES_GRAVITE = NIVEAUX_GRAVITE.map((n) => n.cle);

/** Le palier le moins grave : le repli quand rien n'est exploitable. */
const CLE_PAR_DEFAUT = 'low';

const LIBELLES = Object.fromEntries(NIVEAUX_GRAVITE.map((n) => [n.cle, n.libelle]));

/** Libellé affichable d'un niveau, ou tiret si la clé est inconnue. */
export const libelleGravite = (cle) => LIBELLES[cle] ?? '—';

/**
 * Variables CSS d'un niveau. Passer par cette fonction plutôt que d'écrire
 * `var(--color-severity-${cle})` à la main garde le nommage des jetons
 * modifiable depuis un seul endroit.
 */
export const couleurGravite = (cle) => `var(--color-severity-${cle})`;
export const couleurTexteGravite = (cle) => `var(--color-severity-${cle}-text)`;

/**
 * Extrait le score d'impact global (0 à 10) d'un incident ou de sa prédiction.
 * Cherche récursivement dans les différentes structures renvoyées par l'API.
 *
 * @param {Object} incident
 * @param {Object} [prediction]
 * @returns {number|null}
 */
export const extraireScoreImpact = (incident, prediction = null) => {
  if (!incident && !prediction) return null;

  // 1. Prédiction passée en paramètre
  const pred = Array.isArray(prediction) && prediction.length > 0 ? prediction[0] : prediction;
  if (pred?.global_impact_score !== undefined && pred?.global_impact_score !== null && pred?.global_impact_score !== '') {
    const val = parseFloat(pred.global_impact_score);
    if (!Number.isNaN(val)) return val;
  }

  // 2. Chercher dans l'incident sous toutes les structures possibles
  const cibles = [
    incident?.global_impact_score,
    incident?.incident_details?.prediction_details?.global_impact_score,
    incident?.incident_details?.global_impact_score,
    incident?.incident_details?.prediction?.global_impact_score,
    incident?.prediction_details?.global_impact_score,
    Array.isArray(incident?.prediction_details) ? incident.prediction_details[0]?.global_impact_score : undefined,
    incident?.prediction?.global_impact_score,
    Array.isArray(incident?.prediction) ? incident.prediction[0]?.global_impact_score : undefined,
    incident?.predictions?.[0]?.global_impact_score,
    incident?.details?.prediction_details?.global_impact_score,
    incident?.details?.global_impact_score,
    incident?.predictionDetails?.global_impact_score,
    incident?.incidentDetails?.predictionDetails?.global_impact_score,
    incident?.incident_prediction?.global_impact_score,
    incident?.incident_predictions?.[0]?.global_impact_score,
    incident?.aiAnalysis?.global_impact_score,
    incident?.ai_analysis?.global_impact_score,
  ];

  for (const c of cibles) {
    if (c !== undefined && c !== null && c !== '') {
      const val = parseFloat(c);
      if (!Number.isNaN(val)) return val;
    }
  }

  return null;
};

/**
 * Convertit un score d'impact (0 à 10) en niveau de gravité :
 *   - De 0 à 3   → 'low' (Faible)
 *   - De 4 à 6   → 'medium' (Moyenne)
 *   - De 7 à 10  → 'high' (Élevée)
 *
 * @param {number|string} score
 * @returns {'high'|'medium'|'low'|null}
 */
export const scoreVersNiveau = (score) => {
  if (score === null || score === undefined || score === '') return null;
  const s = parseFloat(score);
  if (Number.isNaN(s)) return null;
  if (s >= 7) return 'high';
  if (s >= 4) return 'medium';
  return 'low';
};

/**
 * Lit le niveau de gravité d'un incident.
 *
 * Sources dans l'ordre de priorité :
 *   1. `global_impact_score` (0–10) :
 *        0 à 3  → faible ('low')
 *        4 à 6  → moyenne ('medium') (ex: 5.36)
 *        7 à 10 → élevée ('high')
 *   2. `severity` textuel du backend ('high' | 'medium' | 'low') si pas de global_impact_score ;
 *   3. `base_severity` numérique (0–10) si severity textuel absent ;
 *   4. `badges` (dernier recours).
 *
 * @param {Object} incident
 * @param {Object} [prediction] détails de prédiction
 * @returns {'high'|'medium'|'low'}
 */
export const gravite = (incident, prediction = null) => {
  if (!incident && !prediction) return CLE_PAR_DEFAUT;

  // 1. Priorité absolue : global_impact_score
  const score = extraireScoreImpact(incident, prediction);
  if (score !== null) {
    return scoreVersNiveau(score);
  }

  // 2. Repli : champ severity texte du serveur
  if (incident?.severity && CLES_GRAVITE.includes(incident.severity)) {
    return incident.severity;
  }

  // 3. Repli : base_severity
  const note =
    incident?.base_severity ??
    prediction?.base_severity ??
    incident?.incident_details?.prediction_details?.base_severity ??
    incident?.prediction_details?.base_severity;

  if (note !== undefined && note !== null && note !== '') {
    const valeur = parseFloat(note);
    if (!Number.isNaN(valeur)) {
      return scoreVersNiveau(valeur);
    }
  }

  // 4. Repli : badges
  const badges = (incident?.badges || []).map((b) => b?.variant);
  if (badges.includes('critical') || badges.includes('high') || badges.includes('expert-needed')) return 'high';
  if (badges.includes('in-progress') || badges.includes('medium')) return 'medium';

  return CLE_PAR_DEFAUT;
};

/**
 * Répartition d'une liste d'incidents par niveau.
 * @returns {Object} { high: {count, percentage}, medium: …, low: … }
 */
export const repartitionGravite = (incidents) => {
  const liste = Array.isArray(incidents) ? incidents : [];
  const compteurs = Object.fromEntries(CLES_GRAVITE.map((c) => [c, 0]));

  liste.forEach((inc) => {
    compteurs[gravite(inc)] += 1;
  });

  // Diviser par 0 donnerait NaN% : sur une liste vide, tous les niveaux sont à 0.
  const total = liste.length || 1;

  return Object.fromEntries(
    CLES_GRAVITE.map((c) => [
      c,
      { count: compteurs[c], percentage: Math.round((compteurs[c] / total) * 100) }
    ])
  );
};

/**
 * Lit la répartition renvoyée par l'API (`by_severity`) selon l'échelle.
 *
 * On ne retourne que les niveaux réellement présents dans la réponse, et dans
 * l'ordre de l'échelle : c'est le serveur qui agrège, et une vue qui inventerait
 * un niveau absent afficherait un compte que personne n'a calculé.
 *
 * @returns {Array} [{ cle, libelle, count, percentage }] du plus grave au moins
 */
export const lireRepartitionApi = (parGravite) => {
  if (!parGravite) return [];

  return NIVEAUX_GRAVITE.filter((n) => parGravite[n.cle]).map((n) => ({
    cle: n.cle,
    libelle: n.libelle,
    count: parGravite[n.cle]?.count ?? 0,
    percentage: parGravite[n.cle]?.percentage ?? 0
  }));
};

export default {
  NIVEAUX_GRAVITE,
  CLES_GRAVITE,
  gravite,
  extraireScoreImpact,
  scoreVersNiveau,
  libelleGravite,
  couleurGravite,
  couleurTexteGravite,
  repartitionGravite,
  lireRepartitionApi
};
