/**
 * Lecture des réponses de /impact/ et /impact/incidents/.
 *
 * L'API a connu deux nommages (anglais, puis français dans d'anciennes
 * réponses) : chaque valeur est cherchée dans les deux. Une valeur absente
 * reste `null` — jamais un zéro ni une estimation inventée — pour que la page
 * puisse dire « non fourni » au lieu d'afficher un chiffre que personne n'a
 * calculé.
 */
import { gravite, libelleGravite } from '../../utils/gravite';
import { getRoleConfig, roleDepuisApi } from '../agents/roles';

/** Types de structures sensibles, dans l'ordre d'affichage. */
export const STRUCTURES = [
  { cle: 'schools', libelle: 'Écoles' },
  { cle: 'water_points', libelle: 'Points d’eau' },
  { cle: 'markets', libelle: 'Marchés' },
  { cle: 'health_centers', libelle: 'Centres de santé' },
  { cle: 'maternities', libelle: 'Maternités' },
  { cle: 'nurseries', libelle: 'Crèches' },
  { cle: 'main_roads_bridges', libelle: 'Routes et ponts' },
  { cle: 'residential_buildings', libelle: 'Bâtiments' },
];

const nombre = (...valeurs) => {
  for (const v of valeurs) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Hommes, femmes, enfants et leur part réelle — ou null si l'API ne les donne pas. */
const cohortes = (objet) => {
  const hommes = nombre(objet?.men, objet?.hommes);
  const femmes = nombre(objet?.women, objet?.femmes);
  const enfants = nombre(objet?.children, objet?.enfants);
  if (hommes === null && femmes === null && enfants === null) return null;
  const valeurs = { hommes: hommes ?? 0, femmes: femmes ?? 0, enfants: enfants ?? 0 };
  const somme = valeurs.hommes + valeurs.femmes + valeurs.enfants;
  const part = (v) => (somme > 0 ? Math.round((v / somme) * 100) : 0);
  return {
    ...valeurs,
    parts: { hommes: part(valeurs.hommes), femmes: part(valeurs.femmes), enfants: part(valeurs.enfants) },
  };
};

/** Structures non nulles, dans l'ordre de STRUCTURES. */
export const structuresNonNulles = (parType) =>
  STRUCTURES
    .map((s) => ({ ...s, n: nombre(parType?.[s.cle]) ?? 0 }))
    .filter((s) => s.n > 0);

/**
 * Chiffres d'ensemble de la page.
 * @param {Object} G réponse de /impact/
 * @param {boolean} estSuperAdmin
 */
export const lireGlobal = (G, estSuperAdmin) => {
  const direct = G?.beneficiaries?.direct ?? G?.beneficiaires_directs ?? {};
  const indirect = G?.beneficiaries?.indirect ?? G?.beneficiaires_indirects ?? {};
  const resolution = G?.resolution ?? {};
  const mobilisation = G?.mobilization ?? G?.mobilisation ?? {};
  const citoyens = G?.citizen_contribution ?? G?.contribution_citoyenne ?? {};
  const parType = G?.infrastructure_protected?.by_type ?? G?.infrastructures_detail ?? {};

  const dansLePerimetre = nombre(G?.filters?.incidents_in_scope);
  const avecPrediction = nombre(G?.filters?.incidents_with_prediction);
  const sansAnalyse = dansLePerimetre !== null && avecPrediction !== null
    ? Math.max(0, dansLePerimetre - avecPrediction)
    : nombre(G?.incidents_sans_analyse);

  const donneesPlateforme = Boolean(G?.resolution || G?.mobilization || G?.mobilisation
    || G?.citizen_contribution || G?.contribution_citoyenne);

  return {
    directs: { total: nombre(direct.total) ?? 0, cohortes: cohortes(direct) },
    indirects: { total: nombre(indirect.total) ?? 0, cohortes: cohortes(indirect) },
    superficieHa: nombre(G?.cumulative_impact_area_ha, G?.superficie_ha) ?? 0,
    structures: {
      total: nombre(G?.infrastructure_protected?.total, G?.infrastructures_total) ?? 0,
      parType: structuresNonNulles(parType),
    },
    plateforme: estSuperAdmin && (G?.filters?.scope === 'platform' || donneesPlateforme),
    sansAnalyse,
    resolution: {
      joursMoyens: nombre(resolution.avg_resolution_days, G?.temps_moyen_resolution),
      taux: nombre(resolution.resolution_rate?.percentage, G?.taux_resolution),
    },
    mobilisation: {
      organisations: nombre(mobilisation.organisations_involved, mobilisation.organisations_distinctes) ?? 0,
      agents: nombre(mobilisation.field_agents_mobilized, mobilisation.agents_terrain) ?? 0,
      collaborations: nombre(mobilisation.collaborations_created, mobilisation.collaborations) ?? 0,
      enCollaboration: nombre(mobilisation.incidents_collaborative) ?? 0,
      seuls: nombre(mobilisation.incidents_individual) ?? 0,
    },
    citoyens: {
      recus: nombre(citoyens.reports_received, citoyens.signalements_recus) ?? 0,
      verifies: nombre(citoyens.reports_verified, citoyens.signalements_verifies) ?? 0,
      actions: nombre(citoyens.reports_led_to_action, citoyens.transformes_actions) ?? 0,
      actifs: nombre(citoyens.active_citizen_contributors),
    },
  };
};

/** « 12,6392° N, 7,9921° O » : le point cardinal suit le signe. */
export const coordonneesLisibles = (lat, lng) => {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || (la === 0 && lo === 0)) return null;
  const f = (v) => Math.abs(v).toFixed(4).replace('.', ',');
  return `${f(la)}° ${la >= 0 ? 'N' : 'S'}, ${f(lo)}° ${lo >= 0 ? 'E' : 'O'}`;
};

const ETATS_TACHE = {
  done: { libelle: 'Terminée', classe: 'is-ok' },
  failed: { libelle: 'Échouée', classe: 'is-ko' },
  in_progress: { libelle: 'En cours', classe: 'is-cours' },
};

const RELATIONS = { leader: 'chef de file', assigned: 'assignée' };

const libelleRole = (role) => {
  if (!role) return '';
  const id = roleDepuisApi(role);
  // roleDepuisApi replie tout rôle inconnu sur « bureau » : on ne traduit
  // donc que les valeurs qu'il connaît vraiment.
  return ['field_agent', 'bureau_agent', 'org_admin'].includes(role)
    ? getRoleConfig(id).label.toLowerCase()
    : String(role);
};

/** Un signalement de /impact/incidents/, prêt à afficher. */
export const lireSignalement = (inc) => {
  const pred = inc.prediction || null;
  const lat = Number(inc.lattitude ?? inc.latitude);
  const lng = Number(inc.longitude);
  const aCoordonnees = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

  const directs = pred ? nombre(pred.direct?.total_population_exposed, pred.total_population_exposed) : null;
  const indirects = pred ? nombre(pred.indirect?.total_population_exposed, pred.potential_risk?.stats?.total_pop) : null;
  const vecteurs = Array.isArray(pred?.spread_vectors) && pred.spread_vectors.length
    ? pred.spread_vectors.join(', ')
    : (pred?.potential_risk?.vector || null);

  const structureDe = (cle) => {
    if (!pred) return 0;
    if (cle === 'maternities') return nombre(pred.infrastructure?.maternities, pred.maternities_count, pred.maternities) ?? 0;
    if (cle === 'nurseries') return nombre(pred.infrastructure?.nurseries, pred.nurseries_count, pred.nurseries) ?? 0;
    if (cle === 'health_centers') return nombre(pred.infrastructure?.health_centers, pred.health_centers) ?? 0;
    return nombre(pred.infrastructure?.[cle], pred[cle], pred.social_data?.[cle]) ?? 0;
  };

  // Agents : ceux à qui une tâche a été confiée, une seule fois chacun.
  const agents = new Map();
  (inc.tasks || []).forEach((t) => {
    if (!t.assigned_to) return;
    const nom = typeof t.assigned_to === 'object'
      ? `${t.assigned_to.first_name || ''} ${t.assigned_to.last_name || ''}`.trim()
      : String(t.assigned_to);
    if (nom && !agents.has(nom)) agents.set(nom, libelleRole(t.assigned_to_role));
  });

  const niveau = gravite(inc, pred);
  return {
    id: inc.id,
    titre: inc.title || 'Signalement sans titre',
    description: inc.description || '',
    zone: inc.zone || '',
    coordonnees: aCoordonnees ? coordonneesLisibles(lat, lng) : null,
    lat: aCoordonnees ? lat : null,
    lng: aCoordonnees ? lng : null,
    photo: inc.photo || inc.photo_url || inc.image || inc.incident_details?.photo || '',
    niveau,
    libelleNiveau: libelleGravite(niveau),
    signaleLe: inc.created_at || null,
    resoluLe: inc.resolution_end_date || null,
    analyse: Boolean(pred),
    directs,
    indirects,
    rayon: pred ? nombre(pred.impact_radius_meters) : null,
    detailDirects: pred ? {
      exposes: directs,
      hommes: nombre(pred.direct?.adult_men_exposed, pred.adult_men_exposed),
      femmes: nombre(pred.direct?.adult_women_exposed, pred.adult_women_exposed),
      enfants: nombre(pred.direct?.children_exposed, pred.children_exposed),
    } : null,
    zoneRisque: pred ? {
      population: indirects,
      vecteurs,
      batiments: nombre(pred.indirect?.residential_buildings, pred.potential_risk?.stats?.infrastructures),
    } : null,
    structures: STRUCTURES.map((s) => ({ ...s, n: structureDe(s.cle) })).filter((s) => s.n > 0),
    organisations: (inc.collaborating_organisations || []).map((o) => ({
      nom: o.name,
      relation: RELATIONS[o.relation] || 'collaboratrice',
    })),
    agents: [...agents].map(([nom, role]) => ({ nom, role })),
    taches: (inc.tasks || []).map((t) => ({
      id: t.id,
      titre: t.title || 'Tâche sans titre',
      description: t.description || '',
      echeance: t.end_date || null,
      etat: ETATS_TACHE[t.state] || { libelle: 'En attente', classe: 'is-attente' },
    })),
  };
};
