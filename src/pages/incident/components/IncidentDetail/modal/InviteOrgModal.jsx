import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { titreIncident } from '../../../../../utils/titreIncident';
import useSWRInfinite from 'swr/infinite';
import debounce from 'lodash.debounce';
import { useIncidentDetail } from '../IncidentDetailContext';
import {
  CloseCircle,
  SearchNormal1,
  Add,
  People,
  Buildings2,
  EyeSlash
} from 'iconsax-react';
import { getOtherOrganisationsService } from '../../../../collaboration-detail/service/collab_detail_service';

import { OffcanvasModal } from '../../../../../components/molecules/OffcanvasModal';
import { AVATAR_COULEUR_DEFAUT } from '../../../../../utils/couleursAvatar';
import { useEstTelephone } from '../../../mobile/useEstTelephone';
import '../../../mobile/mobile.css';
export const InviteOrgModal = () => {
  const estTelephone = useEstTelephone();
  const {
    joinOpen,
    joinClosing,
    closeJoinModal,
    safeIncident,
    handleJoinSubmit,
    alertMessage,
    alertType,
    setAlertMessage,
    motif,
    setMotif,
    selfRole,
    setSelfRole,
    orgSearch,
    setOrgSearch,
    showOrgDropdown,
    setShowOrgDropdown,
    addInvitedOrg,
    invitedOrgs,
    removeInvitedOrg,
    updateOrgRole,
    updateOrgComment,
    isSubmitting,
    ROLE_OPTIONS,
    ORG_ROLE_OPTIONS,

    setIsInvolvePrivate,
    workMode,
    setWorkMode,
    hasAcceptedRole
  } = useIncidentDetail();

  const searchWrapperRef = useRef(null);
  const pageSize = 10;
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce de la recherche
  const debouncedSetSearch = useMemo(
    () => debounce((value) => {
      setDebouncedSearch(value);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSetSearch(orgSearch);
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [orgSearch, debouncedSetSearch]);

  // Récupération paginée avec useSWRInfinite.
  //
  // La clé vaut null tant que la modale est fermée, ce qui suspend toute
  // requête. C'est indispensable : le `return null` plus bas n'empêche pas les
  // hooks de s'exécuter, si bien que la liste complète des organisations était
  // chargée page par page — trois requêtes en cascade, jusqu'à 1,5 s — à chaque
  // ouverture d'un signalement, pour une modale souvent jamais ouverte.
  const getKey = useCallback(
    (pageIndex, previousPageData) => {
      if (!joinOpen) return null;
      if (previousPageData && !previousPageData.next) return null;
      return ['other-organisations-invite', debouncedSearch, pageIndex + 1];
    },
    [joinOpen, debouncedSearch]
  );

  const fetcher = useCallback(([, search, pageNumber]) => {
    const params = { page: pageNumber, page_size: pageSize };
    if (search.trim()) {
      params.search = search.trim();
    }
    return getOtherOrganisationsService(params);
  }, []);

  const {
    data: pages,
    error: orgsError,
    size,
    setSize,
    isLoading: orgsLoading,
    isValidating
  } = useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus: false,
    revalidateFirstPage: false,
    keepPreviousData: true
  });

  // Réinitialise la pagination lors d'une nouvelle recherche
  useEffect(() => {
    setSize(1);
  }, [debouncedSearch, setSize]);

  // Aplatit toutes les pages en une seule liste
  const organisations = useMemo(() => {
    if (!pages) return [];
    const seen = new Set();
    const flat = [];
    for (const pg of pages) {
      for (const org of pg?.results ?? []) {
        if (!seen.has(org.id)) {
          seen.add(org.id);
          flat.push(org);
        }
      }
    }
    return flat;
  }, [pages]);

  const lastPage = pages?.[pages.length - 1];
  const hasMore = Boolean(lastPage?.next);
  const isInitialLoading = orgsLoading && !pages;
  const isLoadingMore =
    orgsLoading || (size > 0 && pages && typeof pages[size - 1] === 'undefined');

  const loadMore = useCallback(() => {
    if (hasMore && !isValidating) {
      setSize((prev) => prev + 1);
    }
  }, [hasMore, isValidating, setSize]);

  // Sélection d'une organisation : on l'ajoute, on vide la recherche et on referme
  const handleSelectOrg = (org) => {
    addInvitedOrg(org);
    setOrgSearch('');
    setShowOrgDropdown(false);
  };

  // Ferme la liste lors d'un clic en dehors
  useEffect(() => {
    if (!showOrgDropdown) return;
    const handlePointerDown = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowOrgDropdown(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showOrgDropdown, setShowOrgDropdown]);

  const getOrgInitials = (org) => {
    if (org.acronym) return org.acronym.substring(0, 2).toUpperCase();
    return org.name ? org.name.substring(0, 2).toUpperCase() : 'OR';
  };

  const getOrgColor = (org) => {
    return org.primary_color || AVATAR_COULEUR_DEFAUT;
  };

  const selectableOrgs = organisations.filter(
    (o) => !invitedOrgs.find((inv) => inv.id === o.id)
  );

  if (!joinOpen) return null;

  return (
    <OffcanvasModal
      onClose={closeJoinModal}
      isClosing={Boolean(joinClosing)}
      className="vd-agir feuille-haute"
      title={safeIncident.isOwner || hasAcceptedRole ? 'Inviter des organisations' : safeIncident?.etat === 'declared' ? 'Agir sur ce signalement' : "Rejoindre l'action"}
      subtitle={titreIncident(safeIncident)}
      ariaLabel={safeIncident.isOwner || hasAcceptedRole ? 'Inviter des organisations' : safeIncident?.etat === 'declared' ? 'Agir sur ce signalement' : "Rejoindre l'action"}
      closeVariant="plain"
    >

        <form onSubmit={handleJoinSubmit} id="invite-org-form" className="am-offcanvas-body" noValidate>


          {!safeIncident.isOwner && !hasAcceptedRole && (
            <>
              {/* Choix du mode de travail si l'incident n'est pas encore pris en charge (déclaré) ou s'il a déjà un mode de prise en charge */}
              {(safeIncident?.etat === 'declared' || safeIncident?.take_in_charge_mode) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-5)' }}>
                  <label className="join-modal-label">
                    Mode de travail <span className="required">*</span>
                  </label>
                  <p className="join-modal-help">
                    Choisissez comment vous souhaitez être impliquer dans cet incident.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
                    <button
                      type="button"
                      disabled={!!safeIncident?.take_in_charge_mode}
                      className={`work-mode-option ${workMode === 'interne' ? 'is-selected' : ''}`}
                      onClick={() => {
                        setWorkMode('interne');
                        setSelfRole('leader');
                        setIsInvolvePrivate(true);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 'var(--spacing-4)',
                        backgroundColor: workMode === 'interne' ? 'rgba(var(--rgb-primary), 0.08)' : 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: workMode === 'interne' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        cursor: safeIncident?.take_in_charge_mode ? 'not-allowed' : 'pointer',
                        opacity: safeIncident?.take_in_charge_mode ? 0.5 : 1,
                        pointerEvents: safeIncident?.take_in_charge_mode ? 'none' : 'auto',
                        transition: 'all 0.2s ease',
                        gap: '8px',
                        minHeight: '100px'
                      }}
                    >
                      <EyeSlash size={24} variant={workMode === 'interne' ? "Bold" : "Linear"} color={workMode === 'interne' ? "var(--color-primary)" : "var(--color-text-secondary)"} />
                      <div style={{
                        fontSize: 'var(--font-size-body)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: workMode === 'interne' ? 'var(--color-primary)' : 'var(--color-text-primary)'
                      }}>
                        Agir en interne
                      </div>
                      <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>
                        Je vais le gérer avec mes équipes en interne simplement
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`work-mode-option ${workMode === 'collaboration' ? 'is-selected' : ''}`}
                      onClick={() => {
                        setWorkMode('collaboration');
                        if (selfRole !== 'leader' && selfRole !== 'contributeur' && selfRole !== 'observateur') {
                          setSelfRole('leader');
                        }
                        setIsInvolvePrivate(false);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 'var(--spacing-4)',
                        backgroundColor: workMode === 'collaboration' ? 'rgba(var(--rgb-primary), 0.08)' : 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: workMode === 'collaboration' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        gap: '8px',
                        minHeight: '100px'
                      }}
                    >
                      <People size={24} variant={workMode === 'collaboration' ? "Bold" : "Linear"} color={workMode === 'collaboration' ? "var(--color-primary)" : "var(--color-text-secondary)"} />
                      <div style={{
                        fontSize: 'var(--font-size-body)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: workMode === 'collaboration' ? 'var(--color-primary)' : 'var(--color-text-primary)'
                      }}>
                        Travailler en collaboration
                      </div>
                      <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>
                        Public et visible par tous
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Sélecteur de rôle pour soi-même - MASQUÉ si travail en interne */}
              {(safeIncident?.etat !== 'declared' || workMode === 'collaboration') && (
                <div className="self-role-section" style={{ marginBottom: 'var(--spacing-5)' }}>
                  <label className="join-modal-label">
                    Rôle souhaité <span className="required">*</span>
                  </label>
                  <p className="join-modal-help">
                    Choisissez le rôle que vous souhaitez avoir dans ce projet.
                  </p>
                  <div className="role-options">
                    {/* Le rôle leader n'est disponible que si l'incident est déclaré et non pris en charge en interne */}
                    {ROLE_OPTIONS.filter((role) => {
                      const isInternal = safeIncident?.take_in_charge_mode === 'internal' || safeIncident?.take_in_charge_mode === 'interne';
                      if (isInternal) {
                        return role.id !== 'leader';
                      }
                      return safeIncident?.etat === 'declared' || role.id !== 'leader';
                    }).map((role) => {
                      const RoleIcon = role.icon;
                      const isSelected = selfRole === role.id;
                      return (
                        <button
                          type="button"
                          key={role.id}
                          className={`role-option ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelfRole(role.id)}
                          style={isSelected ? { borderColor: role.color, color: role.color } : {}}
                          title={role.description}
                        >
                          <RoleIcon
                            size={14}
                            variant={isSelected ? 'Bold' : 'Linear'}
                            color={isSelected ? role.color : 'var(--color-text-secondary)'}
                          />
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const role = ROLE_OPTIONS.find((r) => r.id === selfRole);
                    return role ? (
                      <p className="invited-org-role-desc" style={{ marginTop: '8px' }}>
                        {role.description}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Si l'incident est en cours de prise en charge et qu'on travaille en interne */}
              {safeIncident?.etat === 'declared' && workMode === 'interne' && (
                <div className="vd-agir-note" style={{
                  padding: 'var(--spacing-5)',
                  backgroundColor: 'rgba(var(--rgb-primary), 0.08)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(var(--rgb-primary), 0.2)',
                  marginBottom: 'var(--spacing-5)'
                }}>
                  <p style={{ margin: 0, color: 'var(--color-primary-text)', fontSize: 'var(--font-size-body)', lineHeight: '1.6' }}>
                    <strong>Agir en interne</strong><br />
                    Vous allez prendre en charge cet incident en interne. Vous le gérerez avec vos propres équipes simplement sans qu'il ne devienne privé.
                  </p>
                </div>
              )}

              {/* Si l'incident est en cours de prise en charge, qu'on travaille en collaboration et qu'on a choisi d'être leader */}
              {safeIncident?.etat === 'declared' && workMode === 'collaboration' && selfRole === 'leader' && (
                <div className="vd-agir-note" style={{
                  padding: 'var(--spacing-5)',
                  backgroundColor: 'var(--color-background)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  marginBottom: 'var(--spacing-5)'
                }}>
                  <p style={{ margin: 0, color: 'var(--color-info-text)', fontSize: 'var(--font-size-body)', lineHeight: '1.6' }}>
                    <strong>Prendre en compte en collaboration (Public)</strong><br />
                    En confirmant, vous deviendrez le <strong>leader</strong> de cet incident public. Vous serez responsable de sa coordination et de la collaboration avec les autres organisations partenaires.
                  </p>
                </div>
              )}

              {/* Saisie du motif - uniquement requise pour le rôle contributeur */}
              {selfRole === 'contributeur' && (
                <>
                  <label htmlFor="join-motif" className="join-modal-label">
                    Motif <span className="required">*</span>
                  </label>
                  <p className="join-modal-help">
                    Expliquez pourquoi vous souhaitez rejoindre ce projet en tant que contributeur et ce
                    que vous pouvez apporter.
                  </p>
                  <textarea
                    id="join-motif"
                    className="join-modal-textarea"
                    rows={6}
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="Ex : Je souhaite contribuer en apportant notre expertise de terrain..."
                    required
                  />
                </>
              )}
              {alertMessage && (
                <div className={`am-alert am-alert--${alertType === 'success' ? 'success' : 'danger'}`} role="alert" style={{ marginBottom: 'var(--spacing-4)' }}>
                  <span className="am-alert__message">{alertMessage}</span>
                  <button
                    type="button"
                    className="am-alert__close"
                    onClick={() => setAlertMessage(null)}
                    aria-label="Close"
                  >×</button>
                </div>
              )}
            </>
          )}

          {/* Section Inviter des organisations - pour le propriétaire ou les contributeurs acceptés */}
          {(safeIncident.isOwner || hasAcceptedRole || (safeIncident?.etat === 'declared' && workMode === 'collaboration' && selfRole === 'leader')) && (
            <div className={`invite-orgs-section ${safeIncident.isOwner ? 'is-owner' : ''}`}>
              <div className="invite-orgs-header">
                <div>
                  <label className="join-modal-label">
                    Inviter des organisations
                    {!(safeIncident.isOwner || hasAcceptedRole) && <span className="join-modal-optional"> (facultatif)</span>}
                  </label>
                  <p className="join-modal-help">
                    Invitez d'autres organisations à participer et attribuez-leur un rôle.
                  </p>
                </div>
              </div>

              {/* Champ recherche */}
              <div className="invite-orgs-search-wrapper" ref={searchWrapperRef}>
                <div className="invite-orgs-search">
                  <SearchNormal1 size={16} variant="Linear" color="var(--color-text-secondary)" />
                  <input
                    type="text"
                    className="invite-orgs-search-input"
                    placeholder="Rechercher une organisation..."
                    value={orgSearch}
                    onChange={(e) => {
                      setOrgSearch(e.target.value);
                      setShowOrgDropdown(true);
                    }}
                    onFocus={() => setShowOrgDropdown(true)}
                  />
                  {orgSearch && (
                    <button
                      type="button"
                      className="invite-orgs-clear"
                      onClick={() => { setOrgSearch(''); setShowOrgDropdown(false); }}
                    >
                      <CloseCircle size={16} variant="Linear" color="var(--color-text-secondary)" />
                    </button>
                  )}
                </div>

                {showOrgDropdown && (
                  <div
                    className="invite-orgs-dropdown"
                    style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                  >
                    {/* Zone scrollable */}
                    <div
                      className="invite-orgs-dropdown-scroll"
                      style={{ overflowY: 'auto', maxHeight: '300px' }}
                    >
                      {isInitialLoading ? (
                        <div className="invite-orgs-empty">
                          Chargement...
                        </div>
                      ) : orgsError ? (
                        <div className="invite-orgs-empty">
                          <Buildings2 size={20} variant="Linear" color="var(--color-danger-text)" />
                          <span>Erreur de chargement</span>
                        </div>
                      ) : selectableOrgs.length === 0 ? (
                        <div className="invite-orgs-empty">
                          <Buildings2 size={20} variant="Linear" color="var(--color-text-muted)" />
                          <span>Aucune organisation disponible</span>
                        </div>
                      ) : (
                        selectableOrgs.map((org) => (
                          <button
                            type="button"
                            key={org.id}
                            className="invite-orgs-option"
                            onClick={() => handleSelectOrg(org)}
                          >
                            <div
                              className="invite-orgs-avatar"
                              style={{ backgroundColor: getOrgColor(org) }}
                            >
                              {getOrgInitials(org)}
                            </div>
                            <span className="invite-orgs-option-name">{org.name}</span>
                            <Add size={18} variant="Linear" color="var(--color-primary)" />
                          </button>
                        ))
                      )}
                    </div>

                    {/* Bouton Afficher plus fixe en bas */}
                    {hasMore && !isInitialLoading && !orgsError && (
                      <div
                        className="invite-orgs-dropdown-footer"
                        style={{
                          flexShrink: 0,
                          borderTop: '1px solid rgba(var(--rgb-ombre), 0.06)',
                          background: 'var(--color-surface)'
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-link"
                          onClick={loadMore}
                          disabled={isLoadingMore}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '10px',
                            margin: 0
                          }}
                          onMouseEnter={(e) => !isLoadingMore && (e.currentTarget.style.backgroundColor = 'rgba(var(--rgb-primary), 0.08)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {isLoadingMore ? (
                            <>
                              <span className="am-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                              Chargement...
                            </>
                          ) : (
                            'Afficher plus'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Liste des organisations invitées */}
              {invitedOrgs.length > 0 && (
                <div className="invite-orgs-list">
                  <div className="invite-orgs-list-label">
                    {invitedOrgs.length} organisation{invitedOrgs.length > 1 ? 's' : ''} invitée{invitedOrgs.length > 1 ? 's' : ''}
                  </div>
                  {invitedOrgs.map((org) => {
                    const currentRole = ROLE_OPTIONS.find((r) => r.id === org.role);
                    return (
                      <div key={org.id} className="invited-org-card">
                        <div className="invited-org-info">
                          <div
                            className="invited-org-avatar"
                            style={{ backgroundColor: org.color || getOrgColor(org) }}
                          >
                            {org.initials || getOrgInitials(org)}
                          </div>
                          <div className="invited-org-name">{org.name}</div>
                          <button
                            type="button"
                            className="invited-org-remove"
                            onClick={() => removeInvitedOrg(org.id)}
                            aria-label="Retirer"
                          >
                            {estTelephone ? 'Retirer' : <CloseCircle size={18} variant="Linear" color="var(--color-danger)" />}
                          </button>
                        </div>

                        <div className="invited-org-roles">
                          <span className="invited-org-role-label">Rôle :</span>
                          <div className="role-options">
                            {ORG_ROLE_OPTIONS.map((role) => {
                              const RoleIcon = role.icon;
                              const isSelected = org.role === role.id;
                              return (
                                <button
                                  type="button"
                                  key={role.id}
                                  className={`role-option ${isSelected ? 'is-selected' : ''}`}
                                  onClick={() => updateOrgRole(org.id, role.id)}
                                  style={isSelected ? { borderColor: role.color, color: role.color } : {}}
                                  title={role.description}
                                >
                                  <RoleIcon
                                    size={14}
                                    variant={isSelected ? 'Bold' : 'Linear'}
                                    color={isSelected ? role.color : 'var(--color-text-secondary)'}
                                  />
                                  {role.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="invited-org-comment" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="invited-org-role-label" style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-secondary)', fontWeight: '500' }}>{estTelephone ? "Motif de l'invitation" : "Motif de l'invitation / Justification :"}</span>
                          {estTelephone ? (
                            <textarea
                              rows={2}
                              className="vdm-motif"
                              aria-label="Motif de l'invitation"
                              value={org.comment || ''}
                              onChange={(e) => updateOrgComment(org.id, e.target.value)}
                            />
                          ) : (
                            <input
                              type="text"
                              className="invite-orgs-search-input"
                              style={{ width: '100%', fontSize: 'var(--font-size-body-small)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
                              placeholder="Ex: Expert en biodiversité pour aider sur la zone A..."
                              value={org.comment || ''}
                              onChange={(e) => updateOrgComment(org.id, e.target.value)}
                            />
                          )}
                        </div>

                        {currentRole && (
                          <p className="invited-org-role-desc">
                            {currentRole.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </form>

        <div className="am-offcanvas-footer">
          <button
            type="button"
            className="am-btn am-btn--secondary"
            onClick={closeJoinModal}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="invite-org-form"
            className="am-btn am-btn--primary"
            disabled={
              isSubmitting ||
              (safeIncident.isOwner || hasAcceptedRole
                ? invitedOrgs.length === 0
                : selfRole === 'contributeur' && !motif.trim())
            }
          >
            {isSubmitting ? (
              <>
                <span className="am-spinner" aria-hidden="true" />
                Envoi en cours...
              </>
            ) : (
              <>
                {safeIncident.isOwner || hasAcceptedRole
                    ? `Envoyer ${invitedOrgs.length > 1 ? `les ${invitedOrgs.length} invitations` : "l'invitation"}`
                    : safeIncident?.etat === 'declared' && workMode === 'interne'
                      ? 'Prendre en charge'
                      : selfRole === 'leader'
                        ? (invitedOrgs.length ? `Lancer et inviter ${invitedOrgs.length} organisation${invitedOrgs.length > 1 ? 's' : ''}` : 'Lancer la collaboration')
                        : 'Demander à être impliqué'
                  }
              </>
            )}
          </button>
        </div>
      </OffcanvasModal>
  );
};

export default InviteOrgModal;
