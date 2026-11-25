import { describe, it, expect } from 'vitest';
import {
  NIVEAUX_GRAVITE,
  gravite,
  libelleGravite,
  repartitionGravite,
  lireRepartitionApi
} from './gravite';

// Extraits des charges utiles reelles de l'API de production, gardes tels quels :
// c'est ce que le serveur envoie vraiment, et c'est cela que le code doit lire.
const INCIDENT_API = {
  id: '9bc88002-9f8c-436a-a31a-ab54609bfcbd',
  title: 'Village Inagam',
  etat: 'taken_into_account',
  severity: 'medium'
};

const BY_SEVERITY_API = {
  high: { count: 0, percentage: 0 },
  medium: { count: 23, percentage: 100 },
  low: { count: 0, percentage: 0 }
};

describe('gravite — prise en compte de global_impact_score', () => {
  it('calcule la gravité à partir de global_impact_score (0 à 3 faible, 4 à 6 moyenne, 7 à 10 élevée)', () => {
    // 5.36 demandé expressément par l'utilisateur -> moyenne
    expect(gravite({ global_impact_score: 5.36 })).toBe('medium');
    expect(gravite({ global_impact_score: '5.36' })).toBe('medium');

    // De 0 à 3 -> faible
    expect(gravite({ global_impact_score: 0 })).toBe('low');
    expect(gravite({ global_impact_score: 2.5 })).toBe('low');
    expect(gravite({ global_impact_score: 3.9 })).toBe('low');

    // De 4 à 6 -> moyenne
    expect(gravite({ global_impact_score: 4 })).toBe('medium');
    expect(gravite({ global_impact_score: 6.9 })).toBe('medium');

    // De 7 à 10 -> élevée
    expect(gravite({ global_impact_score: 7 })).toBe('high');
    expect(gravite({ global_impact_score: 8.4 })).toBe('high');
    expect(gravite({ global_impact_score: 10 })).toBe('high');
  });

  it('donne priorité à global_impact_score sur le severity textuel du serveur', () => {
    // Le serveur a dit 'low', mais le score d'impact calculé est 8.5 -> high
    expect(gravite({ severity: 'low', global_impact_score: 8.5 })).toBe('high');
    // Le serveur a dit 'high', mais le score d'impact est 5.36 -> medium
    expect(gravite({ severity: 'high', global_impact_score: 5.36 })).toBe('medium');
  });

  it('extrait global_impact_score au niveau des détails de l\'incident ou de la prédiction', () => {
    // Dans incident_details.prediction_details
    const incAvecDetails = {
      incident_details: {
        prediction_details: {
          global_impact_score: 5.36,
        },
      },
    };
    expect(gravite(incAvecDetails)).toBe('medium');

    // Dans prediction_details direct
    expect(gravite({ prediction_details: { global_impact_score: 7.2 } })).toBe('high');

    // Dans l'objet prediction passé en 2e argument
    expect(gravite({ id: 1 }, { global_impact_score: 2.1 })).toBe('low');
    expect(gravite({ id: 1 }, [{ global_impact_score: 5.36 }])).toBe('medium');
  });
});

describe('gravite — la decision du backend prime quand global_impact_score est absent', () => {
  it('lit le champ severity de l\'incident', () => {
    expect(gravite(INCIDENT_API)).toBe('medium');
  });

  it('ignore base_severity quand severity est deja renseigne', () => {
    // Le piege : une note de 9 vaudrait « elevee » si on la recalculait. Le
    // serveur a dit « medium », c'est lui qui tranche.
    expect(gravite({ ...INCIDENT_API, base_severity: 9 })).toBe('medium');
  });

  it('retombe sur base_severity quand le serveur n\'a pas tranche', () => {
    expect(gravite({ base_severity: 8 })).toBe('high');
    expect(gravite({ base_severity: 4 })).toBe('medium');
    expect(gravite({ base_severity: 0 })).toBe('low');
  });

  it('ignore une note illisible plutot que de la traiter comme zero', () => {
    // parseFloat('') vaut NaN : sans garde, toute comparaison echoue et on
    // tombait en « faible » par accident, en ecrasant le badge.
    const inc = { base_severity: '', badges: [{ variant: 'critical' }] };
    expect(gravite(inc)).toBe('high');
  });

  it('rejette une valeur de severity inconnue et passe aux replis', () => {
    expect(gravite({ severity: 'catastrophique', base_severity: 6 })).toBe('medium');
  });

  it('ne casse pas sur un incident absent', () => {
    expect(gravite(null)).toBe('low');
  });
});

describe('repartition depuis l\'API', () => {
  it('rend les trois niveaux du serveur, dans l\'ordre de l\'echelle', () => {
    const niveaux = lireRepartitionApi(BY_SEVERITY_API);
    expect(niveaux.map((n) => n.cle)).toEqual(['high', 'medium', 'low']);
    expect(niveaux[1]).toMatchObject({ libelle: 'Moyenne', count: 23, percentage: 100 });
  });

  it('omet un niveau absent de la reponse plutot que de l\'inventer a 0', () => {
    const partiel = { high: { count: 3, percentage: 100 } };
    expect(lireRepartitionApi(partiel).map((n) => n.cle)).toEqual(['high']);
  });

  it('conserve l\'ordre de l\'echelle, du plus grave au moins grave', () => {
    const desordonne = {
      low: { count: 1, percentage: 10 },
      high: { count: 8, percentage: 80 },
      medium: { count: 1, percentage: 10 }
    };
    expect(lireRepartitionApi(desordonne).map((n) => n.cle)).toEqual(['high', 'medium', 'low']);
  });

  it('rend une liste vide plutot que de planter si by_severity manque', () => {
    expect(lireRepartitionApi(undefined)).toEqual([]);
  });
});

describe('repartition calculee localement', () => {
  it('compte et repartit en pourcentages', () => {
    const incidents = [
      { severity: 'high' },
      { severity: 'medium' },
      { severity: 'medium' },
      { severity: 'low' }
    ];
    const r = repartitionGravite(incidents);
    expect(r.medium).toEqual({ count: 2, percentage: 50 });
    expect(r.high).toEqual({ count: 1, percentage: 25 });
    expect(r.low).toEqual({ count: 1, percentage: 25 });
  });

  it('rend 0 % et non NaN % sur une liste vide', () => {
    const r = repartitionGravite([]);
    // Le vrai risque ici est la division par zero : `NaN%` s'afficherait tel
    // quel dans la barre de progression.
    Object.values(r).forEach((niveau) => {
      expect(Number.isNaN(niveau.percentage)).toBe(false);
      expect(niveau.percentage).toBe(0);
    });
  });
});

describe('coherence de l\'echelle', () => {
  it('expose les trois niveaux du serveur, ordonnes du plus grave au moins grave', () => {
    // Trois, pas quatre : l'API n'agrege que high/medium/low.
    expect(NIVEAUX_GRAVITE.map((n) => n.cle)).toEqual(['high', 'medium', 'low']);
    const seuils = NIVEAUX_GRAVITE.map((n) => n.min);
    expect([...seuils].sort((a, b) => b - a)).toEqual(seuils);
  });

  it('donne un libelle distinct a chaque niveau', () => {
    const libelles = NIVEAUX_GRAVITE.map((n) => libelleGravite(n.cle));
    expect(new Set(libelles).size).toBe(libelles.length);
  });
});
