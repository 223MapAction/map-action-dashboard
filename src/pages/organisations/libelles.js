// Libellés et pastilles des organisations.
//
// Fonctions pures, sorties du composant pour être testées seules.
import { SECTORS, TYPES, COUNTRIES } from './data/organisations';

const traduire = (liste, valeur) => {
  if (!valeur) return '';
  const trouve = liste.find((o) => o.en === valeur || o.fr === valeur);
  return trouve ? trouve.fr : valeur;
};

export const libelleSecteur = (v) => traduire(SECTORS, v);
export const libelleType = (v) => traduire(TYPES, v);
export const libellePays = (v) => traduire(COUNTRIES, v);

/** Deux lettres pour la pastille : le sigle, sinon le début du nom. */
export const initialesOrganisation = (org) =>
  (org?.acronym || org?.name || '?').trim().slice(0, 2).toUpperCase();

/**
 * Couleurs proposées pour la pastille d'une organisation sans logo.
 * Toutes portent un sigle blanc à plus de 4,5:1 : la pastille reste lisible
 * quelle que soit la teinte choisie.
 */
export const COULEURS_ORGANISATION = [
  '#B91C1C', '#1E78AC', '#15803D', '#7C3AED', '#B45309', '#0E7490', '#BE185D', '#475569',
];

/** Nombre formaté à la française (« 1 234 »), zéro compris. */
export const nombreFr = (n) => Number(n || 0).toLocaleString('fr-FR');
