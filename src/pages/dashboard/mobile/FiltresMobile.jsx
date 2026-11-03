import { createPortal } from 'react-dom';
import { NIVEAUX_GRAVITE, couleurGravite, couleurTexteGravite } from '../../../utils/gravite';
import { COUNTRIES } from '../../organisations/data/organisations';

const Segment = ({ libelle, options, valeur, onChange }) => (
  <div className="dm-seg" role="radiogroup" aria-label={libelle}>
    {options.map((o) => (
      <button key={o.valeur} type="button" role="radio" aria-checked={valeur === o.valeur} onClick={() => onChange(o.valeur)}>
        {o.libelle}
      </button>
    ))}
  </div>
);

/** Écran 4 : les filtres de la carte, en feuille. */
export const FiltresMobile = ({
  proprietaire,
  onProprietaire,
  etat,
  onEtat,
  graviteActive,
  onGravite,
  pays,
  onPays,
  paysUtilisateur,
  styles,
  styleActif,
  onStyle,
  onToutEffacer,
  onTerminer,
}) => {
  const listePays = [
    { valeur: '', nom: 'Tous les pays' },
    ...(paysUtilisateur
      ? [{ valeur: paysUtilisateur, nom: `Mon pays (${COUNTRIES.find((c) => c.en === paysUtilisateur)?.fr || paysUtilisateur})` }]
      : []),
    ...COUNTRIES.filter((c) => c.en !== paysUtilisateur).map((c) => ({ valeur: c.en, nom: c.fr })),
  ];

  return createPortal(
    <>
      <div className="dm-voile" onClick={onTerminer} aria-hidden="true" />
      <section className="dm-filtres" role="dialog" aria-modal="true" aria-labelledby="dm-filtres-titre">
        <span className="dm-poignee" aria-hidden="true" />
        <header className="dm-filtres-entete">
          <button type="button" onClick={onToutEffacer}>Tout effacer</button>
          <h2 id="dm-filtres-titre">Filtres</h2>
          <button type="button" className="dm-terminer" onClick={onTerminer}>Terminé</button>
        </header>

        <div className="dm-filtres-corps">
          <div>
            <h3>Signalements</h3>
            <Segment
              libelle="Signalements"
              valeur={proprietaire}
              onChange={onProprietaire}
              options={[{ valeur: 'all', libelle: 'Tous' }, { valeur: 'mine', libelle: 'Les miens' }]}
            />
          </div>

          <div>
            <h3>État</h3>
            <Segment
              libelle="État"
              valeur={etat}
              onChange={onEtat}
              options={[{ valeur: 'active', libelle: 'Actifs' }, { valeur: 'resolved', libelle: 'Résolus' }]}
            />
          </div>

          <div>
            <h3>Gravité</h3>
            <div className="dm-gravites">
              {NIVEAUX_GRAVITE.map(({ cle, libelle }) => {
                const actif = graviteActive === cle;
                return (
                  <button
                    key={cle}
                    type="button"
                    aria-pressed={actif}
                    style={actif ? { borderColor: couleurGravite(cle), backgroundColor: `var(--color-severity-${cle}-surface)`, color: couleurTexteGravite(cle) } : undefined}
                    onClick={() => onGravite(actif ? null : cle)}
                  >
                    <i style={{ backgroundColor: couleurGravite(cle) }} />
                    {libelle}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3>Pays</h3>
            <ul className="dm-pays" role="radiogroup" aria-label="Pays">
              {listePays.map((p) => (
                <li key={p.valeur || 'tous'}>
                  <button type="button" role="radio" aria-checked={pays === p.valeur} onClick={() => onPays(p.valeur)}>
                    {p.nom}
                    {pays === p.valeur && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-text)" strokeWidth="2.6" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {styles.length > 1 && (
            <div>
              <h3>Fond de carte</h3>
              <Segment
                libelle="Fond de carte"
                valeur={styleActif}
                onChange={onStyle}
                options={styles.map((s) => ({ valeur: s.id, libelle: s.id === 'humanitarian' ? 'Plan' : s.label }))}
              />
            </div>
          )}
        </div>
      </section>
    </>,
    document.body
  );
};

export default FiltresMobile;
