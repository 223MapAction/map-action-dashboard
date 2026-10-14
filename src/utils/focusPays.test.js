import { describe, it, expect } from 'vitest';
import { masqueInverse, bboxPays, frontiereDe } from './focusPays';

const CARRE = [[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]];
const POLYGONE = { type: 'Feature', properties: { iso: 'AAA' }, geometry: { type: 'Polygon', coordinates: [CARRE] } };
const MULTI = {
  type: 'Feature',
  properties: { iso: 'BBB' },
  geometry: { type: 'MultiPolygon', coordinates: [[CARRE], [[[5, 5], [6, 5], [6, 7], [5, 5]]]] },
};

describe('masqueInverse', () => {
  it('perce le monde avec le contour du pays', () => {
    const { coordinates } = masqueInverse(POLYGONE).geometry;
    expect(coordinates).toHaveLength(2);
    expect(coordinates[1]).toEqual(CARRE);
  });

  it('cree un trou par polygone pour un MultiPolygon', () => {
    expect(masqueInverse(MULTI).geometry.coordinates).toHaveLength(3);
  });
});

describe('bboxPays', () => {
  it('couvre tous les polygones', () => {
    expect(bboxPays(MULTI)).toEqual([[0, 0], [6, 7]]);
  });
});

describe('frontiereDe', () => {
  const collection = { features: [POLYGONE, MULTI] };
  it('trouve par code ISO', () => expect(frontiereDe(collection, 'BBB')).toBe(MULTI));
  it('renvoie null si absent', () => expect(frontiereDe(collection, 'ZZZ')).toBeNull());
  it('tolere une collection non chargee', () => expect(frontiereDe(null, 'AAA')).toBeNull());
});
