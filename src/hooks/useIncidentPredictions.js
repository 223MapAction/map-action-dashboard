import { useMemo } from 'react';
import useSWR from 'swr';
import { getIncidentPredictionService } from '../pages/incident/service/incident_service';

/**
 * Charge en parallèle les prédictions IA (contenant `global_impact_score`)
 * pour une liste d'incidents, avec mise en cache SWR partagée.
 *
 * @param {Array<Object|number|string>} incidents - Liste d'incidents ou d'IDs
 * @returns {Record<string|number, Object|null>} Dictionnaire { [incidentId]: prediction }
 */
export const useIncidentPredictions = (incidents = []) => {
  const ids = useMemo(() => {
    const liste = Array.isArray(incidents) ? incidents : incidents ? [incidents] : [];
    const uniques = new Set();
    liste.forEach((item) => {
      const id = typeof item === 'object' && item !== null ? item.id : item;
      if (id !== undefined && id !== null && id !== '') {
        uniques.add(id);
      }
    });
    return Array.from(uniques);
  }, [incidents]);

  const cle = ids.length ? ['incident-predictions-batch', ids.slice().sort().join(',')] : null;

  const { data: predictionsMap = {} } = useSWR(
    cle,
    async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const data = await getIncidentPredictionService(id);
            const pred = Array.isArray(data) && data.length > 0 ? data[0] : (data || null);
            return [id, pred];
          } catch {
            return [id, null];
          }
        })
      );
      return Object.fromEntries(entries);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 120000,
    }
  );

  return predictionsMap;
};

/**
 * Charge la prédiction IA d'un incident unique.
 *
 * @param {number|string|null} incidentId
 * @returns {Object|null}
 */
export const useIncidentPrediction = (incidentId) => {
  const map = useIncidentPredictions(incidentId ? [incidentId] : []);
  return incidentId ? map[incidentId] || null : null;
};

export default useIncidentPredictions;

