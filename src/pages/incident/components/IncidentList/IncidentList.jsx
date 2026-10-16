import React, { useState } from 'react';
import { SearchNormal1 } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerTitle, ShimmerText, ShimmerCircularImage } from 'react-shimmer-effects';
import { Eye, Edit2, Trash, Refresh2 } from 'iconsax-react';
import { BlurryImage } from '../../../../components/atoms/BlurryImage';
import { useIncidentModalContext } from '../../modale/IncidentModalContext';
import { authService } from '../../../auth/services/authService';
import { isSuperAdmin as checkSuperAdmin, getAccessibleNavIds } from '../../../../utils/permissions';
import { retryIncidentPredictionService } from '../../service/incident_service';
import { logger } from '../../../../utils/logger';
import Pagination from '../../../../components/molecules/Pagination';
import { ResponsiveTable } from '../../../../components/molecules/ResponsiveTable';
import { FiltersBar } from '../../../../components/molecules/FiltersBar';
import './incident-list.css';

import { TableActionsMenu } from '../../../../components/molecules/TableActionsMenu';
import { BadgeGravite } from '../../../../components/atoms/BadgeGravite';
import { gravite, couleurGravite } from '../../../../utils/gravite';
// Composant shimmer pour le chargement (version table)

export const IncidentList = ({
  incidents = [],
  onSelectIncident,
  selectedId,
  isLoading = false,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  page,
  setPage,
  pageSize,
  count
}) => {
  const { openDeleteModal, openAssignModal } = useIncidentModalContext();
  const user = authService.getCurrentUser();
  const isSuperAdmin = checkSuperAdmin(user);
  // « admin » ici = peut piloter les incidents sans être super_admin.
  const isAdmin = !isSuperAdmin && getAccessibleNavIds(user).includes('incidents');

  const myOrgId = user?.organisation_member;
  const myOrgName = user?.organisation_name || 'Mon Organisation';

  // ── Relance de prédiction IA (super admin uniquement) ─────────────────────
  const [retryingIds, setRetryingIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast({ message, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRetryPrediction = async (incident) => {
    if (retryingIds.has(incident.id)) return;

    setRetryingIds((previous) => new Set(previous).add(incident.id));

    try {
      await retryIncidentPredictionService(incident.id);
      showToast(`Analyse IA relancée pour « ${incident.title || 'cet incident'} ».`);
    } catch (error) {
      logger.error('[IncidentList] Erreur relance prédiction:', error);
      const message =
        error?.error || error?.detail || "Impossible de relancer l'analyse (photo manquante ?).";
      showToast(message);
    } finally {
      setRetryingIds((previous) => {
        const next = new Set(previous);
        next.delete(incident.id);
        return next;
      });
    }
  };

  // Le filtre par statut est desormais applique par le serveur (parametre
  // `etat`), donc sur l'ensemble du jeu de donnees. Le refaire ici ne
  // filtrerait que la page courante tout en laissant la pagination annoncer
  // le total complet — c'est ce qui rendait le filtre menteur.
  const filtered = incidents;

  // Chaque colonne est decrite une fois. ResponsiveTable en fait un <tr> sur
  // grand ecran et une carte sur telephone : le meme `rendu` sert aux deux,
  // donc un badge modifie ne peut pas diverger entre les deux vues.
  const lignes = filtered.map((incident) => {
    const takenOrgId = incident.taken_by_organisation?.id;
    const estMoi = Boolean(myOrgId && takenOrgId && String(takenOrgId) === String(myOrgId));

    return {
      ...incident,
      _takingOrg: (incident.taken_by_organisation || incident.taken_by)
        ? {
          isMe: estMoi,
          name: estMoi ? myOrgName : (incident.taken_by_organisation?.name || incident.taken_by_name || ''),
        }
        : null,
    };
  });

  const colonnes = [
    {
      id: 'signalement', entete: 'Signalement', priorite: 'titre',
      // Sur la carte, le titre se passe de la vignette : la photo est passee
      // en bandeau au-dessus. La description est omise quand elle repete le
      // titre, ce qui est le cas courant dans les donnees.
      renduCarte: (incident) => (
        <>
          <span className="incident-table-title">
            {incident.title || 'Sans titre'}
            {incident.isOwner ? (
              <span className="incident-owner-tag" style={{ marginLeft: '8px', fontSize: 'var(--font-size-micro)', padding: '2px 6px', background: 'var(--color-primary-text)', color: 'white', borderRadius: '4px' }}>Moi</span>
            ) : incident.takenBy ? (
              <span className="incident-owner-tag" style={{ marginLeft: '8px', fontSize: 'var(--font-size-micro)', padding: '2px 6px', background: 'var(--color-text-muted)', color: 'white', borderRadius: '4px' }}>Autre</span>
            ) : null}
          </span>
          {incident.description
            && !incident.description.startsWith(incident.title || '\u0000')
            && <span className="incident-table-subtitle">{incident.description.substring(0, 80)}</span>}
        </>
      ),
      rendu: (incident) => (
                            <div className="incident-table-main-col">
                              <BlurryImage
                                src={incident.thumbnail ||  ""}
                                alt={incident.title}
                                className="incident-table-img"
                              />
                              <div>
                                <span className="incident-table-title">
                                  {incident.title || 'Sans titre'}
                                  {incident.isOwner ? (
                                    <span className="incident-owner-tag" style={{ marginLeft: '8px', fontSize: 'var(--font-size-micro)', padding: '2px 6px', background: 'var(--color-primary-text)', color: 'white', borderRadius: '4px' }}>Moi</span>
                                  ) : incident.takenBy ? (
                                    <span className="incident-owner-tag" style={{ marginLeft: '8px', fontSize: 'var(--font-size-micro)', padding: '2px 6px', background: 'var(--color-text-muted)', color: 'white', borderRadius: '4px' }}>Autre</span>
                                  ) : null}
                                </span>
                                <span className="incident-table-subtitle">{incident.description?.substring(0, 50)}...</span>
                              </div>
                            </div>
      ),
    },
    {
      id: 'localisation', entete: 'Localisation', priorite: 'sousTitre',
      rendu: (incident) => (
        <span className="incident-table-cell-text">
                            {incident.location || 'Inconnue'}
                            {incident.coordinates && (
                              <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                {incident.coordinates.lat.toFixed(3)}, {incident.coordinates.lng.toFixed(3)}
                              </div>
                            )}
        </span>
      ),
    },
    {
      id: 'rapporteur', entete: 'Signalé par', priorite: 'detail',
      rendu: (incident) => (
        <span className="incident-table-cell-text">
          {incident.user_full_name || 'Non spécifié'}
        </span>
      ),
    },
    {
      id: 'periode', entete: 'Période', priorite: 'detail',
      rendu: (incident) => (
                            <div className="incident-periode">
                              {/* Date et fleche dans le meme span : sinon la fleche part
                                  seule a la ligne suivante quand la cellule est etroite. */}
                              <span className="incident-periode-debut">
                                {incident.startDate}
                                <span className="incident-periode-lien" aria-hidden="true">→</span>
                              </span>
                              {incident.endDate === 'En cours' ? (
                                <span className="incident-date-badge is-pending">En cours</span>
                              ) : (
                                <span className="incident-date-badge is-resolved">{incident.endDate}</span>
                              )}
                            </div>
      ),
    },
    {
      id: 'etat', entete: 'État', priorite: 'marquant',
      // .incident-etat est en colonne — un choix fait pour une cellule etroite.
      // Sur une carte de 390px les deux badges tiennent cote a cote.
      renduCarte: (incident) => (
        <>
          {incident.badges?.map((b, idx) => (
            <span key={idx} className={`incident-badge-glow variant-${b.variant}`}>{b.label}</span>
          ))}
          <BadgeGravite incident={incident} />
        </>
      ),
      rendu: (incident) => (
                            <div className="incident-etat">
                              <div className="incident-table-badges">
                                {incident.badges?.map((b, idx) => (
                                  <span key={idx} className={`incident-badge-glow variant-${b.variant}`}>
                                    {b.label}
                                  </span>
                                ))}
                              </div>
                              <div className="incident-table-badges">
                                <BadgeGravite incident={incident} />
                              </div>
                            </div>
      ),
    },
    {
      id: 'prise-en-charge', entete: 'Prise en charge & Collaboration',
      enteteCarte: 'Prise en charge', priorite: 'bloc',
      rendu: (incident) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {incident._takingOrg ? (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
                                      {incident._takingOrg.name}
                                    </span>
                                    {incident._takingOrg.isMe ? (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        background: 'rgba(var(--rgb-success), 0.12)',
                                        color: 'var(--color-success-text)',
                                        border: '1px solid rgba(var(--rgb-success), 0.3)',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: 'var(--font-size-micro)',
                                        fontWeight: '600'
                                      }}>
                                        Moi
                                      </span>
                                    ) : (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        background: 'rgba(var(--rgb-text-secondary), 0.12)',
                                        color: 'var(--color-text-secondary)',
                                        border: '1px solid rgba(var(--rgb-text-secondary), 0.3)',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: 'var(--font-size-micro)',
                                        fontWeight: '600'
                                      }}>
                                        Autre
                                      </span>
                                    )}
                                  </div>
                                  <div style={{
                                    fontSize: 'var(--font-size-caption)',
                                    color: 'var(--color-text-secondary)',
                                    marginTop: '4px',
                                    fontStyle: 'italic',
                                    lineHeight: '1.4'
                                  }}>
                                    {(() => {
                                      const mode = incident.take_in_charge_mode;
                                      const isInternal = mode === 'internal' || mode === 'interne';
                                      const isCollaborative = mode === 'collaborative' || mode === 'collaboratif';
                                      if (isInternal) {
                                        return incident._takingOrg.isMe
                                          ? "Nous travaillons en interne sur cet incident avec nos équipes"
                                          : `${incident._takingOrg.name} travaille déjà en interne sur cet incident avec ses équipes`;
                                      } else if (isCollaborative) {
                                        return incident._takingOrg.isMe
                                          ? "Nous collaborons avec d'autres organisations sur cet incident"
                                          : `${incident._takingOrg.name} collabore avec d'autres organisations sur cet incident`;
                                      } else {
                                        return incident._takingOrg.isMe
                                          ? "Pris en charge par notre organisation"
                                          : `Pris en charge par ${incident._takingOrg.name}`;
                                      }
                                    })()}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-body-small)', fontStyle: 'italic' }}>
                                  Disponible
                                </span>
                              )}

                            </div>
      ),
    },
  ];

  // Le lisere colore du bord gauche de la carte double le badge de gravite,
  // il ne le remplace pas : la couleur seule ne doit jamais porter le sens.
  const accentDe = (incident) =>
    couleurGravite(gravite(incident));

  // Le bandeau de la carte. Sur un signalement environnemental, la photo dit
  // ce qui se passe mieux qu'aucun badge.
  const mediaDe = (incident) => (
    <BlurryImage src={incident.thumbnail || ''} alt={incident.title || 'Photo du signalement'} />
  );

  const actionsDe = (incident) => (
    <div onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <TableActionsMenu
                                ariaLabel={`Actions sur ${incident.title || 'cet incident'}`}
                                actions={[
                                  {
                                    id: 'view',
                                    label: 'Voir le détail',
                                    icon: Eye,
                                    onSelect: () => onSelectIncident && onSelectIncident(incident),
                                  },
                                  (incident.isOwner || incident._takingOrg?.isMe) && {
                                    id: 'assign',
                                    label: 'Assigner à un agent',
                                    icon: Edit2,
                                    onSelect: () => openAssignModal(incident),
                                  },
                                  isSuperAdmin && {
                                    id: 'retry-prediction',
                                    label: retryingIds.has(incident.id)
                                      ? 'Relance en cours…'
                                      : "Relancer l'analyse IA",
                                    icon: Refresh2,
                                    disabled: retryingIds.has(incident.id),
                                    onSelect: () => handleRetryPrediction(incident),
                                  },
                                  !isAdmin && {
                                    id: 'delete',
                                    label: "Supprimer l'incident",
                                    icon: Trash,
                                    tone: 'danger',
                                    onSelect: () => openDeleteModal(incident),
                                  },
                                ].filter(Boolean)}
                              />
                            </div>
    </div>
  );

  return (
    <section className="project-list-section">
      {/* Header */}
      <header className="project-list-header">
        <h1 className="project-list-title">Signalements</h1>
        <p className="project-list-subtitle">
          Rejoignez des initiatives environnementales en cours ou proposez votre
          expertise pour soutenir les communautés locales.
        </p>
      </header>

      <div className="project-filtres-zone">
        <FiltersBar
          recherche={search}
          onRecherche={setSearch}
          placeholder="Rechercher un signalement, une commune…"
          selects={[{
            id: 'statut',
            valeur: statusFilter,
            onChange: setStatusFilter,
            ariaLabel: 'Filtrer par statut',
            tousLabel: 'Tous les statuts',
            options: [
              { value: 'declared', label: 'Déclaré' },
              { value: 'taken_into_account', label: 'Pris en compte' },
              { value: 'resolved', label: 'Résolu' },
            ],
          }]}
          onEffacer={() => { setSearch(''); setStatusFilter(''); }}
          resultats={count}
          nomResultat="signalement"
        />
      </div>

      {/* Table */}
      <div style={{ padding: '0 var(--spacing-5) var(--spacing-5)' }}>
        {!isLoading && filtered.length === 0 ? (
          <div className='d-flex flex-column align-items-center'>
            <div className='mb-2'>
              <SearchNormal1 size={48} variant="Linear" color="var(--color-text-muted)" />
            </div>
            <p>Aucun signalement ne correspond à vos critères.</p>
          </div>
        ) : (
          <ResponsiveTable
            colonnes={colonnes}
            donnees={lignes}
            cleDe={(i) => i.id}
            actions={actionsDe}
            media={mediaDe}
            accentDe={accentDe}
            chargement={isLoading}
            onLigneClick={onSelectIncident}
            classeLigne={(i) => (i.id === selectedId ? 'is-selected' : '')}
            libelleListe="Signalements"
          />
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          count={count}
          onChange={setPage}
        />
      </div>

      {toast && (
        <div className="incident-list-toast" role="status">
          {toast.message}
        </div>
      )}
    </section>
  );
};

export default IncidentList;
