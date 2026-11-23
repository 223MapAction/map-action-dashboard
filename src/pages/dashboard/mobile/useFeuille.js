import { useCallback, useEffect, useRef, useState } from 'react';

// Doit rester égale à la durée de l'animation `dm-feuille-sortie` (CSS).
const DUREE_SORTIE = 240;

const mouvementReduit = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Fermeture animée des feuilles basses : `fermer` pose d'abord la classe de
 * sortie, puis appelle `onFermer` une fois la feuille descendue. Échap ferme.
 */
export const useFeuille = (onFermer) => {
  const [sortie, setSortie] = useState(false);
  const minuterie = useRef(null);
  const rappel = useRef(onFermer);
  useEffect(() => {
    rappel.current = onFermer;
  }, [onFermer]);

  const fermer = useCallback(() => {
    if (minuterie.current) return;
    setSortie(true);
    minuterie.current = setTimeout(() => {
      minuterie.current = null;
      rappel.current?.();
    }, mouvementReduit() ? 0 : DUREE_SORTIE);
  }, []);

  useEffect(() => {
    const surTouche = (e) => {
      if (e.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
      clearTimeout(minuterie.current);
    };
  }, [fermer]);

  return { sortie, fermer, classe: sortie ? 'is-sortie' : '' };
};
