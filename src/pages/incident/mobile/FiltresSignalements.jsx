import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ETATS } from '../components/IncidentList/formatSignalement';
import { ChoixPeriode } from './ChoixPeriode';

// Doit rester égale à la durée de `sgm-descend` sur `.sgm-filtres.is-sortie`.
const DUREE_SORTIE = 240;

/**
 * Feuille « Filtres » des signalements sur téléphone : état et période réunis
 * derrière un seul bouton. Chaque choix s'applique tout de suite à la liste.
 */
export const FiltresSignalements = ({ statusFilter, setStatusFilter, periode, setPeriode, count = 0, chargement = false, onFermer }) => {
  const [sortie, setSortie] = useState(false);
  // Change à « Tout effacer » : le choix de période repart replié.
  const [generation, setGeneration] = useState(0);
  const minuterie = useRef(null);
  const feuilleRef = useRef(null);

  const fermer = () => {
    if (minuterie.current) return;
    setSortie(true);
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    minuterie.current = setTimeout(onFermer, reduit ? 0 : DUREE_SORTIE);
  };

  useEffect(() => {
    const origine = document.activeElement;
    feuilleRef.current?.focus({ preventScroll: true });
    const surTouche = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', surTouche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = avant;
      clearTimeout(minuterie.current);
      origine?.focus?.({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const effacer = () => {
    setStatusFilter('');
    setPeriode({ debut: '', fin: '' });
    setGeneration((g) => g + 1);
  };

  const classe = sortie ? 'is-sortie' : '';
  const libelleVoir = chargement ? 'Voir les signalements' : `Voir ${count.toLocaleString('fr-FR')} signalement${count > 1 ? 's' : ''}`;

  return createPortal(
    <>
      <div className={`sgm-filtres-voile ${classe}`} onClick={fermer} aria-hidden="true" />
      <section ref={feuilleRef} tabIndex={-1} className={`sgm-filtres ${classe}`} role="dialog" aria-modal="true" aria-labelledby="sgm-filtres-titre">
        <span className="sgm-poignee" aria-hidden="true" />
        <header className="sgm-filtres-tete">
          <button type="button" className="sgm-lien" onClick={effacer}>Tout effacer</button>
          <h2 id="sgm-filtres-titre">Filtres</h2>
          <button type="button" className="sgm-fermer" onClick={fermer} aria-label="Fermer les filtres">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className="sgm-filtres-corps">
          <div>
            <h3 id="sgm-titre-etat">État</h3>
            <div className="sgm-segs" role="radiogroup" aria-labelledby="sgm-titre-etat">
              {ETATS.map((e) => (
                <button key={e.valeur || 'tous'} type="button" role="radio" aria-checked={statusFilter === e.valeur} onClick={() => setStatusFilter(e.valeur)}>
                  {e.libelle}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 id="sgm-titre-periode">Période</h3>
            <ChoixPeriode key={generation} periode={periode} setPeriode={setPeriode} idTitre="sgm-titre-periode" />
          </div>
        </div>

        <footer className="sgm-filtres-pied">
          <button type="button" className="sgm-voir" onClick={fermer}>{libelleVoir}</button>
        </footer>
      </section>
    </>,
    document.body
  );
};

export default FiltresSignalements;
