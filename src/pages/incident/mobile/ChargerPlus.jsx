import { useEffect, useRef } from 'react';
import './mobile.css';

/**
 * Bas d'une liste sur téléphone : le lot suivant se charge quand on approche
 * de la fin. Le bouton reste pour les navigateurs sans IntersectionObserver
 * et pour qui préfère toucher.
 *
 * @param {boolean} chargement  un lot est en route
 * @param {() => void} onPlus   demande le lot suivant
 * @param {number} reste        taille du prochain lot
 * @param {string} [nom]        « signalements », « collaborations »…
 * @param {boolean} [feminin]   accorde « suivants » / « suivantes »
 */
export const ChargerPlus = ({ chargement, onPlus, reste, nom = 'signalements', feminin = false }) => {
  const repere = useRef(null);

  // Pas d'observation pendant un chargement ; à la fin, l'observateur repart
  // et redemande un lot si le bas de liste est encore en vue.
  useEffect(() => {
    const el = repere.current;
    if (chargement || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { obs.disconnect(); onPlus?.(); }
    }, { rootMargin: '0px 0px 400px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [chargement, onPlus]);

  return (
    <div ref={repere} className="sgm-charger-plus">
      {chargement ? (
        <span role="status"><i className="sgm-spin" aria-hidden="true" />Chargement des {reste} {feminin ? 'suivantes' : 'suivants'}…</span>
      ) : (
        <button type="button" onClick={onPlus}>Afficher {reste} {nom} de plus</button>
      )}
    </div>
  );
};

export default ChargerPlus;
