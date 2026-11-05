import useSWR from 'swr';
import { CloseCircle } from 'iconsax-react';
import { ShimmerThumbnail } from 'react-shimmer-effects';
import { useNavigate } from 'react-router-dom';
import { getIncidentService } from '../../../incident/service/incident_service';
import { titreIncident } from '../../../../utils/titreIncident';
import { gravite, couleurGravite, couleurTexteGravite, libelleGravite } from '../../../../utils/gravite';

const STATUTS = {
  declared: { libelle: 'Déclaré', classe: 'bulle-statut-declare' },
  taken_into_account: { libelle: 'Pris en compte', classe: 'bulle-statut-encours' },
  in_progress: { libelle: 'En cours', classe: 'bulle-statut-encours' },
  resolved: { libelle: 'Résolu', classe: 'bulle-statut-resolu' },
};

const tempsRelatif = (iso) => {
  if (!iso) return '';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 60) return `il y a ${Math.max(minutes, 1)} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return jours === 1 ? 'hier' : `il y a ${jours} j`;
};

/**
 * Contenu de la bulle affichée au clic sur un point de la carte : photo,
 * gravité, statut, organisation, et l'action principale selon l'état.
 * Le détail complet (photo, frise, coordonnées) passe par l'aperçu latéral.
 */
export const BulleIncident = ({ incident, onApercu, onFermer }) => {
  const navigate = useNavigate();
  // Même clé que l'aperçu latéral : le détail chargé ici lui sert de cache.
  const { data: detail } = useSWR(incident?.id ? `/incident/${incident.id}` : null, () =>
    getIncidentService(incident.id)
  );
  const i = { ...incident, ...(detail || {}) };
  const niveau = gravite(i);
  const statut = STATUTS[i.etat] ?? STATUTS.declared;
  const photo = i.thumbnail || i.photo;

  const action =
    i.etat === 'declared' || !i.etat
      ? 'Prendre en charge'
      : i.etat === 'resolved'
        ? 'Voir le rapport'
        : 'Voir le suivi';

  return (
    <div className="bulle-incident">
      <div className="bulle-haut">
        {!detail && !photo ? (
          <span className="bulle-photo bulle-photo-chargement">
            <ShimmerThumbnail height={56} width={56} rounded />
          </span>
        ) : (
          <span className="bulle-photo" style={photo ? { backgroundImage: `url(${photo})` } : undefined} />
        )}
        <div className="bulle-texte">
          <b className="bulle-titre" title={titreIncident(i, 400)}>{titreIncident(i)}</b>
          <small className="bulle-meta">
            {[i.zone, tempsRelatif(i.created_at)].filter(Boolean).join(' · ')}
          </small>
          <div className="bulle-pastilles">
            <span
              className="bulle-pastille"
              style={{ backgroundColor: `var(--color-severity-${niveau}-surface)`, color: couleurTexteGravite(niveau) }}
            >
              <i style={{ backgroundColor: couleurGravite(niveau) }} />
              {libelleGravite(niveau)}
            </span>
            <span className={`bulle-pastille ${statut.classe}`}>{statut.libelle}</span>
          </div>
        </div>
        {onFermer && (
          <button type="button" className="bulle-fermer" onClick={onFermer} aria-label="Fermer l'aperçu" title="Fermer">
            <CloseCircle size={18} variant="Bold" color="currentColor" />
          </button>
        )}
      </div>
      <div className="bulle-actions">
        <button type="button" className="bulle-btn bulle-btn-primaire" onClick={() => navigate(`/signalements/${i.id}`)}>
          {action}
        </button>
        <button type="button" className="bulle-btn" onClick={() => onApercu(i)}>
          Détail
        </button>
      </div>
    </div>
  );
};

export default BulleIncident;
