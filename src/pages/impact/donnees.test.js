import { describe, it, expect } from 'vitest';
import { lireGlobal, lireSignalement, coordonneesLisibles, structuresNonNulles } from './donnees';

describe('lireGlobal', () => {
  it('n’invente aucune répartition quand l’API ne la donne pas', () => {
    const g = lireGlobal({ beneficiaries: { direct: { total: 10 }, indirect: { total: 300 } } }, false);
    expect(g.indirects.total).toBe(300);
    expect(g.indirects.cohortes).toBeNull();
    expect(g.directs.cohortes).toBeNull();
  });

  it('calcule la vraie part des enfants, pas le reste à 100', () => {
    const g = lireGlobal({ beneficiaries: { direct: { total: 3, men: 1, women: 1, children: 1 } } }, false);
    expect(g.directs.cohortes.parts).toEqual({ hommes: 33, femmes: 33, enfants: 33 });
  });

  it('accepte l’ancien nommage français', () => {
    const g = lireGlobal({ beneficiaires_directs: { total: 5, hommes: 2, femmes: 2, enfants: 1 }, superficie_ha: 4.5 }, false);
    expect(g.directs.cohortes.hommes).toBe(2);
    expect(g.superficieHa).toBe(4.5);
  });

  it('garde un zéro légitime de signalements sans analyse', () => {
    const g = lireGlobal({ filters: { incidents_in_scope: 8, incidents_with_prediction: 8 }, incidents_sans_analyse: 99 }, true);
    expect(g.sansAnalyse).toBe(0);
  });

  it('lit un taux envoyé en chaîne sans planter', () => {
    const g = lireGlobal({ resolution: { resolution_rate: { percentage: '68.4' } } }, true);
    expect(g.resolution.taux).toBe(68.4);
  });

  it('réserve la vue plateforme au super-administrateur', () => {
    const G = { filters: { scope: 'platform' } };
    expect(lireGlobal(G, true).plateforme).toBe(true);
    expect(lireGlobal(G, false).plateforme).toBe(false);
  });
});

describe('coordonneesLisibles', () => {
  it('met le bon point cardinal selon le signe', () => {
    expect(coordonneesLisibles(12.6392, -7.9921)).toBe('12,6392° N, 7,9921° O');
    expect(coordonneesLisibles(-1.5, 30)).toBe('1,5000° S, 30,0000° E');
  });

  it('ignore des coordonnées absentes ou nulles', () => {
    expect(coordonneesLisibles(null, null)).toBeNull();
    expect(coordonneesLisibles(0, 0)).toBeNull();
  });
});

describe('lireSignalement', () => {
  it('marque un signalement sans prédiction comme non analysé', () => {
    const s = lireSignalement({ id: 1, title: 'Arbre' });
    expect(s.analyse).toBe(false);
    expect(s.directs).toBeNull();
    expect(s.structures).toEqual([]);
  });

  it('lit la prédiction, les structures non nulles et les agents dédoublonnés', () => {
    const s = lireSignalement({
      id: 2,
      lattitude: '12.6',
      longitude: '-8',
      prediction: { direct: { total_population_exposed: 1240 }, impact_radius_meters: 250, infrastructure: { schools: 2, markets: 0 } },
      tasks: [
        { id: 'a', state: 'done', assigned_to: { first_name: 'Awa', last_name: 'Cissé' }, assigned_to_role: 'field_agent' },
        { id: 'b', state: 'failed', assigned_to: { first_name: 'Awa', last_name: 'Cissé' } },
      ],
      collaborating_organisations: [{ name: 'Oxfam', relation: 'leader' }],
    });
    expect(s.directs).toBe(1240);
    expect(s.rayon).toBe(250);
    expect(s.structures.map((x) => x.cle)).toEqual(['schools']);
    expect(s.agents).toEqual([{ nom: 'Awa Cissé', role: 'agent de terrain' }]);
    expect(s.taches[1].etat.libelle).toBe('Échouée');
    expect(s.organisations[0].relation).toBe('chef de file');
    expect(s.lat).toBe(12.6);
  });
});

describe('structuresNonNulles', () => {
  it('écarte les types à zéro', () => {
    expect(structuresNonNulles({ schools: 3, markets: 0 })).toEqual([{ cle: 'schools', libelle: 'Écoles', n: 3 }]);
  });
});
