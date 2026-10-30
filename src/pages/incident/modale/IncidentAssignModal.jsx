import React, { useState, useMemo, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { CloseCircle, TickCircle, SearchNormal1, UserTick, Profile } from 'iconsax-react';
import { useIncidentModalContext } from './IncidentModalContext';
import { assignIncidentToAgentService, getIncidentAssignmentsService } from '../service/incident_service';
import { getOrganisationMembersService } from '../../agents/service/members_service';
import { authService } from '../../auth/services/authService';

import { OffcanvasModal } from '../../../components/molecules/OffcanvasModal';
import { AVATAR_COLORS, AVATAR_COULEUR_DEFAUT } from '../../../utils/couleursAvatar';
import { logger } from '../../../utils/logger';
import { useEstTelephone } from '../mobile/useEstTelephone';
import '../mobile/mobile.css';

const ROLE_MOBILE = { Terrain: 'Agent de terrain', Bureau: 'Agent de bureau' };

// `fetchedAgents || []` fabriquait un tableau neuf a chaque rendu tant que la
// requete n'avait pas repondu. Les useMemo qui en dependent ne memoisaient donc
// jamais rien. Une constante partagee garde la meme reference d'un rendu a
// l'autre. Meme procede que dans Agents.jsx.
const EMPTY_ARRAY = [];
const schema = yup.object().shape({
  agent: yup.string().required('Veuillez sélectionner un agent.'),
  deadline: yup.string().nullable().optional()
});

const getInitials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

const formatDatetimeLocal = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return '';
  }
};

export const IncidentAssignModal = () => {
  const {
    assignModal,
    assignClosing,
    isAssigning,
    setIsAssigning,
    assignAlert,
    setAssignAlert,
    closeAssignModal,
    mutateIncidents
  } = useIncidentModalContext();

  const estTelephone = useEstTelephone();
  const [searchQuery, setSearchQuery] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    if (assignAlert && assignAlert.message && bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [assignAlert]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
    setError
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      agent: '',
      deadline: ''
    }
  });

  const selectedAgentId = watch('agent');
  const deadline = watch('deadline');

  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const userOrgId = currentUser?.organisation || currentUser?.organisation_member || sessionStorage.getItem('organisation');
  const userOrgName = currentUser?.organisation_name || 'Mon Organisation';

  // Charger les agents de l'organisation de l'utilisateur connecté
  const { data: fetchedAgents, isLoading: loadingAgents, mutate: mutateAgents } = useSWR(
    assignModal.open && userOrgId ? ['assign_agents_list', userOrgId] : null,
    async () => {
      if (!userOrgId) return [];
      try {
        const res = await getOrganisationMembersService(userOrgId);
        const members = res.results || res || [];
        return members.map((m) => {
          let roleLabel = 'Membre';
          if (m.org_role === 'org_admin') roleLabel = 'Administrateur';
          if (m.org_role === 'field_agent') roleLabel = 'Terrain';
          if (m.org_role === 'bureau_agent') roleLabel = 'Bureau';

          const fullName = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;

          return {
            id: m.id,
            firstName: m.first_name || '',
            lastName: m.last_name || '',
            fullName,
            email: m.email,
            role: roleLabel,
            orgId: userOrgId,
            orgName: userOrgName,
            avatarColor: AVATAR_COLORS[Math.abs(m.id) % AVATAR_COLORS.length] || AVATAR_COULEUR_DEFAUT
          };
        });
      } catch (err) {
        logger.error(`[IncidentAssignModal] Erreur chargement agents org ${userOrgId}:`, err);
        return [];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false
    }
  );

  const agents = fetchedAgents || EMPTY_ARRAY;

  // 3. Charger les assignations existantes de cet incident
  const { data: existingAssignments, mutate: mutateAssignments } = useSWR(
    assignModal.open && assignModal.incident ? `incident_assignments_${assignModal.incident.id}` : null,
    () => getIncidentAssignmentsService(assignModal.incident.id),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false
    }
  );

  const assignedAgentIds = useMemo(() => {
    const list = existingAssignments || [];
    return list.map((a) => {
      if (a.agent && typeof a.agent === 'object') {
        return a.agent.id;
      }
      return a.agent;
    });
  }, [existingAssignments]);

  const selectedAgent = useMemo(() => {
    return agents.find((a) => String(a.id) === selectedAgentId) || null;
  }, [selectedAgentId, agents]);

  // Initialiser / Pré-sélectionner l'agent déjà assigné et sa date limite
  React.useEffect(() => {
    if (assignModal.open && assignModal.incident) {
      setSearchQuery('');
      setAssignAlert({ type: null, message: null });
      
      // Recharger la liste des agents à chaque ouverture du modal
      if (mutateAgents) {
        mutateAgents();
      }

      const assignedId = assignModal.incident.taken_by || assignModal.incident.takenBy;
      reset({
        agent: assignedId ? String(assignedId) : '',
        deadline: assignModal.incident.deadline ? formatDatetimeLocal(assignModal.incident.deadline) : ''
      });
    }
  }, [assignModal.open, assignModal.incident, reset, mutateAgents, setAssignAlert]);

  const handleSelectAgent = (agent) => {
    if (selectedAgentId === String(agent.id)) {
      setValue('agent', '', { shouldValidate: true });
      setValue('deadline', '');
    } else {
      setValue('agent', String(agent.id), { shouldValidate: true });
    }
  };

  // Filtrer les agents selon la recherche
  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.orgName.toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  if (!assignModal.open || !assignModal.incident) return null;

  const onSubmit = async (data) => {
    setIsAssigning(true);
    setAssignAlert({ type: null, message: null });

    const incident = assignModal.incident;
    const agentObj = agents.find((a) => String(a.id) === data.agent);

    const payload = {
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      status: 'pending',
      incident: incident.id,
      agent: data.agent
    };

    try {
      await assignIncidentToAgentService(incident.id, payload);

      setAssignAlert({
        type: 'success',
        message: `L'incident a été assigné avec succès à ${agentObj?.fullName || 'l\'agent'}.`
      });

      // Rafraîchir les données de la table
      if (mutateIncidents) {
        await mutateIncidents();
      }
      mutateAssignments();

      // Fermer la modale après un délai
      setTimeout(() => {
        closeAssignModal();
        setSearchQuery('');
        reset({
          agent: '',
          deadline: ''
        });
      }, 1500);
    } catch (err) {
      logger.error('[IncidentAssignModal] Erreur lors de l\'assignation:', err);

      if (err?.response?.status === 400 && err?.response?.data) {
        const serverErrors = err.response.data;

        // Gérer les erreurs globales (ex: non_field_errors)
        if (serverErrors.non_field_errors) {
          const errorsList = Array.isArray(serverErrors.non_field_errors)
            ? serverErrors.non_field_errors[0]
            : serverErrors.non_field_errors;
          setAssignAlert({
            type: 'danger',
            message: errorsList
          });
          return;
        }

        let hasFieldErrors = false;
        Object.keys(serverErrors).forEach((key) => {
          if (['deadline', 'agent', 'status', 'incident'].includes(key)) {
            const messages = serverErrors[key];
            const message = Array.isArray(messages) ? messages[0] : messages;
            setError(key, { type: 'server', message });
            hasFieldErrors = true;
          }
        });

        if (hasFieldErrors) {
          setAssignAlert({
            type: 'danger',
            message: "Veuillez corriger les erreurs de validation ci-dessous."
          });
          return;
        }
      }

      let msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message;

      if (!msg && err?.response?.data) {
        const data = err.response.data;
        if (typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          if (firstKey) {
            const val = data[firstKey];
            msg = Array.isArray(val) ? val[0] : String(val);
          }
        }
      }

      if (!msg) {
        msg = "Une erreur est survenue lors de l'assignation de l'incident.";
      }

      setAssignAlert({
        type: 'danger',
        message: msg
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOverlayClick = () => {
    if (isAssigning || assignAlert.type === 'success') return;
    closeAssignModal();
    setSearchQuery('');
    reset({
      agent: '',
      deadline: ''
    });
  };

  const groupes = Object.entries(
    filteredAgents.reduce((acc, curr) => {
      if (!acc[curr.orgName]) acc[curr.orgName] = [];
      acc[curr.orgName].push(curr);
      return acc;
    }, {})
  );

  if (estTelephone) {
    return (
      <OffcanvasModal
        onClose={handleOverlayClick}
        isClosing={Boolean(assignClosing)}
        className="feuille-haute"
        title="Assigner un agent"
        subtitle={assignModal.incident.title || 'Sans titre'}
        closeVariant="plain"
      >
        <form onSubmit={handleSubmit(onSubmit)} id="assign-incident-form" className="am-offcanvas-body" ref={bodyRef} noValidate>
          {assignAlert && assignAlert.message && (
            <div className={`am-alert am-alert--${assignAlert.type === 'success' ? 'success' : 'danger'}`} role="alert" style={{ marginBottom: 'var(--spacing-4)' }}>
              <span className="am-alert__message" style={{ margin: 0 }}>{assignAlert.message}</span>
            </div>
          )}

          <label className="sgm-rech">
            <SearchNormal1 size={17} color="currentColor" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, e-mail ou organisation"
              aria-label="Rechercher un collaborateur"
            />
          </label>

          {loadingAgents && !agents.length ? (
            <p className="sgm-vide">Chargement des agents...</p>
          ) : groupes.length === 0 ? (
            <p className="sgm-vide">Aucun agent trouvé</p>
          ) : groupes.map(([orgName, orgAgents]) => (
            <section key={orgName} aria-label={orgName}>
              <h3 className="sgm-groupe-titre">{orgName}</h3>
              <ul className="sgm-agents" role="radiogroup" aria-label={`Agents de ${orgName}`}>
                {orgAgents.map((agent) => {
                  const isAlreadyAssigned = assignedAgentIds.includes(agent.id);
                  return (
                    <li key={agent.id}>
                      <label className="sgm-agent">
                        <span className="sgm-agent-av" style={{ backgroundColor: agent.avatarColor }}>{getInitials(agent.fullName)}</span>
                        <span className="sgm-agent-t">
                          <b>{agent.fullName}</b>
                          <span>{ROLE_MOBILE[agent.role] || agent.role} • {agent.email}</span>
                        </span>
                        {isAlreadyAssigned && <span className="sgm-agent-pris">Assigné</span>}
                        <input
                          type="radio"
                          name="agent-mobile"
                          checked={selectedAgent?.id === agent.id}
                          disabled={isAlreadyAssigned}
                          onChange={() => setValue('agent', String(agent.id), { shouldValidate: true })}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <label className="sgm-date">
            <span>Date limite</span>
            <input type="date" {...register('deadline')} />
          </label>
          {errors.deadline && <span className="text-danger" style={{ fontSize: 'var(--font-size-caption)' }}>{errors.deadline.message}</span>}
        </form>

        <div className="am-offcanvas-footer">
          <button
            type="button"
            className="am-btn am-btn--secondary"
            onClick={handleOverlayClick}
            disabled={isAssigning || assignAlert.type === 'success'}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="assign-incident-form"
            className="am-btn am-btn--primary"
            disabled={!selectedAgent || !deadline || isAssigning || assignAlert.type === 'success'}
          >
            {isAssigning && <span className="am-spinner" aria-hidden="true" />}
            {isAssigning ? 'Assignation...' : selectedAgent ? `Assigner ${selectedAgent.fullName}` : 'Assigner'}
          </button>
        </div>
      </OffcanvasModal>
    );
  }

  return (
    <OffcanvasModal
      onClose={handleOverlayClick}
      isClosing={Boolean(assignClosing)}
      title="Assigner un agent"
      subtitle={assignModal.incident.title || 'Sans titre'}
      ariaLabel="Assigner un agent"
      closeVariant="plain"
    >

        <form onSubmit={handleSubmit(onSubmit)} id="assign-incident-form" className="am-offcanvas-body" ref={bodyRef} noValidate>
          {assignAlert && assignAlert.message && (
            <div className={`am-alert am-alert--${assignAlert.type === 'success' ? 'success' : 'danger'}`} role="alert" style={{ marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {assignAlert.type === 'success' ? (
                <TickCircle size={18} variant="Bold" color="var(--color-success)" style={{ flexShrink: 0 }} />
              ) : (
                <CloseCircle size={18} variant="Bold" color="var(--color-danger)" style={{ flexShrink: 0 }} />
              )}
              <span className="am-alert__message" style={{ margin: 0 }}>{assignAlert.message}</span>
            </div>
          )}


          {/* Barre de recherche d'agent */}
          <div className="am-field">
            <label className="am-label" htmlFor="agent-search">
              Rechercher un collaborateur
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <SearchNormal1
                size={16}
                variant="Linear"
                color="var(--color-text-secondary)"
                style={{ position: 'absolute', left: '12px' }}
              />
              <input
                id="agent-search"
                type="text"
                className="am-input"
                placeholder="Tapez le nom, email ou organisation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          {/* Liste de sélection des agents */}
          <div className="am-field">
            <label className="am-label">
              Sélectionner l'agent à assigner
            </label>

            {loadingAgents ? (
              <div className="d-flex flex-column align-items-center justify-content-center p-4 border rounded bg-light">
                <div className="spinner-border text-primary" role="status" style={{ width: '1.5rem', height: '1.5rem' }} />
                <span className="text-muted mt-2" style={{ fontSize: 'var(--font-size-caption)' }}>Chargement des agents...</span>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="d-flex flex-column align-items-center justify-content-center p-4 border rounded bg-light text-center">
                <Profile size={32} variant="Linear" color="var(--color-text-muted)" />
                <span className="fw-medium mt-2" style={{ fontSize: 'var(--font-size-body-small)', color: 'var(--color-text-secondary)' }}>Aucun agent trouvé</span>
                <span className="text-muted" style={{ fontSize: 'var(--font-size-micro)' }}>Assurez-vous que des agents sont enregistrés.</span>
              </div>
            ) : (
              <div className="incidents-agents-list">
                {groupes.map(([orgName, orgAgents]) => (
                  <div key={orgName} className="incidents-org-group">
                    <div className="incidents-org-name">{orgName}</div>
                    {orgAgents.map((agent) => {
                      const isSelected = selectedAgent?.id === agent.id;
                      const isAlreadyAssigned = assignedAgentIds.includes(agent.id);
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          className={`incidents-agent-item ${isSelected ? 'is-selected' : ''} ${isAlreadyAssigned ? 'is-disabled' : ''}`}
                          onClick={() => !isAlreadyAssigned && handleSelectAgent(agent)}
                          disabled={isAlreadyAssigned}
                        >
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: isAlreadyAssigned ? 'var(--color-text-muted)' : agent.avatarColor,
                              color: 'var(--color-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '600',
                              fontSize: 'var(--font-size-body-small)',
                              marginRight: '12px',
                              flexShrink: 0
                            }}
                          >
                            {getInitials(agent.fullName)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--font-size-body)', fontWeight: '600', color: isAlreadyAssigned ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {agent.fullName}
                              {isAlreadyAssigned && (
                                <span style={{ marginLeft: '8px', fontSize: 'var(--font-size-micro)', padding: '2px 8px', background: 'var(--color-background)', color: 'var(--color-text-secondary)', borderRadius: '12px', border: '1px solid var(--color-border)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  ✓ Assigné
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-caption)', color: isAlreadyAssigned ? 'var(--color-text-muted)' : 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {agent.role} &bull; {agent.email}
                            </div>
                          </div>
                          {isAlreadyAssigned ? (
                            <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-text-secondary)', fontWeight: 'bold', marginLeft: 'auto', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--color-border)', padding: '4px 8px', borderRadius: '4px' }}>
                              En service
                            </span>
                          ) : isSelected && (
                            <UserTick
                              size={18}
                              variant="Bold"
                              color="var(--color-primary-text)"
                              style={{ marginLeft: '12px', flexShrink: 0 }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            {errors.agent && (
              <span className="text-danger" style={{ display: 'block', marginTop: '6px', fontSize: 'var(--font-size-caption)' }}>
                {errors.agent.message}
              </span>
            )}
          </div>

          {/* Date limite / Deadline */}
          {selectedAgent && (
            <div className="am-field animate-fade-in" style={{ marginTop: 'var(--spacing-4)' }}>
              <label className="am-label" htmlFor="assign-deadline">
                Date limite (Deadline)
              </label>
              <input
                id="assign-deadline"
                type="date"
                className="am-input"
                {...register('deadline')}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-primary)'
                }}
              />
              {errors.deadline && (
                <span className="text-danger" style={{ display: 'block', marginTop: '6px', fontSize: 'var(--font-size-caption)' }}>
                  {errors.deadline.message}
                </span>
              )}


            </div>


          )}
        </form>

        <div className="am-offcanvas-footer">
          <button
            type="button"
            className="am-btn am-btn--secondary"
            onClick={handleOverlayClick}
            disabled={isAssigning || assignAlert.type === 'success'}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="assign-incident-form"
            className="am-btn am-btn--primary"
            disabled={!selectedAgent || !deadline || isAssigning || assignAlert.type === 'success'}
          >
            {isAssigning && <span className="am-spinner" aria-hidden="true" />}
            {isAssigning ? 'Assignation...' : 'Assigner l\'agent'}
          </button>
        </div>
      </OffcanvasModal>
  );
};

export default IncidentAssignModal;
