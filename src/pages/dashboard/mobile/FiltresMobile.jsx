import { createPortal } from 'react-dom';
import { NIVEAUX_GRAVITE, couleurGravite, couleurTexteGravite } from '../../../utils/gravite';
import { useFeuille } from './useFeuille';
import { BoutonFermer } from './BoutonFermer';

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
  styles,
  styleActif,
  onStyle,
  onToutEffacer,
  onTerminer,
}) => {
  const { fermer, classe } = useFeuille(onTerminer);

  return createPortal(
    <>
      <div className={`dm-voile ${classe}`} onClick={fermer} aria-hidden="true" />
      <section className={`dm-filtres dm-feuille ${classe}`} role="dialog" aria-modal="true" aria-labelledby="dm-filtres-titre">
        <span className="dm-poignee" aria-hidden="true" />
        <header className="dm-filtres-entete">
          <button type="button" onClick={onToutEffacer}>Tout effacer</button>
          <h2 id="dm-filtres-titre">Filtres</h2>
          <BoutonFermer onClick={fermer} libelle="Fermer les filtres" />
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
