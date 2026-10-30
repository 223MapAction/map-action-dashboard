import { useEffect, useRef } from 'react';
import { CloseCircle } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerTitle, ShimmerText } from 'react-shimmer-effects';
import { titreIncident, descriptionRedondante } from '../../../../utils/titreIncident';
import { gravite, couleurGravite, couleurTexteGravite, libelleGravite } from '../../../../utils/gravite';

const STATUTS = {
  declared: { libelle: 'Déclaré', classe: 'bulle-statut-declare' },
  pending: { libelle: 'En attente', classe: 'bulle-statut-declare' },
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

const dateLongue = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

/**
 * Panneau latéral de détail d'un signalement, ouvert depuis la carte.
 * Photo en tête, pastilles, frise verticale de suivi, informations, médias,
 * organisations mobilisées, et l'action principale selon l'état.
 */
export const PanneauDetail = ({ incident, isLoading, ouvert, etapes, coordonnees, onFermer, onOuvrirFiche, mobile = false }) => {
  const fermerRef = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    fermerRef.current?.focus();
    const surTouche = (e) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [ouvert, onFermer]);

  const pret = !isLoading && incident;
  const etat = incident?.etat || 'declared';
  const statut = STATUTS[etat] ?? STATUTS.declared;
  const niveau = pret ? gravite(incident) : 'low';
  const indexEtape = Math.max(0, etapes.findIndex((e) => e.id === (etat === 'in_progress' ? 'taken_into_account' : etat)));
  const organisation =
    (typeof incident?.taken_by_organisation === 'object' && incident?.taken_by_organisation?.name) ||
    incident?.taken_by_name ||
    null;

  const detailEtape = (id) => {
    if (id === 'declared') return dateLongue(incident?.created_at) || 'Date inconnue';
    if (id === 'taken_into_account') {
      if (indexEtape < 1) return "En attente d'une organisation";
      return [organisation, dateLongue(incident?.taken_in_charge_at)].filter(Boolean).join(' · ') || 'Pris en compte';
    }
    if (id === 'resolved') {
      if (etat !== 'resolved') return '—';
      return dateLongue(incident?.resolution_end_date) || 'Résolu';
    }
    return '';
  };

  const action = etat === 'declared' || etat === 'pending' ? 'Prendre en charge' : etat === 'resolved' ? 'Voir le rapport' : 'Voir le suivi';

  return (
    <>
      <div className={`panneau-scrim ${mobile ? 'panneau-scrim-mobile' : ''} ${ouvert ? 'is-open' : ''}`} onClick={onFermer} aria-hidden="true" />
      <aside
        className={`panneau-detail ${mobile ? 'panneau-mobile' : ''} ${ouvert ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={incident ? `Détail : ${titreIncident(incident)}` : 'Détail du signalement'}
      >
        <div className="panneau-photo" style={pret && incident.photo ? { backgroundImage: `url(${incident.photo})` } : undefined}>
          {!pret && <ShimmerThumbnail height={200} className="panneau-photo-shimmer" />}
          <button ref={fermerRef} type="button" className="panneau-fermer" onClick={onFermer} aria-label="Fermer">
            <CloseCircle size={22} variant="Bold" color="currentColor" />
          </button>
        </div>

        <div className="panneau-corps">
          {!pret ? (
            <div className="panneau-chargement" aria-busy="true" aria-label="Chargement du signalement">
              <ShimmerTitle line={1} gap={10} variant="primary" />
              <ShimmerText line={1} gap={10} />
              <div className="panneau-chargement-pastilles">
                <ShimmerThumbnail height={22} width={110} rounded />
                <ShimmerThumbnail height={22} width={80} rounded />
              </div>
              <ShimmerText line={3} gap={10} />
              <ShimmerThumbnail height={120} rounded />
              <ShimmerText line={4} gap={10} />
            </div>
          ) : (
            <>
              <header>
                <h2 className="panneau-titre">{titreIncident(incident, 400)}</h2>
                <small className="panneau-meta">
                  {[incident.zone, incident.created_at && `signalé ${tempsRelatif(incident.created_at)}`].filter(Boolean).join(' · ')}
                </small>
              </header>

              <div className="bulle-pastilles">
                <span
                  className="bulle-pastille"
                  style={{ backgroundColor: `var(--color-severity-${niveau}-surface)`, color: couleurTexteGravite(niveau) }}
                >
                  <i style={{ backgroundColor: couleurGravite(niveau) }} />
                  Gravité {libelleGravite(niveau).toLowerCase()}
                </span>
                <span className={`bulle-pastille ${statut.classe}`}>{statut.libelle}</span>
              </div>

              {!descriptionRedondante(incident) && <p className="panneau-description">{incident.description}</p>}

              <ol className="panneau-frise">
                {etapes.map((etape, i) => (
                  <li key={etape.id} className={i < indexEtape ? 'is-done' : i === indexEtape ? (etat === 'resolved' ? 'is-done' : 'is-current') : ''}>
                    <span className="panneau-frise-point" />
                    <div>
                      <p>{etape.label}</p>
                      <small>{detailEtape(etape.id)}</small>
                    </div>
                  </li>
                ))}
              </ol>

              <dl className="panneau-infos">
                {incident.zone && (
                  <>
                    <dt>Commune</dt>
                    <dd>{incident.zone}</dd>
                  </>
                )}
                <dt>Créé le</dt>
                <dd>{dateLongue(incident.created_at) || 'Non spécifié'}</dd>
                <dt>Coordonnées</dt>
                <dd className="panneau-num">{coordonnees}</dd>
                {(organisation || mobile) && (
                  <>
                    <dt>Prise en charge</dt>
                    <dd>{organisation || 'Personne'}</dd>
                  </>
                )}
              </dl>

              {incident.audio && (
                <section>
                  <h3 className="panneau-section">Audio</h3>
                  <audio controls className="w-100">
                    <source src={incident.audio} type="audio/mpeg" />
                    Votre navigateur ne supporte pas l'élément audio.
                  </audio>
                </section>
              )}

              {incident.video && (
                <section>
                  <h3 className="panneau-section">Vidéo</h3>
                  <video controls className="panneau-video">
                    <source src={incident.video} type="video/mp4" />
                    Votre navigateur ne supporte pas la lecture de vidéos.
                  </video>
                </section>
              )}

              {incident.participants?.length > 0 && (
                <section>
                  <h3 className="panneau-section">Organisations mobilisées</h3>
                  <div className="panneau-orgs">
                    {incident.participants.map((p, i) => (
                      <span key={i} className="panneau-org">
                        <span className="panneau-org-avatar" style={{ backgroundColor: p.color }}>{p.initials}</span>
                        {p.name}
                      </span>
                    ))}
                    {incident.extraParticipants > 0 && (
                      <span className="panneau-org">
                        <span className="panneau-org-avatar" style={{ backgroundColor: 'var(--color-text-muted)' }}>
                          +{incident.extraParticipants}
                        </span>
                        Autres organisations
                      </span>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {pret && (
          <footer className="panneau-actions">
            {mobile && (
              <button type="button" className="bulle-btn" onClick={onOuvrirFiche}>
                Fiche complète
              </button>
            )}
            <button type="button" className="bulle-btn bulle-btn-primaire" onClick={onOuvrirFiche}>
              {action}
            </button>
            {!mobile && (
              <button type="button" className="bulle-btn" onClick={onOuvrirFiche}>
                Voir la fiche complète
              </button>
            )}
          </footer>
        )}
      </aside>
    </>
  );
};

export default PanneauDetail;
