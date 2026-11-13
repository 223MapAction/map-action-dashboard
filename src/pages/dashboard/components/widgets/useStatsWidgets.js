import { useMemo } from 'react';
import useSWR from 'swr';
import { NIVEAUX_GRAVITE, lireRepartitionApi, couleurGravite, gravite } from '../../../../utils/gravite';
import { getIncidentsFilteredService } from '../../service/dashboard_service';
import { getIncidentService } from '../../../incident/service/incident_service';

const ORDRE_GRAVITE = { high: 0, medium: 1, low: 2, unknown: 3 };

export const tempsRelatif = (iso) => {
  if (!iso) return '';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return 'hier';
  return `il y a ${jours} j`;
};

/** Données des widgets du dashboard, communes au bureau et au mobile. */
export const useStatsWidgets = (stats) => {
  const locationStats = useMemo(() => {
    if (!Array.isArray(stats?.by_zone)) return [];
    const zones = stats.by_zone.map((z) => ({ name: z.name, count: z.count ?? 0 })).slice(0, 5);
    const max = Math.max(...zones.map((z) => z.count), 1);
    return zones.map((z) => ({ ...z, ratio: z.count / max }));
  }, [stats]);

  // Pas de répartition par gravité par localité : by_zone ne donne qu'un total,
  // et la reconstituer coûtait une recherche lourde par localité
  // (/incident/?search=<zone>&page_size=100, plusieurs secondes chacune),
  // plafonnée à 100 lignes et faussée tant que le backend renvoie la même
  // severity pour tous les incidents. Les barres restent d'une seule couleur.
  // À rebrancher quand l'API fournira by_zone[].by_severity.
  const graviteParZone = null;

  // Les signalements encore déclarés (personne ne les a pris), du plus grave au
  // plus ancien. Le classement se fait sur la liste légère de la carte (rapide,
  // cache SWR partagé) ; seuls les 4 affichés sont ensuite lus en détail pour
  // avoir le titre entier, la localité et la vignette.
  const { data: nonResolus } = useSWR(
    ['incident-filter', 'unresolved', 60],
    () => getIncidentsFilteredService({ scope: 'unresolved', page: 1, page_size: 60 }),
    { revalidateOnFocus: false }
  );

  const aTraiter = useMemo(() => {
    const liste = nonResolus?.results || (Array.isArray(nonResolus) ? nonResolus : []);
    return liste
      .filter((i) => (i.etat || 'declared') === 'declared' && !i.is_deleted)
      .map((i) => ({ ...i, _gravite: gravite(i) }))
      .sort((a, b) =>
        ORDRE_GRAVITE[a._gravite] - ORDRE_GRAVITE[b._gravite] ||
        new Date(a.created_at) - new Date(b.created_at)
      );
  }, [nonResolus]);

  const idsAffiches = aTraiter.slice(0, 4).map((i) => i.id);
  const { data: details } = useSWR(
    idsAffiches.length ? ['a-traiter-details', ...idsAffiches] : null,
    async () => {
      const liste = await Promise.all(idsAffiches.map((id) => getIncidentService(id).catch(() => null)));
      return Object.fromEntries(liste.filter(Boolean).map((d) => [d.id, d]));
    },
    { revalidateOnFocus: false }
  );
  const aAfficher = aTraiter.slice(0, 4).map((i) => ({ ...i, ...(details?.[i.id] || {}) }));

  const severityData = useMemo(() => {
    const niveaux = lireRepartitionApi(stats?.by_severity);
    return NIVEAUX_GRAVITE.map(({ cle, libelle }) => {
      const n = niveaux.find((x) => x.cle === cle);
      return { cle, label: libelle, count: n?.count ?? 0, percentage: n?.percentage ?? 0, color: couleurGravite(cle) };
    });
  }, [stats]);

  const totalGravite = severityData.reduce((s, x) => s + x.count, 0);
  const sommePourcent = severityData.reduce((s, x) => s + x.percentage, 0) || 1;

  return { locationStats, graviteParZone, nonResolus, aTraiter, aAfficher, severityData, totalGravite, sommePourcent };
};

export default useStatsWidgets;
