import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar1, ArrowDown2, ArrowLeft2, ArrowRight2, ArrowRight, CloseCircle } from 'iconsax-react';
import {
  versIso, depuisIso, memeJour, court, complet, debutMois, aujourdhui, raccourcis, libellePeriode,
} from './periode';
import './filtre-periode.css';

/*
 * Filtre par période de la page Signalements.
 *
 * La valeur est { debut, fin } en YYYY-MM-DD, ou deux chaînes vides pour
 * « toutes les dates » (le défaut). Les raccourcis sont convertis en deux
 * dates : l'API ne reçoit que filter_type=custom_range avec custom_start et
 * custom_end. Le choix ne s'applique qu'au clic sur « Appliquer ».
 */

const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const Mois = ({ base, brouillon, survol, auj, onChoisir, onSurvol, enTete }) => {
  const premier = debutMois(base);
  const nbJours = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const decalage = (premier.getDay() + 6) % 7;
  const { a, b } = brouillon;
  const finVisible = b || (a && survol && survol >= a ? survol : null);

  return (
    <div className="fp-mois">
      {enTete}
      <div className="fp-grille" role="grid" aria-label={base.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}>
        {JOURS_SEMAINE.map((j, i) => <span key={i} className="fp-jsem" aria-hidden="true">{j}</span>)}
        {Array.from({ length: decalage }, (_, i) => <span key={`v${i}`} className="fp-vide" />)}
        {Array.from({ length: nbJours }, (_, i) => {
          const d = new Date(base.getFullYear(), base.getMonth(), i + 1);
          const futur = d > auj;
          const classes = ['fp-jour'];
          if (memeJour(d, auj)) classes.push('is-auj');
          if (a && finVisible && d >= a && d <= finVisible) classes.push(b ? 'is-dans' : 'is-apercu');
          if (memeJour(d, a)) classes.push('is-debut');
          if (memeJour(d, finVisible)) classes.push('is-fin');
          const choisi = memeJour(d, a) || memeJour(d, b);
          return (
            <button
              key={i}
              type="button"
              className={classes.join(' ')}
              disabled={futur}
              aria-pressed={choisi}
              aria-label={complet(d)}
              onClick={() => onChoisir(d)}
              onMouseEnter={() => onSurvol(d)}
            >
              <span>{i + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const FiltrePeriode = ({ valeur = { debut: '', fin: '' }, onChange }) => {
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState({ a: null, b: null });
  const [survol, setSurvol] = useState(null);
  const [vue, setVue] = useState(() => debutMois(aujourdhui(), -1));
  const [etroit, setEtroit] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches);
  const racine = useRef(null);
  const bouton = useRef(null);
  const panneau = useRef(null);

  const auj = useMemo(() => aujourdhui(), [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps
  const listeRaccourcis = useMemo(() => raccourcis(auj), [auj]);
  const actif = Boolean(valeur?.debut && valeur?.fin);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const maj = (e) => setEtroit(e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  const fermer = (rendreFocus = true) => {
    setOuvert(false);
    setSurvol(null);
    if (rendreFocus) bouton.current?.focus();
  };

  const ouvrir = () => {
    const a = depuisIso(valeur?.debut);
    const b = depuisIso(valeur?.fin);
    setBrouillon({ a, b });
    // Le mois de fin se trouve dans la colonne de droite.
    setVue(debutMois(b || aujourdhui(), etroit ? 0 : -1));
    setOuvert(true);
  };

  useEffect(() => {
    if (!ouvert) return undefined;
    const clavier = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    const dehors = (e) => { if (!racine.current?.contains(e.target)) fermer(false); };
    document.addEventListener('keydown', clavier);
    document.addEventListener('mousedown', dehors);
    // Le focus entre dans le panneau, sur le raccourci choisi ou le premier.
    requestAnimationFrame(() => {
      const cible = panneau.current?.querySelector('.fp-raccourci[aria-pressed="true"]') || panneau.current?.querySelector('.fp-raccourci');
      cible?.focus();
    });
    return () => {
      document.removeEventListener('keydown', clavier);
      document.removeEventListener('mousedown', dehors);
    };
  }, [ouvert]);

  // Sur téléphone, la page derrière la feuille ne défile plus.
  useEffect(() => {
    if (!ouvert || !etroit) return undefined;
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = avant; };
  }, [ouvert, etroit]);

  const choisirJour = (d) => {
    const { a, b } = brouillon;
    setBrouillon(!a || b || d < a ? { a: d, b: null } : { a, b: d });
    setSurvol(null);
  };

  const appliquer = () => {
    const { a, b } = brouillon;
    onChange(a && b ? { debut: versIso(a), fin: versIso(b) } : { debut: '', fin: '' });
    fermer();
  };

  const toutesLesDates = () => { onChange({ debut: '', fin: '' }); fermer(); };

  const { a, b } = brouillon;
  const nbJours = a && b ? Math.round((b - a) / 864e5) + 1 : 0;
  const resume = !a ? 'Cliquez sur le premier jour.' : !b ? 'Cliquez maintenant sur le dernier jour.' : null;
  const incomplet = Boolean(a && !b);
  const nbMois = etroit ? 1 : 2;
  const moisCourant = debutMois(auj);
  const peutAvancer = debutMois(vue, nbMois - 1) < moisCourant;

  const navigation = (index) => (
    <div className="fp-mois-tete">
      {index === 0
        ? <button type="button" className="fp-nav" onClick={() => setVue(debutMois(vue, -1))} aria-label="Mois précédent"><ArrowLeft2 size={16} color="currentColor" /></button>
        : <span className="fp-nav-place" />}
      <b>{debutMois(vue, index).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b>
      {index === nbMois - 1
        ? <button type="button" className="fp-nav" onClick={() => setVue(debutMois(vue, 1))} disabled={!peutAvancer} aria-label="Mois suivant"><ArrowRight2 size={16} color="currentColor" /></button>
        : <span className="fp-nav-place" />}
    </div>
  );

  return (
    <div className="fp" ref={racine}>
      <div className={`fp-declencheur ${actif ? 'is-actif' : ''}`}>
        <button
          ref={bouton}
          type="button"
          className="fp-ouvrir"
          aria-haspopup="dialog"
          aria-expanded={ouvert}
          onClick={() => (ouvert ? fermer() : ouvrir())}
        >
          <Calendar1 size={16} color="currentColor" variant={actif ? 'Bold' : 'Linear'} aria-hidden="true" />
          <span className="fp-lib">Période</span>
          <span className="fp-val">{libellePeriode(valeur)}</span>
          {!actif && <ArrowDown2 size={14} color="currentColor" className="fp-chev" aria-hidden="true" />}
        </button>
        {actif && (
          <button type="button" className="fp-effacer" onClick={toutesLesDates} aria-label="Effacer la période, afficher toutes les dates">
            <CloseCircle size={16} color="currentColor" variant="Bold" aria-hidden="true" />
          </button>
        )}
      </div>

      {ouvert && (
        <>
          <div className="fp-voile" aria-hidden="true" onClick={() => fermer(false)} />
          <div className="fp-panneau" role="dialog" aria-modal={etroit || undefined} aria-label="Choisir une période" ref={panneau}>
            <div className="fp-raccourcis">
              <span className="fp-titre">Raccourcis</span>
              {listeRaccourcis.map(({ id, nom, plage: [x, y] }) => (
                <button
                  key={id}
                  type="button"
                  className="fp-raccourci"
                  aria-pressed={memeJour(x, a) && memeJour(y, b)}
                  onClick={() => { setBrouillon({ a: x, b: y }); setVue(debutMois(y, etroit ? 0 : -1)); }}
                >
                  {nom}
                  <small>{memeJour(x, y) ? court(x) : `${court(x)} – ${court(y)}`}</small>
                </button>
              ))}
            </div>

            <div className="fp-droite">
              <div className="fp-champs">
                <div className={`fp-champ ${!a ? 'is-focus' : ''}`}>
                  <small>Du</small>
                  <span className={a ? '' : 'is-vide'}>{a ? complet(a) : 'Choisir'}</span>
                </div>
                <ArrowRight size={16} color="currentColor" className="fp-fleche" aria-hidden="true" />
                <div className={`fp-champ ${a && !b ? 'is-focus' : ''}`}>
                  <small>Au</small>
                  <span className={b ? '' : 'is-vide'}>{b ? complet(b) : 'Choisir'}</span>
                </div>
              </div>

              <div className="fp-calendriers" onMouseLeave={() => setSurvol(null)}>
                {Array.from({ length: nbMois }, (_, i) => (
                  <Mois
                    key={i}
                    base={debutMois(vue, i)}
                    brouillon={brouillon}
                    survol={survol}
                    auj={auj}
                    onChoisir={choisirJour}
                    onSurvol={(d) => { if (a && !b) setSurvol(d); }}
                    enTete={navigation(i)}
                  />
                ))}
              </div>

              <div className="fp-pied">
                <span className="fp-resume" role="status">
                  {resume || <><b>{nbJours} jour{nbJours > 1 ? 's' : ''}</b> sélectionné{nbJours > 1 ? 's' : ''}</>}
                </span>
                <div className="fp-actions">
                  <button type="button" className="fp-btn fp-btn-sec" onClick={toutesLesDates}>Toutes les dates</button>
                  <button type="button" className="fp-btn fp-btn-pri" onClick={appliquer} disabled={incomplet}>Appliquer</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FiltrePeriode;
