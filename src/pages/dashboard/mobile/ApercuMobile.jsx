import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { getIncidentService } from '../../incident/service/incident_service';
import { titreIncident } from '../../../utils/titreIncident';
import { gravite, couleurGravite, couleurTexteGravite, libelleGravite } from '../../../utils/gravite';
import { tempsRelatif } from '../components/widgets/useStatsWidgets';
import { useFeuille } from './useFeuille';
import { BoutonFermer } from './BoutonFermer';

const STATUTS = {
  declared: { libelle: 'Déclaré', classe: 'bulle-statut-declare' },
  pending: { libelle: 'En attente', classe: 'bulle-statut-declare' },
  taken_into_account: { libelle: 'Pris en compte', classe: 'bulle-statut-encours' },
  in_progress: { libelle: 'En cours', classe: 'bulle-statut-encours' },
  resolved: { libelle: 'Résolu', classe: 'bulle-statut-resolu' },
};

/** Écran 2 : le signalement touché sur la carte, en feuille basse. */
export const ApercuMobile = ({ incident, onDetail, onFermer }) => {
  const navigate = useNavigate();
  const { fermer, classe } = useFeuille(onFermer);
  // Même clé que le détail rapide : ce qui est chargé ici lui sert de cache.
  const { data: detail } = useSWR(`/incident/${incident.id}`, () => getIncidentService(incident.id));
  const i = { ...incident, ...(detail || {}) };
  const niveau = gravite(i);
  const statut = STATUTS[i.etat] ?? STATUTS.declared;
  const photo = i.thumbnail || i.photo;
  const action = !i.etat || i.etat === 'declared' || i.etat === 'pending' ? 'Prendre en charge' : i.etat === 'resolved' ? 'Voir le rapport' : 'Voir le suivi';

  return (
    <>
      <button type="button" className={`dm-verre dm-retour-carte dm-fondu ${classe}`} onClick={fermer} aria-label="Fermer l'aperçu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      </button>

      <section className={`dm-apercu dm-feuille ${classe}`} aria-label="Aperçu du signalement">
        <span className="dm-poignee" aria-hidden="true" />
        <div className="dm-apercu-haut">
          <span className="dm-apercu-photo" style={photo ? { backgroundImage: `url(${photo})` } : undefined} />
          <div className="dm-apercu-texte">
            <b>{titreIncident(i)}</b>
            <span>{[i.zone, tempsRelatif(i.created_at)].filter(Boolean).join(' · ')}</span>
            <span className="bulle-pastilles">
              <span className="bulle-pastille" style={{ backgroundColor: `var(--color-severity-${niveau}-surface)`, color: couleurTexteGravite(niveau) }}>
                <i style={{ backgroundColor: couleurGravite(niveau) }} />
                {libelleGravite(niveau)}
              </span>
              <span className={`bulle-pastille ${statut.classe}`}>{statut.libelle}</span>
            </span>
          </div>
          <BoutonFermer onClick={fermer} libelle="Fermer l'aperçu" />
        </div>
        <div className="dm-deux-boutons">
          <button type="button" className="dm-bouton" onClick={() => onDetail(i)}>Détail</button>
          <button type="button" className="dm-bouton dm-bouton-primaire" onClick={() => navigate(`/signalements/${i.id}`, { state: { from: '/dashboard' } })}>
            {action}
          </button>
        </div>
      </section>
    </>
  );
};

export default ApercuMobile;
