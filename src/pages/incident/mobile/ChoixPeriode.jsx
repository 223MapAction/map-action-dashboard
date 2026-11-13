import { useMemo, useState } from 'react';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-react';
import { Mois } from '../components/IncidentList/FiltrePeriode';
import { raccourcis, aujourdhui, versIso, memeJour, depuisIso, debutMois, libellePeriode } from '../components/IncidentList/periode';
import '../components/IncidentList/filtre-periode.css';
import './mobile.css';

const Coche = () => (
  <svg className="sgm-coche" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

/**
 * Choix de la période dans une feuille de filtres sur téléphone : toutes les
 * dates, les raccourcis, puis « Autre période » qui déplie le mois sur place.
 * La plage s'applique au deuxième jour touché.
 *
 * @param {{ debut: string, fin: string }} periode  YYYY-MM-DD, ou deux chaînes vides
 * @param {(p: { debut: string, fin: string }) => void} setPeriode
 * @param {string} [idTitre]  id du titre qui nomme le groupe
 */
export const ChoixPeriode = ({ periode, setPeriode, idTitre }) => {
  const listeRaccourcis = useMemo(() => raccourcis(aujourdhui()), []);
  const auj = useMemo(() => aujourdhui(), []);

  const a = depuisIso(periode?.debut);
  const b = depuisIso(periode?.fin);
  const raccourciActif = a && b ? listeRaccourcis.find(({ plage: [x, y] }) => memeJour(x, a) && memeJour(y, b))?.id : null;
  const plagePerso = Boolean(a && b && !raccourciActif);

  const [persoOuvert, setPersoOuvert] = useState(plagePerso);
  const [brouillon, setBrouillon] = useState(() => (plagePerso ? { a, b } : { a: null, b: null }));
  const [vue, setVue] = useState(() => debutMois(plagePerso ? b : auj));

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

  return (
    <ul className="sgm-choix" role="radiogroup" aria-labelledby={idTitre}>
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
        <li className="sgm-calendrier fp">
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
  );
};

export default ChoixPeriode;
