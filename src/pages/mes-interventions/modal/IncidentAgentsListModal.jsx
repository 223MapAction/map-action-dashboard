import React, { useMemo } from 'react';
import useSWR from 'swr';
import { useMesInterventionsModalContext } from '../mesInterventionsModalContexte';
import { CloseCircle, Profile, Edit2 } from 'iconsax-react';
import { getIncidentAssignmentsService } from '../../incident/service/incident_service';

import { OffcanvasModal } from '../../../components/molecules/OffcanvasModal';
import { AVATAR_COLORS, AVATAR_COULEUR_DEFAUT } from '../../../utils/couleursAvatar';
const getInitials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

const formatDate = (isoString) => {
  if (!isoString) return 'Non spécifiée';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
};

export const IncidentAgentsListModal = () => {
  const {
    agentsModal,
    agentsClosing,
    closeAgentsModal,
    openAssignModal
  } = useMesInterventionsModalContext();

  const currentIncident = agentsModal.incident;

  // Fetch real assignments dynamically using SWR
  const { data: assignmentsData, isLoading } = useSWR(
    agentsModal.open && currentIncident ? `incident_assignments_${currentIncident.id}` : null,
    () => getIncidentAssignmentsService(currentIncident.id),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false
    }
  );

  const assignedAgents = useMemo(() => {
    const list = assignmentsData || [];
    return list.map((a) => {
      const agentId = a.agent || a.id;
      const fullName = a.agent_name || `Agent #${agentId}`;
      const email = a.agent_email || '';
      const phone = a.agent_phone || '';
      const avatarColor = AVATAR_COLORS[Math.abs(agentId) % AVATAR_COLORS.length] || AVATAR_COULEUR_DEFAUT;

      // Find the org metadata and role if the reporter matches the agent ID
      const isReporter = a.incident_detail?.user_id?.id === agentId;
      const roleVal = isReporter ? a.incident_detail?.user_id?.org_role : null;
      let role = 'Terrain';
      if (roleVal === 'org_admin') role = 'Administrateur';
      if (roleVal === 'bureau_agent') role = 'Bureau';
      if (roleVal === 'field_agent') role = 'Terrain';

      const orgName = isReporter ? a.incident_detail?.user_id?.organisation_name : (a.incident_detail?.user_id?.organisation_name || '');

      return {
        id: agentId,
        fullName,
        email,
        phone,
        avatarColor,
        role,
        orgName: orgName || 'Kaicedra Consulting SAS',
        deadline: a.deadline,
        status: a.status,
        assignedByName: a.assigned_by_name,
        assignedByEmail: a.assigned_by_email,
        createdAt: a.created_at
      };
    });
  }, [assignmentsData]);

  if (!agentsModal.open || !currentIncident) return null;

  const handleOverlayClick = () => {
    closeAgentsModal();
  };

  const handleOpenEditModal = () => {
    closeAgentsModal();
    // Ouvrir le modal d'assignation pour ce même incident après la fermeture du premier modal
    setTimeout(() => {
      openAssignModal(currentIncident);
    }, 300);
  };

  return (
    <OffcanvasModal
      onClose={handleOverlayClick}
      isClosing={Boolean(agentsClosing)}
      title="Équipe sur le terrain"
      subtitle={currentIncident.title || 'Sans titre'}
      ariaLabel="Liste des agents assignés"
      closeVariant="plain"
    >

        <div className="am-offcanvas-body">
          {isLoading ? (
            <div className="d-flex flex-column align-items-center justify-content-center p-5 text-center">
              <div className="spinner-border text-primary" role="status" style={{ width: '1.5rem', height: '1.5rem' }} />
              <span className="text-muted mt-2" style={{ fontSize: 'var(--font-size-caption)' }}>Chargement de l'équipe...</span>
            </div>
          ) : assignedAgents.length === 0 ? (
            <div className="d-flex flex-column align-items-center justify-content-center p-5 border rounded bg-light text-center" style={{ gap: '12px' }}>
              <Profile size={48} variant="Linear" color="var(--color-text-muted)" />
              <div>
                <span className="fw-semibold d-block" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)' }}>
                  Aucun agent sur le terrain
                </span>
                <span className="text-muted d-block mt-1" style={{ fontSize: 'var(--font-size-caption)' }}>
                  Aucun collaborateur n'est assigné à cet incident pour le moment.
                </span>
              </div>
              <button
                type="button"
                className="am-btn am-btn--primary mt-2"
                onClick={handleOpenEditModal}
                style={{ minHeight: '38px', fontSize: 'var(--font-size-body-small)' }}
              >
                <Edit2 size={14} variant="Linear" color="var(--color-surface)" />
                Assigner un agent
              </button>
            </div>
          ) : (
            <div className="incidents-agents-list">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: 'var(--font-size-body-small)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                  Collaborateur(s) actif(s) ({assignedAgents.length})
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenEditModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '34px', padding: '0 12px', fontSize: 'var(--font-size-caption)' }}
                >
                  <Edit2 size={14} variant="Linear" color="var(--color-primary)" />
                  Modifier l'équipe
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {assignedAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="incidents-agent-item"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      backgroundColor: 'var(--color-background-card)',
                      gap: '12px'
                    }}
                  >
                    {/* Header: Avatar, Name, Role */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: agent.avatarColor,
                          color: 'var(--color-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '600',
                          fontSize: 'var(--font-size-body-large)',
                          marginRight: '12px',
                          flexShrink: 0
                        }}
                      >
                        {getInitials(agent.fullName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: '600', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {agent.fullName}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {agent.role} &bull; {agent.orgName}
                        </div>
                      </div>
                      {agent.status && (
                        <span className={`mes-interventions-badge-glow variant-${agent.status === 'resolved' ? 'resolved' : (agent.status === 'pending' || agent.status === 'reported' ? 'taken' : 'declared')}`} style={{ fontSize: 'var(--font-size-micro)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {agent.status === 'reported' ? 'Reporté' : agent.status === 'pending' ? 'En cours' : agent.status}
                        </span>
                      )}
                    </div>

                    {/* Details: Contact, Deadline, Assigned by */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--color-border)', paddingTop: '10px', fontSize: 'var(--font-size-caption)', color: 'var(--color-text-secondary)' }}>
                      {agent.email && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Email :</span>
                          <span style={{ fontWeight: '500' }}>{agent.email}</span>
                        </div>
                      )}
                      {agent.phone && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Téléphone :</span>
                          <span style={{ fontWeight: '500' }}>{agent.phone}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Date limite :</span>
                        <span style={{ fontWeight: '600', color: 'var(--color-danger-text)' }}>{formatDate(agent.deadline)}</span>
                      </div>
                      {(agent.assignedByName || agent.assignedByEmail) && (
                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px', padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--color-background-hover)', fontSize: 'var(--font-size-micro)' }}>
                          <span style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>Assigné par :</span>
                          <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                            {agent.assignedByName} {agent.assignedByEmail && `(${agent.assignedByEmail})`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="am-offcanvas-footer">
          <button
            type="button"
            className="am-btn am-btn--secondary w-full"
            onClick={handleOverlayClick}
          >
            Fermer
          </button>
        </div>
      </OffcanvasModal>
  );
};

export default IncidentAgentsListModal;
