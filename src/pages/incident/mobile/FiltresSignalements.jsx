import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-react';
import { ETATS } from '../components/IncidentList/formatSignalement';
import { Mois } from '../components/IncidentList/FiltrePeriode';
import { raccourcis, aujourdhui, versIso, memeJour, depuisIso, debutMois, libellePeriode } from '../components/IncidentList/periode';
import '../components/IncidentList/filtre-periode.css';

// Doit rester égale à la durée de `sgm-descend` sur `.sgm-filtres.is-sortie`.
const DUREE_SORTIE = 240;

const Coche = () => (
  <svg className="sgm-coche" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

/**
 * Feuille « Filtres » des signalements sur téléphone : état et période réunis
 * derrière un seul bouton. Chaque choix s'applique tout de suite à la liste.
 * La période personnalisée se choisit dans la feuille même : le mois se
 * déplie sous « Autre période », la plage s'applique au deuxième jour touché.
 */
export const FiltresSignalements = ({ statusFilter, setStatusFilter, periode, setPeriode, count = 0, chargement = false, onFermer }) => {
  const [sortie, setSortie] = useState(false);
  const minuterie = useRef(null);
  const feuilleRef = useRef(null);
  const listeRaccourcis = useMemo(() => raccourcis(aujourdhui()), []);
  const auj = useMemo(() => aujourdhui(), []);

  const a = depuisIso(periode?.debut);
  const b = depuisIso(periode?.fin);
  const raccourciActif = a && b ? listeRaccourcis.find(({ plage: [x, y] }) => memeJour(x, a) && memeJour(y, b))?.id : null;
  const plagePerso = Boolean(a && b && !raccourciActif);

  const [persoOuvert, setPersoOuvert] = useState(plagePerso);
  const [brouillon, setBrouillon] = useState(() => (plagePerso ? { a, b } : { a: null, b: null }));
  const [vue, setVue] = useState(() => debutMois(plagePerso ? b : auj));

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
    setPersoOuvert(false);
    setBrouillon({ a: null, b: null });
  };

  const choisirPlage = (valeur) => {
    setPersoOuvert(false);
    setBrouillon({ a: null, b: null });
    setPeriode(valeur);
  };

  const choisirJour = (d) => {
    const { a: x, b: y } = brouillon;
    if (!x || y || d < x) {
      setBrouillon({ a: d, b: null });
      return;
    }
    setBrouillon({ a: x, b: d });
    setPeriode({ debut: versIso(x), fin: versIso(d) });
  };

  const peutAvancer = debutMois(vue) < debutMois(auj);
  const consigne = !brouillon.a ? 'Touchez le premier jour.' : !brouillon.b ? 'Touchez maintenant le dernier jour.' : null;
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
            <ul className="sgm-choix" role="radiogroup" aria-labelledby="sgm-titre-periode">
              <li>
                <button type="button" role="radio" aria-checked={!persoOuvert && (!a || !b)} onClick={() => choisirPlage({ debut: '', fin: '' })}>
                  Toutes les dates
                  {!persoOuvert && (!a || !b) && <Coche />}
                </button>
              </li>
              {listeRaccourcis.map((r) => {
                const actif = !persoOuvert && raccourciActif === r.id;
                return (
                  <li key={r.id}>
                    <button type="button" role="radio" aria-checked={actif} onClick={() => choisirPlage({ debut: versIso(r.plage[0]), fin: versIso(r.plage[1]) })}>
                      {r.nom}
                      {actif && <Coche />}
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  role="radio"
                  aria-checked={persoOuvert}
                  aria-expanded={persoOuvert}
                  aria-controls="sgm-calendrier"
                  onClick={() => {
                    if (persoOuvert) return;
                    setPersoOuvert(true);
                    setBrouillon(plagePerso ? { a, b } : { a: null, b: null });
                  }}
                >
                  Autre période
                  {persoOuvert && plagePerso
                    ? <span className="sgm-perso-val">{libellePeriode(periode)}</span>
                    : persoOuvert && <Coche />}
                </button>
              </li>
              {persoOuvert && (
                <li id="sgm-calendrier" className="sgm-calendrier fp">
                  <Mois
                    base={vue}
                    brouillon={brouillon}
                    survol={null}
                    auj={auj}
                    onChoisir={choisirJour}
                    onSurvol={() => {}}
                    enTete={(
                      <div className="fp-mois-tete">
                        <button type="button" className="fp-nav" onClick={() => setVue(debutMois(vue, -1))} aria-label="Mois précédent"><ArrowLeft2 size={18} color="currentColor" /></button>
                        <b>{vue.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b>
                        <button type="button" className="fp-nav" onClick={() => setVue(debutMois(vue, 1))} disabled={!peutAvancer} aria-label="Mois suivant"><ArrowRight2 size={18} color="currentColor" /></button>
                      </div>
                    )}
                  />
                  {consigne && <p className="sgm-consigne" role="status">{consigne}</p>}
                </li>
              )}
            </ul>
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
