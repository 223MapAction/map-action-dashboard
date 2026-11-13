import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ETATS } from '../components/IncidentList/formatSignalement';
import { FiltrePeriode } from '../components/IncidentList/FiltrePeriode';
import { raccourcis, aujourdhui, versIso, memeJour, depuisIso } from '../components/IncidentList/periode';

// Doit rester égale à la durée de `sgm-descend` sur `.sgm-filtres.is-sortie`.
const DUREE_SORTIE = 240;

const Coche = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E78AC" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

/**
 * Feuille « Filtres » des signalements sur téléphone : état et période réunis
 * derrière un seul bouton. Chaque choix s'applique tout de suite à la liste.
 */
export const FiltresSignalements = ({ statusFilter, setStatusFilter, periode, setPeriode, onFermer }) => {
  const [sortie, setSortie] = useState(false);
  const minuterie = useRef(null);
  const listeRaccourcis = useMemo(() => raccourcis(aujourdhui()), []);

  const fermer = () => {
    if (minuterie.current) return;
    setSortie(true);
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    minuterie.current = setTimeout(onFermer, reduit ? 0 : DUREE_SORTIE);
  };

  useEffect(() => {
    const surTouche = (e) => { if (e.key === 'Escape' && !document.querySelector('.fp-voile')) fermer(); };
    document.addEventListener('keydown', surTouche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = avant;
      clearTimeout(minuterie.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const a = depuisIso(periode?.debut);
  const b = depuisIso(periode?.fin);
  const raccourciActif = a && b ? listeRaccourcis.find(({ plage: [x, y] }) => memeJour(x, a) && memeJour(y, b))?.id : null;
  const plagePerso = Boolean(a && b && !raccourciActif);
  const effacer = () => { setStatusFilter(''); setPeriode({ debut: '', fin: '' }); };

  const classe = sortie ? 'is-sortie' : '';

  return createPortal(
    <>
      <div className={`sgm-filtres-voile ${classe}`} onClick={fermer} aria-hidden="true" />
      <section className={`sgm-filtres ${classe}`} role="dialog" aria-modal="true" aria-labelledby="sgm-filtres-titre">
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
            <h3>État</h3>
            <ul className="sgm-choix" role="radiogroup" aria-label="État">
              {ETATS.map((e) => (
                <li key={e.valeur || 'tous'}>
                  <button type="button" role="radio" aria-checked={statusFilter === e.valeur} onClick={() => setStatusFilter(e.valeur)}>
                    {e.libelle}
                    {statusFilter === e.valeur && <Coche />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Période</h3>
            <ul className="sgm-choix" role="radiogroup" aria-label="Période">
              <li>
                <button type="button" role="radio" aria-checked={!a || !b} onClick={() => setPeriode({ debut: '', fin: '' })}>
                  Toutes les dates
                  {(!a || !b) && <Coche />}
                </button>
              </li>
              {listeRaccourcis.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={raccourciActif === r.id}
                    onClick={() => setPeriode({ debut: versIso(r.plage[0]), fin: versIso(r.plage[1]) })}
                  >
                    {r.nom}
                    {raccourciActif === r.id && <Coche />}
                  </button>
                </li>
              ))}
            </ul>
            <div className={`sgm-perso ${plagePerso ? 'is-actif' : ''}`}>
              <span>Autre période</span>
              <FiltrePeriode valeur={periode} onChange={setPeriode} />
            </div>
          </div>
        </div>

        <footer className="sgm-filtres-pied">
          <button type="button" className="sgm-voir" onClick={fermer}>Voir les signalements</button>
        </footer>
      </section>
    </>,
    document.body
  );
};

export default FiltresSignalements;
