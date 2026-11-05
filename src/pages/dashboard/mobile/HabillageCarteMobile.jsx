import { useState } from 'react';
import { NIVEAUX_GRAVITE, couleurGravite, libelleGravite } from '../../../utils/gravite';
import { FiltresMobile } from './FiltresMobile';

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

/**
 * Écran 1 : tout ce qui se pose sur la carte plein écran. L'état des filtres
 * reste dans MapContainer, le même que sur le bureau.
 */
export const HabillageCarteMobile = ({
  nonLues,
  onStatistiques,
  onActivite,
  onNotifications,
  etat,
  onEtat,
  proprietaire,
  onProprietaire,
  pays,
  onPays,
  paysUtilisateur,
  nomPays,
  styles,
  styleActif,
  onStyle,
  graviteActive,
  onGravite,
  zoneActive,
  onToutEffacer,
  nombre,
  aPlus,
  chargementPlus,
  onChargerPlus,
  masquerNombre,
}) => {
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const libellePerimetre = proprietaire === 'mine' ? 'Mes signalements' : 'Tous les signalements';
  const nomStyle = styles.find((s) => s.id === styleActif)?.id === 'humanitarian' ? 'Plan' : styles.find((s) => s.id === styleActif)?.label;

  const sousTitre = [
    libellePerimetre,
    etat === 'resolved' ? 'résolus' : 'actifs',
    graviteActive && `gravité ${libelleGravite(graviteActive).toLowerCase()}`,
    zoneActive,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <div className="dm-haut">
        <span className="dm-verre dm-contexte" aria-live="polite">
          <b>{nomPays || 'Tous les pays'}</b>
          <span>{sousTitre}</span>
        </span>
        <button type="button" className="dm-verre dm-rond" onClick={onStatistiques} aria-label="Statistiques">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6" /></svg>
        </button>
        <button type="button" className="dm-verre dm-rond" onClick={onActivite} aria-label="Activité en temps réel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
        </button>
        <button
          type="button"
          className="dm-verre dm-rond"
          onClick={onNotifications}
          aria-label={nonLues > 0 ? `Notifications, ${nonLues} non lues` : 'Notifications'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 10a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
          {nonLues > 0 && <span className="dm-pastille-non-lue" />}
        </button>
      </div>

      <div className="dm-puces">
        <div className="dm-verre dm-etat" role="radiogroup" aria-label="État">
          {[{ v: 'active', l: 'Actifs' }, { v: 'resolved', l: 'Résolus' }].map(({ v, l }) => (
            <button key={v} type="button" role="radio" aria-checked={etat === v} onClick={() => onEtat(v)}>{l}</button>
          ))}
        </div>
        <button type="button" className="dm-verre dm-puce" onClick={() => setFiltresOuverts(true)}>{libellePerimetre}<Chevron /></button>
        <button type="button" className="dm-verre dm-puce" onClick={() => setFiltresOuverts(true)}>{nomPays || 'Tous les pays'}<Chevron /></button>
      </div>

      {styles.length > 1 && (
        <button type="button" className="dm-verre dm-rond dm-fond" onClick={() => setFiltresOuverts(true)} aria-label={`Fond de carte : ${nomStyle}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5-10-5z" /><path d="M2 13l10 5 10-5" /></svg>
        </button>
      )}

      <div className="dm-bas">
        <div className="dm-verre dm-legende">
          {etat === 'active' ? (
            NIVEAUX_GRAVITE.map(({ cle, libelle }) => (
              <span key={cle}><i style={{ backgroundColor: couleurGravite(cle) }} />{libelle}</span>
            ))
          ) : (
            <>
              <span><i style={{ backgroundColor: 'var(--color-primary)' }} />Par d'autres</span>
              <span><i style={{ backgroundColor: 'var(--color-success)' }} />Par moi</span>
            </>
          )}
        </div>
        {!masquerNombre && (
          <button type="button" className="dm-verre dm-charger" onClick={onChargerPlus} disabled={!aPlus || chargementPlus}>
            {nombre.toLocaleString('fr-FR')}
            {aPlus && (chargementPlus ? ' · Chargement…' : ' · Charger plus')}
          </button>
        )}
      </div>

      {filtresOuverts && (
        <FiltresMobile
          proprietaire={proprietaire}
          onProprietaire={onProprietaire}
          etat={etat}
          onEtat={onEtat}
          graviteActive={graviteActive}
          onGravite={onGravite}
          pays={pays}
          onPays={onPays}
          paysUtilisateur={paysUtilisateur}
          styles={styles}
          styleActif={styleActif}
          onStyle={onStyle}
          onToutEffacer={onToutEffacer}
          onTerminer={() => setFiltresOuverts(false)}
        />
      )}
    </>
  );
};

export default HabillageCarteMobile;
