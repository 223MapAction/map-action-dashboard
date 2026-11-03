import { describe, it, expect } from 'vitest';
import { libelleSecteur, libelleType, libellePays, initialesOrganisation, nombreFr, COULEURS_ORGANISATION } from './libelles';

describe('traductions', () => {
  it('rend le libellé français d’un code connu', () => {
    expect(libellePays('mali')).toBe('Mali');
    expect(libelleType('ngo')).toBe('ONG');
    expect(libelleSecteur('environment')).toBe('Environnement');
  });

  it('laisse passer une valeur inconnue plutôt que de la vider', () => {
    expect(libellePays('atlantide')).toBe('atlantide');
  });

  it('rend une chaîne vide pour une valeur absente', () => {
    expect(libellePays('')).toBe('');
    expect(libellePays(undefined)).toBe('');
  });
});

describe('pastille', () => {
  it('prend le sigle, sinon le début du nom', () => {
    expect(initialesOrganisation({ acronym: 'crs', name: 'Croix-Rouge' })).toBe('CR');
    expect(initialesOrganisation({ name: 'Oxfam Mali' })).toBe('OX');
    expect(initialesOrganisation({})).toBe('?');
  });

  it('ne propose que des couleurs hexadécimales distinctes', () => {
    expect(new Set(COULEURS_ORGANISATION).size).toBe(COULEURS_ORGANISATION.length);
    for (const c of COULEURS_ORGANISATION) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('nombres', () => {
  it('sépare les milliers à la française, jamais 1234 collé', () => {
    // L'espace des milliers est insécable (U+202F ou U+00A0 selon le moteur) :
    // on exige un séparateur non numérique entre les deux groupes.
    expect(nombreFr(1234)).not.toBe('1234');
    expect(nombreFr(1234)).toMatch(/^1\D234$/);
    expect(nombreFr(undefined)).toBe('0');
  });
});
